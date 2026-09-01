-- Qualify the Storage object path so the class ownership check uses storage.objects.name.
drop policy if exists "teachers upload own class materials" on storage.objects;
drop policy if exists "teachers read own class materials" on storage.objects;
drop policy if exists "teachers update own class materials" on storage.objects;
drop policy if exists "teachers delete own class materials" on storage.objects;

create policy "teachers upload own class materials" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and split_part(storage.objects.name, '/', 1) = 'materials'
    and split_part(storage.objects.name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(storage.objects.name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers read own class materials" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and split_part(storage.objects.name, '/', 1) = 'materials'
    and split_part(storage.objects.name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(storage.objects.name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers update own class materials" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and split_part(storage.objects.name, '/', 1) = 'materials'
    and split_part(storage.objects.name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(storage.objects.name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'materials'
    and split_part(storage.objects.name, '/', 1) = 'materials'
    and split_part(storage.objects.name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(storage.objects.name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );

create policy "teachers delete own class materials" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and split_part(storage.objects.name, '/', 1) = 'materials'
    and split_part(storage.objects.name, '/', 2) = auth.uid()::text
    and exists (
      select 1 from public.classes c
      where c.id::text = split_part(storage.objects.name, '/', 3)
        and c.teacher_id = auth.uid()
    )
  );
