-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 08 · Auth -> profile sync
-- ----------------------------------------------------------------------------
-- Every Supabase auth signup gets a public.users row, role 'buyer'. Role
-- transitions (e.g. to 'dealer' on dealer approval) are performed by the
-- backend/admin, not here (and are gated by guard_user_row).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.users (id, role, full_name, email)
  values (
    new.id,
    'buyer',
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
comment on function public.handle_new_user() is
  'Creates the public.users profile row on auth signup (role buyer). Role changes happen later, backend/admin-side.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
