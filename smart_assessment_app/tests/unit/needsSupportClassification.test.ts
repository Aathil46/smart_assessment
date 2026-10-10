import { describe, expect, it } from "vitest";
import {
  evaluateAttempt,
  isWeakStudent,
  type ConceptPerformanceResult,
} from "@/lib/conceptEngine";
import { aggregateClassPerformance } from "@/lib/analytics";

describe("Student 'Needs Support' Classification Logic (Weak Concept Ratio > 40%)", () => {
  // Helper to create concept performance items
  function makeConcepts(weakCount: number, totalCount: number): ConceptPerformanceResult[] {
    const list: ConceptPerformanceResult[] = [];
    for (let i = 1; i <= totalCount; i++) {
      const isWeak = i <= weakCount;
      list.push({
        concept: `Concept_${i}`,
        correctCount: isWeak ? 0 : 5,
        totalCount: 5,
        accuracy: isWeak ? 0.0 : 1.0,
        accuracyPercentage: isWeak ? 0 : 100,
        level: isWeak ? "Weak" : "Strong",
      });
    }
    return list;
  }

  // 1. 2 weak out of 10 concepts -> not flagged
  it("1. 2 weak out of 10 concepts (20%) -> not flagged", () => {
    const concepts = makeConcepts(2, 10);
    expect(isWeakStudent(concepts)).toBe(false);
  });

  // 2. 4 weak out of 10 concepts -> not flagged (strict inequality > 0.40)
  it("2. 4 weak out of 10 concepts (40% exact) -> not flagged", () => {
    const concepts = makeConcepts(4, 10);
    expect(isWeakStudent(concepts)).toBe(false);
  });

  // 3. 5 weak out of 10 concepts -> flagged
  it("3. 5 weak out of 10 concepts (50%) -> flagged as Needs Support", () => {
    const concepts = makeConcepts(5, 10);
    expect(isWeakStudent(concepts)).toBe(true);
  });

  // 4. 2 weak out of 5 concepts -> not flagged (strict inequality > 0.40)
  it("4. 2 weak out of 5 concepts (40% exact) -> not flagged", () => {
    const concepts = makeConcepts(2, 5);
    expect(isWeakStudent(concepts)).toBe(false);
  });

  // 5. 3 weak out of 5 concepts -> flagged
  it("5. 3 weak out of 5 concepts (60%) -> flagged as Needs Support", () => {
    const concepts = makeConcepts(3, 5);
    expect(isWeakStudent(concepts)).toBe(true);
  });

  // 6. 1 weak out of 1 concept -> flagged
  it("6. 1 weak out of 1 concept (100%) -> flagged as Needs Support", () => {
    const concepts = makeConcepts(1, 1);
    expect(isWeakStudent(concepts)).toBe(true);
  });

  // 7. Zero assessed concepts -> no division-by-zero error, not flagged
  it("7. Zero assessed concepts -> safely returns false with no division-by-zero error", () => {
    expect(isWeakStudent([])).toBe(false);
    expect(isWeakStudent(null as any)).toBe(false);
    expect(isWeakStudent(undefined as any)).toBe(false);
    expect(isWeakStudent([{ concept: "  ", level: "Weak" }] as any)).toBe(false);
  });

  // 8. Duplicate questions mapped to one concept -> count the concept only once
  it("8. Duplicate questions mapped to one concept -> concept is counted only once in denominator and numerator", () => {
    // 5 distinct concepts.
    // Concept_1 has 4 questions mapped to it, all answered incorrectly.
    // Concepts 2, 3, 4, 5 each have 1 question mapped to them, answered correctly.
    // Total questions: 8.
    // Distinct concepts: 5. Weak concepts: 1 ("Concept_1").
    // Ratio: 1 / 5 = 20% <= 40% -> MUST NOT be flagged as Needs Support!
    const questions = [
      { id: "q1", correct_answer: "A", concept: "Concept_1" },
      { id: "q2", correct_answer: "A", concept: "Concept_1" },
      { id: "q3", correct_answer: "A", concept: "Concept_1" },
      { id: "q4", correct_answer: "A", concept: "Concept_1" },
      { id: "q5", correct_answer: "B", concept: "Concept_2" },
      { id: "q6", correct_answer: "C", concept: "Concept_3" },
      { id: "q7", correct_answer: "D", concept: "Concept_4" },
      { id: "q8", correct_answer: "A", concept: "Concept_5" },
    ];

    const answers = [
      { question_id: "q1", selected_choice: "Z" }, // wrong
      { question_id: "q2", selected_choice: "Z" }, // wrong
      { question_id: "q3", selected_choice: "Z" }, // wrong
      { question_id: "q4", selected_choice: "Z" }, // wrong
      { question_id: "q5", selected_choice: "B" }, // correct
      { question_id: "q6", selected_choice: "C" }, // correct
      { question_id: "q7", selected_choice: "D" }, // correct
      { question_id: "q8", selected_choice: "A" }, // correct
    ];

    const evaluation = evaluateAttempt(questions, answers);
    expect(evaluation.conceptPerformance).toHaveLength(5);
    expect(evaluation.isWeakStudent).toBe(false);

    // Direct isWeakStudent call with duplicate entries for the same concept
    const duplicateEntries = [
      { concept: "Photosynthesis", correctCount: 0, totalCount: 1, level: "Weak" },
      { concept: "Photosynthesis", correctCount: 1, totalCount: 1, level: "Strong" },
      { concept: "Genetics", correctCount: 1, totalCount: 1, level: "Strong" },
    ];
    // Photosynthesis combined: 1/2 = 50% (Medium, not weak). Genetics: 100% (Strong).
    // Total distinct concepts: 2. Weak concepts: 0.
    expect(isWeakStudent(duplicateEntries)).toBe(false);
  });

  // 9. A student not flagged overall still appears under every weak concept in the support section
  it("9. A student not flagged overall still appears under every weak concept in the support section", () => {
    const members = [{ student_id: "s1" }, { student_id: "s2" }];
    const profiles = [
      { id: "s1", name: "Alice", roll_number: "R01" },
      { id: "s2", name: "Bob", roll_number: "R02" },
    ];

    // s1 has 10 assessed concepts, 2 are weak (Mitochondria and Ribosomes), 8 are strong
    // weakConceptRatio = 2 / 10 = 20% <= 40% -> s1 is NOT weak overall
    const attempts = [
      {
        id: "a1",
        student_id: "s1",
        score: 8,
        total: 10,
        started_at: "2024-01-01T10:00:00Z",
        submitted_at: "2024-01-01T10:30:00Z",
      },
      {
        id: "a2",
        student_id: "s2",
        score: 2,
        total: 10,
        started_at: "2024-01-01T10:00:00Z",
        submitted_at: "2024-01-01T10:30:00Z",
      },
    ];

    const conceptPerfs = [
      // s1 perfs: 2 weak concepts, 8 strong concepts
      { attempt_id: "a1", concept: "Mitochondria", correct_count: 0, total_count: 5, accuracy: 0.0, level: "Weak" },
      { attempt_id: "a1", concept: "Ribosomes", correct_count: 1, total_count: 5, accuracy: 0.2, level: "Weak" },
      { attempt_id: "a1", concept: "Nucleus", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Chloroplast", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Cell Wall", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Vacuole", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Cytoplasm", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Membrane", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Golgi", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a1", concept: "Lysosome", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },

      // s2 perfs: struggling on Mitochondria and Ribosomes as well
      { attempt_id: "a2", concept: "Mitochondria", correct_count: 0, total_count: 5, accuracy: 0.0, level: "Weak" },
      { attempt_id: "a2", concept: "Ribosomes", correct_count: 0, total_count: 5, accuracy: 0.0, level: "Weak" },
    ];

    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);

    // 1) Verify student s1 is NOT classified as Weak/Needs Support overall
    const student1 = result.studentResults.find((s) => s.student_id === "s1");
    expect(student1).toBeDefined();
    expect(student1?.isWeakStudent).toBe(false);

    // 2) Verify Mitochondria appears in weakConcepts and lists Alice (s1)
    const mitoConcept = result.weakConcepts.find((c) => c.concept === "Mitochondria");
    expect(mitoConcept).toBeDefined();
    expect(mitoConcept?.level).toBe("Weak");
    expect(mitoConcept?.affectedStudents.some((st) => st.student_id === "s1")).toBe(true);

    // 3) Verify Ribosomes appears in weakConcepts and lists Alice (s1)
    const riboConcept = result.weakConcepts.find((c) => c.concept === "Ribosomes");
    expect(riboConcept).toBeDefined();
    expect(riboConcept?.level).toBe("Weak");
    expect(riboConcept?.affectedStudents.some((st) => st.student_id === "s1")).toBe(true);
  });

  // 10. A student with a high overall score and more than 40% weak concepts is still flagged
  it("10. A student with a high overall score and more than 40% weak concepts is still flagged", () => {
    // 5 concepts total.
    // Concepts 1 & 2 have 10 questions each, student gets all 20 correct (Strong).
    // Concepts 3, 4, 5 each have 1 question, student gets 0 correct (Weak).
    // Total questions: 23.
    // Total score: 20 / 23 = 86.96% (High overall score!).
    // Assessed concepts: 5.
    // Weak concepts: 3 out of 5 = 60% > 40%.
    // Must still be flagged as Needs Support!
    const questions = [
      // Concept 1: 10 questions
      ...Array.from({ length: 10 }, (_, i) => ({ id: `c1_q${i}`, correct_answer: "A", concept: "C1" })),
      // Concept 2: 10 questions
      ...Array.from({ length: 10 }, (_, i) => ({ id: `c2_q${i}`, correct_answer: "A", concept: "C2" })),
      // Concept 3: 1 question
      { id: "c3_q0", correct_answer: "A", concept: "C3" },
      // Concept 4: 1 question
      { id: "c4_q0", correct_answer: "A", concept: "C4" },
      // Concept 5: 1 question
      { id: "c5_q0", correct_answer: "A", concept: "C5" },
    ];

    const answers = [
      ...Array.from({ length: 10 }, (_, i) => ({ question_id: `c1_q${i}`, selected_choice: "A" })),
      ...Array.from({ length: 10 }, (_, i) => ({ question_id: `c2_q${i}`, selected_choice: "A" })),
      { question_id: "c3_q0", selected_choice: "WRONG" },
      { question_id: "c4_q0", selected_choice: "WRONG" },
      { question_id: "c5_q0", selected_choice: "WRONG" },
    ];

    const evaluation = evaluateAttempt(questions, answers);
    expect(evaluation.score).toBe(20);
    expect(evaluation.total).toBe(23);
    expect(evaluation.percentage).toBe(86.96);
    expect(evaluation.passFail).toBe("Pass");
    // High score, but 3 of 5 concepts weak (60% > 40%) -> flagged!
    expect(evaluation.isWeakStudent).toBe(true);
  });
});
