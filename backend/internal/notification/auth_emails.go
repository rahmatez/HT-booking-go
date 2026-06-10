package notification

type AuthEmailAdapter struct {
	svc *Service
}

func NewAuthEmailAdapter(svc *Service) *AuthEmailAdapter {
	return &AuthEmailAdapter{svc: svc}
}

func (a *AuthEmailAdapter) SendVerifyEmail(to, name, verifyURL string) {
	subject, html := VerifyEmail(name, verifyURL)
	a.svc.Enqueue(EmailMessage{To: to, Subject: subject, HTML: html})
}

func (a *AuthEmailAdapter) SendResetPasswordEmail(to, name, resetURL string) {
	subject, html := ResetPasswordEmail(name, resetURL)
	a.svc.Enqueue(EmailMessage{To: to, Subject: subject, HTML: html})
}
