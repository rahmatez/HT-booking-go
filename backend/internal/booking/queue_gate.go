package booking

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrQueueRequired = errors.New("waiting room admission required")

type QueueGate interface {
	RequiresQueue(ctx context.Context, eventID uuid.UUID) (bool, error)
	IsAdmitted(ctx context.Context, eventID uuid.UUID, token string) bool
}
