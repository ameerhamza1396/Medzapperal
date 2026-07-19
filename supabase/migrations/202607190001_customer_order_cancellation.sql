-- Customers may cancel only while an order is pending. Inventory is restored atomically.
create or replace function public.cancel_pending_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.orders
  set status = 'cancelled', updated_at = now()
  where id = p_order_id
    and user_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'This order can no longer be cancelled online. Please contact support.';
  end if;

  for v_item in
    select variant_id, quantity
    from public.order_items
    where order_id = p_order_id
  loop
    update public.product_variants
    set stock_quantity = stock_quantity + v_item.quantity
    where id = v_item.variant_id;
  end loop;
end;
$$;

revoke all on function public.cancel_pending_order(uuid) from public;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
