-- Migration 0008: Phase 8 Principal Feature

-- 1. Create schools table
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 2. Modify profiles to include school_id and principal role
alter table profiles add column if not exists school_id uuid references schools(id) on delete set null;

-- We need to update the role check constraint to include 'principal'.
-- Postgres requires dropping and recreating check constraints.
-- First, find the constraint name or drop the default one.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('teacher', 'student', 'principal'));

-- 3. Row Level Security for schools table
-- The principal policy is finalized by migration 0009, which uses a
-- SECURITY DEFINER helper to avoid querying profiles from its own policy.
alter table schools enable row level security;
create policy "principals can view their school" on schools
  for select to authenticated using (
    exists (
      select 1
      from profiles principal
      where principal.id = auth.uid()
        and principal.role = 'principal'
        and principal.school_id = schools.id
    )
  );

-- 4. RLS for Principals
-- Principals can see profiles of teachers and students in their school.
-- (A student is in the school if they belong to a class taught by a teacher in the school, or explicitly assigned).
create policy "principals see profiles in their school" on profiles
  for select using (
    exists (
      select 1
      from profiles principal
      where principal.id = auth.uid()
        and principal.role = 'principal'
        and principal.school_id = profiles.school_id
    )
    or
    (
      exists (select 1 from profiles principal where principal.id = auth.uid() and principal.role = 'principal')
      and id in (
        select cm.student_id from class_members cm
        join classes c on c.id = cm.class_id
        join profiles teacher on teacher.id = c.teacher_id
        where teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
      )
    )
  );

-- Principals can see classes belonging to teachers in their school
create policy "principals see classes in their school" on classes
  for select using (
    exists (
      select 1 from profiles teacher
      where teacher.id = classes.teacher_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

-- Principals can see class members for those classes
create policy "principals see class members in their school" on class_members
  for select using (
    exists (
      select 1 from classes c
      join profiles teacher on teacher.id = c.teacher_id
      where c.id = class_members.class_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

-- Principals can see assessments in those classes
create policy "principals see assessments in their school" on assessments
  for select using (
    exists (
      select 1 from classes c
      join profiles teacher on teacher.id = c.teacher_id
      where c.id = assessments.class_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

-- Principals can see attempts in those classes
create policy "principals see attempts in their school" on attempts
  for select using (
    exists (
      select 1 from assessments a
      join classes c on c.id = a.class_id
      join profiles teacher on teacher.id = c.teacher_id
      where a.id = attempts.assessment_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

-- Principals can see concept_perf for those attempts
create policy "principals see concept_perf in their school" on concept_perf
  for select using (
    exists (
      select 1 from attempts a
      join assessments ast on ast.id = a.assessment_id
      join classes c on c.id = ast.class_id
      join profiles teacher on teacher.id = c.teacher_id
      where a.id = concept_perf.attempt_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

-- Principals can see learning_gaps for those attempts
create policy "principals see learning_gaps in their school" on learning_gaps
  for select using (
    exists (
      select 1 from attempts a
      join assessments ast on ast.id = a.assessment_id
      join classes c on c.id = ast.class_id
      join profiles teacher on teacher.id = c.teacher_id
      where a.id = learning_gaps.attempt_id
      and teacher.school_id = (select school_id from profiles where id = auth.uid() and role = 'principal')
    )
  );

