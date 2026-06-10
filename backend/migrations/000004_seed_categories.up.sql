INSERT INTO event_categories (slug, name, sort_order) VALUES
    ('musik', 'Musik', 1),
    ('olahraga', 'Olahraga', 2),
    ('workshop', 'Workshop', 3),
    ('festival', 'Festival', 4),
    ('teater', 'Teater', 5)
ON CONFLICT (slug) DO NOTHING;
