package audit

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

type Service struct {
	queries *db.Queries
}

func NewService(queries *db.Queries) *Service {
	return &Service{queries: queries}
}

func (s *Service) Log(ctx context.Context, actorID *uuid.UUID, action, entityType string, entityID uuid.UUID, meta map[string]interface{}) {
	var raw json.RawMessage
	if meta != nil {
		raw, _ = json.Marshal(meta)
	}
	_ = s.queries.InsertAuditLog(ctx, actorID, action, entityType, entityID, raw)
}

func (s *Service) List(ctx context.Context, page, perPage int) ([]db.AuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	logs, err := s.queries.ListAuditLogs(ctx, int32(perPage), int32(offset))
	if err != nil {
		return nil, 0, err
	}
	total, err := s.queries.CountAuditLogs(ctx)
	return logs, total, err
}
