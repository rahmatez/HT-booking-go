package promo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

var (
	ErrNotFound = errors.New("promo not found")
	ErrInvalid  = errors.New("promo tidak valid")
	ErrExpired  = errors.New("promo sudah kedaluwarsa")
	ErrExhausted = errors.New("kuota promo habis")
)

type Service struct {
	queries *db.Queries
}

func NewService(queries *db.Queries) *Service {
	return &Service{queries: queries}
}

type ApplyResult struct {
	Code           string
	DiscountAmount int64
	FinalTotal     int64
	Subtotal       int64
}

func (s *Service) ValidateAndApply(ctx context.Context, code string, eventID uuid.UUID, subtotal int64) (*ApplyResult, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return &ApplyResult{FinalTotal: subtotal, Subtotal: subtotal}, nil
	}

	p, err := s.queries.GetPromoByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	now := time.Now()
	if !p.Active || now.Before(p.ValidFrom) || now.After(p.ValidUntil) {
		return nil, ErrExpired
	}
	if p.MaxUses.Valid && p.UsedCount >= p.MaxUses.Int32 {
		return nil, ErrExhausted
	}
	if p.EventID.Valid && p.EventID.Bytes != eventID {
		return nil, ErrInvalid
	}

	var discount int64
	switch p.DiscountType {
	case "percent":
		discount = subtotal * p.DiscountValue / 100
	case "fixed":
		discount = p.DiscountValue
	default:
		return nil, ErrInvalid
	}
	if discount > subtotal {
		discount = subtotal
	}
	if discount < 0 {
		discount = 0
	}

	final := subtotal - discount
	return &ApplyResult{
		Code:           p.Code,
		DiscountAmount: discount,
		FinalTotal:     final,
		Subtotal:       subtotal,
	}, nil
}

func (s *Service) IncrementOnConfirm(ctx context.Context, code string) error {
	if strings.TrimSpace(code) == "" {
		return nil
	}
	p, err := s.queries.GetPromoByCode(ctx, code)
	if err != nil {
		return err
	}
	return s.queries.IncrementPromoUsage(ctx, p.ID)
}

func PromoErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrNotFound):
		return "kode promo tidak ditemukan"
	case errors.Is(err, ErrExpired):
		return "kode promo tidak berlaku"
	case errors.Is(err, ErrExhausted):
		return "kuota promo sudah habis"
	case errors.Is(err, ErrInvalid):
		return "kode promo tidak berlaku untuk event ini"
	default:
		return fmt.Sprintf("promo error: %v", err)
	}
}
