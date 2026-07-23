-- Retry the V-team promotion with fuzzy matching: the first attempt matched
-- the username only case-insensitively, which silently updates zero rows when
-- the stored name differs by spacing/punctuation (e.g. "V team", "v_team",
-- "vteam"). Strip every non-alphanumeric character before comparing.
UPDATE "InviteUser"
SET "role" = 'SYSTEM_ADMIN'
WHERE lower(regexp_replace("username", '[^a-zA-Z0-9]', '', 'g')) = 'vteam';
