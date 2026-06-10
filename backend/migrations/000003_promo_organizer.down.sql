ALTER TABLE bookings DROP COLUMN IF EXISTS promo_code;
ALTER TABLE bookings DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE bookings DROP COLUMN IF EXISTS subtotal_amount;
ALTER TABLE events DROP COLUMN IF EXISTS organizer_id;
