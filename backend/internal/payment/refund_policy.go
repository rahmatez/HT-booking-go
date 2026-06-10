package payment

import (
	"fmt"
	"time"
)

type RefundPolicy struct {
	FullRefundHoursBeforeEvent int
	PartialRefundHours         int
	PartialRefundPercent       int
}

func DefaultRefundPolicy() RefundPolicy {
	return RefundPolicy{
		FullRefundHoursBeforeEvent: 168, // 7 hari
		PartialRefundHours:         48,
		PartialRefundPercent:       50,
	}
}

type RefundDecision struct {
	Amount int64
	Kind   string // full, partial, none
	Reason string
}

func CalculateRefund(paymentAmount int64, eventStartsAt time.Time, policy RefundPolicy, forceFull bool) (RefundDecision, error) {
	if paymentAmount <= 0 {
		return RefundDecision{}, fmt.Errorf("invalid payment amount")
	}
	if forceFull {
		return RefundDecision{Amount: paymentAmount, Kind: "full", Reason: "event cancelled"}, nil
	}

	hoursUntil := time.Until(eventStartsAt).Hours()
	if hoursUntil >= float64(policy.FullRefundHoursBeforeEvent) {
		return RefundDecision{Amount: paymentAmount, Kind: "full", Reason: "more than 7 days before event"}, nil
	}
	if hoursUntil >= float64(policy.PartialRefundHours) {
		amount := paymentAmount * int64(policy.PartialRefundPercent) / 100
		if amount < 1 {
			amount = 1
		}
		return RefundDecision{
			Amount: amount,
			Kind:   "partial",
			Reason: fmt.Sprintf("%d%% refund (within %d hours)", policy.PartialRefundPercent, policy.PartialRefundHours),
		}, nil
	}
	return RefundDecision{Amount: 0, Kind: "none", Reason: "less than 48 hours before event"}, nil
}
