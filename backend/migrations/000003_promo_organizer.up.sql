ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subtotal_amount BIGINT NOT NULL DEFAULT 0;

UPDATE bookings SET subtotal_amount = total_amount WHERE subtotal_amount = 0;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
