-- Migration: admin_push_subscriptions
CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
