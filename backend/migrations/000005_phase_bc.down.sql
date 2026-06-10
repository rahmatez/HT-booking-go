DROP TABLE IF EXISTS organizer_payout_accounts;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS event_staff;

ALTER TABLE events
    DROP COLUMN IF EXISTS waiting_room_enabled,
    DROP COLUMN IF EXISTS waiting_room_capacity;
