-- Product images are represented by multiple rows. The lowest sort_order is the
-- main catalogue image (normally 0); remaining rows form the product gallery.
create index if not exists product_images_gallery_idx
  on public.product_images (product_id, sort_order, created_at);

comment on column public.product_images.sort_order is
  'Gallery position. The lowest value is the main product image displayed on catalogue cards.';
