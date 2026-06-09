package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

var (
	ErrEmailTaken       = errors.New("email already registered")
	ErrInvalidCreds     = errors.New("invalid email or password")
	ErrInvalidToken     = errors.New("invalid refresh token")
)

type Service struct {
	queries *db.Queries
	jwt     *JWTService
}

func NewService(queries *db.Queries, jwt *JWTService) *Service {
	return &Service{queries: queries, jwt: jwt}
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type RegisterInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*db.User, *TokenPair, error) {
	if _, err := s.queries.GetUserByEmail(ctx, in.Email); err == nil {
		return nil, nil, ErrEmailTaken
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, err
	}

	var phone pgtype.Text
	if in.Phone != "" {
		phone = pgtype.Text{String: in.Phone, Valid: true}
	}

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Email:        in.Email,
		PasswordHash: string(hash),
		FullName:     in.FullName,
		Phone:        phone,
		Role:         "user",
	})
	if err != nil {
		return nil, nil, err
	}

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return &user, tokens, nil
}

func (s *Service) Login(ctx context.Context, in LoginInput) (*db.User, *TokenPair, error) {
	user, err := s.queries.GetUserByEmail(ctx, in.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrInvalidCreds
		}
		return nil, nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)); err != nil {
		return nil, nil, ErrInvalidCreds
	}

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return &user, tokens, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	hash := hashToken(refreshToken)
	rt, err := s.queries.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	user, err := s.queries.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}

	_ = s.queries.RevokeRefreshToken(ctx, hash)
	return s.issueTokens(ctx, user)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.queries.RevokeRefreshToken(ctx, hashToken(refreshToken))
}

func (s *Service) issueTokens(ctx context.Context, user db.User) (*TokenPair, error) {
	access, err := s.jwt.GenerateAccessToken(user.ID, user.Email, string(user.Role))
	if err != nil {
		return nil, err
	}

	refreshRaw, err := generateRefreshToken()
	if err != nil {
		return nil, err
	}

	_, err = s.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: hashToken(refreshRaw),
		ExpiresAt: time.Now().Add(s.jwt.RefreshTTL()),
	})
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  access,
		RefreshToken: refreshRaw,
		ExpiresAt:    time.Now().Add(s.jwt.AccessTTL()),
	}, nil
}

func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func UserResponse(u db.User) map[string]interface{} {
	return map[string]interface{}{
		"id":                u.ID,
		"email":             u.Email,
		"full_name":         u.FullName,
		"phone":             textVal(u.Phone),
		"role":              u.Role,
		"email_verified_at": timeVal(u.EmailVerifiedAt),
		"created_at":        u.CreatedAt,
	}
}

func textVal(t pgtype.Text) interface{} {
	if t.Valid {
		return t.String
	}
	return nil
}

func timeVal(t pgtype.Timestamptz) interface{} {
	if t.Valid {
		return t.Time
	}
	return nil
}

func (s *Service) GetUserByID(ctx context.Context, id uuid.UUID) (db.User, error) {
	return s.queries.GetUserByID(ctx, id)
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	return nil
}
