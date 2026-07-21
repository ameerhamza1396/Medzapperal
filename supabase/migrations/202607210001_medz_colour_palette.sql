-- Medz Apparel colour palette supplied July 21, 2026.
-- Existing colour IDs are preserved where they are already used by variants.
insert into public.colors (name,hex,slug) values
  ('Ciel Blue',       '#169BC5', 'ceil-blue'),
  ('Navy Blue',       '#10264C', 'navy'),
  ('Sky Blue',        '#9DD9F3', 'sky-blue'),
  ('Burgundy',        '#6B1835', 'burgundy'),
  ('Baby Pink',       '#E8A7C1', 'baby-pink'),
  ('Maroon',          '#741D2E', 'maroon'),
  ('Black',           '#171717', 'black'),
  ('Grey',            '#9A9AA0', 'grey'),
  ('Chocolate Brown', '#553421', 'chocolate-brown'),
  ('Emerald Green',   '#075C3F', 'emerald-green'),
  ('Sage Green',      '#9CAE8C', 'sage'),
  ('Olive Green',     '#4E5422', 'olive'),
  ('Beige',           '#D2B78C', 'beige'),
  ('Charcoal',        '#46484B', 'charcoal'),
  ('Lavender',        '#9363B5', 'lavender')
on conflict (slug) do update
set name=excluded.name,
    hex=excluded.hex;
