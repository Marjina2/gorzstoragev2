-- Comprehensive migration to add all missing columns to the files table
-- Run this SQL in your Supabase SQL Editor

-- First, let's check what columns currently exist
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'files';

-- Add missing columns one by one (IF NOT EXISTS prevents errors if column already exists)

-- File type column (image, video, or other)
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('image', 'video', 'other'));

-- IP address of uploader
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Browser/device user agent
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- File title (custom name)
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Collection ID for grouped uploads
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS collection_id TEXT;

-- Folder ID for organized storage
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS folder_id TEXT;

-- Download tracking
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS downloads_done INTEGER DEFAULT 0;

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS download_limit INTEGER;

-- File expiry time
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS expiry TIMESTAMP WITH TIME ZONE;

-- Token information
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS token_used TEXT;

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS temp_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN files.type IS 'File type: image, video, or other';
COMMENT ON COLUMN files.ip_address IS 'IP address of the user who uploaded the file';
COMMENT ON COLUMN files.user_agent IS 'Browser/device user agent string of the uploader';
COMMENT ON COLUMN files.title IS 'Custom title for the file';
COMMENT ON COLUMN files.collection_id IS 'ID for grouping multiple files together';
COMMENT ON COLUMN files.folder_id IS 'Folder where the file is stored';
COMMENT ON COLUMN files.downloads_done IS 'Number of times file has been downloaded';
COMMENT ON COLUMN files.download_limit IS 'Maximum number of downloads allowed';
COMMENT ON COLUMN files.expiry IS 'When the file expires and should be deleted';
COMMENT ON COLUMN files.token_used IS 'Token hash used to upload this file';
COMMENT ON COLUMN files.name IS 'Name of the uploader';
COMMENT ON COLUMN files.temp_name IS 'Purpose/description of the upload';

-- Verify all columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'files'
ORDER BY ordinal_position;
