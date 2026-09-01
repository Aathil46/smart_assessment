 AI-Powered Smart Assessment System — MVP Build Spec

## 1. Executive Summary

The AI Smart Assessment MVP lets teachers upload a lesson PDF, automatically generates a concept-tagged multiple-choice quiz via Gemini Flash, and — after teacher review and publish — lets students take the quiz on the web. The Next.js backend deterministically scores every attempt and rolls results up by concept; a rule-based gap-detection engine (accuracy thresholds, no ML) flags weak concepts per student, and Gemini is called a second time — with only anonymized concept-accuracy numbers, never PII — to turn those flags into plain-language explanations and study recommendations. Supabase provides Postgres, Auth, and Storage with Row-Level Security enforcing the teacher/student data boundary; PyMuPDF extracts and chunks PDF text server-side (capped at ~20–30 pages) before it's sent to the LLM. The result is a small, auditable, cost-controlled stack — Next.js + Supabase + a single LLM API, no vector DB or RAG — that ships the full assessment → scoring → gap-detection → recommendation loop as a portfolio-ready MVP.

---

## 2. Project Scaffold

```
smart-assessment/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (teacher)/
│   │   ├── dashboard/page.tsx
│   │   ├── classes/
│   │   │   ├── page.tsx
│   │   │   └── [classId]/page.tsx
│   │   ├── materials/upload/page.tsx
│   │   ├── assessments/
│   │   │   ├── [assessmentId]/edit/page.tsx      # AI question review/edit
│   │   │   └── [assessmentId]/results/page.tsx
│   │   └── students/[studentId]/page.tsx
│   ├── (student)/
│   │   ├── dashboard/page.tsx
│   │   ├── join/page.tsx
│   │   ├── assessments/[assessmentId]/take/page.tsx
│   │   ├── results/[attemptId]/page.tsx
│   │   └── gaps/page.tsx
│   ├── api/
│   │   ├── auth/[...supabase]/route.ts
│   │   ├── classes/route.ts
│   │   ├── classes/[id]/route.ts
│   │   ├── classes/[id]/join/route.ts
│   │   ├── classes/[id]/students/route.ts
│   │   ├── materials/route.ts
│   │   ├── materials/[id]/text/route.ts
│   │   ├── assessments/route.ts
│   │   ├── assessments/[id]/route.ts
│   │   ├── assessments/[id]/generate/route.ts     # triggers LLM quiz gen
│   │   ├── assessments/[id]/publish/route.ts
│   │   ├── questions/route.ts
│   │   ├── attempts/route.ts
│   │   ├── attempts/[id]/answer/route.ts
│   │   ├── attempts/[id]/submit/route.ts          # scoring + gap engine
│   │   ├── results/assessment/[id]/route.ts
│   │   ├── results/student/[id]/route.ts
│   │   ├── gaps/student/[id]/route.ts
│   │   └── practice/[gapId]/route.ts
│   └── layout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── pdf/
│   │   └── extract.py                             # PyMuPDF subprocess/microservice
│   ├── llm/
│   │   ├── gemini.ts                               # thin client wrapper
│   │   ├── prompts.ts                              # prompt templates
│   │   └── schemas.ts                              # zod schemas for LLM JSON
│   ├── scoring/
│   │   ├── score.ts
│   │   └── gapEngine.ts
│   └── validation/
│       └── schemas.ts                              # zod request/response schemas
├── components/
│   ├── teacher/QuestionEditor.tsx
│   ├── student/QuizRunner.tsx
│   ├── charts/MasteryChart.tsx
│   └── ui/ (shadcn components)
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── policies/
│       └── rls.sql
├── tests/
│   ├── unit/
│   │   ├── scoring.test.ts
│   │   └── gapEngine.test.ts
│   └── integration/
│       ├── teacherFlow.test.ts
│       └── studentFlow.test.ts
├── .env.local.example
├── package.json
└── README.md
```

---

## 3. API Contract

All endpoints are Next.js API routes under `/api`. Auth via Supabase session (JWT cookie); role enforced in middleware + RLS. Errors follow `{ error: { code, message } }`.

### Auth
**POST `/api/auth/signup`**
```json
// req
{ "email": "string", "password": "string", "name": "string", "role": "teacher|student" }
// res 201
{ "userId": "uuid", "role": "teacher" }
```

**POST `/api/auth/login`** → handled by Supabase Auth client directly (no custom route needed); session cookie set.

### Classes
**POST `/api/classes`** (Teacher)
```json
// req
{ "name": "Algebra I", "subject": "Math", "grade": "9" }
// res 201
{ "id": "uuid", "code": "ABC123", "name": "Algebra I" }
```

**GET `/api/classes`** (Teacher) → `{ "classes": [{ "id", "name", "subject", "grade", "code", "studentCount" }] }`

**POST `/api/classes/:id/join`** (Student)
```json
{ "code": "ABC123" }
// res
{ "classId": "uuid", "className": "Algebra I" }
```

**GET `/api/classes/:id/students`** (Teacher) → `{ "students": [{ "id", "name", "email" }] }`

### Materials
**POST `/api/materials`** (Teacher, multipart/form-data: `file`, `classId`, `title`)
```json
// res 201
{ "id": "uuid", "storageUrl": "string", "pageCount": 18, "status": "processing" }
```

**GET `/api/materials/:id/text`** (Backend/internal) → `{ "text": "string", "chunkCount": 3 }`

### Assessments
**POST `/api/assessments`** (Teacher)
```json
{ "materialId": "uuid", "classId": "uuid", "title": "Quadratics Quiz", "topic": "Quadratic Equations", "numQuestions": 10 }
// res 201
{ "id": "uuid", "status": "draft" }
```

**POST `/api/assessments/:id/generate`** (Teacher) — triggers LLM generation, saves draft questions
```json
// res 200
{ "assessmentId": "uuid", "questionCount": 10, "status": "draft" }
```

**GET `/api/assessments/:id`** → full assessment incl. questions (draft view for teacher, published view for student, answers hidden for student).

**POST `/api/assessments/:id/publish`** (Teacher)
```json
{ "opensAt": "2026-09-10T09:00:00Z", "closesAt": "2026-09-17T23:59:00Z", "attemptLimit": 1 }
// res 200
{ "status": "published" }
```

### Questions (manual edit)
**POST `/api/questions`** (Teacher)
```json
{ "assessmentId": "uuid", "text": "...", "choices": ["a","b","c","d"], "correctAnswer": "b", "concept": "Factorization", "difficulty": "medium" }
```

### Attempts
**POST `/api/attempts`** (Student) `{ "assessmentId": "uuid" }` → `{ "attemptId": "uuid", "questions": [...no-answer-key...] }`

**POST `/api/attempts/:id/answer`** (Student) `{ "questionId": "uuid", "selectedChoice": "b" }` → `{ "saved": true }`

**POST `/api/attempts/:id/submit`** (Student) → runs scoring + gap engine + (async) LLM explanation
```json
// res 200
{
  "score": 7, "total": 10, "percentage": 70,
  "conceptBreakdown": [{ "concept": "Factorization", "accuracy": 0.6 }, { "concept": "Quadratics", "accuracy": 0.4 }],
  "gaps": [{ "concept": "Quadratics", "level": "high" }]
}
```

### Results & Gaps
**GET `/api/results/assessment/:id`** (Teacher) → class-level score distribution + concept averages.

**GET `/api/results/student/:id`** (Teacher/Student) → per-concept accuracy history.

**GET `/api/gaps/student/:id`** (Student)
```json
{
  "gaps": [
    { "concept": "Quadratic Equations", "mastery": 0.39, "level": "high",
      "explanation": "You need more practice with multi-step equations.",
      "recommendations": ["Review Factorization (10 min)", "Practice Quadratic Equations (15 min)"] }
  ]
}
```

**POST `/api/practice/:gapId`** (Student) → generates a 3–5 question targeted practice set via LLM, returns question list.

---

## 4. Database Schema (Supabase Postgres)

```sql
create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('teacher','student')),
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  subject text,
  grade text,
  code text unique not null,
  created_at timestamptz default now()
);

create table class_members (
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, student_id)
);

create table materials (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  title text not null,
  storage_url text not null,
  text_excerpt text,
  page_count int,
  status text default 'processing' check (status in ('processing','ready','error')),
  created_at timestamptz default now()
);

create table assessments (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  material_id uuid references materials(id),
  title text not null,
  topic text,
  status text default 'draft' check (status in ('draft','published','closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  attempt_limit int default 1,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table questions (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid references assessments(id) on delete cascade,
  text text not null,
  choices jsonb not null,          -- ["choice1","choice2","choice3","choice4"]
  correct_answer text not null,
  concept text not null,
  difficulty text check (difficulty in ('easy','medium','hard')),
  source text default 'ai' check (source in ('ai','manual')),
  created_at timestamptz default now()
);

create table attempts (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid references assessments(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  score int,
  total int,
  started_at timestamptz default now(),
  submitted_at timestamptz
);

create table answers (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid references attempts(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  selected_choice text,
  is_correct boolean
);

create table concept_perf (
  attempt_id uuid references attempts(id) on delete cascade,
  concept text not null,
  correct_count int not null,
  total_count int not null,
  accuracy numeric(4,3) not null,
  primary key (attempt_id, concept)
);

create table learning_gaps (
  attempt_id uuid references attempts(id) on delete cascade,
  concept text not null,
  gap_level text check (gap_level in ('high','medium','low')),
  notes text,
  recommendations jsonb,
  primary key (attempt_id, concept)
);

create table practice_sets (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade,
  concept text not null,
  questions jsonb not null,        -- array of generated question objects
  created_at timestamptz default now()
);
```

### RLS policy pattern (example — repeat per table)
```sql
alter table classes enable row level security;

create policy "teacher owns class" on classes
  for all using (auth.uid() = teacher_id);

alter table attempts enable row level security;

create policy "student sees own attempts" on attempts
  for select using (auth.uid() = student_id);

create policy "teacher sees class attempts" on attempts
  for select using (
    exists (
      select 1 from assessments a join classes c on a.class_id = c.id
      where a.id = attempts.assessment_id and c.teacher_id = auth.uid()
    )
  );
```
Apply the same teacher-owns-class-data / student-owns-own-data pattern to `materials`, `assessments`, `questions`, `answers`, `concept_perf`, `learning_gaps`, and `practice_sets`.

---

## 5. Server Modules

### 5.1 PDF Extraction (PyMuPDF)
Run as a small Python subprocess invoked from a Next.js API route (or a lightweight Python microservice if deploying separately). Caps input at ~25 pages for MVP.

```python
# lib/pdf/extract.py
import fitz  # PyMuPDF
import sys, json

MAX_PAGES = 25

def extract_text(path: str) -> dict:
    doc = fitz.open(path)
    pages = min(len(doc), MAX_PAGES)
    chunks = []
    for i in range(pages):
        text = doc[i].get_text("text").strip()
        if text:
            chunks.append({"page": i + 1, "text": text})
    doc.close()
    return {"pageCount": len(doc), "usedPages": pages, "chunks": chunks}

if __name__ == "__main__":
    print(json.dumps(extract_text(sys.argv[1])))
```

```ts
// app/api/materials/route.ts (excerpt)
import { spawn } from "child_process";

async function extractPdfText(filePath: string) {
  return new Promise<{ pageCount: number; chunks: { page: number; text: string }[] }>(
    (resolve, reject) => {
      const proc = spawn("python3", ["lib/pdf/extract.py", filePath]);
      let out = "";
      proc.stdout.on("data", (d) => (out += d));
      proc.on("close", (code) =>
        code === 0 ? resolve(JSON.parse(out)) : reject(new Error("PDF extraction failed"))
      );
    }
  );
}
```

Chunking beyond 25 pages: join `chunks` in page order, split every ~6,000 characters at paragraph boundaries, and only send the chunk(s) relevant to the requested `topic` (simple keyword match) to the LLM to stay well under Gemini Flash's context window and reduce cost.

### 5.2 LLM Client Wrapper

```ts
// lib/llm/gemini.ts
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export async function callGemini(prompt: string, responseSchema?: object) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(responseSchema ? { responseSchema } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}
```
Never called from the client — only from API routes, with `GEMINI_API_KEY` read from server-only env vars.

### 5.3 Scoring Engine (deterministic, no AI)

```ts
// lib/scoring/score.ts
type Answer = { questionId: string; selectedChoice: string };
type Question = { id: string; correctAnswer: string; concept: string };

export function scoreAttempt(answers: Answer[], questions: Question[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const conceptTally = new Map<string, { correct: number; total: number }>();
  let score = 0;

  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    const isCorrect = a.selectedChoice === q.correctAnswer;
    if (isCorrect) score++;

    const tally = conceptTally.get(q.concept) ?? { correct: 0, total: 0 };
    tally.total++;
    if (isCorrect) tally.correct++;
    conceptTally.set(q.concept, tally);
  }

  const conceptBreakdown = [...conceptTally.entries()].map(([concept, t]) => ({
    concept,
    correctCount: t.correct,
    totalCount: t.total,
    accuracy: t.correct / t.total,
  }));

  return { score, total: questions.length, conceptBreakdown };
}
```

### 5.4 Learning-Gap Engine (rule-based)

```ts
// lib/scoring/gapEngine.ts
type ConceptAccuracy = { concept: string; accuracy: number };
type Gap = { concept: string; level: "high" | "medium" };

const HIGH_GAP_THRESHOLD = 0.5;   // <50% accuracy
const MEDIUM_GAP_THRESHOLD = 0.8; // 50–79% accuracy

export function detectGaps(concepts: ConceptAccuracy[]): Gap[] {
  const gaps: Gap[] = [];

  for (const { concept, accuracy } of concepts) {
    if (accuracy < HIGH_GAP_THRESHOLD) gaps.push({ concept, level: "high" });
    else if (accuracy < MEDIUM_GAP_THRESHOLD) gaps.push({ concept, level: "medium" });
  }

  // Simple prerequisite heuristic (MVP-level, optional dependency map)
  const prerequisiteMap: Record<string, string> = {
    "Quadratic Equations": "Factorization",
  };
  for (const gap of gaps.filter((g) => g.level === "high")) {
    const prereq = prerequisiteMap[gap.concept];
    if (prereq && !gaps.some((g) => g.concept === prereq)) {
      const prereqAcc = concepts.find((c) => c.concept === prereq)?.accuracy;
      if (prereqAcc !== undefined && prereqAcc < 0.7) {
        gaps.push({ concept: prereq, level: "medium" });
      }
    }
  }
  return gaps;
}
```

This module owns *all* pass/fail logic. The LLM is only invoked afterward to phrase `gaps` into human-readable text — it never decides gap levels itself.

---

## 6. LLM Prompt Templates

### 6.1 Quiz Generation (from extracted PDF text)

**System/user prompt:**
```
Generate {N} multiple-choice questions on "{Topic}" based only on the material
below. Each question must have exactly 4 choices with exactly one correct
answer. Use plausible, pedagogically meaningful distractors (not obviously
wrong). Tag each question with a concept (a short sub-topic name) and a
difficulty ("easy" | "medium" | "hard"). Do not invent facts not present in
the material. Return ONLY valid JSON, no markdown, matching this schema:

{
  "questions": [
    {
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "correctAnswer": "string (must exactly match one choice)",
      "concept": "string",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Material:
{extracted_text_chunk}
```

**Expected structured output:**
```json
{
  "questions": [
    {
      "question": "Which expression is the fully factored form of x^2 - 5x + 6?",
      "choices": ["(x-2)(x-3)", "(x+2)(x+3)", "(x-1)(x-6)", "(x-2)(x+3)"],
      "correctAnswer": "(x-2)(x-3)",
      "concept": "Factorization",
      "difficulty": "medium"
    }
  ]
}
```

### 6.2 Gap Explanation & Recommendations (anonymized, aggregate only)

**Prompt:**
```
A student's concept accuracies from a recent quiz are given below (no
personal identifiers included — do not assume any). For each concept below
the mastery threshold, write a one-sentence explanation of the likely
underlying difficulty and 1-2 concrete, actionable next steps. Keep language
encouraging and specific. Return ONLY valid JSON matching this schema:

{
  "gaps": [
    {
      "concept": "string",
      "explanation": "string (1 sentence)",
      "recommendations": ["string", "string"]
    }
  ]
}

Concept accuracies:
{ "Factorization": 0.42, "Quadratics": 0.35, "LinearEquations": 0.80 }

Flagged gap concepts: ["Quadratics" (high), "Factorization" (medium)]
```

**Expected structured output:**
```json
{
  "gaps": [
    {
      "concept": "Quadratics",
      "explanation": "Low accuracy suggests difficulty applying factoring steps to solve quadratic equations.",
      "recommendations": ["Review factorization fundamentals (10 min)", "Practice a 5-question quadratics set"]
    },
    {
      "concept": "Factorization",
      "explanation": "Moderate accuracy indicates inconsistent handling of sign errors when factoring.",
      "recommendations": ["Redo factorization worksheet focusing on sign rules"]
    }
  ]
}
```

**Privacy rule enforced in code, not just the prompt:** the request payload builder for both prompts must only ever accept `{ concept, accuracy }[]` or `{ text }` — no student name, email, or ID field exists on the payload type, so it cannot leak even by mistake.

---

## 7. Roadmap — 4 Sprints (2-week each)

### Sprint 1 — Foundation
- **US:** As a teacher, I can sign up, log in, and create a class. **AC:** Class gets a unique join code; teacher sees it in dashboard.
- **US:** As a student, I can join a class with a code. **AC:** Student appears in teacher's roster immediately.
- **US:** As a teacher, I can upload a PDF and see extraction status. **AC:** File stored in Supabase Storage; text extracted via PyMuPDF; status flips to "ready" or "error".
- Set up Supabase project, RLS policies, Next.js scaffold, CI on GitHub → Vercel preview deploys.

### Sprint 2 — AI Quiz Generation & Review
- **US:** As a teacher, I can generate a draft quiz from an uploaded material. **AC:** Calls Gemini, returns 8-12 questions with concept/difficulty tags, saved as `draft`.
- **US:** As a teacher, I can edit/delete/add questions before publishing. **AC:** Edits persist; manual questions marked `source: manual`.
- **US:** As a teacher, I can publish a quiz with a schedule and attempt limit. **AC:** Status becomes `published`; students in the class can see it once `opens_at` passes.

### Sprint 3 — Student Flow, Scoring, Gap Detection
- **US:** As a student, I can take a published quiz and submit answers. **AC:** Answers saved incrementally; final submit locks the attempt.
- **US:** As a student, I get an immediate score and concept breakdown. **AC:** Scoring engine computes exact score server-side, no AI involved.
- **US:** As a student, I see flagged learning gaps with plain-language explanations. **AC:** Gap engine flags concepts <80% accuracy; Gemini generates explanation/recommendations from anonymized accuracies only.

### Sprint 4 — Dashboards, Practice, Hardening
- **US:** As a teacher, I can view class-level results and per-student gap reports. **AC:** Aggregate averages + concept breakdown chart render correctly for a full class.
- **US:** As a student, I can request a targeted practice set for a flagged gap. **AC:** Returns 3-5 new questions on that concept via LLM.
- **US:** As a student, I can see mastery trend over time. **AC:** Line chart of past attempt scores renders via Recharts.
- Performance pass (serverless timeout checks for LLM calls), security review of RLS policies, write remaining unit/integration tests, polish README + demo deploy.

---

## 8. Tests & QA

### Unit tests
- `scoreAttempt()`: correct score/total for mixed correct/incorrect answers; handles missing answers as incorrect; concept breakdown sums correctly across multiple concepts.
- `detectGaps()`: accuracy exactly at 0.5 and 0.8 boundaries classify correctly; empty concept list returns no gaps; prerequisite heuristic only fires when configured mapping exists.
- LLM response parsing: malformed/non-JSON Gemini response is caught and surfaces a clear error rather than crashing the route.
- PDF extraction: page count over `MAX_PAGES` is truncated, not rejected; empty/blank pages excluded from chunks.

### Integration tests
- **Teacher flow:** signup → create class → upload PDF → generate quiz → edit one question → publish → verify `GET /api/assessments/:id` shows `published` with correct question count.
- **Student flow:** join class via code → fetch published assessment (no answer keys exposed) → submit answers → verify score, concept breakdown, and gap list match expected values for a known answer set.
- **RLS isolation:** a second teacher's session cannot read another teacher's class/materials/results (expect 403/empty result, not data leakage).
- **Auth boundary:** student session cannot call `/api/assessments` POST (teacher-only) — expect 403.

### Manual QA checklist
- [ ] Upload a >25-page PDF — extraction truncates gracefully with a visible notice to the teacher.
- [ ] Upload a corrupted/non-PDF file — clear error, no server crash.
- [ ] Generate quiz twice on the same material — no duplicate question sets unless explicitly regenerated.
- [ ] Publish a quiz, then confirm a student outside the class cannot access it via direct URL.
- [ ] Submit a quiz attempt twice when `attemptLimit = 1` — second attempt is blocked.
- [ ] Verify no student name/email ever appears in outbound Gemini request payloads (inspect server logs).
- [ ] Confirm gap explanations render even if Gemini call fails (fallback to rule-based label only, e.g. "High gap — Quadratics").
- [ ] Mobile-width layout check on quiz-taking and dashboard pages.

---

## 9. Deployment (Vercel + Supabase)

1. **Supabase project:** create project → run `supabase/migrations/0001_init.sql` and `supabase/policies/rls.sql` via SQL editor or `supabase db push`. Enable email auth in Auth settings. Create a Storage bucket `materials` (private, signed URLs).
2. **Gemini API key:** obtain a key from Google AI Studio for the Gemini Flash model.
3. **Environment variables** (set in Vercel Project Settings → Environment Variables, and in `.env.local` for dev):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
   GEMINI_API_KEY=                   # server-only
   NEXT_PUBLIC_APP_URL=
   ```
4. **Python runtime for PyMuPDF:** if deploying PDF extraction as part of the Next.js serverless function, use a Vercel Python runtime function or split it into a small separate service (e.g. Fly.io/Render) that the Next.js API route calls over HTTPS — Vercel's default Node runtime cannot run PyMuPDF directly.
5. **Deploy:** push to GitHub main branch → Vercel auto-builds and deploys; verify preview deploys work for PRs before merging.
6. **Post-deploy checks:** confirm RLS is enabled on every table (Supabase dashboard → Database → Tables → RLS toggle), confirm Storage bucket is not publicly listable, and smoke-test the teacher/student flows against the production URL.
7. **Cost guardrails:** cache generated quizzes (don't regenerate on every page load), keep Gemini Flash as the default model, and monitor Supabase free-tier storage/DB usage (500MB storage / 10GB DB caps).

---

## 10. README Template

```markdown
# AI Smart Assessment System

## Overview
[1-2 sentence pitch — teachers upload materials, get AI-generated concept-tagged
quizzes, students get personalized gap analysis and recommendations.]

## Architecture
[Insert the flowchart/sequence diagram from the PRD — Teacher/Student → Next.js
API → Supabase (Postgres/Auth/Storage) + Gemini Flash → Scoring & Gap Engine]

## Tech Stack
Next.js (App Router) · Supabase (Postgres/Auth/Storage) · Google Gemini Flash ·
PyMuPDF · Tailwind CSS + shadcn/ui · Recharts

## Setup
1. Clone the repo, `npm install`
2. Create a Supabase project, run migrations in `supabase/migrations/`
3. Copy `.env.local.example` to `.env.local` and fill in Supabase + Gemini keys
4. `npm run dev`

## Usage
- **Teachers:** sign up → create a class → upload a PDF → generate & review
  a quiz → publish → view class/individual results.
- **Students:** sign up → join a class with a code → take a quiz → view
  score, concept breakdown, and personalized learning gaps.

## Key Design Decisions
- All scoring and gap detection is deterministic, rule-based code — the LLM
  never decides correctness or gap levels, only generates questions and
  phrases explanations from data.
- No student PII is ever sent to the LLM; only anonymized concept accuracies.
- No vector DB/RAG — content is chunked and passed directly per request.

## License
[MIT / your choice]
```


---

## 11. Functional Clarifications and Implementation Rules

This section supplements the MVP requirements above. It intentionally defines functional behavior and implementation rules only; it does not prescribe visual design.

### 11.1 End-to-End Assessment Workflow

The canonical teacher workflow is:

1. Teacher signs in.
2. Teacher creates or selects a class.
3. Teacher uploads a PDF learning material for that class.
4. Backend validates and stores the file.
5. Backend extracts text and marks the material `ready` or `error`.
6. Teacher creates a draft assessment using the ready material.
7. Teacher specifies the topic and question count.
8. Backend generates AI questions.
9. Questions are validated and saved as draft questions.
10. Teacher reviews and edits the questions.
11. Teacher publishes the assessment with availability and attempt settings.
12. Eligible students can access it during the published window.
13. Student starts one active attempt.
14. Answers are saved incrementally.
15. Student submits the attempt.
16. Backend deterministically scores it and computes concept performance.
17. Backend detects learning gaps.
18. Gemini may generate explanations and recommendations using anonymized concept-accuracy data only.
19. Student sees the result and learning gaps.
20. Student may generate targeted practice for a flagged concept.

This workflow is the primary MVP path. Additional features must not disrupt it.

### 11.2 Assessment State Transitions

Assessment states are:

- `draft`
- `published`
- `closed`

Allowed transitions:

```text
draft -> published
published -> closed
```

For MVP:

- A draft can be edited.
- A published assessment's questions, choices, correct answers, concepts, and difficulty must not be modified.
- A published assessment becomes closed after `closes_at`.
- A teacher may explicitly close a published assessment.
- A closed assessment cannot accept new attempts.
- Existing submitted attempts remain available for results.
- If an assessment has no `closes_at`, it remains published until explicitly closed.
- Publishing requires at least one valid question.
- Publishing requires a valid opening/closing configuration when dates are supplied.
- `opens_at` must be earlier than `closes_at` when both are present.

### 11.3 Assessment Availability Rules

A student may start an assessment only when all are true:

1. The assessment belongs to a class the student has joined.
2. The assessment status is `published`.
3. Current time is at or after `opens_at`, if `opens_at` is set.
4. Current time is before `closes_at`, if `closes_at` is set.
5. The student's submitted attempt count is below `attempt_limit`.
6. The student does not already have an unfinished active attempt for the assessment.

If the student has an unfinished active attempt, the existing attempt must be resumed rather than creating another active attempt.

### 11.4 Attempt Lifecycle

An attempt has these logical states based on timestamps:

- active: `started_at` exists and `submitted_at` is null
- submitted: `submitted_at` exists

MVP rules:

- Starting an assessment creates one active attempt.
- Refreshing or leaving the quiz must not create another active attempt.
- An active attempt can be resumed.
- Answers may be updated while the attempt is active.
- Submission is final.
- A submitted attempt cannot be modified.
- A student cannot submit the same attempt twice.
- `attempt_limit` counts submitted attempts.
- A student cannot create a second active attempt for the same assessment.
- If an assessment closes while a student has an active attempt, the product must use one consistent rule: **the active attempt may be submitted, but no new attempt may be started after closing**.
- Missing answers are treated as incorrect when scoring.
- The server determines the question set for the attempt; the client cannot supply or replace the assessment's correct answers.

### 11.5 Answer Persistence and Integrity

Answers must be uniquely associated with an attempt/question pair.

Recommended database constraint:

```sql
unique (attempt_id, question_id)
```

Saving an answer should upsert the student's selected choice for that question while the attempt is active.

The server must verify:

- the attempt belongs to the authenticated student;
- the attempt is active;
- the question belongs to the attempt's assessment;
- the selected choice is one of the question's available choices.

The client must never submit `is_correct`. The server calculates it during scoring.

### 11.6 Question Validation Rules

All AI-generated and manually created questions must satisfy:

- non-empty question text;
- exactly 4 choices;
- every choice is non-empty;
- all 4 choices are unique;
- exactly one correct answer;
- `correctAnswer` exactly matches one of the four choices;
- non-empty concept;
- difficulty is exactly one of `easy`, `medium`, `hard`.

AI output must be validated with Zod before database insertion.

If the model returns invalid data:

1. Do not save invalid questions.
2. Keep the assessment in `draft`.
3. Return a clear generation error.
4. Allow the teacher to retry generation.

The requested number of questions should be treated as a target. The generation route must reject materially incomplete output rather than silently presenting an incomplete assessment as complete.

### 11.7 Manual Question Validation

Manual questions use the same validation rules as AI questions.

Manual creation must additionally set:

```text
source = manual
```

AI-generated questions must set:

```text
source = ai
```

The source field is informational and must not affect scoring.

### 11.8 Assessment Creation Preconditions

To create an assessment:

- authenticated user must be a teacher;
- teacher must own the selected class;
- selected material must belong to the selected class;
- material must be `ready`;
- title must be non-empty;
- question count must be within the MVP-supported range;
- topic must be non-empty when topic-based generation is requested.

For MVP, use a practical question-count range such as **3–20 questions**, with 8–12 as the normal default.

### 11.9 PDF Upload and Processing Rules

The material upload endpoint must validate:

- authenticated teacher;
- class ownership;
- file exists;
- file is a PDF;
- reasonable maximum file size;
- non-empty file.

For MVP:

- process at most the first 25 pages;
- preserve page order;
- ignore blank pages;
- show/return the actual total page count;
- record how many pages were processed;
- if the PDF exceeds 25 pages, process the first 25 pages and clearly expose that the extraction was truncated;
- do not treat truncation as a server failure.

Recommended material processing states remain:

```text
processing
ready
error
```

If extraction fails:

- set `status = error`;
- retain a useful error message for the teacher-facing workflow;
- do not create an assessment from an errored material.

Scanned/image-only PDFs may produce little or no extractable text. For MVP, do not introduce OCR unless explicitly added later. Mark the material unusable for generation when there is insufficient extracted text and explain the reason.

### 11.10 PDF Extraction Implementation Correction

When calculating the PDF page count, capture it before closing the document.

Use the equivalent logic:

```python
doc = fitz.open(path)
page_count = len(doc)
pages = min(page_count, MAX_PAGES)

# extract pages...

doc.close()

return {
    "pageCount": page_count,
    "usedPages": pages,
    "chunks": chunks,
}
```

Do not call `len(doc)` after `doc.close()`.

### 11.11 Material-to-LLM Chunking Rules

For generation:

1. Join extracted pages in page order.
2. Split large text at paragraph boundaries where possible.
3. Target approximately 6,000 characters per chunk.
4. Prefer chunks relevant to the requested topic using simple keyword matching.
5. If no topic-relevant chunk is found, use the available extracted material rather than inventing content.
6. Keep the LLM request comfortably within the selected model's context limits.
7. Do not send the original PDF binary to Gemini.

The LLM must be instructed to use only supplied material.

### 11.12 Gemini Failure and Retry Rules

Quiz generation failure:

```text
Gemini error
    ↓
assessment remains draft
    ↓
no invalid questions saved
    ↓
teacher receives retryable error
```

Gap explanation failure:

```text
Gemini error
    ↓
deterministic score/gaps remain valid
    ↓
fallback explanation is shown
    ↓
assessment submission still succeeds
```

Practice generation failure:

```text
Gemini error
    ↓
practice request fails gracefully
    ↓
existing assessment/results remain unaffected
    ↓
student may retry
```

Never make successful assessment scoring dependent on Gemini availability.

### 11.13 Gemini Privacy Boundary

The application must enforce two separate payload contracts.

Quiz generation may receive only learning-material text and generation parameters needed for the task.

Gap explanation may receive only anonymized concept-performance information, for example:

```json
{
  "concepts": [
    { "concept": "Quadratics", "accuracy": 0.35 },
    { "concept": "Factorization", "accuracy": 0.60 }
  ]
}
```

The gap-explanation payload type must not include:

- student name;
- student email;
- student ID;
- class ID;
- assessment ID;
- any other direct student identifier.

Do not rely solely on prompt wording. Enforce the boundary in TypeScript types/request construction.

### 11.14 Authorization Matrix

| Operation | Teacher | Student |
|---|---:|---:|
| Sign up/login | Yes | Yes |
| Create class | Yes | No |
| View own classes | Yes | No |
| Join class by code | No | Yes |
| View own class roster | Yes | No |
| Upload material | Yes | No |
| Create assessment | Yes | No |
| Generate questions | Yes | No |
| Edit questions | Yes | No |
| Add manual question | Yes | No |
| Publish/close assessment | Yes | No |
| View published assessment in joined class | No | Yes |
| Start attempt | No | Yes |
| Save own answers | No | Yes |
| Submit own attempt | No | Yes |
| View own results | No | Yes |
| View class assessment results | Yes | No |
| View student performance in teacher's class | Yes | No |
| View another student's private results | No | No |
| View own learning gaps | No | Yes |
| Generate own targeted practice | No | Yes |

Teacher access to student results is limited to students belonging to classes owned by that teacher.

### 11.15 Join-Code Rules

Class join codes must:

- be unique;
- be generated server-side;
- use a short human-enterable format;
- be case-normalized;
- not be derived from a student's or teacher's identity.

Recommended MVP behavior:

- 6 uppercase alphanumeric characters;
- exclude ambiguous characters if practical;
- joining an already joined class is idempotent;
- invalid codes return a clear error;
- a student cannot join a class using a code belonging to another resource;
- the server resolves the class from the code rather than trusting a client-supplied class ID.

### 11.16 Results Rules

Teacher assessment results must include at minimum:

- number of students with submitted attempts;
- average score/percentage;
- score distribution;
- concept-level class averages;
- per-student submitted score where the teacher is authorized to see it.

Student results must include:

- own score;
- total;
- percentage;
- own concept breakdown;
- own detected gaps;
- own recommendations.

Results must never be computed from client-provided scores.

### 11.17 Gap Engine Rules

The gap engine remains fully deterministic.

```text
accuracy < 0.50      -> high
0.50 <= accuracy < 0.80 -> medium
accuracy >= 0.80     -> no gap
```

Boundary behavior must be explicitly tested:

- `0.499...` -> high
- `0.50` -> medium
- `0.799...` -> medium
- `0.80` -> no gap

The LLM cannot change these levels.

The prerequisite heuristic may add a prerequisite concept only when the configured prerequisite exists and its measured accuracy satisfies the heuristic.

### 11.18 Practice-Set Rules

A targeted practice set must:

- belong to the authenticated student;
- reference one concept;
- contain 3–5 questions;
- follow the same question validation rules;
- not expose or depend on another student's information;
- be generated only after a valid gap/concept is selected.

Practice scoring is outside the core assessment scoring flow unless explicitly added later. Do not imply that practice-set results change official assessment results.

### 11.19 API Authorization and Trust Boundaries

Every protected API route must derive the authenticated user from the Supabase server session.

Do not trust client-provided:

- `teacher_id`;
- `student_id`;
- `role`;
- `score`;
- `percentage`;
- `is_correct`;
- `gap_level`;
- ownership relationships.

The server must verify ownership/membership through the database.

The service-role key may be used only in trusted server-side code where necessary and must never be sent to the browser.

### 11.20 Student Assessment Response Contract

Student-facing assessment data must exclude:

```text
correct_answer
is_correct
teacher-only editing metadata
private material storage information
```

The student may receive:

```text
question id
question text
choices
concept only if product flow requires it
difficulty only if product flow requires it
```

The implementation must explicitly test that correct answers are absent from student API responses.

### 11.21 Error Contract

All API errors should follow:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Use stable error codes for major categories such as:

```text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
INVALID_FILE
PROCESSING_ERROR
AI_GENERATION_ERROR
ASSESSMENT_NOT_AVAILABLE
ATTEMPT_LIMIT_REACHED
ATTEMPT_ALREADY_ACTIVE
ATTEMPT_ALREADY_SUBMITTED
INVALID_ANSWER
```

Do not expose stack traces, secrets, provider credentials, or internal database details to clients.

### 11.22 Database Integrity and Indexing

Add appropriate constraints and indexes for common access paths.

At minimum:

- unique `class_members(class_id, student_id)`;
- unique `answers(attempt_id, question_id)`;
- unique class join code;
- indexes on foreign-key columns used for filtering;
- indexes supporting assessment-by-class queries;
- indexes supporting attempts by student and assessment;
- indexes supporting concept performance by attempt;
- indexes supporting learning gaps by attempt/student access patterns.

Where business rules cannot be safely represented by a simple database constraint, enforce them transactionally/server-side.

### 11.23 Transactional Submission

Assessment submission should be treated as one logical server operation.

The server should:

1. verify the authenticated student owns the attempt;
2. verify the attempt is active;
3. load the authoritative questions;
4. load the saved answers;
5. calculate correctness;
6. calculate score;
7. calculate concept performance;
8. detect gaps;
9. persist the result records;
10. mark the attempt submitted.

Avoid a state where an attempt is marked submitted but its authoritative score/performance records were not persisted.

Gemini explanation generation should occur after the deterministic result is safely persisted and must not block successful scoring.

### 11.24 Time and Scheduling Rules

Store timestamps as `timestamptz`/UTC-compatible values.

Use server time for:

- assessment availability;
- opening/closing;
- submission;
- attempt-limit decisions.

Do not rely on the browser clock for authorization or availability.

Display times in the user's local timezone at the application layer.

### 11.25 MVP Operational Limits

Use conservative limits to control cost and abuse.

Recommended defaults:

- PDF: maximum 25 processed pages;
- assessment generation: 3–20 questions;
- normal generation default: 10 questions;
- targeted practice: 3–5 questions;
- reject empty/near-empty extracted text;
- avoid regenerating an assessment automatically on every page load.

These are implementation guardrails and may be adjusted later without changing the product concept.

### 11.26 Deployment Architecture Decision

The application must retain PyMuPDF functionality.

Because the standard Vercel Node runtime cannot be assumed to execute PyMuPDF directly, deployment must use one of these approaches:

1. a supported Vercel Python runtime/function for the extraction operation, if compatible with the final deployment configuration; or
2. a small separate Python extraction service accessed securely by the Next.js backend.

For local development, the extraction implementation may use the Python subprocess approach described earlier.

The final README must document whichever approach is actually implemented.

### 11.27 Required Pre-Release Checks

Before considering the MVP complete, verify:

- teacher signup/login;
- student signup/login;
- class creation;
- join code creation;
- student class joining;
- PDF upload;
- PDF extraction;
- material error handling;
- assessment creation;
- AI generation;
- malformed AI response handling;
- question validation;
- teacher question editing;
- assessment publishing;
- assessment availability;
- active-attempt resume;
- answer persistence;
- duplicate-answer prevention;
- attempt limit;
- deterministic scoring;
- concept performance;
- gap thresholds;
- Gemini gap explanation;
- Gemini failure fallback;
- targeted practice;
- RLS isolation;
- answer-key protection;
- no student PII in gap-analysis Gemini payload;
- build;
- lint;
- type checking;
- automated tests.

---

## 12. Explicit MVP Non-Goals

The following are intentionally outside the MVP unless later added as separate requirements:

- OCR for scanned PDFs;
- vector databases;
- RAG infrastructure;
- adaptive testing based on real-time ML;
- predictive student analytics;
- automated grading of free-text answers;
- teacher-generated lesson plans;
- parent accounts;
- school administrator roles;
- payments/subscriptions;
- social features;
- gamification;
- live classroom features;
- notifications infrastructure;
- external LMS integrations.

Keeping these outside the MVP preserves the core assessment → scoring → gap detection → recommendation loop.

---

## 13. Final Functional Acceptance Criteria

The MVP is functionally complete when the following scenario succeeds end-to-end:

### Teacher

1. Teacher creates an account and signs in.
2. Teacher creates a class and receives a unique join code.
3. Teacher uploads a valid PDF.
4. The material is stored privately and extracted successfully.
5. Teacher creates an assessment from the ready material.
6. Gemini generates a valid question set.
7. Teacher edits at least one question.
8. Teacher publishes the assessment.
9. Teacher can view the assessment and later view authorized student results.

### Student

1. Student creates an account and signs in.
2. Student joins the teacher's class using the join code.
3. Student sees the published assessment only when it is available.
4. Student starts an attempt.
5. Student can refresh/resume the active attempt.
6. Student answers questions and saves answers.
7. Student submits the attempt.
8. Backend calculates the authoritative score.
9. Backend calculates concept-level accuracy.
10. Backend detects gaps using the defined thresholds.
11. Student sees the result and gaps even if Gemini is unavailable.
12. Gemini-generated explanation/recommendations appear when available.
13. Student can generate a targeted practice set for a flagged concept.
14. A second attempt is blocked when the configured attempt limit has been reached.

### Security

1. A student cannot access another student's results.
2. A student cannot access teacher-only APIs.
3. A teacher cannot access another teacher's classes or materials.
4. A student cannot retrieve assessment answer keys before submission.
5. Client-provided score/gap/correctness fields are ignored or rejected.
6. No student PII is sent to Gemini for gap explanation.
7. Private material files are not publicly exposed.

These criteria define the minimum acceptable functional MVP.
