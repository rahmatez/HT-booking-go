package midtrans

import (
	"crypto/sha512"
	"encoding/hex"
)

func VerifyNotificationSignature(orderID, statusCode, grossAmount, serverKey, signatureKey string) bool {
	if signatureKey == "" {
		return false
	}
	payload := orderID + statusCode + grossAmount + serverKey
	sum := sha512.Sum512([]byte(payload))
	expected := hex.EncodeToString(sum[:])
	return expected == signatureKey
}

func IsPaymentSuccess(status string) bool {
	switch status {
	case "capture", "settlement":
		return true
	default:
		return false
	}
}

func IsPaymentFailed(status string) bool {
	switch status {
	case "deny", "cancel", "expire", "failure":
		return true
	default:
		return false
	}
}
