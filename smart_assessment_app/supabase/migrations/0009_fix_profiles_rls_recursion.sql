-- Migration 0009: Fix profiles RLS recursion for authenticated profile reads

-- Evaluate principal profile access without re-entering profiles RLS while a
-- policy is being evaluated. The function exposes no profile data to callers.
create or replace function public.principal_can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles principal
    join public.profiles target on target.id = target_profile_id
    where principal.id = auth.uid()
      and principal.role = 'principal'
      and (
        target.school_id = principal.school_id
        or exists (
          select 1
          from public.class_members cm
          join public.classes c on c.id = cm.class_id
          join public.profiles teacher on teacher.id = c.teacher_id
          where cm.student_id = target.id
            and teacher.school_id = principal.school_id
        )
      )
  )
$$;

revoke all on function public.principal_can_view_profile(uuid) from public;
grant execute on function public.principal_can_view_profile(uuid) to authenticated;

drop policy if exists "principals see profiles in their school" on profiles;
drop policy if exists "principals view same school profiles" on profiles;

create policy "principals see profiles in their school" on profiles
  for select to authenticated using (
    auth.uid() = id
    or public.principal_can_view_profile(id)
  );

