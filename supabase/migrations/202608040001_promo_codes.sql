-- Cloud-managed promo codes with server-side validation and atomic usage limits.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = upper(trim(code)) and code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_type text not null check (discount_type in ('percentage','fixed')),
  value numeric(12,2) not null check (value > 0),
  min_order_amount numeric(12,2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount numeric(12,2) check (max_discount_amount is null or max_discount_amount > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create unique index if not exists promo_codes_code_upper_idx on public.promo_codes (upper(code));
create index if not exists promo_codes_active_idx on public.promo_codes (is_active, starts_at, expires_at);

drop trigger if exists promo_codes_updated_at on public.promo_codes;
create trigger promo_codes_updated_at
before update on public.promo_codes
for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;
grant select, insert, update, delete on public.promo_codes to authenticated;
drop policy if exists "promo_codes_staff_manage" on public.promo_codes;
create policy "promo_codes_staff_manage" on public.promo_codes
for all
using (public.is_store_staff())
with check (public.is_store_staff());

alter table public.orders
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists promo_code text,
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);

create or replace function public.validate_promo_code(
  p_code text,
  p_subtotal numeric
)
returns table(
  promo_id uuid,
  code text,
  discount_type text,
  value numeric,
  discount_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_discount numeric(12,2) := 0;
  v_subtotal numeric(12,2) := greatest(coalesce(p_subtotal,0),0);
begin
  select * into v_promo
  from public.promo_codes pc
  where upper(pc.code) = upper(trim(coalesce(p_code,'')));

  if not found then raise exception 'Promo code is invalid.'; end if;
  if not v_promo.is_active then raise exception 'This promo code is inactive.'; end if;
  if v_promo.starts_at is not null and now() < v_promo.starts_at then raise exception 'This promo code is not active yet.'; end if;
  if v_promo.expires_at is not null and now() >= v_promo.expires_at then raise exception 'This promo code has expired.'; end if;
  if v_promo.usage_limit is not null and v_promo.used_count >= v_promo.usage_limit then raise exception 'This promo code has reached its usage limit.'; end if;
  if v_subtotal < v_promo.min_order_amount then
    raise exception 'This promo code requires a minimum order of Rs %.', trim(to_char(v_promo.min_order_amount,'FM999G999G990'));
  end if;

  if v_promo.discount_type = 'percentage' then
    v_discount := round(v_subtotal * v_promo.value / 100,2);
    if v_promo.max_discount_amount is not null then
      v_discount := least(v_discount,v_promo.max_discount_amount);
    end if;
  else
    v_discount := v_promo.value;
  end if;
  v_discount := least(v_subtotal,greatest(v_discount,0));

  return query select v_promo.id,v_promo.code,v_promo.discount_type,v_promo.value,v_discount;
end;
$$;

revoke all on function public.validate_promo_code(text,numeric) from public;
grant execute on function public.validate_promo_code(text,numeric) to anon, authenticated;

create or replace function public.place_cod_order(
  p_shipping_address jsonb,
  p_items jsonb,
  p_promo_code text default null
)
returns table(order_id uuid, order_total numeric, delivery_fee numeric, discount_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_delivery numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_item jsonb;
  v_customization jsonb;
  v_variant public.product_variants%rowtype;
  v_promo public.promo_codes%rowtype;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_custom_fee numeric(12,2);
  v_measurement_count integer;
  v_item_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Your cart is empty';
  end if;
  if coalesce(p_shipping_address->>'country','') <> 'Pakistan'
     or coalesce(p_shipping_address->>'city','') = ''
     or coalesce(p_shipping_address->>'recipient_name','') = ''
     or coalesce(p_shipping_address->>'email','') = ''
     or coalesce(p_shipping_address->>'complete_address','') = ''
     or coalesce(p_shipping_address->>'mobile','') = '' then
    raise exception 'Complete shipping details are required';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1,least(20,(v_item->>'quantity')::integer));
    v_customization := coalesce(v_item->'customization','{}'::jsonb);
    select pv.* into v_variant
    from public.product_variants pv
    join public.products p on p.id=pv.product_id
    where pv.id=(v_item->>'variant_id')::uuid and pv.is_active and p.is_active
    for update;
    if not found then raise exception 'A selected product variant is unavailable'; end if;
    if v_variant.stock_quantity < v_quantity then raise exception 'Insufficient stock for SKU %',v_variant.sku; end if;

    select coalesce(v_variant.price_override,p.sale_price,p.base_price)
    into v_unit_price from public.products p where p.id=v_variant.product_id;
    select count(*) into v_measurement_count
    from jsonb_each_text(coalesce(v_customization->'measurements','{}'::jsonb))
    where nullif(trim(value),'') is not null;
    v_custom_fee := v_measurement_count * 100;
    if coalesce(v_customization->>'name_engraving','') <> '' then v_custom_fee := v_custom_fee + 200; end if;
    if coalesce(v_customization#>>'{logo_engraving,url}','') <> '' then v_custom_fee := v_custom_fee + 200; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'sleeves' then v_custom_fee := v_custom_fee + 150; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'inner' then v_custom_fee := v_custom_fee + 1000; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'scrub_cap' then v_custom_fee := v_custom_fee + 700; end if;
    v_subtotal := v_subtotal + ((v_unit_price+v_custom_fee)*v_quantity);
    v_item_count := v_item_count+v_quantity;
  end loop;

  if nullif(trim(coalesce(p_promo_code,'')),'') is not null then
    select * into v_promo
    from public.promo_codes pc
    where upper(pc.code)=upper(trim(p_promo_code))
    for update;
    if not found then raise exception 'Promo code is invalid.'; end if;
    if not v_promo.is_active then raise exception 'This promo code is inactive.'; end if;
    if v_promo.starts_at is not null and now() < v_promo.starts_at then raise exception 'This promo code is not active yet.'; end if;
    if v_promo.expires_at is not null and now() >= v_promo.expires_at then raise exception 'This promo code has expired.'; end if;
    if v_promo.usage_limit is not null and v_promo.used_count >= v_promo.usage_limit then raise exception 'This promo code has reached its usage limit.'; end if;
    if v_subtotal < v_promo.min_order_amount then
      raise exception 'This promo code requires a minimum order of Rs %.', trim(to_char(v_promo.min_order_amount,'FM999G999G990'));
    end if;
    if v_promo.discount_type='percentage' then
      v_discount := round(v_subtotal*v_promo.value/100,2);
      if v_promo.max_discount_amount is not null then v_discount:=least(v_discount,v_promo.max_discount_amount); end if;
    else
      v_discount := v_promo.value;
    end if;
    v_discount := least(v_subtotal,greatest(v_discount,0));
  end if;

  v_delivery := 200+(50*v_item_count);
  insert into public.orders(user_id,status,total_amount,shipping_address,promo_code_id,promo_code,discount_amount)
  values(
    auth.uid(),'pending',v_subtotal-v_discount+v_delivery,
    p_shipping_address||jsonb_build_object(
      'payment_method','cod','delivery_fee',v_delivery,'subtotal',v_subtotal,
      'promo_code',case when v_promo.id is null then null else v_promo.code end,
      'promo_discount',v_discount
    ),
    v_promo.id,v_promo.code,v_discount
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1,least(20,(v_item->>'quantity')::integer));
    v_customization := coalesce(v_item->'customization','{}'::jsonb);
    select pv.* into v_variant from public.product_variants pv where pv.id=(v_item->>'variant_id')::uuid;
    select coalesce(v_variant.price_override,p.sale_price,p.base_price)
    into v_unit_price from public.products p where p.id=v_variant.product_id;
    select count(*) into v_measurement_count
    from jsonb_each_text(coalesce(v_customization->'measurements','{}'::jsonb))
    where nullif(trim(value),'') is not null;
    v_custom_fee := v_measurement_count*100;
    if coalesce(v_customization->>'name_engraving','') <> '' then v_custom_fee := v_custom_fee + 200; end if;
    if coalesce(v_customization#>>'{logo_engraving,url}','') <> '' then v_custom_fee := v_custom_fee + 200; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'sleeves' then v_custom_fee := v_custom_fee + 150; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'inner' then v_custom_fee := v_custom_fee + 1000; end if;
    if coalesce(v_customization->'addons','[]'::jsonb) ? 'scrub_cap' then v_custom_fee := v_custom_fee + 700; end if;
    insert into public.order_items(order_id,variant_id,quantity,unit_price,customization)
    values(v_order_id,v_variant.id,v_quantity,v_unit_price+v_custom_fee,v_customization);
    update public.product_variants set stock_quantity=stock_quantity-v_quantity where id=v_variant.id;
  end loop;

  if v_promo.id is not null then
    update public.promo_codes set used_count=used_count+1 where id=v_promo.id;
  end if;
  return query select v_order_id,v_subtotal-v_discount+v_delivery,v_delivery,v_discount;
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb,text) from public;
grant execute on function public.place_cod_order(jsonb,jsonb,text) to anon, authenticated;

notify pgrst, 'reload schema';
