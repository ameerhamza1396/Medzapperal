-- Preserve ordered variants as immutable order history and make every configured
-- product colour available with every configured product size.
insert into public.product_variants
  (product_id,color_id,size,sku,price_override,stock_quantity,is_active)
select
  options.product_id,
  options.color_id,
  options.size,
  left(coalesce(products.slug,'product'),36) || '-' || substr(md5(options.product_id::text || options.color_id::text || options.size),1,12),
  options.price_override,
  options.stock_quantity,
  true
from (
  select
    product_colors.product_id,
    product_colors.color_id,
    product_sizes.size,
    product_colors.price_override,
    greatest(product_colors.stock_quantity,product_sizes.stock_quantity) as stock_quantity
  from (
    select product_id,color_id,max(price_override) as price_override,max(stock_quantity) as stock_quantity
    from public.product_variants where is_active group by product_id,color_id
  ) product_colors
  join (
    select product_id,size,max(stock_quantity) as stock_quantity
    from public.product_variants where is_active group by product_id,size
  ) product_sizes using (product_id)
) options
join public.products products on products.id=options.product_id
on conflict (product_id,color_id,size) do update set is_active=true;

comment on table public.product_variants is
  'Internal purchasable combinations generated from independently managed product colours and sizes. Referenced rows are retired, never deleted, so order history remains intact.';
