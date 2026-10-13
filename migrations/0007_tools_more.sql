-- More open tools on Max's server (deployed 2026-10-13). INSERT OR IGNORE: edits and deletions in /admin win.

INSERT OR IGNORE INTO tools (id, name, url, description, action, sort_order, visible, created_at, updated_at) VALUES
  ('tool-draw', 'whiteboard', 'https://draw.huismax.com', 'Sketch diagrams and ideas, alone or together live. Excalidraw; drawings stay in your browser.', 'start drawing', 2, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z'),
  ('tool-pdf', 'pdf tools', 'https://pdf.huismax.com', 'Merge, split, compress, convert or OCR PDFs. Stirling-PDF, up to 50 MB.', 'open', 3, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z'),
  ('tool-paste', 'private paste', 'https://paste.huismax.com', 'Share text or code end-to-end encrypted. PrivateBin; pastes expire within a week.', 'new paste', 4, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z'),
  ('tool-it', 'dev tools', 'https://tools.huismax.com', 'Encoders, converters, generators and more, all in your browser. IT-Tools.', 'open', 5, 1, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
