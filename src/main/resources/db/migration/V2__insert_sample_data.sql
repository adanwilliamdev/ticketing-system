-- Insert sample events
INSERT INTO events (name, description, start_date_time, end_date_time, location, total_capacity, available_tickets, price, status) 
VALUES 
('Rock Concert 2024', 'Amazing rock concert with multiple bands', '2024-12-15 20:00:00', '2024-12-15 23:00:00', 'Stadium Arena', 1000, 1000, 150.00, 'PUBLISHED'),
('Tech Conference 2024', 'Annual technology conference', '2024-11-20 09:00:00', '2024-11-22 18:00:00', 'Convention Center', 500, 500, 299.00, 'PUBLISHED'),
('Jazz Night', 'Classic jazz performance', '2024-10-25 19:30:00', '2024-10-25 22:00:00', 'Jazz Club', 200, 200, 75.00, 'PUBLISHED');

-- Insert sample tickets for Rock Concert
DO $$
DECLARE
    event_id BIGINT;
BEGIN
    SELECT id INTO event_id FROM events WHERE name = 'Rock Concert 2024';
    
    FOR i IN 1..1000 LOOP
        INSERT INTO tickets (event_id, seat_number, section, row_number, status)
        VALUES (
            event_id,
            'A' || LPAD(i::TEXT, 3, '0'),
            CASE 
                WHEN i <= 100 THEN 'VIP'
                WHEN i <= 300 THEN 'Premium'
                ELSE 'Regular'
            END,
            'Row ' || (CEIL(i/20.0))::TEXT,
            'AVAILABLE'
        );
    END LOOP;
END $$;

-- Insert sample tickets for Tech Conference
DO $$
DECLARE
    event_id BIGINT;
BEGIN
    SELECT id INTO event_id FROM events WHERE name = 'Tech Conference 2024';
    
    FOR i IN 1..500 LOOP
        INSERT INTO tickets (event_id, seat_number, section, row_number, status)
        VALUES (
            event_id,
            'B' || LPAD(i::TEXT, 3, '0'),
            CASE 
                WHEN i <= 50 THEN 'VIP'
                ELSE 'Regular'
            END,
            'Row ' || (CEIL(i/25.0))::TEXT,
            'AVAILABLE'
        );
    END LOOP;
END $$;

-- Insert sample tickets for Jazz Night
DO $$
DECLARE
    event_id BIGINT;
BEGIN
    SELECT id INTO event_id FROM events WHERE name = 'Jazz Night';
    
    FOR i IN 1..200 LOOP
        INSERT INTO tickets (event_id, seat_number, section, row_number, status)
        VALUES (
            event_id,
            'C' || LPAD(i::TEXT, 3, '0'),
            CASE 
                WHEN i <= 20 THEN 'VIP'
                WHEN i <= 80 THEN 'Premium'
                ELSE 'Regular'
            END,
            'Row ' || (CEIL(i/20.0))::TEXT,
            'AVAILABLE'
        );
    END LOOP;
END $$;
