-- Checkout-side scrub add-on fees:
-- black sleeves Rs 150, Black Inner Rs 1000, matching scrub cap Rs 700.
create or replace function public.place_cod_order(
  p_shipping_address jsonb,
  p_items jsonb
)
returns table(order_id uuid, order_total numeric, delivery_fee numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_delivery numeric(12,2) := 0;
  v_item jsonb;
  v_customization jsonb;
  v_variant public.product_variants%rowtype;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_custom_fee numeric(12,2);
  v_measurement_count integer;
  v_engraving_count integer;
  v_addon_fee numeric(12,2);
  v_item_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
  if coalesce(p_shipping_address->>'country','') <> 'Pakistan'
     or coalesce(p_shipping_address->>'city','') = ''
     or coalesce(p_shipping_address->>'recipient_name','') = ''
     or coalesce(p_shipping_address->>'complete_address','') = ''
     or coalesce(p_shipping_address->>'mobile','') = '' then
    raise exception 'Complete shipping details are required';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1,least(20,(v_item->>'quantity')::integer));
    v_customization := coalesce(v_item->'customization','{}'::jsonb);
    select pv.* into v_variant
    from public.product_variants pv join public.products p on p.id=pv.product_id
    where pv.id=(v_item->>'variant_id')::uuid and pv.is_active and p.is_active
    for update;
    if not found then raise exception 'A selected product variant is unavailable'; end if;
    if v_variant.stock_quantity < v_quantity then raise exception 'Insufficient stock for SKU %',v_variant.sku; end if;

    select coalesce(v_variant.price_override,p.sale_price,p.base_price) into v_unit_price
    from public.products p
    where p.id=v_variant.product_id;

    select count(*) into v_measurement_count
    from jsonb_each_text(coalesce(v_customization->'measurements','{}'::jsonb))
    where nullif(trim(value),'') is not null;

    v_engraving_count := 0;
    if nullif(trim(coalesce(v_customization->>'name_engraving','')),'') is not null then
      v_engraving_count := v_engraving_count + 1;
    end if;
    if nullif(trim(coalesce(v_customization->'logo_engraving'->>'url','')),'') is not null then
      v_engraving_count := v_engraving_count + 1;
    end if;

    select coalesce(sum(case value
      when 'sleeves' then 150
      when 'inner' then 1000
      when 'scrub_cap' then 700
      else 0
    end),0) into v_addon_fee
    from jsonb_array_elements_text(coalesce(v_customization->'addons','[]'::jsonb));

    v_custom_fee := (v_measurement_count * 100) + (v_engraving_count * 200) + v_addon_fee;
    v_subtotal := v_subtotal + ((v_unit_price+v_custom_fee)*v_quantity);
    v_item_count := v_item_count+v_quantity;
  end loop;

  v_delivery := 200+(50*v_item_count);
  insert into public.orders(user_id,status,total_amount,shipping_address)
  values(auth.uid(),'pending',v_subtotal+v_delivery,p_shipping_address||jsonb_build_object('payment_method','cod','delivery_fee',v_delivery))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1,least(20,(v_item->>'quantity')::integer));
    v_customization := coalesce(v_item->'customization','{}'::jsonb);
    select pv.* into v_variant from public.product_variants pv where pv.id=(v_item->>'variant_id')::uuid;
    select coalesce(v_variant.price_override,p.sale_price,p.base_price) into v_unit_price from public.products p where p.id=v_variant.product_id;

    select count(*) into v_measurement_count
    from jsonb_each_text(coalesce(v_customization->'measurements','{}'::jsonb))
    where nullif(trim(value),'') is not null;

    v_engraving_count := 0;
    if nullif(trim(coalesce(v_customization->>'name_engraving','')),'') is not null then
      v_engraving_count := v_engraving_count + 1;
    end if;
    if nullif(trim(coalesce(v_customization->'logo_engraving'->>'url','')),'') is not null then
      v_engraving_count := v_engraving_count + 1;
    end if;

    select coalesce(sum(case value
      when 'sleeves' then 150
      when 'inner' then 1000
      when 'scrub_cap' then 700
      else 0
    end),0) into v_addon_fee
    from jsonb_array_elements_text(coalesce(v_customization->'addons','[]'::jsonb));

    v_custom_fee := (v_measurement_count * 100) + (v_engraving_count * 200) + v_addon_fee;
    insert into public.order_items(order_id,variant_id,quantity,unit_price,customization)
    values(v_order_id,v_variant.id,v_quantity,v_unit_price+v_custom_fee,v_customization);
    update public.product_variants set stock_quantity=stock_quantity-v_quantity where id=v_variant.id;
  end loop;
  return query select v_order_id,v_subtotal+v_delivery,v_delivery;
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;
