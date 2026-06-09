package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var in RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if in.Email == "" || in.Password == "" || in.FullName == "" {
		response.BadRequest(w, "email, password, and full_name are required")
		return
	}
	if err := ValidatePassword(in.Password); err != nil {
		response.BadRequest(w, err.Error())
		return
	}

	user, tokens, err := h.svc.Register(r.Context(), in)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			response.Conflict(w, "EMAIL_TAKEN", "email already registered")
			return
		}
		response.Internal(w, "failed to register")
		return
	}

	response.Created(w, map[string]interface{}{
		"user":   UserResponse(*user),
		"tokens": tokens,
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	user, tokens, err := h.svc.Login(r.Context(), in)
	if err != nil {
		if errors.Is(err, ErrInvalidCreds) {
			response.Unauthorized(w, "invalid email or password")
			return
		}
		response.Internal(w, "failed to login")
		return
	}

	response.OK(w, map[string]interface{}{
		"user":   UserResponse(*user),
		"tokens": tokens,
	})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.BadRequest(w, "refresh_token is required")
		return
	}

	tokens, err := h.svc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		response.Unauthorized(w, "invalid refresh token")
		return
	}

	response.OK(w, tokens)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.RefreshToken != "" {
		_ = h.svc.Logout(r.Context(), body.RefreshToken)
	}
	response.OK(w, map[string]string{"message": "logged out"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	u, err := h.svc.GetUserByID(r.Context(), user.ID)
	if err != nil {
		response.NotFound(w, "user not found")
		return
	}

	response.OK(w, UserResponse(u))
}
