package middleware

import (
	"net/http"
	"strings"

	"github.com/rahmatez/high-traffic-booking/backend/internal/auth"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

func Auth(jwtSvc *auth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				response.Unauthorized(w, "missing or invalid authorization header")
				return
			}

			token := strings.TrimPrefix(header, "Bearer ")
			claims, err := jwtSvc.ValidateAccessToken(token)
			if err != nil {
				response.Unauthorized(w, "invalid or expired token")
				return
			}

			ctx := authctx.WithUser(r.Context(), authctx.User{
				ID:    claims.UserID,
				Email: claims.Email,
				Role:  claims.Role,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuth(jwtSvc *auth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if strings.HasPrefix(header, "Bearer ") {
				token := strings.TrimPrefix(header, "Bearer ")
				if claims, err := jwtSvc.ValidateAccessToken(token); err == nil {
					ctx := authctx.WithUser(r.Context(), authctx.User{
						ID:    claims.UserID,
						Email: claims.Email,
						Role:  claims.Role,
					})
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireRoleDB(queries *db.Queries, roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		roleSet[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := authctx.GetUser(r.Context())
			if !ok {
				response.Unauthorized(w, "authentication required")
				return
			}

			dbUser, err := queries.GetUserByID(r.Context(), user.ID)
			if err != nil {
				response.Unauthorized(w, "authentication required")
				return
			}

			role := string(dbUser.Role)
			if _, allowed := roleSet[role]; !allowed {
				response.Forbidden(w, "insufficient permissions")
				return
			}

			ctx := authctx.WithUser(r.Context(), authctx.User{
				ID:    user.ID,
				Email: user.Email,
				Role:  role,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		roleSet[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := authctx.GetUser(r.Context())
			if !ok {
				response.Unauthorized(w, "authentication required")
				return
			}
			if _, allowed := roleSet[user.Role]; !allowed {
				response.Forbidden(w, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
