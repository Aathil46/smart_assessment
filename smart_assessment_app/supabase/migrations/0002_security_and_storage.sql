-- Enable row-level security for all application tables.
alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table materials enable row level security;
alter table assessments enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;

-- Recreate policies so this migration is safe to apply from a clean or partially configured database.
drop policy if exists "profiles are viewable by self" on profiles;
drop policy if exists "profiles are updatable by self" on profiles;
drop policy if exists "teachers manage own classes" on classes;
drop policy if exists "students can view joined classes" on classes;
drop policy if exists "students can join classes" on class_members;
drop policy if exists "students see own class memberships" on class_members;
drop policy if exists "teachers see members of their own classes" on class_members;
drop policy if exists "teachers manage own materials" on materials;
drop policy if exists "students see materials in joined classes" on materials;
drop policy if exists "teachers manage own assessments" on assessments;
drop policy if exists "students see published assessments in joined classes" on assessments;
drop policy if exists "teachers manage own questions" on questions;
drop policy if exists "students see their attempts" on attempts;
drop policy if exists "students create their attempts" on attempts;
drop policy if exists "teachers see attempts in their classes" on attempts;
drop policy if exists "students manage their answers" on answers;

create policy "profiles are viewable by self" on profiles
  for select using (auth.uid() = id);

create policy "profiles are updatable by self" on profiles
  for update using (auth.uid() = id);

create policy "teachers manage own classes" on classes
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "students can view joined classes" on classes
  for select using (
    exists (
      select 1 from class_members cm
      where cm.class_id = classes.id and cm.student_id = auth.uid()
    )
  );

-- Enrollment is intentionally denied until the student join-code milestone adds a controlled flow.
create policy "students see own class memberships" on class_members
  for select using (auth.uid() = student_id);

create policy "teachers see members of their own classes" on class_members
  for select using (
    exists (
      select 1 from classes c
      where c.id = class_members.class_id and c.teacher_id = auth.uid()
    )
  );

create policy "teachers manage own materials" on materials
  for all using (
    exists (
      select 1 from classes c
      where c.id = materials.class_id and c.teacher_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from classes c
      where c.id = materials.class_id and c.teacher_id = auth.uid()
    )
  );

create policy "students see materials in joined classes" on materials
  for select using (
    exists (
      select 1 from class_members cm
      where cm.class_id = materials.class_id and cm.student_id = auth.uid()
    )
  );

create policy "teachers manage own assessments" on assessments
  for all using (
    exists (
      select 1 from classes c
      where c.id = assessments.class_id and c.teacher_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from classes c
      where c.id = assessments.class_id and c.teacher_id = auth.uid()
    )
  );

create policy "students see published assessments in joined classes" on assessments
  for select using (
    status = 'published' and exists (
      select 1 from class_members cm
      where cm.class_id = assessments.class_id and cm.student_id = auth.uid()
    )
  );

create policy "teachers manage own questions" on questions
  for all using (
    exists (
      select 1
      from assessments a
      join classes c on c.id = a.class_id
      where a.id = questions.assessment_id and c.teacher_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from assessments a
      join classes c on c.id = a.class_id
      where a.id = questions.assessment_id and c.teacher_id = auth.uid()
    )
  );

create policy "students see their attempts" on attempts
  for select using (auth.uid() = student_id);

create policy "students create their attempts" on attempts
  for insert with check (auth.uid() = student_id);

create policy "teachers see attempts in their classes" on attempts
  for select using (
    exists (
      select 1
      from assessments a
      join classes c on c.id = a.class_id
      where a.id = attempts.assessment_id and c.teacher_id = auth.uid()
    )
  );

create policy "students manage their answers" on answers
  for all using (
    exists (
      select 1 from attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  );

-- The app stores private PDFs under materials/<teacher-id>/<class-id>/<uuid>.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 20971520, array['application/pdf']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "teachers upload own class materials" on storage.objects;
drop policy if exists "teachers read own class materials" on storage.objects;
drop policy if exists "teachers update own class materials" on storage.objects;
drop policy if exists "teachers delete own class materials" on storage.objects;

create policy "teachers upload own class materials" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers read own class materials" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers update own class materials" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers delete own class materials" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );
