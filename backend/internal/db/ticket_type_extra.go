package db

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrTicketTypeInUse = errors.New("ticket type has sales or holds")

func (q *Queries) UpdateTicketType(ctx context.Context, id uuid.UUID, name string, price int64, totalQuota, maxPerOrder int32, salesStart, salesEnd time.Time) (TicketType, error) {
	var tt TicketType
	err := q.db.QueryRow(ctx, `
		UPDATE ticket_types
		SET name = $2, price = $3, total_quota = $4, max_per_order = $5,
		    sales_start_at = $6, sales_end_at = $7, updated_at = NOW()
		WHERE id = $1
		RETURNING id, event_id, name, price, total_quota, sold_count, held_count, max_per_order,
		          sales_start_at, sales_end_at, version, created_at, updated_at
	`, id, name, price, totalQuota, maxPerOrder, salesStart, salesEnd).Scan(
		&tt.ID, &tt.EventID, &tt.Name, &tt.Price, &tt.TotalQuota, &tt.SoldCount, &tt.HeldCount,
		&tt.MaxPerOrder, &tt.SalesStartAt, &tt.SalesEndAt, &tt.Version, &tt.CreatedAt, &tt.UpdatedAt,
	)
	return tt, err
}

func (q *Queries) DeleteTicketType(ctx context.Context, id uuid.UUID) error {
	var sold, held int32
	err := q.db.QueryRow(ctx, `SELECT sold_count, held_count FROM ticket_types WHERE id = $1`, id).Scan(&sold, &held)
	if err != nil {
		return err
	}
	if sold > 0 || held > 0 {
		return ErrTicketTypeInUse
	}
	_, err = q.db.Exec(ctx, `DELETE FROM ticket_types WHERE id = $1`, id)
	return err
}
