-- Staff order updates with an optional note shown to the customer.

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status public.order_status,
  p_customer_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.order_status;
  v_item record;
begin
  if not public.is_store_staff() then
    raise exception 'Administrator access required';
  end if;
  if char_length(coalesce(p_customer_message,'')) > 500 then
    raise exception 'Customer message is too long';
  end if;

  select status into v_previous
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_previous in ('cancelled','refunded') and p_status <> v_previous then
    raise exception 'A declined or refunded order cannot be reopened';
  end if;

  update public.orders
  set status = p_status,
      internal_notes = nullif(trim(p_customer_message),''),
      updated_at = now()
  where id = p_order_id;

  if p_status = 'cancelled' and v_previous <> 'cancelled' then
    for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.variant_id;
    end loop;
  end if;
end;
$$;

revoke all on function public.admin_update_order(uuid,public.order_status,text) from public;
grant execute on function public.admin_update_order(uuid,public.order_status,text) to authenticated;
