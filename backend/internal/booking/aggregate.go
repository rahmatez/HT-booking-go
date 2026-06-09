package booking

import (
	"fmt"

	"github.com/google/uuid"
)

type aggregatedHoldItem struct {
	TicketTypeID uuid.UUID
	Quantity     int32
}

func aggregateHoldItems(items []HoldItem) ([]aggregatedHoldItem, error) {
	counts := make(map[uuid.UUID]int32, len(items))
	for _, item := range items {
		if item.Quantity <= 0 {
			return nil, fmt.Errorf("invalid quantity")
		}
		counts[item.TicketTypeID] += item.Quantity
	}
	out := make([]aggregatedHoldItem, 0, len(counts))
	for id, qty := range counts {
		out = append(out, aggregatedHoldItem{TicketTypeID: id, Quantity: qty})
	}
	return out, nil
}

func dedupeTicketTypeIDs(items []aggregatedHoldItem) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(items))
	out := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item.TicketTypeID]; ok {
			continue
		}
		seen[item.TicketTypeID] = struct{}{}
		out = append(out, item.TicketTypeID)
	}
	return out
}
