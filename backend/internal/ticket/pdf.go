package ticket

import (
	"bytes"
	"fmt"

	"github.com/jung-kurt/gofpdf/v2"
)

type PDFInput struct {
	EventTitle   string
	HolderName   string
	TicketCode   string
	TicketType   string
	BookingID    string
}

func GeneratePDF(in PDFInput) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 20)
	pdf.Cell(0, 12, "Eventra E-Ticket")
	pdf.Ln(14)
	pdf.SetFont("Helvetica", "", 12)
	pdf.Cell(0, 8, fmt.Sprintf("Event: %s", in.EventTitle))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Pemegang: %s", in.HolderName))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Tipe: %s", in.TicketType))
	pdf.Ln(12)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.Cell(0, 10, in.TicketCode)
	pdf.Ln(12)
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Booking: %s", in.BookingID))
	pdf.Ln(6)
	pdf.Cell(0, 6, "Tunjukkan QR/kode ini di pintu masuk. Satu kali scan.")
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
