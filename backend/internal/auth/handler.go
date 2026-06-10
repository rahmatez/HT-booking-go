package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/captcha"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
	cfg *config.Config
}

func NewHandler(svc *Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	return r.RemoteAddr
}

func (h *Handler) verifyCaptcha(w http.ResponseWriter, r *http.Request, token string) bool {
	ok, err := captcha.Verify(h.cfg.TurnstileSecretKey, token, clientIP(r))
	if err != nil || !ok {
		response.BadRequest(w, "captcha verification failed")
		return false
	}
	return true
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RegisterInput
		CaptchaToken string `json:"captcha_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	in := body.RegisterInput
	if h.cfg.TurnstileSecretKey != "" && !h.verifyCaptcha(w, r, body.CaptchaToken) {
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
	var body struct {
		LoginInput
		CaptchaToken string `json:"captcha_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	in := body.LoginInput
	if h.cfg.TurnstileSecretKey != "" && !h.verifyCaptcha(w, r, body.CaptchaToken) {
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

func (h *Handler) RequestVerifyEmail(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}
	if err := h.svc.RequestEmailVerification(r.Context(), user.ID); err != nil {
		if errors.Is(err, ErrAlreadyVerified) {
			response.BadRequest(w, "email already verified")
			return
		}
		response.Internal(w, "failed to send verification email")
		return
	}
	response.OK(w, map[string]string{"message": "verification email sent"})
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
		response.BadRequest(w, "token is required")
		return
	}
	if err := h.svc.VerifyEmail(r.Context(), body.Token); err != nil {
		if errors.Is(err, ErrInvalidReset) {
			response.BadRequest(w, "invalid or expired token")
			return
		}
		response.Internal(w, "verification failed")
		return
	}
	response.OK(w, map[string]string{"message": "email verified"})
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		response.BadRequest(w, "email is required")
		return
	}
	_ = h.svc.ForgotPassword(r.Context(), body.Email)
	response.OK(w, map[string]string{"message": "if the email exists, a reset link has been sent"})
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" || body.NewPassword == "" {
		response.BadRequest(w, "token and new_password are required")
		return
	}
	if err := ValidatePassword(body.NewPassword); err != nil {
		response.BadRequest(w, err.Error())
		return
	}
	if err := h.svc.ResetPassword(r.Context(), body.Token, body.NewPassword); err != nil {
		if errors.Is(err, ErrInvalidReset) {
			response.BadRequest(w, "invalid or expired token")
			return
		}
		response.Internal(w, "reset failed")
		return
	}
	response.OK(w, map[string]string{"message": "password updated"})
}
