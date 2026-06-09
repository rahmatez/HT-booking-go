package midtrans

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	serverKey  string
	clientKey  string
	isProd     bool
	httpClient *http.Client
}

func NewClient(serverKey, clientKey string, isProd bool) *Client {
	return &Client{
		serverKey:  serverKey,
		clientKey:  clientKey,
		isProd:     isProd,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) ClientKey() string {
	return c.clientKey
}

func (c *Client) IsConfigured() bool {
	return c.serverKey != "" && c.clientKey != ""
}

func (c *Client) snapBaseURL() string {
	if c.isProd {
		return "https://app.midtrans.com"
	}
	return "https://app.sandbox.midtrans.com"
}

func (c *Client) apiBaseURL() string {
	if c.isProd {
		return "https://api.midtrans.com"
	}
	return "https://api.sandbox.midtrans.com"
}

type TransactionDetails struct {
	OrderID     string `json:"order_id"`
	GrossAmount int64  `json:"gross_amount"`
}

type CustomerDetails struct {
	FirstName string `json:"first_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone,omitempty"`
}

type ItemDetail struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Price    int64  `json:"price"`
	Quantity int32  `json:"quantity"`
}

type Callbacks struct {
	Finish string `json:"finish"`
}

type SnapRequest struct {
	TransactionDetails TransactionDetails `json:"transaction_details"`
	CustomerDetails    CustomerDetails    `json:"customer_details"`
	ItemDetails        []ItemDetail       `json:"item_details"`
	Callbacks          *Callbacks         `json:"callbacks,omitempty"`
}

type SnapResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

type TransactionStatus struct {
	OrderID           string `json:"order_id"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	TransactionID     string `json:"transaction_id"`
	SignatureKey      string `json:"signature_key"`
}

func (c *Client) CreateSnapTransaction(ctx context.Context, req SnapRequest) (*SnapResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.snapBaseURL()+"/snap/v1/transactions",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+basicAuth(c.serverKey))

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("midtrans snap error %d: %s", res.StatusCode, string(respBody))
	}

	var snap SnapResponse
	if err := json.Unmarshal(respBody, &snap); err != nil {
		return nil, err
	}
	if snap.Token == "" {
		return nil, fmt.Errorf("midtrans returned empty snap token")
	}
	return &snap, nil
}

func (c *Client) GetTransactionStatus(ctx context.Context, orderID string) (*TransactionStatus, error) {
	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		c.apiBaseURL()+"/v2/"+orderID+"/status",
		nil,
	)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+basicAuth(c.serverKey))

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("midtrans status error %d: %s", res.StatusCode, string(respBody))
	}

	var status TransactionStatus
	if err := json.Unmarshal(respBody, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

func basicAuth(serverKey string) string {
	return base64.StdEncoding.EncodeToString([]byte(serverKey + ":"))
}
