-- Evaluate material ownership without recursively applying classes RLS inside the policy.
create or replace function public.teacher_owns_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes
    where id = target_class_id
      and teacher_id = auth.uid()
  );
$$;

revoke all on function public.teacher_owns_class(uuid) from public;
grant execute on function public.teacher_owns_class(uuid) to authenticated;

drop policy if exists "teachers manage own materials" on materials;

create policy "teachers manage own materials" on materials
  for all
  using (public.teacher_owns_class(class_id))
  with check (public.teacher_owns_class(class_id));
