-- Create restore_timer table for hourly timer system
-- This table tracks a counter that increments every hour from 1-10, then resets

-- Create the table
CREATE TABLE IF NOT EXISTS restore_timer (
    id INTEGER PRIMARY KEY DEFAULT 1,
    counter INTEGER NOT NULL DEFAULT 1 CHECK (counter >= 1 AND counter <= 10),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS restore_timer_singleton ON restore_timer (id);

-- Insert initial row with counter = 1
INSERT INTO restore_timer (id, counter, last_updated)
VALUES (1, 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE restore_timer IS 'Tracks hourly timer counter (1-10) that resets after reaching 10';
COMMENT ON COLUMN restore_timer.counter IS 'Current timer value, increments hourly from 1 to 10, then resets to 1';
COMMENT ON COLUMN restore_timer.last_updated IS 'Timestamp of last counter update';

-- Grant permissions for anon role (needed for client-side access)
GRANT SELECT, UPDATE ON restore_timer TO anon, authenticated;

-- Verify the table was created
SELECT * FROM restore_timer;
