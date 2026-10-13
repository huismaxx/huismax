-- Muse Companion (/muse, github.com/huismaxx/companion) is Max's open-source project: list it with his work on the
-- homepage (projects_) and /vibe-coder. INSERT OR IGNORE: deleting it in /admin keeps it deleted.

INSERT OR IGNORE INTO projects (id, name, url, status, note, sort_order, visible, created_at, updated_at) VALUES
  ('muse-companion', 'Muse Companion', 'https://github.com/huismaxx/companion', 'live', 'Open-source Windows app that turns an ESP32 board into a Muse gadget.', 2, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
