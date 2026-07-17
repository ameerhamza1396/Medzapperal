-- The initial migration protected role changes from customers, but also
-- unintentionally blocked trusted database roles in the Supabase SQL Editor.
-- Keep browser/API users restricted while allowing secure server-side bootstrap.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
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
