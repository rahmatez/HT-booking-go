package midtrans

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type RefundRequest struct {
	RefundKey string `json:"refund_key"`
	Amount    int64  `json:"amount"`
	Reason    string `json:"reason"`
}

type RefundResponse struct {
	StatusCode        string `json:"status_code"`
	StatusMessage     string `json:"status_message"`
	TransactionID     string `json:"transaction_id"`
	OrderID           string `json:"order_id"`
	RefundAmount      string `json:"refund_amount"`
	TransactionStatus string `json:"transaction_status"`
}

func (c *Client) RefundTransaction(ctx context.Context, orderID, refundKey string, amount int64, reason string) error {
	if !c.IsConfigured() {
		return fmt.Errorf("midtrans not configured")
	}
	body, err := json.Marshal(RefundRequest{
		RefundKey: refundKey,
		Amount:    amount,
		Reason:    reason,
	})
	if err != nil {
		return err
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.apiBaseURL()+"/v2/"+orderID+"/refund",
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+basicAuth(c.serverKey))

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	if res.StatusCode >= 400 {
		return fmt.Errorf("midtrans refund error %d: %s", res.StatusCode, string(respBody))
	}

	var refund RefundResponse
	if err := json.Unmarshal(respBody, &refund); err != nil {
		return err
	}
	if refund.StatusCode != "200" {
		return fmt.Errorf("midtrans refund failed: %s", refund.StatusMessage)
	}
	return nil
}
