create table if not exists concept_perf (
  attempt_id uuid references attempts(id) on delete cascade,
  concept text not null,
  correct_count int not null,
  total_count int not null,
  accuracy numeric(4,3) not null,
  primary key (attempt_id, concept)
);

alter table assessments add column if not exists num_questions int not null default 10 check (num_questions between 3 and 20);
alter table assessments add column if not exists difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard'));

create table if not exists learning_gaps (
  attempt_id uuid references attempts(id) on delete cascade,
  concept text not null,
  gap_level text not null check (gap_level in ('high','medium','low')),
  notes text,
  recommendations jsonb not null default '[]'::jsonb,
  primary key (attempt_id, concept)
);

create table if not exists practice_sets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  concept text not null,
  questions jsonb not null,
  created_at timestamptz default now()
);

alter table concept_perf enable row level security;
alter table learning_gaps enable row level security;
alter table practice_sets enable row level security;

create policy "students view own concept performance" on concept_perf for select using (exists (select 1 from attempts a where a.id = attempt_id and a.student_id = auth.uid()));
create policy "teachers view class concept performance" on concept_perf for select using (exists (select 1 from attempts a join assessments x on x.id = a.assessment_id join classes c on c.id = x.class_id where a.id = attempt_id and c.teacher_id = auth.uid()));
create policy "students view own learning gaps" on learning_gaps for select using (exists (select 1 from attempts a where a.id = attempt_id and a.student_id = auth.uid()));
create policy "students manage own practice sets" on practice_sets for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create unique index if not exists idx_one_attempt_per_limit on attempts (assessment_id, student_id, id);
create or replace function public.join_class_by_code(join_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  select id into target_id from classes where upper(code) = upper(join_code) limit 1;
  if target_id is null then raise exception 'Class not found'; end if;
  insert into class_members (class_id, student_id) values (target_id, auth.uid()) on conflict do nothing;
  return target_id;
end; $$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

create or replace function public.prevent_published_question_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from assessments where id = coalesce(old.assessment_id, new.assessment_id) and status <> 'draft') then
    raise exception 'Published questions are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists prevent_published_question_change on questions;
create trigger prevent_published_question_change before update or delete on questions
for each row execute function public.prevent_published_question_change();