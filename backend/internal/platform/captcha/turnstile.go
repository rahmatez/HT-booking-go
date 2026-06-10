package captcha

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type VerifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

func Verify(secret, token, remoteIP string) (bool, error) {
	if secret == "" {
		return true, nil // disabled in dev
	}
	if strings.TrimSpace(token) == "" {
		return false, fmt.Errorf("captcha required")
	}

	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", token)
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", form)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()

	var body VerifyResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return false, err
	}
	return body.Success, nil
}
