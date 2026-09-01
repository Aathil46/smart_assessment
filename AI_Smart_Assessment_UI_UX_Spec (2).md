# AI Smart Assessment — Complete UI/UX Design Specification

**Version:** 1.0  
**Product:** AI-Powered Smart Assessment System (MVP)  
**Source of Truth:** `AI_Smart_Assessment_MVP_Build_Spec_V2.md`  
**Stack context:** Next.js (App Router) + Tailwind CSS + shadcn/ui + Recharts + Lucide icons  
**Audience:** Portfolio-ready modern EdTech SaaS web application  

This specification translates the V2 functional requirements into a complete, implementable UI/UX design. No core product functionality is added, removed, or altered. Where V2 is silent, items are explicitly labeled **UI/UX recommendation**.

---

## 1. Product UX Vision

AI Smart Assessment is a focused, trustworthy assessment loop for teachers and students:

**Teacher path:** Create class → Upload PDF material → Generate AI-drafted concept-tagged quiz → Review & edit → Publish with schedule → View class & individual results.

**Student path:** Join class by code → Take available quiz (resume if active) → Submit → See score + concept breakdown → See rule-based learning gaps + AI-phrased explanations → Generate targeted practice.

The interface communicates **intelligence, trust, learning, clarity, progress, simplicity, and professionalism**. It feels like a real product suitable for GitHub, portfolio, resume, and live demo—not a generic admin template, enterprise bloat, or basic CRUD form.

**Design personality**
- Calm, confident, educational.
- Primary focus on the next meaningful action.
- AI is a helpful draft/explainer, never the authority on scores or gap levels.
- Deterministic scoring and gap detection are visible as system rules.
- Minimal cognitive load, especially during quiz-taking.
- Progressive disclosure: show what is needed now; reveal detail on demand.

**Core metaphors**
- Class = container of students + materials + assessments.
- Assessment lifecycle = clear status badges (Draft / Published / Closed).
- Learning gap = actionable signal derived from accuracy thresholds, not opaque AI judgment.

---

## 2. Information Architecture

### 2.1 Route Map (aligned with V2 scaffold)

**Public / Auth**
- `/login`
- `/signup`

**Teacher (`(teacher)` group)**
- `/dashboard` — overview
- `/classes` — list
- `/classes/[classId]` — class detail (roster, materials, assessments, performance)
- Material upload — launched primarily from class detail; a dedicated `/materials/upload` route is optional.
- `/assessments/new` — assessment creation flow
- `/assessments/[assessmentId]/edit` — question review/editor
- `/assessments/[assessmentId]/results` — class results
- `/students/[studentId]` — individual student performance (scoped to teacher’s classes)

**Student (`(student)` group)**
- `/dashboard` — next actions, available assessments, gaps
- `/join` — join class by code
- `/assessments/[assessmentId]/take` — quiz runner
- `/results/[attemptId]` — score + concept breakdown + gaps
- `/gaps` — learning gaps list / detail
- (Practice is launched from gap → modal or `/practice/[gapId]` or inline)

**Shared**
- Profile / account (simple dropdown or `/profile`)
- Logout

Role-based routing: after login, redirect teacher → `/dashboard` (teacher), student → `/dashboard` (student). Middleware + RLS enforce boundaries.

### 2.2 Navigation Structure

**Teacher primary nav (sidebar on desktop, bottom or hamburger on mobile)**
1. Dashboard
2. Classes
3. (Context: current class name when inside class)
4. Account / Logout

Secondary actions live inside class detail and assessment pages (Upload material, Create assessment, Publish, View results).

**Student primary nav**
1. Dashboard
2. My Classes (or join entry point)
3. Learning Gaps
4. Account / Logout

**UI/UX recommendation:** Use a persistent left sidebar (≥1024px) that collapses to icon rail or top/bottom nav on smaller screens. Keep navigation depth shallow (max 2 levels of hierarchy visible).

---

## 3. User Flows

### 3.1 Teacher End-to-End Flow
1. Sign up / Login (role = teacher)
2. Dashboard (empty or with classes)
3. Create Class → receive join code
4. Open Class → Upload PDF → processing → ready/error
5. Create Assessment (select ready material, title, topic, numQuestions 3–20)
6. Generate (AI) → draft questions saved
7. Review / Edit questions (edit, add manual, delete, validate)
8. Publish (set opensAt, closesAt, attemptLimit) → confirmation
9. Monitor Results (class averages, distribution, concept averages, per-student)
10. Drill into Student Performance

### 3.2 Student End-to-End Flow
1. Sign up / Login (role = student)
2. Join Class (enter 6-char code)
3. Dashboard shows available assessments
4. Start or Resume attempt
5. Answer questions (autosave), navigate, submit with confirmation
6. View Results (score, concept breakdown, gaps + explanations)
7. From gap → Generate Targeted Practice (3–5 questions)
8. Complete practice (no official score impact)

### 3.3 Assessment Creation Flow (Teacher)
Material ready → Create Assessment form → Generate → Editor → Publish dialog → Published state.

### 3.4 Assessment-Taking Flow (Student)
Available → Start/Resume → Quiz Runner (one question or multi with progress) → Submit confirmation → Results.

### 3.5 Result / Gap Flow
Submit → deterministic score + concept_perf + gaps → (async) Gemini explanations → Results page shows everything; Gaps page aggregates across attempts.

### 3.6 Targeted Practice Flow
Select gap → Generate (LLM) → Practice set of 3–5 questions → Answer → Completion state (practice only).

---

## 4. Page-by-Page Specification

### 4.1 Authentication

#### Login (`/login`)
- **Purpose:** Authenticate existing user.
- **Target:** Teacher or Student.
- **Layout:** Centered card on calm background. Logo + product name above form.
- **Fields:** Email, Password (with show/hide toggle).
- **Primary action:** Log in.
- **Secondary:** “Don’t have an account? Sign up”, Forgot password (optional for MVP).
- **States:**
  - Loading: button spinner, fields disabled.
  - Error: inline alert “Invalid email or password” (code `UNAUTHENTICATED`).
  - Session expired: banner or redirect with message.
- **Role-based routing:** On success, route by `profiles.role`.
- **Primary authentication:** Email/password and Google OAuth.
- **Guest/demo:** Provide a restricted “Continue as Guest” experience for trying the product without creating an account. Guest access must not expose or mutate real teacher/student data.
- **Guest UX recommendation:** Route guest users into a clearly isolated demo experience; do not treat guest mode as a full teacher/student account.
- **Responsive:** Full-width form on mobile, max-w-md on desktop.
- **A11y:** Labels, autocomplete attributes, focus management, error announced via aria-live.

#### Signup (`/signup`)
- **Fields:** Name, Email, Password, Confirm password, Role (Teacher / Student) — radio or segmented control.
- **Validation:** Email format, password strength (min length), role required.
- **Success:** 201 → auto-login or redirect to login with success toast.
- **Error:** Duplicate email, validation messages near fields.

#### Logout
- Clear session, redirect to `/login`. Confirmation optional (UI/UX recommendation: soft confirm only if unsaved work exists).

---

### 4.2 Teacher Dashboard (`/dashboard`)

- **Purpose:** Orient teacher; surface next actions and health of classes/assessments.
- **Primary action:** Create Class or “Upload material / Create assessment” if classes exist.
- **Sections:**
  1. Greeting + quick stats (Classes, Active assessments, Students, Avg recent score).
  2. Class overview cards (name, student count, join code preview, recent assessment status).
  3. Recent activity (uploads, publishes, submissions).
  4. Performance summary (optional compact concept heat or top weak concepts across classes — keep light).
- **Empty state:** Illustration + “Create your first class” CTA + short explanation of the assessment loop.
- **Loading:** Skeleton cards + metric placeholders.
- **Responsive:** Stats in 2×2 grid on mobile; activity list stacks.

---

### 4.3 Classes List (`/classes`)

- **Purpose:** Manage all classes owned by teacher.
- **Content:** Table or card grid: Name, Subject, Grade, Code, Student count, Created.
- **Primary:** Create Class (opens modal or `/classes/new`).
- **Create Class form:** Name (required), Subject, Grade → generates unique 6-char uppercase code.
- **Actions per class:** Open, Copy code, View roster.
- **Empty / Loading / Error:** Standard patterns.
- **Join code display:** Monospace, copy-to-clipboard button, tooltip “Students use this code to join”.

---

### 4.4 Class Detail (`/classes/[classId]`)

- **Purpose:** Hub for one class.
- **Tabs or sections:** Overview | Students | Materials | Assessments | Performance.
- **Overview:** Name, subject, grade, join code (prominent + copy), student count, quick actions (Upload, Create assessment).
- **Students:** Roster table (name, email, joined_at). No other PII.
- **Materials:** List with status badge (processing / ready / error), page count, truncated note if >25 pages, “Create assessment” only when ready.
- **Assessments:** List with status (draft/published/closed), question count, opens/closes, attempt limit, actions (Edit if draft, Results, Publish/Close).
- **Performance:** High-level averages linking to full results.
- **States:** Processing materials show spinner + “Extracting text…”. Error materials show reason + retry upload.

---

### 4.5 Material Upload

- **Entry:** From class detail or dedicated `/materials/upload?classId=…`.
- **Experience:** Drag-and-drop zone + file picker. Accept only PDF. **UI/UX recommendation:** show a 20 MB client-side guidance limit only if the backend does not define another limit; do not treat this as a V2 backend requirement.
- **Validation:** File type, non-empty, size.
- **Progress:** Upload progress bar → “Processing (extracting text)…” → Ready or Error.
- **Warnings:**
  - >25 pages: “Only the first 25 pages will be used.”
  - Insufficient text: “Little or no extractable text found. Scanned PDFs are not supported in MVP.”
- **Success:** Toast + material appears in class list with Ready badge.
- **Error:** Clear message, keep file reference if useful, allow retry.
- **Never send PDF binary to Gemini** (backend constraint reflected by UI never offering “send original”).

---

### 4.6 Assessment Creation

- **Flow (simple linear form or stepped):**
  1. Select class (pre-filled if from class context).
  2. Select ready material (only ready materials listed).
  3. Title (required).
  4. Topic (required for generation).
  5. Number of questions (slider or select, 3–20, default 10).
  6. Generate.
- **Primary CTA:** “Generate draft questions”.
- **Precondition checks:** Material must be ready; teacher owns class.
- **After create:** Status = draft, navigate to editor or show generation progress on editor page.

---

### 4.7 AI Generation State (on Editor or intermediate)

- **Generation in progress:** Full-page or panel skeleton + “Generating questions with AI… This usually takes 10–30 seconds.” Progress indicator (indeterminate). Disable publish/edit until complete.
- **Success:** “10 questions generated. Review and edit before publishing.” Status remains draft.
- **Failure:** Alert with `AI_GENERATION_ERROR`, Retry button, assessment stays draft, no invalid questions saved.
- **Do not imply instant generation.**

---

### 4.8 Question Review / Editor (`/assessments/[assessmentId]/edit`)

**Most important teacher screen.**

- **Layout (desktop):** Left sidebar question list (numbered, concept tag, difficulty badge, AI/Manual source indicator). Main pane = selected question editor. Sticky footer or top bar with Save / Publish / question count.
- **Per question editable fields:**
  - Question text (textarea)
  - Four choices (inputs, reorder optional UI/UX recommendation)
  - Correct answer (radio selecting one of the four)
  - Concept (text input)
  - Difficulty (select: easy / medium / hard)
  - Source badge (ai | manual) — read-only for AI, set to manual on create
- **Interactions:**
  - Edit → local dirty state → Save (or autosave with debounce — UI/UX recommendation)
  - Delete question (confirm)
  - Add question (manual) → new empty form with source=manual
  - Validation on save: exactly 4 unique non-empty choices, correctAnswer matches one, non-empty concept & text, valid difficulty
  - Unsaved changes: warn on navigate away
  - Question navigation: prev/next + sidebar click
- **Published lock:** If status = published or closed, all fields read-only; banner “This assessment is published and cannot be edited.”
- **Mobile:** Accordion or full-screen question cards with bottom nav for prev/next/save.
- **Efficiency for 10+ questions:** Keyboard shortcuts (UI/UX recommendation: j/k or arrows), bulk status indicators (valid/invalid count).

---

### 4.9 Assessment Publishing

- **Entry:** From editor “Publish” button (enabled only when ≥1 valid question).
- **Dialog / panel:**
  - Summary: title, topic, question count, material name.
  - Opens at (datetime-local, optional)
  - Closes at (datetime-local, optional; must be after opensAt)
  - Attempt limit (number, default 1)
  - Confirmation checkbox or explicit “Publish” CTA
- **Status communication:** Badge system
  - Draft (gray)
  - Published (green/blue)
  - Closed (neutral)
- **After publish:** Questions locked; students in class can see when window opens.
- **Close action:** Explicit teacher action or automatic after closesAt.

---

### 4.10 Teacher Assessment Results (`/assessments/[assessmentId]/results`)

- **Purpose:** Class-level insight.
- **Content:**
  - Header: title, status, # submitted / total students, average score %, attempt window.
  - Score distribution (simple histogram or bar — Recharts).
  - Concept-level class averages (horizontal bars or table with accuracy %).
  - Per-student table: name, score, % , submitted_at, link to student page.
- **Charts:** Only where they aid understanding; provide table alternative.
- **Empty:** “No submissions yet.”
- **Responsive:** Charts stack or become tables on mobile; student list becomes cards.

---

### 4.11 Teacher Student Performance (`/students/[studentId]`)

- **Scope:** Only students in teacher’s classes.
- **Content:** Assessment history (title, score, date), concept performance across attempts, learning gaps (concept, level, notes if available), simple trend (line of past scores if multiple).
- **No other students’ data.**
- **Purpose:** Help teacher identify instructional needs.

---

### 4.12 Student Dashboard (`/dashboard`)

- **Purpose:** Answer “What should I do next?”
- **Priority order of sections:**
  1. Action required (available assessments to take / resume, attempt limit remaining).
  2. Recent results summary.
  3. Learning gaps needing attention (high first).
  4. Joined classes.
- **Cards:** Assessment cards with status (Available / In progress / Completed / Closed / Limit reached).
- **Empty:** “Join a class with a code to get started.”
- **Loading / Error:** Standard.

---

### 4.13 Join Class (`/join`)

- **Experience:** Extremely simple.
- **UI:** Large input for 6-character code (auto-uppercase, monospace), “Join” button.
- **Validation:** Format, existence, already-joined (idempotent success).
- **Success:** Toast + redirect to dashboard or class view.
- **Error:** “Invalid code” or clear message.
- **Mobile:** Full focus on input; large touch target.

---

### 4.14 Quiz-Taking Experience (`/assessments/[assessmentId]/take`)

**Critical, focused, low-distraction screen.**

- **Layout:** Minimal chrome. Assessment title + progress (Question 3 of 10) + timer optional (UI/UX recommendation: none for MVP unless required).
- **Question area:** Stem, four large choice buttons (A B C D or full text). Selected state clearly highlighted. Saved indicator (“Saved”).
- **Navigation:** Previous / Next, question palette (answered vs unanswered dots).
- **Submit:** Primary button; opens confirmation modal “You have X unanswered. Submit anyway?” Final submit locks attempt.
- **Behaviors enforced by UI:**
  - Resume existing active attempt on refresh/re-entry.
  - No second active attempt.
  - Attempt limit reached → disabled start + message.
  - Closed assessment → cannot start new; may submit existing active.
  - Never show correctAnswer or is_correct.
- **Autosave:** On choice select (POST answer). Optimistic UI + error recovery.
- **Mobile:** Large touch targets (≥44px), sticky progress and submit, choices stack vertically.
- **A11y:** Radio group semantics, keyboard navigation between questions, live region for save status.

---

### 4.15 Student Results (`/results/[attemptId]`)

- **Purpose:** Clear understanding of performance and next steps.
- **Hierarchy:**
  1. Score summary (large number: 7/10 · 70%) with encouraging tone.
  2. Concept breakdown (list or simple bars: concept · accuracy · correct/total).
  3. Learning gaps (severity badge high/medium, explanation, recommendations).
  4. CTA: “Practice this concept” for each gap.
- **Messaging:**
  - Gaps come from accuracy thresholds (system rules).
  - Explanations/recommendations are AI-generated study guidance based on concept performance.
- **Fallback:** If Gemini failed, still show score + gaps with generic explanation (“Review this concept”) and retry option for explanations if desired.
- **Never show answer keys retroactively in a way that feels like cheating; post-submit review of own answers is optional UI/UX recommendation only if product later adds it.**

---

### 4.16 Learning Gaps (`/gaps`)

- **List of gaps** across attempts (or filtered by latest).
- **Per gap card:**
  - Concept name
  - Mastery / accuracy %
  - Severity badge (High / Medium) — never “AI decided”. Backend `gap_level` remains `high | medium | low`; the UI may label `low` as “Strong” or “Mastered”.
  - One-sentence explanation
  - 1–2 recommendations
  - “Generate practice” button
- **Mastered concepts** can be shown collapsed or in a separate “Strong areas” section.
- **Empty:** “No learning gaps detected yet. Complete an assessment to see personalized insights.”

---

### 4.17 Targeted Practice

- **Entry:** From gap card.
- **Generation:** Loading state “Creating 3–5 practice questions on {concept}…”.
- **Failure:** Retry, existing results unaffected.
- **Practice runner:** Similar to quiz but clearly labeled “Practice · does not affect your assessment score”.
- **Completion:** Summary of practice answers (optional) + return to gaps.
- **No official score impact.**

---

## 5. Component System

Reuse shadcn/ui primitives where possible. Product-specific compositions:

| Component | Behavior / Notes |
|-----------|------------------|
| Button | Primary, secondary, destructive, ghost, outline. Loading spinner + disabled. |
| Input / Textarea / Select | Visible labels, error text below, helper text. |
| Card | Surface for class, assessment, gap, question. Consistent padding. |
| Badge | Status (draft/published/closed), difficulty, source (AI/Manual), gap level (high/medium), severity. |
| Progress | Linear for upload/generation; circular optional. |
| Dialog / AlertDialog | Publish confirm, delete question, submit quiz, unsaved changes. |
| Toast | Success / error / info. Auto-dismiss 4s. aria-live polite. |
| Skeleton | Page and card level. |
| EmptyState | Illustration + title + description + primary CTA. |
| QuestionCard | Stem + 4 choices + metadata. Used in editor and (read-only) results. |
| AssessmentCard | Title, status, dates, progress or score. |
| ClassCard | Name, code, student count, quick actions. |
| MasteryBar / ConceptRow | Accuracy visualization with accessible text alternative. |
| Chart wrappers | Recharts with legend, tooltip, table fallback, reduced-motion respect. |
| JoinCodeDisplay | Monospace + copy button. |
| StatusBadge | Semantic colors + icon + text (never color alone). |

---

## 6. Design System

### 6.1 Color Tokens (semantic)

**Light mode (default for MVP)**
- `--background`: #FAFBFC (cool off-white)
- `--surface`: #FFFFFF
- `--surface-muted`: #F1F5F9
- `--border`: #E2E8F0
- `--text`: #0F172A (slate-900)
- `--text-muted`: #64748B (slate-500)
- `--primary`: #2563EB (blue-600) — trust, education, clarity
- `--primary-foreground`: #FFFFFF
- `--secondary`: #0EA5E9 (sky) or soft indigo accent
- `--success`: #16A34A
- `--warning`: #D97706
- `--error`: #DC2626
- `--info`: #0284C7
- Gap `high`: error/warning family
- Gap `medium`: warning
- Gap `low`: success; UI label may be “Strong” or “Mastered”

**Dark mode (optional but recommended for portfolio polish)**
- Desaturated surfaces, higher contrast text, same semantic hues adjusted for ≥4.5:1.

All interactive states (hover, focus, pressed, disabled) defined via tokens. Focus ring: 2–3px primary with offset.

### 6.2 Typography

- **Font:** Inter (or system-ui stack) for UI; optional JetBrains Mono or tabular-nums for scores and codes.
- **Scale:**
  - Display / Page title: 30–36px / 700
  - H1: 24–28px / 600
  - H2: 20px / 600
  - H3: 16–18px / 600
  - Body: 16px / 400, line-height 1.5–1.6
  - Small / Caption: 14px / 400
  - Micro: 12px (use sparingly)
- Numeric scores use tabular lining figures.

### 6.3 Spacing

4 / 8px rhythm: 4, 8, 12, 16, 24, 32, 48, 64.  
Page padding: 16–24 mobile, 32–48 desktop.  
Card internal: 16–24.

### 6.4 Radius

- sm: 6px (inputs, badges)
- md: 8–10px (cards, buttons)
- lg: 12–16px (modals, large cards)
- full: pills / avatars

### 6.5 Shadows

Restrained:
- sm: subtle card elevation
- md: dropdowns / popovers
- lg: modals only

Avoid heavy glass or multi-layer glow.

### 6.6 Icons

Lucide React (consistent 1.5–2px stroke). Size tokens: 16 / 20 / 24.  
Never emoji as structural icons. Decorative icons aria-hidden; interactive icons have accessible names.

### 6.7 Visual Hierarchy

One primary CTA per view. Secondary actions visually quieter. Status and severity always paired with text + icon.

---

## 7. Responsive Strategy

| Breakpoint | Behavior |
|------------|----------|
| < 640px (mobile) | Single column. Bottom or top nav. Quiz: full-width choices, sticky progress/submit. Tables → stacked cards. Charts → simplified or table. |
| 640–1023px (tablet) | 2-column where helpful. Sidebar collapses. |
| ≥ 1024px | Persistent sidebar. Multi-column editor (list + detail). Full charts. |

- Quiz-taking: highest priority for touch targets and focus.
- Question editor: on mobile becomes sequential full-screen cards.
- No horizontal scroll.
- Viewport meta allows zoom.
- Safe areas respected if PWA later.

---

## 8. Accessibility

- Contrast ≥ 4.5:1 body text, ≥ 3:1 non-text UI.
- Visible focus rings on all interactive elements.
- Keyboard: full support for quiz navigation, editor, modals (focus trap + escape).
- Form labels always visible (not placeholder-only).
- Errors: associated via aria-describedby + aria-live.
- Color never sole indicator (badges include text + icon).
- Charts: text summary or data table alternative.
- Reduced motion: respect `prefers-reduced-motion` (disable non-essential transitions).
- Touch targets ≥ 44×44 px.
- Screen-reader status for save, generate, submit.
- Semantic headings, landmarks, skip link to main content.

---

## 9. UX State Matrix (key actions)

| Action | Loading | Success | Error | Empty | Disabled | Unauthorized |
|--------|---------|---------|-------|-------|----------|--------------|
| Login / Signup | Spinner on button | Redirect by role | Inline alert | — | During request | — |
| Create class | Button loading | Toast + list update | Validation / server | — | — | Teacher only |
| Upload PDF | Progress + “Processing” | Ready badge | Type/size/extract error | — | Invalid file | Teacher + owns class |
| Generate questions | Indeterminate + message | Draft questions appear | AI_GENERATION_ERROR + retry | — | No ready material | Teacher |
| Save question | Subtle indicator | Saved | Validation near fields | — | Published | Teacher |
| Publish | Button loading | Status → published | Validation (dates, questions) | — | No questions / invalid | Teacher |
| Start attempt | — | Enter quiz | Limit / closed / not available | — | Limit reached / closed | Student + member |
| Save answer | Optimistic + “Saved” | Confirmed | Network → retry | — | Submitted | Owner of attempt |
| Submit attempt | Confirm modal → loading | Results page | Already submitted | Unanswered warning | Already submitted | Owner |
| Gap explanation | Optional skeleton | Text appears | Fallback generic text | No gaps | — | Student own |
| Practice generate | “Creating practice…” | Practice set | Retry | — | — | Student own gap |

Session expired → redirect to login with message. Permission denied → 403 page or toast + back.

---

## 10. AI Interaction Patterns

**Quiz generation**
- Framing: “AI will generate a draft set of questions from your material. You review and edit before publishing.”
- Never present generated questions as final or authoritative.
- Source badge “AI” vs “Manual” remains visible.
- Failure is recoverable; assessment stays draft.

**Gap explanations & recommendations**
- Framing: “Study guidance generated from your concept performance. Gap levels are calculated by the assessment system from accuracy thresholds.”
- Severity is never attributed to the model.
- If model fails, deterministic gaps still show with fallback copy.
- Avoid “AI” logo spam; keep product language focused on learning outcomes.

**Practice**
- Clearly labeled practice; no impact on official scores.
- Same validation rules as assessment questions.

---

## 11. Developer Handoff Notes

### Page requirements summary
Implement every route listed in §2.1. Each page must implement the sections, primary/secondary actions, and states described in §4.

### Interaction behavior
- Autosave answers while attempt is active.
- Resume active attempt; never create duplicate active.
- Published assessments lock question editing in UI (backend also enforces).
- Attempt limit and window checks are server-authoritative; UI reflects them clearly.
- Client never sends `is_correct`, `score`, `gap_level`, or answer keys.

### State behavior
Use the matrix in §9. Prefer optimistic updates for answer saves with clear error recovery. Generation and practice are async; show progress and allow retry.

### Responsive rules
Follow §7. Mobile quiz and join flows are highest priority for polish.

### Important UX constraints (must not be violated)
1. Students never see `correct_answer` before submission.
2. Gap severity comes only from rule engine (0.5 / 0.8 thresholds).
3. No student PII in any Gemini-facing payload (UI must not collect or display it in generation contexts).
4. Published → questions immutable in UI.
5. Active attempt resume, not recreate.
6. Scoring success independent of Gemini availability.
7. Practice does not affect official assessment scores.
8. Error contract uses stable codes from V2 (`UNAUTHENTICATED`, `FORBIDDEN`, `AI_GENERATION_ERROR`, `ATTEMPT_LIMIT_REACHED`, etc.).

### Suggested component library mapping
- shadcn/ui: Button, Input, Textarea, Select, Dialog, AlertDialog, Badge, Card, Tabs, Toast (sonner), Progress, Skeleton, Table.
- Lucide icons.
- Recharts for distribution and concept bars (with accessible alternatives).
- Tailwind CSS design tokens matching §6.

### Empty / Loading / Error patterns
Implement consistent EmptyState, Skeleton, and Alert components used across teacher and student surfaces so the product feels coherent.

---

## 12. V2 Alignment Clarifications

The following are implementation clarifications to prevent UI recommendations from being mistaken for changes to the functional specification:

1. **Assessment creation route:** `/assessments/new` is the recommended route for the assessment creation form. A class context may be passed with `classId`.
2. **Material upload route:** Upload is primarily initiated from Class Detail. A dedicated upload route is optional and should not be required if an in-context flow is simpler.
3. **Gap levels:** The backend contract remains `high | medium | low`. The UI may present `low` as “Strong” or “Mastered” for student-friendly language. Gap severity is still deterministic.
4. **Authentication:** The current UI/UX decision includes Google OAuth and a restricted Guest/Demo mode in addition to email/password. Guest mode must be isolated from real persistent teacher/student data.
5. **File size:** Any 20 MB upload guidance in this document is a UI/UX recommendation only unless the backend specification explicitly adopts it.
6. **Recommendations vs requirements:** UI/UX recommendations in this document must not be implemented as new backend/product requirements unless separately approved.

---

## Appendix A — Status Badge Visual Language

| Status | Color token | Icon suggestion | Label |
|--------|-------------|-----------------|-------|
| Draft | muted | FileEdit | Draft |
| Published | success / primary | CheckCircle | Published |
| Closed | muted | Lock | Closed |
| Processing | info | Loader | Processing |
| Ready | success | Check | Ready |
| Error | error | AlertCircle | Error |
| High gap | error | AlertTriangle | High |
| Medium gap | warning | AlertCircle | Medium |
| Mastered | success | CheckCircle | Strong |

---

## Appendix B — Key Microcopy Examples

- Upload >25 pages: “Only the first 25 pages will be processed.”
- Insufficient text: “We couldn’t extract enough text. Scanned or image-only PDFs aren’t supported yet.”
- Generation failure: “We couldn’t generate questions right now. Your assessment is still a draft — try again.”
- Attempt limit: “You’ve reached the attempt limit for this assessment.”
- Active attempt: “You have an unfinished attempt. Continue where you left off.”
- Practice disclaimer: “Practice questions do not change your assessment score.”
- Gap framing: “Based on your accuracy, these concepts need more attention.”

---

**End of UI/UX Specification**

This document, together with `AI_Smart_Assessment_MVP_Build_Spec_V2.md`, is intended to allow a frontend coding agent to implement the complete application UI without guessing page content, interaction rules, or states.
