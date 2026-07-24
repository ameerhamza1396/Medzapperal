-- Replace the old Outerwear/Jackets category with Accessories while preserving products.
insert into public.categories (name,slug,sort_order,is_active)
values ('Accessories','accessories',90,true)
on conflict (slug) do update set name=excluded.name,is_active=true;

do $$
declare
  v_accessories uuid;
  v_old uuid;
begin
  select id into v_accessories from public.categories where slug='accessories';

  for v_old in
    select id from public.categories
    where slug in ('outerwear','jackets') or lower(name) in ('outerwear','jacket','jackets')
  loop
    update public.products set category_id=v_accessories where category_id=v_old;
    update public.categories set is_active=false where id=v_old;
  end loop;
end $$;
