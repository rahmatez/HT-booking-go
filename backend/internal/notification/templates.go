package notification

import (
	"fmt"
	"strings"
)

func PaymentConfirmEmail(name, eventTitle, bookingURL string, amount int64) (string, string) {
	subject := fmt.Sprintf("Pembayaran Dikonfirmasi — %s", eventTitle)
	html := fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h2>Pembayaran Berhasil</h2>
<p>Halo %s,</p>
<p>Pembayaran tiket untuk <strong>%s</strong> telah dikonfirmasi (Rp %s).</p>
<p><a href="%s" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Lihat E-Ticket</a></p>
<p style="color:#666;font-size:13px">Tunjukkan QR code di venue pada hari event.</p>
</div>`, name, eventTitle, formatIDR(amount), bookingURL)
	return subject, html
}

func ETicketEmail(name, eventTitle, bookingURL string, ticketCodes []string) (string, string) {
	subject := fmt.Sprintf("E-Ticket — %s", eventTitle)
	codes := strings.Join(ticketCodes, ", ")
	html := fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h2>E-Ticket Kamu</h2>
<p>Halo %s,</p>
<p>Tiket untuk <strong>%s</strong> siap digunakan.</p>
<p>Kode tiket: <strong>%s</strong></p>
<p><a href="%s" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Buka E-Ticket & QR</a></p>
</div>`, name, eventTitle, codes, bookingURL)
	return subject, html
}

func CancellationEmail(name, eventTitle string) (string, string) {
	subject := fmt.Sprintf("Pemesanan Dibatalkan — %s", eventTitle)
	html := fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px">
<h2>Pemesanan Dibatalkan</h2>
<p>Halo %s,</p>
<p>Pemesanan tiket untuk <strong>%s</strong> telah dibatalkan.</p>
</div>`, name, eventTitle)
	return subject, html
}

func VerifyEmail(name, verifyURL string) (string, string) {
	subject := "Verifikasi Email — Eventra"
	html := fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px">
<h2>Verifikasi Email</h2>
<p>Halo %s,</p>
<p>Klik link berikut untuk memverifikasi email kamu:</p>
<p><a href="%s">Verifikasi Email</a></p>
<p style="color:#666;font-size:13px">Link berlaku 24 jam.</p>
</div>`, name, verifyURL)
	return subject, html
}

func ResetPasswordEmail(name, resetURL string) (string, string) {
	subject := "Reset Password — Eventra"
	html := fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px">
<h2>Reset Password</h2>
<p>Halo %s,</p>
<p>Klik link berikut untuk mengatur ulang password:</p>
<p><a href="%s">Reset Password</a></p>
<p style="color:#666;font-size:13px">Link berlaku 1 jam. Abaikan jika kamu tidak meminta ini.</p>
</div>`, name, resetURL)
	return subject, html
}

func formatIDR(amount int64) string {
	s := fmt.Sprintf("%d", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var parts []string
	for n > 3 {
		parts = append([]string{s[n-3 : n]}, parts...)
		n -= 3
	}
	parts = append([]string{s[:n]}, parts...)
	return strings.Join(parts, ".")
}
