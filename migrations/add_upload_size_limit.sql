-- Add max_upload_size column to tokens table
-- Run this SQL in your Supabase SQL Editor

-- Add max_upload_size column (in bytes, NULL = unlimited)
ALTER TABLE tokens 
ADD COLUMN IF NOT EXISTS max_upload_size BIGINT;

-- Add comment to document the column
COMMENT ON COLUMN tokens.max_upload_size IS 'Maximum upload size in bytes (NULL or 0 = unlimited)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tokens' 
AND column_name = 'max_upload_size';
