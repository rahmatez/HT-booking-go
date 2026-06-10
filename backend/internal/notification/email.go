package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
)

type EmailMessage struct {
	To      string
	Subject string
	HTML    string
}

type Service struct {
	cfg    *config.Config
	client *http.Client
	queue  chan EmailMessage
}

func NewService(cfg *config.Config) *Service {
	return &Service{
		cfg:    cfg,
		client: &http.Client{Timeout: 15 * time.Second},
		queue:  make(chan EmailMessage, 256),
	}
}

func (s *Service) StartWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-s.queue:
			_ = s.sendNow(context.Background(), msg)
		}
	}
}

func (s *Service) Enqueue(msg EmailMessage) {
	select {
	case s.queue <- msg:
	default:
		// Drop if queue full; log in production via caller
		go func() { _ = s.sendNow(context.Background(), msg) }()
	}
}

func (s *Service) Send(ctx context.Context, msg EmailMessage) error {
	if s.cfg.ResendAPIKey == "" {
		return nil // dev: no-op when email not configured
	}
	return s.sendNow(ctx, msg)
}

func (s *Service) sendNow(ctx context.Context, msg EmailMessage) error {
	if s.cfg.ResendAPIKey == "" {
		return nil
	}
	body := map[string]interface{}{
		"from":    s.cfg.EmailFrom,
		"to":      []string{msg.To},
		"subject": msg.Subject,
		"html":    msg.HTML,
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("resend api status %d", res.StatusCode)
	}
	return nil
}

func (s *Service) Configured() bool {
	return s.cfg.ResendAPIKey != ""
}
