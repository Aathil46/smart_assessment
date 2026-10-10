"use client";

import { useState, useRef, useId, useEffect, useCallback } from 'react';
import { useNavigate } from '@/components/bolt/router';
import {
  CloudUpload, MoreVertical, Trash2, Eye, Download,
  Sparkles, Check, ChevronDown, Plus, X, Upload,
  AlertCircle, Loader2, CheckCircle2, FileText,
} from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';

type MaterialItem = {
  id: string;
  classId: string;
  displayClass: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: 'pdf' | 'doc' | 'docx' | 'txt' | 'image';
  status: 'ready' | 'processing' | 'failed';
  extractedConcepts: string[];
  uploadedAt: string;
  timeAgo: string;
  pageCount?: number;
  errorMessage?: string | null;
};

type TeacherClassOption = { id: string; name: string };
type MaterialApiRecord = {
  id: string;
  class_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: 'processing' | 'processed' | 'failed';
  created_at: string;
  page_count?: number | null;
  error_message?: string | null;
  metadata?: { aiSummary?: { concepts?: Array<{ name: string }> } | null } | null;
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTimeAgo(date: string) {
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (elapsedDays === 0) return 'Today';
  if (elapsedDays === 1) return 'Yesterday';
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  const weeks = Math.floor(elapsedDays / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function mapMaterial(record: MaterialApiRecord, classNames: Map<string, string>): MaterialItem {
  const extension = record.file_name.split('.').pop()?.toLowerCase();
  const fileType: MaterialItem['fileType'] =
    extension === 'txt'
      ? 'txt'
      : extension === 'doc'
      ? 'doc'
      : extension === 'docx'
      ? 'docx'
      : ['png', 'jpg', 'jpeg'].includes(extension || '')
      ? 'image'
      : 'pdf';
  return {
    id: record.id,
    classId: record.class_id,
    displayClass: classNames.get(record.class_id) || 'Class',
    title: record.title,
    fileName: record.file_name,
    fileSize: formatFileSize(record.size_bytes),
    fileType,
    status: record.status === 'processed' ? 'ready' : record.status,
    extractedConcepts: record.metadata?.aiSummary?.concepts?.map((concept) => concept.name) || [],
    uploadedAt: record.created_at,
    timeAgo: formatTimeAgo(record.created_at),
    pageCount: record.page_count ?? undefined,
    errorMessage: record.error_message,
  };
}

// Custom File Type Icon matching the reference image's colorful file icons
function FileTypeBadge({ type }: { type: MaterialItem['fileType'] }) {
  switch (type) {
    case 'pdf':
      return (
        <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
          <svg className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight text-rose-600 uppercase leading-none mt-0.5">PDF</span>
        </div>
      );
    case 'docx':
    case 'doc':
      return (
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[8px] font-extrabold tracking-tight text-blue-600 uppercase leading-none mt-0.5">{type.toUpperCase()}</span>
        </div>
      );
    case 'txt':
      return (
        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight text-slate-600 uppercase leading-none mt-0.5">TXT</span>
        </div>
      );
    case 'image':
    default:
      return (
        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 shadow-xs">
          <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      );
  }
}

export function TeacherMaterials() {
  const navigate = useNavigate();
  const fileInputId = useId();

  const [classOptions, setClassOptions] = useState<TeacherClassOption[]>([]);

  // State
  const [materialsList, setMaterialsList] = useState<MaterialItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // Staged material selection & validation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState<File[]>([]);
  const [materialTitle, setMaterialTitle] = useState('');
  const [classValidationError, setClassValidationError] = useState<string | null>(null);

  // Upload & Processing Progress Lifecycle State
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    step: 'idle' | 'uploading' | 'processing' | 'ready' | 'failed';
    title: string;
    fileName: string;
    className: string;
    errorMessage?: string | null;
  }>({
    isUploading: false,
    step: 'idle',
    title: '',
    fileName: '',
    className: '',
  });

  // Detail Modal state
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, duration = 5000) => {
    setUploadToast(msg);
    setTimeout(() => setUploadToast(null), duration);
  };

  const loadMaterials = useCallback(async (classesToUse = classOptions) => {
    try {
      const response = await fetch('/api/materials');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load learning materials.');
      const classNames = new Map(classesToUse.map((item) => [item.id, item.name]));
      setMaterialsList((payload.materials || []).map((item: MaterialApiRecord) => mapMaterial(item, classNames)));
    } catch (err) {
      console.error('Failed to load materials:', err);
    }
  }, [classOptions]);

  useEffect(() => {
    Promise.all([
      fetch('/api/classes').then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load classes.');
        return (payload.classes || []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name }));
      }),
    ])
      .then(async ([loadedClasses]) => {
        setClassOptions(loadedClasses);
        await loadMaterials(loadedClasses);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load learning materials.'))
      .finally(() => setLoading(false));
  }, [loadMaterials]);

  // Polling: If user navigates away and returns or if any material is in 'processing' status,
  // fetch actual material status from backend every 3 seconds until completed.
  useEffect(() => {
    const hasProcessing = materialsList.some((m) => m.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadMaterials();
    }, 3000);

    return () => clearInterval(interval);
  }, [materialsList, loadMaterials]);

  // Handle outside click for custom dropdowns
  const handleDropdownToggle = (type: 'class' | 'sort') => {
    if (type === 'class') {
      setIsClassDropdownOpen((prev) => !prev);
      setIsSortDropdownOpen(false);
    } else {
      setIsSortDropdownOpen((prev) => !prev);
      setIsClassDropdownOpen(false);
    }
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setClassValidationError(null);
    setIsClassDropdownOpen(false);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const stageSelectedFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files).filter(Boolean);
    if (fileList.length === 0) return;

    // Check if user selected multiple image files for gallery upload
    const allImages = fileList.every((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      return ['.png', '.jpg', '.jpeg'].includes(ext);
    });

    if (fileList.length > 1 && allImages) {
      if (fileList.length > 10) {
        showToast('Maximum 10 images allowed per gallery material.');
        return;
      }
      const totalSize = fileList.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > 20 * 1024 * 1024) {
        showToast('Total size must be under 20 MB.');
        return;
      }
      setSelectedGalleryFiles(fileList);
      setSelectedFile(null);
      const baseName = fileList[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setMaterialTitle(`${baseName} Gallery`);
      setClassValidationError(null);
      return;
    }

    // Single document or image file
    const file = fileList[0];
    const dotIdx = file.name.lastIndexOf('.');
    const ext = dotIdx !== -1 ? file.name.slice(dotIdx).toLowerCase() : '';
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    if (!allowed.includes(ext)) {
      showToast('Supported files are PDF, DOC, DOCX, PNG, JPG, and JPEG.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('The file must be under 20 MB.');
      return;
    }

    setSelectedFile(file);
    setSelectedGalleryFiles([]);
    setMaterialTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    setClassValidationError(null);
  };

  const clearStagedFile = () => {
    setSelectedFile(null);
    setSelectedGalleryFiles([]);
    setMaterialTitle('');
    setClassValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageSelectedFiles(e.target.files);
    }
  };

  const handleUploadMaterial = async () => {
    if (uploadState.isUploading) return;
    if (!selectedFile && selectedGalleryFiles.length === 0) return;

    if (!selectedClassId) {
      const msg = 'Please select a class before uploading the material.';
      setClassValidationError(msg);
      showToast(msg);
      return;
    }

    setClassValidationError(null);

    const isGallery = selectedGalleryFiles.length > 0;
    const defaultTitle = isGallery
      ? `${selectedGalleryFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')} Gallery`
      : selectedFile!.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const titleToUse = materialTitle.trim() || defaultTitle;
    const targetClass = classOptions.find((c) => c.id === selectedClassId);
    const classNameDisplay = targetClass ? targetClass.name : 'Class';
    const displayFileName = isGallery
      ? `${selectedGalleryFiles.length} Images (${selectedGalleryFiles.map((f) => f.name).slice(0, 2).join(', ')}${selectedGalleryFiles.length > 2 ? '...' : ''})`
      : selectedFile!.name;

    setUploadState({
      isUploading: true,
      step: 'uploading',
      title: titleToUse,
      fileName: displayFileName,
      className: classNameDisplay,
    });

    const processingTimer = setTimeout(() => {
      setUploadState((prev) => (prev.step === 'uploading' ? { ...prev, step: 'processing' } : prev));
    }, 1500);

    try {
      const formData = new FormData();
      formData.append('classId', selectedClassId);
      formData.append('title', titleToUse);

      if (isGallery) {
        selectedGalleryFiles.forEach((f) => formData.append('images[]', f));
      } else {
        formData.append('file', selectedFile!);
      }

      const response = await fetch('/api/materials', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(processingTimer);
      const payload = await response.json();

      if (!response.ok) {
        const errorMsg = payload?.error?.message || 'Unable to upload material.';
        setUploadState({
          isUploading: false,
          step: 'failed',
          title: titleToUse,
          fileName: displayFileName,
          className: classNameDisplay,
          errorMessage: errorMsg,
        });
        showToast(errorMsg);
        return;
      }

      if (payload.status === 'failed') {
        const errorMsg = payload.errorMessage || 'Processing failed: Unable to extract concepts.';
        setUploadState({
          isUploading: false,
          step: 'failed',
          title: titleToUse,
          fileName: displayFileName,
          className: classNameDisplay,
          errorMessage: errorMsg,
        });
        showToast(errorMsg);
      } else {
        setUploadState({
          isUploading: false,
          step: 'ready',
          title: titleToUse,
          fileName: displayFileName,
          className: classNameDisplay,
        });
        showToast(`"${titleToUse}" is ready for assessments.`);
        clearStagedFile();
      }

      await loadMaterials();
    } catch {
      clearTimeout(processingTimer);
      const errorMsg = 'Upload failed. Please try again.';
      setUploadState({
        isUploading: false,
        step: 'failed',
        title: titleToUse,
        fileName: displayFileName,
        className: classNameDisplay,
        errorMessage: errorMsg,
      });
      showToast(errorMsg);
    }
  };

  // Delete material through the existing authorized storage/database boundary.
  const handleDeleteMaterial = async (id: string) => {
    const response = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setUploadToast('Unable to delete this material.');
      return;
    }
    setMaterialsList((prev) => prev.filter((m) => m.id !== id));
    setUploadToast('Material deleted.');
    setTimeout(() => setUploadToast(null), 4000);
  };

  const handleDownloadMaterial = async (material: MaterialItem) => {
    const response = await fetch(`/api/materials/${material.id}/download`);
    if (!response.ok) {
      setUploadToast('Unable to download this material.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = material.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Sorting
  const sortedMaterials = [...materialsList].sort((a, b) => {
    if (sortBy === 'newest') return b.uploadedAt.localeCompare(a.uploadedAt);
    if (sortBy === 'oldest') return a.uploadedAt.localeCompare(b.uploadedAt);
    return a.title.localeCompare(b.title);
  });

  const selectedClass = classOptions.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-7 pb-10">
      {/* Toast Notification */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-soft-lg text-sm animate-fade-in">
          <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
          <span>{uploadToast}</span>
          <button
            type="button"
            onClick={() => setUploadToast(null)}
            className="text-slate-400 hover:text-white transition-colors ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learning Materials</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload learning materials and let AI extract key concepts for assessments.
        </p>
      </div>

      {/* Top Upload Section (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Left Column (~72% on desktop) */}
        {uploadState.step !== 'idle' ? (
          /* State 1: Active Upload & Processing Progress Card */
          <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 flex flex-col justify-between shadow-soft transition-all duration-200">
            <div className="space-y-5">
              {/* Header with Title, File Name & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {uploadState.className}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                      {uploadState.fileName}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
                    {uploadState.title}
                  </h3>
                </div>

                {uploadState.step === 'ready' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Ready
                  </span>
                )}
                {uploadState.step === 'failed' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shrink-0">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                    Failed
                  </span>
                )}
              </div>

              {/* Status Stepper: Uploading → Processing material → Ready */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between sm:justify-start sm:gap-6 text-xs font-semibold">
                  {/* Step 1: Uploading */}
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      uploadState.step === 'uploading'
                        ? 'text-teal-700 font-bold'
                        : uploadState.step === 'processing' || uploadState.step === 'ready'
                        ? 'text-emerald-700 font-medium'
                        : 'text-slate-500'
                    )}
                  >
                    {uploadState.step === 'uploading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600 shrink-0" />
                    ) : uploadState.step === 'processing' || uploadState.step === 'ready' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        1
                      </span>
                    )}
                    <span>Uploading</span>
                  </div>

                  <span className="text-slate-300">→</span>

                  {/* Step 2: Processing material */}
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      uploadState.step === 'processing'
                        ? 'text-teal-700 font-bold'
                        : uploadState.step === 'ready'
                        ? 'text-emerald-700 font-medium'
                        : uploadState.step === 'failed'
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400'
                    )}
                  >
                    {uploadState.step === 'processing' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600 shrink-0" />
                    ) : uploadState.step === 'ready' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : uploadState.step === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        2
                      </span>
                    )}
                    <span>Processing material</span>
                  </div>

                  <span className="text-slate-300">→</span>

                  {/* Step 3: Ready */}
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      uploadState.step === 'ready'
                        ? 'text-emerald-700 font-bold'
                        : uploadState.step === 'failed'
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400'
                    )}
                  >
                    {uploadState.step === 'ready' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : uploadState.step === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        3
                      </span>
                    )}
                    <span>{uploadState.step === 'failed' ? 'Failed' : 'Ready'}</span>
                  </div>
                </div>

                {/* Indeterminate Progress Bar */}
                <div className="mt-4">
                  {uploadState.step === 'uploading' || uploadState.step === 'processing' ? (
                    <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden relative">
                      <div className="h-full bg-teal-600 rounded-full animate-indeterminate-progress" />
                    </div>
                  ) : uploadState.step === 'ready' ? (
                    <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-full" />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full w-full" />
                    </div>
                  )}
                </div>

                {/* Status Description Text */}
                <p className="text-xs text-slate-500 mt-2.5 font-medium">
                  {uploadState.step === 'uploading' && 'Sending file to server storage...'}
                  {uploadState.step === 'processing' && 'AI is extracting key concepts and generating assessment metadata...'}
                  {uploadState.step === 'ready' && 'Material has been processed and is ready to generate assessments!'}
                  {uploadState.step === 'failed' && (uploadState.errorMessage || 'Unable to process material.')}
                </p>
              </div>
            </div>

            {/* Footer Actions when Complete or Failed */}
            {(uploadState.step === 'ready' || uploadState.step === 'failed') && (
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUploadState({
                      isUploading: false,
                      step: 'idle',
                      title: '',
                      fileName: '',
                      className: '',
                    });
                  }}
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors"
                >
                  {uploadState.step === 'ready' ? 'Upload Another Material' : 'Try Again'}
                </button>
              </div>
            )}
          </div>
        ) : selectedFile || selectedGalleryFiles.length > 0 ? (
          /* State 2: Staged Document / Image Card with "Upload Material" Button */
          <div className="lg:col-span-8 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/40 via-white to-slate-50 p-6 sm:p-7 flex flex-col justify-between shadow-xs transition-all duration-200">
            <div className="space-y-4">
              {/* File Info Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedGalleryFiles.length > 0 ? (
                    <div className="w-11 h-11 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center flex-shrink-0 text-teal-800 font-bold text-xs">
                      {selectedGalleryFiles.length} img
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center flex-shrink-0 text-teal-700">
                      <FileText className="h-6 w-6 stroke-[1.75]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedGalleryFiles.length > 0
                        ? `Gallery (${selectedGalleryFiles.length} images)`
                        : selectedFile?.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-normal">
                      {selectedGalleryFiles.length > 0
                        ? `${formatFileSize(selectedGalleryFiles.reduce((acc, f) => acc + f.size, 0))} · Selected`
                        : `${formatFileSize(selectedFile?.size || 0)} · Selected`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearStagedFile}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 shrink-0"
                  title="Remove selected file"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Change</span>
                </button>
              </div>

              {/* Material Title Field */}
              <div>
                <label htmlFor="material-title-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Material Title
                </label>
                <input
                  id="material-title-input"
                  type="text"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Enter a descriptive title for this material"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              {/* Validation Message if attempted upload without selecting a class */}
              {classValidationError && (
                <div
                  className="flex items-center gap-2 p-3 text-xs sm:text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{classValidationError}</span>
                </div>
              )}
            </div>

            {/* Upload Material Button & Class Association */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                {selectedClass ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Assigning to <strong className="font-semibold">{selectedClass.name.startsWith('Class') ? selectedClass.name : `Class ${selectedClass.name}`}</strong>
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Select a class on the right before or after choosing your file.
                  </span>
                )}
              </div>

              <button
                type="button"
                id="upload-material-btn"
                onClick={handleUploadMaterial}
                disabled={uploadState.isUploading}
                className={cn(
                  'w-full sm:w-auto h-11 px-7 rounded-xl font-medium text-sm shadow-xs transition-colors flex items-center justify-center gap-2',
                  'bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white',
                  uploadState.isUploading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {uploadState.isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Upload Material</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Empty Drag-and-Drop Area */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'lg:col-span-8 rounded-2xl border-2 border-dashed p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none bg-white',
              isDragging
                ? 'border-brand-500 bg-brand-50/40 ring-4 ring-brand-500/10'
                : 'border-[#99f6e4] hover:border-brand-400 hover:bg-[#f0fdfa]/30'
            )}
          >
            <div className="mb-3 text-[#0d9488]">
              <CloudUpload className="h-11 w-11 stroke-[1.75]" />
            </div>

            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              Drag and drop a file here
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 mb-5 font-normal">
              or choose a file from your device
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="h-10 px-7 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white font-medium text-sm shadow-xs transition-colors"
            >
              Choose File
            </button>

            <p className="text-xs text-slate-400 mt-5 font-normal">
              PDF, DOC, DOCX, PNG, JPG, JPEG · Max 20 MB
            </p>
          </div>
        )}

        {/* Right Column: Add to Class Dropdown Card (~28%) */}
        <div
          className={cn(
            'lg:col-span-4 rounded-2xl border bg-white p-6 flex flex-col justify-between shadow-xs transition-all duration-150',
            classValidationError
              ? 'border-rose-300 ring-2 ring-rose-500/10'
              : 'border-slate-200/80'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="select-class-btn" className="block text-sm font-bold text-slate-900">
                Add to class
              </label>
              {selectedClass && (
                <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                  Selected
                </span>
              )}
            </div>

            <div className="relative" ref={classDropdownRef}>
              <button
                id="select-class-btn"
                type="button"
                disabled={uploadState.isUploading}
                onClick={() => handleDropdownToggle('class')}
                className={cn(
                  'w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-left flex items-center justify-between transition-all duration-150',
                  classValidationError
                    ? 'border-rose-400 ring-2 ring-rose-400/20'
                    : isClassDropdownOpen
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-slate-200 hover:border-slate-300',
                  uploadState.isUploading && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className={selectedClass ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                  {selectedClass
                    ? selectedClass.name.startsWith('Class')
                      ? selectedClass.name
                      : `Class ${selectedClass.name}`
                    : 'Select a class'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-slate-400 transition-transform duration-200',
                    isClassDropdownOpen && 'rotate-180 text-brand-600'
                  )}
                />
              </button>

              {/* Dropdown Options */}
              {isClassDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1 animate-scale-in">
                  <button
                    type="button"
                    onClick={() => handleSelectClass('')}
                    className={cn(
                      'w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors',
                      !selectedClassId ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span>Select a class</span>
                    {!selectedClassId && <Check className="h-4 w-4 text-brand-600" />}
                  </button>
                  {classOptions.map((c) => {
                    const isSelected = selectedClassId === c.id;
                    const label = c.name.startsWith('Class') ? c.name : `Class ${c.name}`;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClass(c.id)}
                        className={cn(
                          'w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors',
                          isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="h-4 w-4 text-brand-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {classValidationError && (
              <p className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1.5 animate-fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{classValidationError}</span>
              </p>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mt-4">
            The material will be available for assessments in this class.
          </p>
        </div>
      </div>

      {/* Uploaded Materials Section */}
      <div className="space-y-4 pt-2">
        {loadError && <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">{loadError}</div>}
        {loading && <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading learning materials...</div>}
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Uploaded Materials
          </h2>

          {/* Sort By Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => handleDropdownToggle('sort')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            >
              <span>Sort by:</span>
              <span className="capitalize">{sortBy}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-scale-in">
                {(['newest', 'oldest', 'name'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSortBy(option);
                      setIsSortDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-1.5 text-left text-xs capitalize flex items-center justify-between transition-colors',
                      sortBy === option ? 'text-brand-700 font-semibold bg-brand-50' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span>{option}</span>
                    {sortBy === option && <Check className="h-3.5 w-3.5 text-brand-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clean Material List Rows */}
        <div className="space-y-3">
          {sortedMaterials.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-700">No materials uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload your first document above to get started.</p>
            </div>
          ) : (
            sortedMaterials.map((m) => (
              <div
                key={m.id}
                className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 hover:border-slate-300 hover:shadow-soft transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden"
              >
                {/* Left Group: Icon + Title & File info */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <FileTypeBadge type={m.fileType} />

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-brand-700 transition-colors">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-normal truncate">
                      {m.fileSize} · Uploaded {new Date(m.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Right Group: Class Badge + Status Badge + Time Ago + Action Menu */}
                <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap justify-between sm:justify-end flex-shrink-0">
                  {/* Class Badge */}
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1] whitespace-nowrap">
                    {m.displayClass}
                  </span>

                  {/* Status Pill (Ready, Failed, Processing) */}
                  {m.status === 'ready' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]/60 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                      Ready
                    </span>
                  ) : m.status === 'failed' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                      Failed
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]/60 flex items-center gap-1.5 whitespace-nowrap">
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                      Processing
                    </span>
                  )}

                  {/* Relative Time */}
                  <span className="text-xs text-slate-400 min-w-[65px] text-right hidden sm:block">
                    {m.timeAgo}
                  </span>

                  {/* Material Actions Dropdown */}
                  <Dropdown
                    trigger={
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="Material actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownItem
                      icon={<Eye className="h-4 w-4" />}
                      onClick={() => setSelectedMaterial(m)}
                    >
                      View Details
                    </DropdownItem>
                    {m.status === 'ready' && (
                      <DropdownItem
                        icon={<Sparkles className="h-4 w-4 text-brand-600" />}
                        onClick={() => navigate('/teacher/assessments/create')}
                      >
                        Create Assessment
                      </DropdownItem>
                    )}
                    <DropdownItem
                      icon={<Download className="h-4 w-4" />}
                      onClick={() => void handleDownloadMaterial(m)}
                    >
                      Download
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem
                      icon={<Trash2 className="h-4 w-4" />}
                      danger
                      onClick={() => handleDeleteMaterial(m.id)}
                    >
                      Delete
                    </DropdownItem>
                  </Dropdown>
                </div>

                {/* Indeterminate bottom progress bar when material is processing */}
                {m.status === 'processing' && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-100 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-indeterminate-progress" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Material Details / Concepts Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedMaterial(null)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-soft-lg border border-slate-100 animate-scale-in p-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <FileTypeBadge type={selectedMaterial.fileType} />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedMaterial.title}</h3>
                  <p className="text-xs text-slate-400">{selectedMaterial.fileName} · {selectedMaterial.fileSize}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Target Class:</span>
                <span className="font-semibold text-slate-800">{selectedMaterial.displayClass}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Status:</span>
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full font-medium',
                  selectedMaterial.status === 'ready'
                    ? 'bg-emerald-50 text-emerald-700'
                    : selectedMaterial.status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
                )}>
                  {selectedMaterial.status === 'ready' ? 'Ready for Assessments' : selectedMaterial.status === 'failed' ? 'Processing failed' : 'Processing'}
                </span>
              </div>

              {selectedMaterial.status === 'failed' && selectedMaterial.errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700">
                  <span className="font-semibold block mb-0.5">Failure reason:</span>
                  <p className="font-normal text-rose-600 break-words">{selectedMaterial.errorMessage}</p>
                </div>
              )}

              {selectedMaterial.extractedConcepts && selectedMaterial.extractedConcepts.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                    <span className="text-xs font-bold text-slate-700">AI-Extracted Key Concepts</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMaterial.extractedConcepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              {selectedMaterial.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMaterial(null);
                    navigate('/teacher/assessments/create');
                  }}
                  className="h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-soft flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Assessment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
