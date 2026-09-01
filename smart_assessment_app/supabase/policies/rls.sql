alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table materials enable row level security;
alter table assessments enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;

create policy "profiles are viewable by self" on profiles
  for select using (auth.uid() = id);

create policy "profiles are updatable by self" on profiles
  for update using (auth.uid() = id);

create policy "teachers manage own classes" on classes
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "students can join classes" on class_members
  for insert with check (auth.uid() = student_id);

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
  for all using (public.teacher_owns_class(class_id))
  with check (public.teacher_owns_class(class_id));

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
      select 1
      from attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from attempts a
      where a.id = answers.attempt_id and a.student_id = auth.uid()
    )
  );
