# AI SMART ASSESSMENT SYSTEM — MVP SPECIFICATION V3

**Version:** 3.0  
**Status:** Feature-locked (Teacher Results + Principal Role included)  
**Date:** August 2026

---

## 1. Product Overview

**Product Name**  
AI Smart Assessment System

**One-line description**  
An intelligent assessment platform that helps teachers turn learning materials into AI-generated assessments, lets students take those assessments, and identifies which concepts students actually struggle with. The system also gives teachers class-level performance insights and allows school principals to view performance across their school.

---

## 2. The Problem

Traditional online quizzes usually provide a result like:

> Student scored 7/10 — 70%

That tells us how much the student got right, but not necessarily what they don’t understand.

For example, a student gets 7/10 in a Photosynthesis test.  
The teacher may not know whether the student is struggling with:

- Chlorophyll
- Light reactions
- Calvin cycle
- Stomata
- Glucose production

Teachers also have to spend time:

- Reading learning material
- Creating questions
- Assigning concepts
- Checking answers
- Analyzing student performance
- Identifying weak concepts
- Deciding what needs to be re-taught

---

## 3. Proposed Solution

The system creates an intelligent pipeline:

```
Learning Material
       ↓
PDF Text Extraction
       ↓
AI Question Generation
       ↓
Teacher Review
       ↓
Published Assessment
       ↓
Student Takes Assessment
       ↓
Deterministic Scoring
       ↓
Concept-Level Analysis
       ↓
Learning Gap Detection
       ↓
AI Explanation
       ↓
Student Results
       ↓
Teacher Analytics
       ↓
Principal School-Level View
```

**Key idea:**  
Don’t stop at the student’s total score. Identify the concepts behind the score.

---

## 4. Core Product Users

The MVP has **three roles**.

### 4.1 Teacher
Teacher can:
- Create/manage classes
- Upload learning material
- Create assessments
- Generate questions with Gemini
- Review / edit / add / delete questions
- Publish assessments
- See student results
- Analyze weak concepts
- View individual student performance
- Export results to Excel

### 4.2 Student
Student can:
- Create/login to account
- Join a class
- View published assessments
- Take assessments
- Submit answers
- View score
- View concept performance
- View learning gaps
- View AI-generated explanations/recommendations

### 4.3 Principal
Principal is **view-only**.

Principal can:
- View their school
- View grades
- View subjects / teachers
- View assessments
- View student / class performance
- View concept performance
- View weak concepts
- View aggregated AI review

Principal **cannot** modify assessment data.

---

## 5. High-Level Architecture

```
                    ┌──────────────────┐
                    │      TEACHER     │
                    └────────┬─────────┘
                             │
                    Create Class / Upload PDF
                             │
                             ▼
                    ┌──────────────────┐
                    │    NEXT.JS APP   │
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
          Supabase       PyMuPDF        Gemini API
          Auth/DB        PDF Extract    AI Generation
               │                           │
               │                           │
               └─────────────┬─────────────┘
                             ▼
                       ASSESSMENT
                             │
                             ▼
                    ┌──────────────────┐
                    │     STUDENT      │
                    └────────┬─────────┘
                             │
                         Take Test
                             │
                             ▼
                    Deterministic Scoring
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
          Total Score   Concept Perf.   Learning Gaps
                                             │
                                             ▼
                                       Gemini Explanation
                                             │
                              ┌──────────────┴─────────────┐
                              ▼                            ▼
                         Student Result              Teacher Results
                                                           │
                                                           ▼
                                                    Principal View
```

---

## 6. Teacher Workflow

### 6.1 Teacher Login
Teacher logs into the platform.  
The system identifies:
- Role = Teacher
- School = Assigned School

Teacher can only access their authorized classes and assessments.

---

## 7. Class Creation

Teacher creates a class.

**Example:**
- Grade: 10
- Subject: Biology
- Class: 10A

The system generates a class join code.

**Example:** `LTACJB`

Students use this code to join.

---

## 8. Learning Material Upload

Teacher uploads a PDF.

**Example:** `Photosynthesis.pdf`

The PDF is stored securely in Supabase Storage.  
PyMuPDF extracts the text.

```
Photosynthesis.pdf
       ↓
   PyMuPDF
       ↓
Extracted Text
```

The extracted content becomes the source material for assessment generation.

---

## 9. Assessment Creation

Teacher creates an assessment.

**Example:**
- Assessment: Photosynthesis Test
- Class: 10A
- Question Count: 10

The teacher selects the relevant learning material.

---

## 10. AI Question Generation

Gemini generates questions from the learning material.

**Example Question:**
```
Question:
What is the main pigment responsible for absorbing
light energy during photosynthesis?

Choices:
A. Glucose
B. Chlorophyll
C. Carbon dioxide
D. Water

Correct Answer: B
Concept: Chlorophyll
Difficulty: Medium
```

Another question could be:
```
Question:
Where do the light-dependent reactions occur?

Concept: Light-dependent reactions
```

Each question must contain a **concept tag**.  
This concept tag is critical because later the backend uses it to determine which concepts the student understood.

---

## 11. Teacher Question Review

AI-generated questions are **not** automatically trusted.

Teacher can:
- Review
- Edit
- Add
- Delete

**Example:**
```
Q1
What is the primary pigment involved in photosynthesis?

[Edit]

Concept: Chlorophyll
Difficulty: Medium

[Save]
```

---

## 12. Publishing

Assessment starts as **Draft**.

After teacher review:
```
Draft
  ↓
Publish
```

Once published, students can access it.  
Published questions must be protected from unauthorized modification.

---

## 13. Student Class Joining

Student logs in and enters the class code.

**Example:** `LTACJB`

The system verifies the code and adds the student to the class.  
Students should only see assessments belonging to their classes.

---

## 14. Student Assessment Discovery

Student sees published assessments.

**Example:**
```
My Assessments

Photosynthesis Test
Biology — Class 10A
10 Questions

[Start Assessment]
```

Students must never receive the correct answer from the assessment API before submission.

---

## 15. Taking the Assessment

Student starts the assessment.

**Example:**
```
Photosynthesis Test

Question 1 of 10

What is the main pigment responsible
for absorbing light?

○ Glucose
○ Chlorophyll
○ Carbon dioxide
○ Water
```

The student’s selected answer is stored (with auto-save / resume support).

---

## 16. Submission

After answering:

```
[Submit Assessment]
```

The backend validates the attempt.  
Once submitted:
- `submitted_at` = timestamp
- The attempt becomes locked
- The student cannot modify the submitted attempt

---

## 17. Deterministic Scoring

**Critical architectural rule:**  
The backend calculates correctness. Gemini does **not** decide whether an answer is correct.

**Example:**
```
Stored correct answer = B
Student answer = B  → Correct

Stored correct answer = B
Student answer = C  → Incorrect
```

Final score example:
```
Correct = 7
Total = 10
Score = 70%
```

---

## 18. Concept-Level Performance

This is the main intelligence of the system.

Suppose the 10 questions are distributed like this:

| Concept          | Questions |
|------------------|-----------|
| Chlorophyll      | 2         |
| Light reactions  | 3         |
| Calvin cycle     | 3         |
| Stomata          | 2         |

Student results:

| Concept          | Correct | Performance |
|------------------|---------|-------------|
| Chlorophyll      | 2/2     | 100%        |
| Light reactions  | 1/3     | 33%         |
| Calvin cycle     | 2/3     | 67%         |
| Stomata          | 2/2     | 100%        |

Interpretation:
- Chlorophyll → Strong
- Light reactions → Weak
- Calvin cycle → Medium
- Stomata → Strong

---

## 19. Standard Performance Rules

These rules are used consistently across the entire system:

| Level   | Rule      |
|---------|-----------|
| Strong  | ≥ 80%     |
| Medium  | 50–79%    |
| Weak    | < 50%     |

| Overall | Rule          |
|---------|---------------|
| Pass    | Score > 50%   |
| Fail    | Score ≤ 50%   |

---

## 20. Learning Gap Detection

A weak concept becomes a learning gap.

**Example:**
```
Overall Score: 70%

Concept Performance:
Chlorophyll      100% → Strong
Light reactions   33% → Weak  → Learning Gap
Calvin cycle      67% → Medium
Stomata          100% → Strong
```

The system identifies:
- Learning Gap: Light reactions

This calculation is done entirely by the backend using rule-based thresholds.

---

## 21. Gemini Gap Explanation

Gemini explains the identified weakness.

The system sends only anonymized data:
```
Concept: Light reactions
Mastery: 33%
Level: Weak
```

Gemini returns something like:
> The student may need to review how light energy is converted into chemical energy during the light-dependent reactions.

No unnecessary student personal information is sent to Gemini.

---

## 22. Student Result View

Student sees:

```
Photosynthesis Test

Score: 7 / 10
70%
```

Then concept performance:

```
Chlorophyll        100% — Strong
Light reactions     33% — Weak
Calvin cycle        67% — Medium
Stomata            100% — Strong
```

Then learning gaps:

```
⚠ Light reactions

You may need to review how light energy
is converted into chemical energy during
the light-dependent reactions.
```

This gives the student far more useful information than only “You scored 70%”.

---

## 23. Teacher Results Feature

Teachers have a separate **Results** section.

**Example entry:**
```
Results

Photosynthesis Test — Class 10A
Cell Structure Quiz — Class 10A
Algebra Basics — Class 9B
```

Teacher only sees their own authorized assessments.

---

## 24. Teacher Assessment Results Dashboard

When teacher selects an assessment (e.g. Photosynthesis Test):

**Overview cards:**
- Total Students: 32
- Passed: 22
- Failed: 10

Rules used:
- Pass = score > 50%
- Fail = score ≤ 50%

---

## 25. Teacher Teaching Suggestions

Title: **“You need to re-teach these weak concepts”**

### Weak Concepts (Priority)
```
Light reactions — 38%

Students affected:
• Aathil
• Aravindh
• Jeffy
• Bala

Glucose — 41%

Students affected:
• Priya
• Karthik
```

### Medium Concepts (Needs Attention)
```
Calvin cycle — 61%

Students affected:
• Sneha
• Rahul

Stomata — 67%

Students affected:
• Divya
```

These values are calculated from actual assessment results.  
They must never be hardcoded.

---

## 26. Teacher Student Results Table

**Example table:**

| Student  | Score | Percentage | Status      | Action |
|----------|-------|------------|-------------|--------|
| Aathil   | 4/10  | 40%        | Completed   | View   |
| Aravindh | 6/10  | 60%        | Completed   | View   |
| Jeffy    | 3/10  | 30%        | Completed   | View   |
| Sneha    | 8/10  | 80%        | Completed   | View   |
| Rahul    | —     | —          | In Progress | —      |

**Features:**
- **Default sort:** Most recent submission first
- **Optional sort:** Alphabetical A–Z
- **Search:** By student name
- **Filters:** Failed, Weak, Completed, In Progress, All

---

## 27. Teacher Individual Student View

Teacher clicks a student (e.g. Aathil → View):

```
Aathil — Photosynthesis Test

Overall: 4/10 (40%)
Status: Failed

Concept Performance:
Chlorophyll        100% — Strong
Stomata             50% — Medium
Light reactions     20% — Weak
Glucose             25% — Weak

Learning Gaps:
• Light reactions
• Glucose

AI Explanation:
You may need to review how light energy is
converted into chemical energy during the
light-dependent reactions.

Also review the role of glucose in photosynthesis.
```

---

## 28. Teacher Excel Export

Button: **[Export to Excel]**

The spreadsheet should contain at minimum:

| Student | Score | %   | Status | Chlorophyll | Light Reactions | ... |
|---------|-------|-----|--------|-------------|-----------------|-----|
| Aathil  | 4/10  | 40% | Failed | 100%        | 20%             |     |
| Sneha   | 8/10  | 80% | Passed | 100%        | 67%             |     |

---

## 29. Principal / Head Feature

New role: **Principal**  
Principal is **read-only**.

---

## 30. Principal School Relationship

A Principal belongs to one school.

**Example:**
```
School: ABC Higher Secondary School

Teachers:
├── Mrs. Priya
├── Mr. Kumar
├── Mrs. Divya
└── Mr. Rahul
```

Teachers of the same school automatically come under that Principal.

---

## 31. Principal Permissions

**Principal CAN:**
- View grades
- View subjects
- View teachers
- View classes
- View assessments
- View student performance
- View concept performance
- View aggregated results
- View AI review

**Principal CANNOT:**
- Create / edit / delete assessments
- Modify questions
- Modify student scores
- Modify learning gaps
- Create classes

These restrictions must be enforced **server-side**, not only by hiding UI buttons.

---

## 32. Current MVP Account Creation

For this MVP:
- Principal and Teacher accounts are manually created and assigned.
- Each account is associated with a School.
- Do not build a complicated school administration system unless later required.

---

## 33. Principal Navigation Hierarchy

```
Principal Login
    ↓
Grades (1st, 2nd, 3rd … 12th)
    ↓
Click “5th Standard” / “10th Standard”
    ↓
Subjects + Teachers
    ↓
Click “Science — Mrs. Priya”
    ↓
List of Tests
    ↓
Click a Test
    ↓
Summary Report
```

**Example path:**
```
Grade 10
  → Biology — Mrs. Priya
    → Photosynthesis Test
```

---

## 34. Principal Assessment Summary

**Example:**
```
Photosynthesis Test
Class 10A
Teacher: Mrs. Priya

Overview
Total Students: 32
Passed: 22
Failed: 10
Weak Students: 14
```

---

## 35. Principal Concept Analytics

**Example table:**

| Concept          | Average Accuracy | Level  |
|------------------|------------------|--------|
| Chlorophyll      | 91%              | Strong |
| Stomata          | 78%              | Medium |
| Calvin cycle     | 59%              | Medium |
| Light reactions  | 36%              | Weak   |
| Glucose          | 42%              | Weak   |

These numbers must be calculated from actual student performance.

---

## 36. Principal Gemini Review

Simple aggregated AI summary.

**Example:**
> In this test, 22 students passed and 10 students failed.  
> The weak concepts that need to be re-taught are Light reactions and Glucose.

Gemini receives only aggregated information (no unnecessary student PII):

```
Total students: 32
Passed: 22
Failed: 10

Concepts:
Chlorophyll: 91%
Stomata: 78%
Calvin cycle: 59%
Light reactions: 36%
Glucose: 42%
```

The backend calculates the numbers.  
Gemini only turns the information into natural language.

---

## 37. Access Control Summary

| Role      | Can Access                                      | Cannot Access                          |
|-----------|--------------------------------------------------|----------------------------------------|
| Student   | Own profile, classes, assessments, attempts, results | Other students’ results, teacher analytics, principal reports |
| Teacher   | Own classes, assessments, students in own classes, own results | Other teachers’ private data           |
| Principal | All data belonging to their school (view only)  | Other schools’ data, any write actions |

---

## 38. AI Responsibility Separation

**Strict rule:**

| Responsibility              | Owner     |
|-----------------------------|-----------|
| Question generation         | Gemini    |
| Learning-gap explanation    | Gemini    |
| Aggregated review           | Gemini    |
| Authentication              | Backend   |
| Authorization               | Backend   |
| Validation                  | Backend   |
| Answer correctness          | Backend   |
| Scoring                     | Backend   |
| Concept accuracy            | Backend   |
| Thresholds                  | Backend   |
| Learning-gap detection      | Backend   |
| Persistence                 | Backend   |
| Access control              | Backend   |

**Never** use Gemini to decide whether a student’s answer is correct.

---

## 39. Database Concept

The system needs to persist:

- Users / Profiles (with roles)
- Schools
- Classes
- Class Members
- Materials
- Assessments
- Questions
- Attempts
- Answers
- Concept Performance
- Learning Gaps

The existing project already contains the core assessment-related tables.  
Implementation should **reuse** them instead of creating duplicate systems.

---

## 40. Existing Technical Foundation

Current stack:
- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- PyMuPDF (Python)
- Gemini API

The existing core assessment pipeline (Phases 1–3) must be preserved.

---

## 41. Targeted Practice

Targeted practice is **not required** for the current MVP.

The repository may already contain some practice-related database/API work, but do not make targeted practice a dependency of the core MVP.

---

## 42. Complete End-to-End Example

### Teacher
Mrs. Priya logs in.  
Creates:
- Grade: 10
- Subject: Biology
- Class: 10A

Uploads `Photosynthesis.pdf`.  
System extracts the text.  
Creates “Photosynthesis Test” (10 questions).  
Gemini generates the questions.  
She reviews and edits one question.  
Publishes the test.

### Student
Aathil joins using code `LTACJB`.  
Takes the test and scores **4/10 (40%)**.

Backend calculates:
- Chlorophyll: 100%
- Stomata: 50%
- Light reactions: 20%
- Glucose: 25%

Learning gaps: Light reactions, Glucose.  
Gemini generates explanations.  
Aathil sees his detailed result.

### Teacher
Mrs. Priya opens **Results → Photosynthesis Test**.

Sees:
- 32 Students
- 22 Passed
- 10 Failed

Teaching Suggestions show weak concepts and the students under them.  
She opens Aathil’s detail view and knows exactly what to re-teach.

### Principal
Principal logs in.  
Selects:
```
Grade 10 → Biology → Mrs. Priya → Photosynthesis Test
```

Sees:
- 32 Students, 22 Passed, 10 Failed, 14 Weak Students
- Concept analysis table
- Simple Gemini review:
  > In this test, 22 students passed and 10 students failed.  
  > The weak concepts that need to be re-taught are Light reactions and Glucose.

---

## 43. What Makes This Project Different

The system is **not** simply “Upload PDF → AI makes quiz”.

The complete value is:

```
Learning Material
       ↓
AI Assessment Generation
       ↓
Teacher Verification
       ↓
Student Assessment
       ↓
Deterministic Scoring
       ↓
Concept-Level Analysis
       ↓
Learning Gap Detection
       ↓
Student Feedback
       ↓
Teacher Teaching Insights
       ↓
School-Level Visibility
```

The key output is therefore not just:
> 70%

It is:
> 70% overall, but the student/class is specifically weak in Light Reactions and Glucose.

---

## 44. MVP Scope Boundary

### INCLUDED
- Teacher authentication
- Student authentication
- Principal authentication
- School association
- Class creation + join code
- PDF upload + text extraction
- AI question generation + concept tagging
- Teacher question review / edit
- Assessment publishing
- Student assessment taking + submission
- Deterministic scoring
- Concept performance calculation
- Learning-gap detection
- Student results
- Teacher results dashboard
- Teacher student-level performance
- Teaching suggestions (Weak + Medium)
- Excel export
- Principal school-level dashboard
- Principal assessment analytics
- Principal AI review
- Role-based access control

### NOT REQUIRED FOR CURRENT MVP
- Targeted practice
- Practice runner
- Practice history
- Complex school administration
- Automated principal/teacher account provisioning
- Unnecessary AI features

---

## 45. Final Success Criteria

The MVP is successful when this complete journey works end-to-end:

```
TEACHER
  → Login
  → Create Class
  → Upload PDF
  → Extract Material
  → Generate Questions
  → Review/Edit
  → Publish
────────────────────────
STUDENT
  → Login
  → Join Class
  → Take Assessment
  → Submit
  → Score
  → Concept Performance
  → Learning Gaps
  → AI Explanation
  → Student Result
────────────────────────
TEACHER
  → Results
  → Class Performance
  → Weak Concepts
  → Students Needing Attention
  → Individual Student Results
  → Excel Export
────────────────────────
PRINCIPAL
  → School
  → Grade
  → Subject / Teacher
  → Assessment
  → School/Class Summary
  → Concept Performance
  → Weak Concepts
  → AI Review
```

---

## Core Philosophy (Never Break This)

> **AI creates and explains.**  
> **The backend verifies and decides.**

This distinction must remain intact throughout the entire implementation.

---

**End of MVP Specification V3**
