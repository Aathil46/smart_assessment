import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check, Info, CheckCircle2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeacherClassCard } from '../types';

export interface CreateClassModalProps {
  open: boolean;
  onClose: () => void;
  onClassCreated?: (newClass: TeacherClassCard) => void;
}

const GRADE_OPTIONS = [
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
] as const;

export function CreateClassModal({ open, onClose, onClassCreated }: CreateClassModalProps) {
  // Form fields
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');

  // Dropdown open state
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);

  // Validation / touched state
  const [touched, setTouched] = useState<{ className?: boolean; subject?: boolean; gradeLevel?: boolean }>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Submission & Success state
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdJoinCode, setCreatedJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      resetToDefault();
    } else {
      document.body.style.overflow = '';
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        if (isGradeDropdownOpen) {
          setIsGradeDropdownOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, isGradeDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGradeDropdownOpen(false);
      }
    };
    if (isGradeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGradeDropdownOpen]);

  function resetToDefault() {
    setClassName('');
    setSubject('');
    setGradeLevel('');
    setIsGradeDropdownOpen(false);
    setTouched({});
    setShowValidationErrors(false);
    setIsSuccess(false);
    setCreatedJoinCode('');
    setCopiedCode(false);
    setIsCreating(false);
    setCreateError('');
  }

  function handleClose() {
    resetToDefault();
    onClose();
  }

  // Form validity calculations
  const isClassNameValid = className.trim().length > 0;
  const isSubjectValid = subject.trim().length > 0;
  const isGradeValid = gradeLevel.length > 0;
  const isFormValid = isClassNameValid && isSubjectValid && isGradeValid;

  // Errors visibility
  const classNameError = (touched.className || showValidationErrors) && !isClassNameValid;
  const subjectError = (touched.subject || showValidationErrors) && !isSubjectValid;
  const gradeError = (touched.gradeLevel || showValidationErrors) && !isGradeValid;

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      setTouched({ className: true, subject: true, gradeLevel: true });
      setShowValidationErrors(true);
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: className.trim(), subject: subject.trim(), grade: gradeLevel }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to create class.');

      setCreatedJoinCode(payload.code);
      setIsSuccess(true);
      onClassCreated?.({
        id: payload.id,
        name: payload.name,
        subject: subject.trim(),
        grade: gradeLevel,
        joinCode: payload.code,
        studentCount: 0,
        assessmentCount: 0,
        avgPerformance: null,
        color: 'brand',
        createdAt: new Date().toISOString(),
      });
    } catch (creationError) {
      setCreateError(creationError instanceof Error ? creationError.message : 'Unable to create class.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (createdJoinCode) {
      navigator.clipboard?.writeText(createdJoinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-[460px] rounded-2xl bg-white shadow-soft-lg border border-slate-100 animate-scale-in overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {isSuccess ? 'Class Created' : 'Create New Class'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Content */}
        {!isSuccess ? (
          <form onSubmit={handleCreateClass} noValidate>
            <div className="p-6 space-y-4.5">
              {/* Field 1: Class Name */}
              <div className="space-y-1.5">
                <label htmlFor="className" className="block text-sm font-semibold text-slate-800">
                  Class Name <span className="text-red-500 font-medium">*</span>
                </label>
                <input
                  id="className"
                  name="className"
                  type="text"
                  placeholder="e.g., 8 A"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, className: true }))}
                  className={cn(
                    'w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-150',
                    'focus:outline-none focus:ring-2',
                    classNameError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
                      : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
                  )}
                />
                {classNameError && (
                  <p className="text-xs text-red-600 font-medium mt-1 animate-fade-in">
                    Class name is required
                  </p>
                )}
              </div>

              {/* Field 2: Subject */}
              <div className="space-y-1.5">
                <label htmlFor="subject" className="block text-sm font-semibold text-slate-800">
                  Subject <span className="text-red-500 font-medium">*</span>
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder="e.g., Mathematics"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, subject: true }))}
                  className={cn(
                    'w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-150',
                    'focus:outline-none focus:ring-2',
                    subjectError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
                      : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
                  )}
                />
                {subjectError && (
                  <p className="text-xs text-red-600 font-medium mt-1 animate-fade-in">
                    Subject is required
                  </p>
                )}
              </div>

              {/* Field 3: Grade Level (Selectable Dropdown) */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label htmlFor="gradeLevel" className="block text-sm font-semibold text-slate-800">
                  Grade Level <span className="text-red-500 font-medium">*</span>
                </label>
                <button
                  id="gradeLevel"
                  type="button"
                  onClick={() => {
                    setIsGradeDropdownOpen((prev) => !prev);
                    setTouched((prev) => ({ ...prev, gradeLevel: true }));
                  }}
                  className={cn(
                    'w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-left flex items-center justify-between transition-all duration-150',
                    'focus:outline-none focus:ring-2',
                    gradeError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10'
                      : isGradeDropdownOpen
                      ? 'border-brand-500 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
                  )}
                >
                  <span className={gradeLevel ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                    {gradeLevel || 'Select grade level'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-slate-400 transition-transform duration-200',
                      isGradeDropdownOpen && 'rotate-180 text-brand-600'
                    )}
                  />
                </button>

                {gradeError && (
                  <p className="text-xs text-red-600 font-medium mt-1 animate-fade-in">
                    Please select a grade level
                  </p>
                )}

                {/* Dropdown Menu */}
                {isGradeDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1 animate-scale-in">
                    {GRADE_OPTIONS.map((grade) => {
                      const isSelected = gradeLevel === grade;
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => {
                            setGradeLevel(grade);
                            setIsGradeDropdownOpen(false);
                            setTouched((prev) => ({ ...prev, gradeLevel: true }));
                          }}
                          className={cn(
                            'w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors',
                            isSelected
                              ? 'bg-brand-50 text-brand-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          )}
                        >
                          <span>{grade}</span>
                          {isSelected && <Check className="h-4 w-4 text-brand-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Informational Message Banner */}
              <div className="p-3.5 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex items-start gap-2.5">
                <Info className="h-4.5 w-4.5 text-[#0284c7] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#0369a1] leading-relaxed">
                  A unique join code will be generated automatically. Students can use this code to join your class.
                </p>
              </div>
            </div>
            {createError && <p className="px-6 pb-3 text-xs font-medium text-red-600">{createError}</p>}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isCreating}
                className={cn(
                  'h-10 px-5 rounded-xl text-sm font-semibold transition-all duration-150',
                  isFormValid
                    ? 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-soft cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {isCreating ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </form>
        ) : (
          /* Success State */
          <div className="p-6 space-y-5 animate-fade-in">
            <div className="flex flex-col items-center text-center pt-2">
              <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Class Created Successfully</h3>
              <p className="text-xs text-slate-500 mt-1">
                A unique join code has been generated for your class.
              </p>
            </div>

            {/* Class Details Pill & Join Code Display */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <div>
                  <span className="text-xs font-semibold text-slate-900">{className || '8 A'}</span>
                  <span className="text-xs text-slate-400 mx-1.5">•</span>
                  <span className="text-xs text-slate-600">{subject || 'Mathematics'}</span>
                </div>
                <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60">
                  {gradeLevel || '8th Grade'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                    Student Join Code
                  </span>
                  <span className="text-2xs text-slate-400">Share with students</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between font-mono font-bold text-slate-900 text-sm tracking-wide">
                    <span>{createdJoinCode || '8A-MAT-7X9K'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="h-10 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-brand-600 flex items-center gap-1.5 text-xs font-medium transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex items-start gap-2.5">
              <Info className="h-4 w-4 text-[#0284c7] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#0369a1] leading-relaxed">
                Students can use this code to join your class immediately. You can view or copy it anytime from the classes page.
              </p>
            </div>

            {/* Success Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetToDefault}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold text-sm shadow-soft transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
