create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  subject text,
  grade text,
  code text unique not null,
  created_at timestamptz default now()
);

create table if not exists class_members (
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, student_id)
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'uploaded' check (status in ('uploaded','processing','processed','failed')),
  error_message text,
  extracted_text text,
  page_count int,
  used_pages int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  title text not null,
  topic text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  attempt_limit int default 1,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  text text not null,
  choices jsonb not null,
  correct_answer text not null,
  concept text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  source text not null default 'ai' check (source in ('ai','manual')),
  created_at timestamptz default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  score int,
  total int,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_choice text,
  is_correct boolean,
  updated_at timestamptz default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_classes_teacher on classes (teacher_id);
create index if not exists idx_class_members_student on class_members (student_id);
create index if not exists idx_materials_class on materials (class_id);
create index if not exists idx_assessments_class on assessments (class_id);
create index if not exists idx_attempts_student on attempts (student_id);
create index if not exists idx_attempts_assessment on attempts (assessment_id);
create index if not exists idx_answers_attempt on answers (attempt_id);
create index if not exists idx_questions_assessment on questions (assessment_id);
