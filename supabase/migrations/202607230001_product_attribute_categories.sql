-- Category needed for category-specific product attributes on the storefront.
insert into public.categories (name,slug,sort_order,is_active)
values ('Trousers','trousers',35,true)
on conflict (slug) do update
set name=excluded.name,
    sort_order=excluded.sort_order,
    is_active=true;
