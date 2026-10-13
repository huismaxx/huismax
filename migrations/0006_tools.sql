-- Homepage tools_: services on Max's server that visitors can use without an account (edited in /admin → homelab).
-- Additive only. MiroTalk (meet.huismax.com) is already open to anyone: {room} becomes a fresh random room name.

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO tools (id, name, url, description, action, sort_order, visible, created_at, updated_at) VALUES
  ('tool-meet', 'video calls', 'https://meet.huismax.com/join/{room}', 'Free HD video calls on my server. No account, no app: start a room and send the link.', 'start a call', 1, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
