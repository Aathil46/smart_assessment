-- Migration 0011: Add extended profile fields for Teacher Profile page

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say'));
alter table profiles add column if not exists address text;
alter table profiles add column if not exists avatar_url text;

-- Allow authenticated users to update their own profile
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'users can update own profile'
  ) then
    execute 'create policy "users can update own profile" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid())';
  end if;
end $$;
