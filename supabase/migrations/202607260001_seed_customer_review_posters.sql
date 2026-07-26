create unique index if not exists customer_reviews_image_url_key
  on public.customer_reviews (image_url);

insert into public.customer_reviews (title, image_url, sort_order, is_active)
values
  ('Nice stuff and perfect size', '/media/reviews/review-anee-size-perfect.jpeg', 1, true),
  ('Scrub bohot achy hai', '/media/reviews/review-murkcha-scrub-good.jpeg', 2, true),
  ('Fast delivery and amazing product', '/media/reviews/review-mirha-fast-delivery.jpeg', 3, true),
  ('Stretchiness and size are perfect', '/media/reviews/review-dr-fahad-stretch-size.jpeg', 4, true),
  ('Very nice product', '/media/reviews/review-shahzaib-nice-product.jpeg', 5, true),
  ('Nice scrub', '/media/reviews/review-dr-iqra-nice-scrub.jpeg', 6, true),
  ('It is really nice', '/media/reviews/review-tayyaba-really-nice.jpeg', 7, true),
  ('On-time delivery and good stitching', '/media/reviews/review-umair-on-time-delivery.jpeg', 8, true),
  ('The fit is perfect', '/media/reviews/review-ahmed-perfect-fit.jpeg', 9, true),
  ('Quality, fabric and price recommended', '/media/reviews/review-zarex-quality-fabric.jpeg', 10, true)
on conflict (image_url) do update
set title = excluded.title,
    sort_order = excluded.sort_order,
    is_active = true;
