package db

import (
	"context"

	"github.com/google/uuid"
)

const sellTicketsDirect = `
UPDATE ticket_types
SET sold_count = sold_count + $2,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1 AND (total_quota - sold_count - held_count) >= $2
RETURNING id, event_id, name, price, total_quota, sold_count, held_count, max_per_order, sales_start_at, sales_end_at, version, created_at, updated_at`

func (q *Queries) SellTicketsDirect(ctx context.Context, id uuid.UUID, quantity int32) (TicketType, error) {
	row := q.db.QueryRow(ctx, sellTicketsDirect, id, quantity)
	var i TicketType
	err := row.Scan(
		&i.ID,
		&i.EventID,
		&i.Name,
		&i.Price,
		&i.TotalQuota,
		&i.SoldCount,
		&i.HeldCount,
		&i.MaxPerOrder,
		&i.SalesStartAt,
		&i.SalesEndAt,
		&i.Version,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}
