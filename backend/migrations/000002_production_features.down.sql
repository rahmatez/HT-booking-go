ALTER TABLE events DROP COLUMN IF EXISTS category_id;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS event_categories;
DROP TABLE IF EXISTS promo_codes;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS app_settings;
