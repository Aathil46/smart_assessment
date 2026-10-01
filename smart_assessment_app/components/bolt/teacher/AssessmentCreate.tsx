"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from '@/components/bolt/router';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { AIProcessingOverlay } from '@/components/ui/StatusIndicator';
import type { Question } from '@/types';
import {
  Check, ChevronRight, ChevronLeft, Sparkles, FileText,
  ClipboardPen, Clock, Award, Eye, Send, Plus, Trash2,
  Edit3, CheckCircle2, AlertCircle, SlidersHorizontal, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealClass {
  id: string;
  name: string;
  subject?: string;
  grade?: string;
  studentCount: number;
  color: string;
}

interface RealMaterial {
  id: string;
  title: string;
  fileSize: string;
  pageCount: number;
  extractedConcepts: string[];
  status: string;
}

const steps = [
  { id: 0, label: 'Select Class', icon: FileText },
  { id: 1, label: 'Choose Material', icon: FileText },
  { id: 2, label: 'Configure', icon: ClipboardPen },
  { id: 3, label: 'AI Generate', icon: Sparkles },
  { id: 4, label: 'Review & Edit', icon: Edit3 },
  { id: 5, label: 'Preview & Publish', icon: Send },
];

export function AssessmentCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [config, setConfig] = useState({ title: '', questionCount: 10, duration: 45, passingScore: 70, difficulty: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed' });
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classesList, setClassesList] = useState<RealClass[]>([]);
  const [materialsList, setMaterialsList] = useState<RealMaterial[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [createdAssessmentId, setCreatedAssessmentId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoadingClasses(true);
        const res = await fetch('/api/classes');
        if (!res.ok) throw new Error('Failed to load classes');
        const data = await res.json();
        const rawClasses = data.classes ?? [];
        const colors = ['teal', 'blue', 'purple', 'amber', 'rose', 'sky'];
        const mapped: RealClass[] = rawClasses.map((c: any, index: number) => ({
          id: c.id,
          name: c.name?.startsWith('"') && c.name?.endsWith('"') ? c.name.slice(1, -1) : (c.name || 'Unnamed Class'),
          subject: c.subject || 'General',
          grade: c.grade || '',
          studentCount: c.class_members?.[0]?.count ?? 0,
          color: colors[index % colors.length],
        }));
        setClassesList(mapped);
      } catch (err) {
        console.error('Error fetching classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setMaterialsList([]);
      setSelectedMaterial('');
      return;
    }
    async function loadMaterials() {
      try {
        setLoadingMaterials(true);
        const res = await fetch(`/api/materials?classId=${selectedClass}`);
        if (!res.ok) throw new Error('Failed to load materials');
        const data = await res.json();
        const rawMaterials = data.materials ?? [];
        const ready = rawMaterials.filter((m: any) => m.status === 'processed');
        const mapped: RealMaterial[] = ready.map((m: any) => {
          const concepts = m.metadata?.aiSummary?.concepts?.map((c: any) => c.name || c) || [];
          const sizeMb = m.size_bytes ? (m.size_bytes / (1024 * 1024)).toFixed(1) + ' MB' : '';
          return {
            id: m.id,
            title: m.title,
            fileSize: sizeMb,
            pageCount: m.page_count ?? 1,
            extractedConcepts: concepts,
            status: m.status,
          };
        });
        setMaterialsList(mapped);
      } catch (err) {
        console.error('Error fetching materials:', err);
      } finally {
        setLoadingMaterials(false);
      }
    }
    loadMaterials();
  }, [selectedClass]);

  const genSteps = [
    'Analyzing learning material...',
    'Extracting key concepts...',
    'Generating questions...',
    'Creating answer explanations...',
    'Mapping questions to concepts...',
    'Validating assessment...',
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setGenStep(0);
    setGenerationError(null);

    const stepTimer = setInterval(() => {
      setGenStep((s) => (s < genSteps.length - 1 ? s + 1 : s));
    }, 1200);

    try {
      const diff = config.difficulty === 'mixed' ? 'medium' : config.difficulty;
      const count = Math.max(3, Math.min(20, config.questionCount));

      // 1. Create draft assessment in database
      const createRes = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          materialId: selectedMaterial,
          title: config.title.trim(),
          topic: config.title.trim(),
          numQuestions: count,
          difficulty: diff,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to create draft assessment');
      }

      const created = await createRes.json();
      const assessmentId = created.id;
      setCreatedAssessmentId(assessmentId);

      // 2. Call backend AI generation endpoint
      const genRes = await fetch(`/api/assessments/${assessmentId}/generate`, {
        method: 'POST',
      });

      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'AI generation failed');
      }

      // 3. Fetch questions generated in the database
      const getRes = await fetch(`/api/assessments/${assessmentId}`);
      if (!getRes.ok) throw new Error('Failed to load generated questions');
      const getData = await getRes.json();
      const rawQs = getData?.assessment?.questions ?? [];

      const mappedQs: Question[] = rawQs.map((q: any) => ({
        id: q.id,
        type: 'multiple-choice',
        question: q.text,
        options: q.choices,
        correctAnswer: q.correct_answer,
        explanation: `Concept: ${q.concept}`,
        concept: q.concept,
        difficulty: q.difficulty,
        points: 1,
      }));

      setQuestions(mappedQs);
      setGenerated(true);
    } catch (err: any) {
      console.error('Generation error:', err);
      setGenerationError(err.message || 'An error occurred during AI generation');
    } finally {
      clearInterval(stepTimer);
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!createdAssessmentId) {
      navigate('/teacher/assessments');
      return;
    }
    try {
      setPublishing(true);
      const res = await fetch(`/api/assessments/${createdAssessmentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptLimit: 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || 'Failed to publish assessment');
        return;
      }
      navigate(`/teacher/assessments/${createdAssessmentId}`);
    } catch (err) {
      alert('An error occurred while publishing assessment');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to remove this question?')) return;
    try {
      const res = await fetch(`/api/questions/${questionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || 'Failed to delete question');
        return;
      }
      setQuestions((prev) => prev.filter((item) => item.id !== questionId));
    } catch (err) {
      alert('Failed to delete question');
    }
  };

  const handleEditQuestion = async (q: Question) => {
    const newText = prompt('Edit question text:', q.question);
    if (!newText || newText.trim() === q.question) return;
    try {
      const res = await fetch(`/api/questions/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newText.trim(),
          choices: q.options,
          correctAnswer: q.correctAnswer,
          concept: q.concept,
          difficulty: q.difficulty,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || 'Failed to update question');
        return;
      }
      setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, question: newText.trim() } : item)));
    } catch (err) {
      alert('Failed to update question');
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedClass;
      case 1: return !!selectedMaterial;
      case 2: return !!config.title;
      case 3: return generated;
      case 4: return questions.length > 0;
      default: return true;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/teacher/assessments')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-2">
            <ChevronLeft className="h-4 w-4" /> Back to Assessments
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Create Assessment</h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-shrink-0">
            {i < step ? (
              <button
                type="button"
                onClick={() => setStep(i)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full text-slate-800 hover:text-slate-900 transition-colors font-semibold text-xs cursor-pointer"
              >
                <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <span>{s.label}</span>
              </button>
            ) : i === step ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#2dd4bf] bg-[#f0fdfa] text-[#0d9488] font-bold text-xs shadow-xs">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d9488] text-white text-xs font-bold">
                  {i + 1}
                </div>
                <span>{s.label}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 text-slate-400 text-xs font-medium">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs">
                  {i + 1}
                </div>
                <span>{s.label}</span>
              </div>
            )}
            {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <Card className="relative">
        <CardBody className="p-6">
          {/* Step 0: Select Class */}
          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Select a Class</h2>
              <p className="text-sm text-slate-500 mb-5">Choose which class this assessment is for.</p>
              {loadingClasses ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-5 h-5 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading your classes...</p>
                </div>
              ) : classesList.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No classes found. Please create a class first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classesList.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClass(c.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedClass === c.id ? 'border-brand-500 bg-brand-50 shadow-glow-brand' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${c.color}-100 text-${c.color}-600`}>
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        {selectedClass === c.id && <CheckCircle2 className="h-5 w-5 text-brand-500" />}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.studentCount} students · {c.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Choose Material */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Choose Learning Material</h2>
              <p className="text-sm text-slate-500 mb-5">AI will generate questions based on this material's concepts.</p>
              {loadingMaterials ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-5 h-5 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading materials...</p>
                </div>
              ) : materialsList.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No ready materials in this class. Upload materials first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {materialsList.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMaterial(m.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedMaterial === m.id ? 'border-brand-500 bg-brand-50 shadow-glow-brand' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        {selectedMaterial === m.id && <CheckCircle2 className="h-5 w-5 text-brand-500" />}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{m.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.fileSize} · {m.pageCount} pages</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.extractedConcepts.slice(0, 3).map((c, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-2xs font-medium bg-slate-100 text-slate-600 rounded">{c}</span>
                        ))}
                        {m.extractedConcepts.length > 3 && <span className="px-1.5 py-0.5 text-2xs text-slate-400">+{m.extractedConcepts.length - 3}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              {/* Header with Icon */}
              <div className="flex items-start gap-3.5 pb-1">
                <div className="w-11 h-11 rounded-xl bg-[#f0fdfa] text-[#0d9488] border border-[#ccfbf1] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Configure Assessment</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
                    Set the key parameters for your assessment. The AI will use these settings to generate questions.
                  </p>
                </div>
              </div>

              {/* Assessment Title */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Assessment Title <span className="text-red-500 font-medium">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g., Quadratic Equations Mastery"
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Two Column Row 1: Number of Questions & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Number of Questions Stepper */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">
                    Number of Questions <span className="text-red-500 font-medium">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2.5">
                    Choose how many questions to include.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, questionCount: Math.max(1, config.questionCount - 1) })}
                      disabled={config.questionCount <= 1}
                      className="w-12 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Decrease questions"
                    >
                      <Minus className="h-4 w-4 stroke-[2.5]" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={config.questionCount}
                      onChange={(e) => setConfig({ ...config, questionCount: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                      className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-center font-bold text-slate-900 text-base focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, questionCount: Math.min(50, config.questionCount + 1) })}
                      disabled={config.questionCount >= 50}
                      className="w-12 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Increase questions"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-normal">
                    Recommended: 5 – 50 questions
                  </p>
                </div>

                {/* Duration Presets */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">
                    Duration (minutes) <span className="text-red-500 font-medium">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2.5">
                    Set the time limit for the assessment.
                  </p>
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {[15, 30, 45, 60, 90].map((preset) => {
                      const isSelected = !isCustomDuration && config.duration === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setIsCustomDuration(false);
                            setConfig({ ...config, duration: preset });
                          }}
                          className={cn(
                            'h-11 rounded-xl border text-sm font-medium transition-all flex items-center justify-center cursor-pointer',
                            isSelected
                              ? 'border-[#2dd4bf] bg-[#f0fdfa] text-[#0d9488] font-bold ring-1 ring-[#2dd4bf]'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                          )}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setIsCustomDuration(true)}
                      className={cn(
                        'h-11 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-center cursor-pointer',
                        isCustomDuration
                          ? 'border-[#2dd4bf] bg-[#f0fdfa] text-[#0d9488] font-bold ring-1 ring-[#2dd4bf]'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                      )}
                    >
                      Custom
                    </button>
                  </div>

                  {isCustomDuration && (
                    <div className="mt-2.5 flex items-center gap-2 animate-fade-in">
                      <input
                        type="number"
                        min={5}
                        max={180}
                        placeholder="Minutes"
                        value={config.duration}
                        onChange={(e) => setConfig({ ...config, duration: Math.max(5, parseInt(e.target.value) || 5) })}
                        className="h-9 w-28 px-3 rounded-lg border border-brand-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                      <span className="text-xs text-slate-500 font-medium">minutes (5 – 180)</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5 font-normal">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Recommended: 15 – 90 minutes</span>
                  </p>
                </div>
              </div>

              {/* Two Column Row 2: Passing Score & Difficulty Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                {/* Passing Score Slider */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">
                    Passing Score (%) <span className="text-red-500 font-medium">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2.5">
                    Minimum score required to pass.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={config.passingScore}
                        onChange={(e) => setConfig({ ...config, passingScore: parseInt(e.target.value) || 70 })}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#0d9488]"
                        style={{
                          background: `linear-gradient(to right, #0d9488 ${config.passingScore}%, #e2e8f0 ${config.passingScore}%)`,
                        }}
                      />
                      <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-0.5 font-medium">
                        <span>0</span>
                        <span>25</span>
                        <span>50</span>
                        <span>75</span>
                        <span>100</span>
                      </div>
                    </div>
                    <div className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white flex items-center gap-1.5 flex-shrink-0 shadow-xs">
                      <span className="text-sm font-bold text-slate-900">{config.passingScore}</span>
                      <span className="text-xs text-slate-400 font-medium">%</span>
                    </div>
                  </div>
                </div>

                {/* Difficulty Level Segmented Buttons */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">
                    Difficulty Level <span className="text-red-500 font-medium">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2.5">
                    Select the overall difficulty for questions.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'mixed', 'hard'] as const).map((lvl) => {
                      const isSelected = config.difficulty === lvl;
                      const label = lvl.charAt(0).toUpperCase() + lvl.slice(1);
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setConfig({ ...config, difficulty: lvl })}
                          className={cn(
                            'h-11 rounded-xl border text-sm font-medium transition-all flex items-center justify-center cursor-pointer',
                            isSelected
                              ? 'border-[#2dd4bf] bg-[#f0fdfa] text-[#0d9488] font-bold ring-1 ring-[#2dd4bf]'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-normal">
                    {config.difficulty === 'mixed' && 'Mixed includes a balance of easy, medium, and hard questions.'}
                    {config.difficulty === 'easy' && 'Easy focuses on foundational recall and understanding.'}
                    {config.difficulty === 'hard' && 'Hard includes complex multi-step application and reasoning.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: AI Generate */}
          {step === 3 && (
            <div className="animate-fade-in">
              <AIProcessingOverlay visible={generating} label={genSteps[genStep]} />
              {generationError && (
                <div className="p-4 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{generationError}</span>
                </div>
              )}
              {!generated && !generating && (
                <div className="text-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white mx-auto mb-4 animate-ai-pulse">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Ready to Generate</h2>
                  <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
                    AI will create {config.questionCount} questions based on the extracted concepts from your material.
                  </p>
                  <Button size="lg" onClick={handleGenerate}>
                    <Sparkles className="h-4 w-4" /> Generate Assessment
                  </Button>
                </div>
              )}
              {generating && (
                <div className="py-8">
                  <div className="space-y-3 max-w-md mx-auto">
                    {genSteps.map((s, i) => (
                      <div key={i} className={`flex items-center gap-3 transition-all ${i <= genStep ? 'opacity-100' : 'opacity-30'}`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                          i < genStep ? 'bg-success-100 text-success-600' :
                          i === genStep ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {i < genStep ? <Check className="h-3.5 w-3.5" /> :
                           i === genStep ? <div className="h-3 w-3 rounded-full bg-brand-500 animate-pulse" /> :
                           <div className="h-2 w-2 rounded-full bg-slate-300" />}
                        </div>
                        <span className={`text-sm ${i <= genStep ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {generated && !generating && (
                <div className="text-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-100 text-success-600 mx-auto mb-4 animate-scale-in">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Assessment Generated!</h2>
                  <p className="text-sm text-slate-500 mb-4">{questions.length} questions created. Review and edit them next.</p>
                  <Button size="lg" onClick={() => setStep(4)}>Review Questions <ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Edit */}
          {step === 4 && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Review & Edit Questions</h2>
                  <p className="text-sm text-slate-500">Edit any question before publishing.</p>
                </div>
              </div>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">{i + 1}</span>
                        <Badge variant="default" size="sm">{q.type === 'multiple-choice' ? 'Multiple Choice' : q.type === 'true-false' ? 'True/False' : 'Short Answer'}</Badge>
                        <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'error'} size="sm">{q.difficulty}</Badge>
                        <Badge variant="brand" size="sm">{q.concept}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditQuestion(q)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
                          aria-label="Edit question"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                          aria-label="Delete question"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mb-3">{q.question}</p>
                    {q.options && (
                      <div className="space-y-1.5 mb-2">
                        {q.options.map((opt, j) => (
                          <div key={j} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                            opt === q.correctAnswer ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-slate-50 text-slate-600'
                          }`}>
                            <span className="text-xs font-semibold w-4">{String.fromCharCode(65 + j)}</span>
                            {opt}
                            {opt === q.correctAnswer && <Check className="h-3.5 w-3.5 ml-auto text-success-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Sparkles className="h-3 w-3 text-accent-500" />
                      <span className="text-xs text-slate-500">{q.explanation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Preview & Publish */}
          {step === 5 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Preview & Publish</h2>
              <p className="text-sm text-slate-500 mb-5">Review the assessment summary before publishing to students.</p>
              <div className="max-w-lg space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                      <ClipboardPen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{config.title || 'Untitled Assessment'}</p>
                      <p className="text-xs text-slate-500">{classesList.find(c => c.id === selectedClass)?.name || 'Class'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                    <div className="text-center"><FileText className="h-4 w-4 text-slate-400 mx-auto mb-1" /><p className="text-sm font-bold text-slate-900">{questions.length}</p><p className="text-2xs text-slate-400">Questions</p></div>
                    <div className="text-center"><Clock className="h-4 w-4 text-slate-400 mx-auto mb-1" /><p className="text-sm font-bold text-slate-900">{config.duration}m</p><p className="text-2xs text-slate-400">Duration</p></div>
                    <div className="text-center"><Award className="h-4 w-4 text-slate-400 mx-auto mb-1" /><p className="text-sm font-bold text-slate-900">{config.passingScore}%</p><p className="text-2xs text-slate-400">Passing</p></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-50 border border-accent-200">
                  <Sparkles className="h-4 w-4 text-accent-500" />
                  <span className="text-xs text-accent-700">Once published, students will be notified and can begin taking the assessment immediately.</span>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : navigate('/teacher/assessments'))}
          className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{step === 0 ? 'Cancel' : 'Back'}</span>
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => canProceed() && setStep(step + 1)}
            disabled={!canProceed() || generating}
            className={cn(
              'h-11 px-6 rounded-xl text-white font-medium text-sm shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer',
              'bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59]',
              (!canProceed() || generating) && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <span>{step === 3 && !generated ? 'Generate' : 'Continue'}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="h-11 px-6 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white font-medium text-sm shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>{publishing ? 'Publishing...' : 'Publish Assessment'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
