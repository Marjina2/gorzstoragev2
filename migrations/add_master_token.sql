-- Add master token to the tokens table to satisfy foreign key constraint
-- Run this SQL in your Supabase SQL Editor

-- Insert the master token record if it doesn't exist
INSERT INTO tokens (
    id,
    token_hash,
    display_token,
    name,
    temp_name,
    created_at,
    expires_at,
    max_uses,
    uses,
    ip_address,
    permission
)
VALUES (
    gen_random_uuid(),  -- Generate a proper UUID for the id
    '516d0d9866b17f3b57111b72840f0a526389b537ef1bed454dc28013ebcdc12f',
    'HIDDEN',
    'Admin',
    'Master Override',
    NOW(),
    NOW() + INTERVAL '1000 years',
    1000000,
    0,
    'Admin',
    'both'
)
ON CONFLICT (token_hash) DO NOTHING;

-- Verify the master token was added
SELECT id, name, temp_name, permission 
FROM tokens 
WHERE token_hash = '516d0d9866b17f3b57111b72840f0a526389b537ef1bed454dc28013ebcdc12f';
