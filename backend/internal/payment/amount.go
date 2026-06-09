package payment

import (
	"fmt"
	"strconv"
	"strings"
)

func parseMidtransAmount(raw string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, fmt.Errorf("empty amount")
	}
	if idx := strings.Index(raw, "."); idx >= 0 {
		raw = raw[:idx]
	}
	return strconv.ParseInt(raw, 10, 64)
}
