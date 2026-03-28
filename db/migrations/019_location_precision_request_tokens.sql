ALTER TABLE user_location_precision_requests
  ADD COLUMN IF NOT EXISTS request_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_user_location_precision_requests_token_hash
  ON user_location_precision_requests(request_token_hash);
