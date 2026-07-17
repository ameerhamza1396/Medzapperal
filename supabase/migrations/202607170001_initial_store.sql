create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'staff', 'admin');
create type public.gender_fit as enum ('men', 'women', 'unisex');
create type public.order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'customer',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  image_file_id text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  slug text not null unique
);

create table public.cloth_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid not null references public.categories(id),
  cloth_type_id uuid references public.cloth_types(id),
  gender public.gender_fit not null default 'unisex',
  base_price numeric(12,2) not null check (base_price >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.colors(id),
  size text not null,
  sku text not null unique,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, color_id, size)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  url text not null,
  file_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status public.order_status not null default 'pending',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  shipping_address jsonb not null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  full_address jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index products_category_idx on public.products(category_id);
create index variants_product_idx on public.product_variants(product_id);
create index images_product_idx on public.product_images(product_id);
create index orders_user_idx on public.orders(user_id);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_store_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.colors enable row level security;
alter table public.cloth_types enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;

create policy "profiles_select_self_or_staff" on public.profiles for select
using (id = auth.uid() or public.is_store_staff());
create policy "profiles_update_self" on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_update_all" on public.profiles for update
using (public.is_admin()) with check (public.is_admin());

create policy "categories_public_read" on public.categories for select using (is_active or public.is_store_staff());
create policy "categories_staff_write" on public.categories for all using (public.is_store_staff()) with check (public.is_store_staff());
create policy "colors_public_read" on public.colors for select using (true);
create policy "colors_staff_write" on public.colors for all using (public.is_store_staff()) with check (public.is_store_staff());
create policy "cloth_types_public_read" on public.cloth_types for select using (true);
create policy "cloth_types_staff_write" on public.cloth_types for all using (public.is_store_staff()) with check (public.is_store_staff());
create policy "products_public_read" on public.products for select using (is_active or public.is_store_staff());
create policy "products_staff_write" on public.products for all using (public.is_store_staff()) with check (public.is_store_staff());
create policy "variants_public_read" on public.product_variants for select
using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active) or public.is_store_staff());
create policy "variants_staff_write" on public.product_variants for all using (public.is_store_staff()) with check (public.is_store_staff());
create policy "images_public_read" on public.product_images for select
using (exists (select 1 from public.products p where p.id = product_id and p.is_active) or public.is_store_staff());
create policy "images_staff_write" on public.product_images for all using (public.is_store_staff()) with check (public.is_store_staff());

create policy "orders_own_read" on public.orders for select using (user_id = auth.uid() or public.is_store_staff());
create policy "orders_own_insert" on public.orders for insert with check (user_id = auth.uid());
create policy "orders_staff_update" on public.orders for update using (public.is_store_staff()) with check (public.is_store_staff());
create policy "order_items_read" on public.order_items for select
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_store_staff())));
create policy "order_items_own_insert" on public.order_items for insert
with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_items_staff_write" on public.order_items for all using (public.is_store_staff()) with check (public.is_store_staff());

create policy "addresses_own_all" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wishlists_own_all" on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prevent a customer from changing their own role through the self-update policy.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Only administrators can change roles';
  end if;
  return new;
end;
$$;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

insert into public.categories (name, slug, sort_order) values
('Scrubs', 'scrubs', 10), ('Lab Coats', 'lab-coats', 20),
('Jackets', 'jackets', 30), ('Accessories', 'accessories', 40)
on conflict (slug) do nothing;

insert into public.colors (name, hex, slug) values
('Navy', '#172D4F', 'navy'), ('Ceil Blue', '#9BBBD1', 'ceil-blue'),
('Black', '#252525', 'black'), ('White', '#E9E7DF', 'white'),
('Wine', '#722F48', 'wine'), ('Olive', '#78836A', 'olive'),
('Sage', '#8E9B88', 'sage')
on conflict (slug) do nothing;

insert into public.cloth_types (name, slug, description) values
('4-Way Stretch', '4-way-stretch', 'Flexible performance weave engineered for unrestricted movement.'),
('Poly-Cotton', 'poly-cotton', 'Durable, breathable everyday blend.'),
('Antimicrobial Twill', 'antimicrobial-twill', 'Structured twill with an antimicrobial finish.'),
('Rip-stop', 'rip-stop', 'Lightweight reinforced fabric built for durability.'),
('Cotton Blend', 'cotton-blend', 'Soft, breathable cotton-rich blend.')
on conflict (slug) do nothing;

-- After creating the first user, promote it once in the SQL editor:
-- update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
