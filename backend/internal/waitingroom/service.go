package waitingroom

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

const (
	queueKeyPrefix    = "wr:queue:"
	admittedKeyPrefix = "wr:admitted:"
	tokenKeyPrefix    = "wr:token:"
	admitRatePerMin   = 30
	tokenTTL          = 30 * time.Minute
)

type Service struct {
	redis   *goredis.Client
	queries *db.Queries
}

func NewService(redis *goredis.Client, queries *db.Queries) *Service {
	return &Service{redis: redis, queries: queries}
}

type JoinResult struct {
	Token            string `json:"token"`
	Position         int64  `json:"position"`
	EstimatedSeconds int64  `json:"estimated_seconds"`
	Status           string `json:"status"`
}

type StatusResult struct {
	Status           string `json:"status"`
	Position         int64  `json:"position,omitempty"`
	EstimatedSeconds int64  `json:"estimated_seconds,omitempty"`
}

func (s *Service) Join(ctx context.Context, eventSlug string) (JoinResult, error) {
	wr, err := s.queries.GetEventWaitingRoomBySlug(ctx, eventSlug)
	if err != nil {
		return JoinResult{}, fmt.Errorf("event not found")
	}
	if !wr.WaitingRoomEnabled {
		token := uuid.New().String()
		s.setAdmitted(ctx, wr.ID, token)
		return JoinResult{Token: token, Position: 0, EstimatedSeconds: 0, Status: "admitted"}, nil
	}

	token := uuid.New().String()
	queueKey := queueKeyPrefix + wr.ID.String()
	score := float64(time.Now().UnixMilli())

	pipe := s.redis.Pipeline()
	pipe.ZAdd(ctx, queueKey, goredis.Z{Score: score, Member: token})
	pipe.Set(ctx, tokenKeyPrefix+token, wr.ID.String(), tokenTTL)
	_, _ = pipe.Exec(ctx)

	pos, _ := s.redis.ZRank(ctx, queueKey, token).Result()
	position := pos + 1
	s.tryAdmit(ctx, wr)

	if s.isAdmitted(ctx, wr.ID, token) {
		return JoinResult{Token: token, Position: 0, EstimatedSeconds: 0, Status: "admitted"}, nil
	}

	est := (position / admitRatePerMin) * 60
	if est < 30 {
		est = 30
	}
	return JoinResult{Token: token, Position: position, EstimatedSeconds: est, Status: "waiting"}, nil
}

func (s *Service) Status(ctx context.Context, eventSlug, token string) (StatusResult, error) {
	wr, err := s.queries.GetEventWaitingRoomBySlug(ctx, eventSlug)
	if err != nil {
		return StatusResult{}, fmt.Errorf("event not found")
	}
	if !wr.WaitingRoomEnabled {
		return StatusResult{Status: "admitted"}, nil
	}

	s.tryAdmit(ctx, wr)

	if s.isAdmitted(ctx, wr.ID, token) {
		return StatusResult{Status: "admitted"}, nil
	}

	queueKey := queueKeyPrefix + wr.ID.String()
	pos, err := s.redis.ZRank(ctx, queueKey, token).Result()
	if err == goredis.Nil {
		return StatusResult{}, fmt.Errorf("token expired or invalid")
	}
	position := pos + 1
	est := (position / admitRatePerMin) * 60
	if est < 30 {
		est = 30
	}
	return StatusResult{Status: "waiting", Position: position, EstimatedSeconds: est}, nil
}

func (s *Service) IsAdmitted(ctx context.Context, eventID uuid.UUID, token string) bool {
	return s.isAdmitted(ctx, eventID, token)
}

func (s *Service) RequiresQueue(ctx context.Context, eventID uuid.UUID) (bool, error) {
	wr, err := s.queries.GetEventWaitingRoom(ctx, eventID)
	if err != nil {
		return false, err
	}
	return wr.WaitingRoomEnabled, nil
}

func (s *Service) tryAdmit(ctx context.Context, wr db.EventWaitingRoom) {
	if !wr.WaitingRoomEnabled {
		return
	}
	capacity := int64(100)
	if wr.WaitingRoomCapacity.Valid && wr.WaitingRoomCapacity.Int32 > 0 {
		capacity = int64(wr.WaitingRoomCapacity.Int32)
	}

	admittedKey := admittedKeyPrefix + wr.ID.String()
	current, _ := s.redis.SCard(ctx, admittedKey).Result()
	if current >= capacity {
		return
	}

	queueKey := queueKeyPrefix + wr.ID.String()
	toAdmit := capacity - current
	if toAdmit > admitRatePerMin {
		toAdmit = admitRatePerMin
	}

	members, err := s.redis.ZRange(ctx, queueKey, 0, toAdmit-1).Result()
	if err != nil || len(members) == 0 {
		return
	}

	pipe := s.redis.Pipeline()
	for _, m := range members {
		pipe.SAdd(ctx, admittedKey, m)
		pipe.ZRem(ctx, queueKey, m)
		pipe.Expire(ctx, admittedKey, tokenTTL)
	}
	_, _ = pipe.Exec(ctx)
}

func (s *Service) setAdmitted(ctx context.Context, eventID uuid.UUID, token string) {
	admittedKey := admittedKeyPrefix + eventID.String()
	s.redis.SAdd(ctx, admittedKey, token)
	s.redis.Expire(ctx, admittedKey, tokenTTL)
}

func (s *Service) GetConfig(ctx context.Context, slug string) (bool, int32, error) {
	wr, err := s.queries.GetEventWaitingRoomBySlug(ctx, slug)
	if err != nil {
		return false, 0, err
	}
	capacity := int32(100)
	if wr.WaitingRoomCapacity.Valid {
		capacity = wr.WaitingRoomCapacity.Int32
	}
	return wr.WaitingRoomEnabled, capacity, nil
}

func (s *Service) isAdmitted(ctx context.Context, eventID uuid.UUID, token string) bool {
	admittedKey := admittedKeyPrefix + eventID.String()
	ok, _ := s.redis.SIsMember(ctx, admittedKey, token).Result()
	return ok
}
