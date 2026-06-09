package authctx

import (
	"context"

	"github.com/google/uuid"
)

type contextKey string

const userKey contextKey = "user"

type User struct {
	ID    uuid.UUID
	Email string
	Role  string
}

func WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, userKey, user)
}

func GetUser(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(userKey).(User)
	return user, ok
}
