"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shared/StatCard";
import {
  User, Mail, Phone, Calendar, MapPin, GraduationCap,
  Edit2, Save, X, School, Hash, CheckCircle2, Camera,
  Layers, Sparkles, Droplets, HeartHandshake, AlertCircle,
  Building, Compass,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudentProfileData {
  id: string;
  email: string; // College / School email - read-only
  name: string;
  role: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  grade: string | null;
  section: string | null;
  roll_number: string | null;
  school: { id: string; name: string } | null; // read-only
  father_name: string | null;
  father_mobile: string | null;
  mother_name: string | null;
  mother_mobile: string | null;
  // Structured address
  addr_door: string | null;
  addr_building: string | null;
  addr_street: string | null;
  addr_city: string | null;
  addr_state: string | null;
  addr_pincode: string | null;
}

interface StudentEditState {
  name: string;
  date_of_birth: string;
  blood_group: string;
  avatar_url: string;
  grade: string;
  section: string;
  roll_number: string;
  father_name: string;
  father_mobile: string;
  mother_name: string;
  mother_mobile: string;
  addr_door: string;
  addr_building: string;
  addr_street: string;
  addr_city: string;
  addr_state: string;
  addr_pincode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatAddress(p: StudentProfileData): string | null {
  const parts = [
    p.addr_door,
    p.addr_building,
    p.addr_street,
    p.addr_city,
    p.addr_state,
    p.addr_pincode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  placeholder = "Not specified",
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50/80 text-teal-600 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium break-words ${value ? "text-slate-800" : "text-slate-300 italic"}`}>
          {value || placeholder}
        </p>
      </div>
    </div>
  );
}

function EditInput({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <span className="text-teal-600">{icon}</span>
        {label}
      </label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className={`h-10 w-full rounded-xl border px-3 text-sm transition-all ${
          readOnly
            ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed select-none"
            : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
        }`}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StudentProfile() {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editState, setEditState] = useState<StudentEditState>({
    name: "",
    date_of_birth: "",
    blood_group: "",
    avatar_url: "",
    grade: "",
    section: "",
    roll_number: "",
    father_name: "",
    father_mobile: "",
    mother_name: "",
    mother_mobile: "",
    addr_door: "",
    addr_building: "",
    addr_street: "",
    addr_city: "",
    addr_state: "",
    addr_pincode: "",
  });

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch Profile ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.profile) {
          setProfile(json.profile);
        } else {
          setError(json.error?.message ?? "Failed to load profile.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Edit Controls ─────────────────────────────────────────────────────────

  function handleEdit() {
    if (!profile) return;
    setSaveError(null);
    setSaveSuccess(false);
    setEditState({
      name: profile.name ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      blood_group: profile.blood_group ?? "",
      avatar_url: profile.avatar_url ?? "",
      grade: profile.grade ?? "",
      section: profile.section ?? "",
      roll_number: profile.roll_number ?? "",
      father_name: profile.father_name ?? "",
      father_mobile: profile.father_mobile ?? "",
      mother_name: profile.mother_name ?? "",
      mother_mobile: profile.mother_mobile ?? "",
      addr_door: profile.addr_door ?? "",
      addr_building: profile.addr_building ?? "",
      addr_street: profile.addr_street ?? "",
      addr_city: profile.addr_city ?? "",
      addr_state: profile.addr_state ?? "",
      addr_pincode: profile.addr_pincode ?? "",
    });
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setSaveError(null);
  }

  function set(field: keyof StudentEditState) {
    return (v: string) => setEditState((s) => ({ ...s, [field]: v }));
  }

  // ── Avatar Upload ─────────────────────────────────────────────────────────

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview and store data URL
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setEditState((s) => ({ ...s, avatar_url: result }));
      // If not currently in editing mode, prompt into edit or keep preview
      if (!editing) {
        handleEdit();
        setEditState((s) => ({ ...s, avatar_url: result }));
      }
    };
    reader.readAsDataURL(file);
  }

  // ── Save Changes ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);

    const clean = <T extends string | null>(v: string, fallback: T): string | T =>
      v.trim() !== "" ? v.trim() : fallback;

    const payload = {
      name: clean(editState.name, profile.name),
      date_of_birth: editState.date_of_birth || null,
      blood_group: clean(editState.blood_group, null),
      avatar_url: editState.avatar_url || null,
      grade: clean(editState.grade, null),
      section: clean(editState.section, null),
      roll_number: clean(editState.roll_number, null),
      father_name: clean(editState.father_name, null),
      father_mobile: clean(editState.father_mobile, null),
      mother_name: clean(editState.mother_name, null),
      mother_mobile: clean(editState.mother_mobile, null),
      addr_door: clean(editState.addr_door, null),
      addr_building: clean(editState.addr_building, null),
      addr_street: clean(editState.addr_street, null),
      addr_city: clean(editState.addr_city, null),
      addr_state: clean(editState.addr_state, null),
      addr_pincode: clean(editState.addr_pincode, null),
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Failed to save profile.");
      }

      // Update local state with real saved record
      const p = json.profile;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: p.name ?? prev.name,
              date_of_birth: p.date_of_birth ?? null,
              blood_group: p.blood_group ?? null,
              avatar_url: p.avatar_url ?? null,
              grade: p.grade ?? null,
              section: p.section ?? null,
              roll_number: p.roll_number ?? null,
              father_name: p.father_name ?? null,
              father_mobile: p.father_mobile ?? null,
              mother_name: p.mother_name ?? null,
              mother_mobile: p.mother_mobile ?? null,
              addr_door: p.addr_door ?? null,
              addr_building: p.addr_building ?? null,
              addr_street: p.addr_street ?? null,
              addr_city: p.addr_city ?? null,
              addr_state: p.addr_state ?? null,
              addr_pincode: p.addr_pincode ?? null,
            }
          : prev
      );

      setEditing(false);
      setSaveSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading Skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-xl" />
        <div className="h-56 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-200 rounded-2xl" />
          <div className="h-96 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error-50 text-error-600 mb-4 shadow-sm">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Failed to Load Profile</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{error ?? "Profile data could not be retrieved."}</p>
        <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const activeAvatar = editing ? editState.avatar_url || profile.avatar_url : profile.avatar_url;
  const currentGrade = editing ? editState.grade : profile.grade;
  const currentSection = editing ? editState.section : profile.section;
  const currentRoll = editing ? editState.roll_number : profile.roll_number;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Hidden image file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* ── 1. Page Header ── */}
      <PageHeader
        title="My Profile"
        description="View and manage your personal information."
        action={
          !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50/60 hover:border-teal-300 transition-all rounded-xl shadow-xs"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
                className="gap-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )
        }
      />

      {/* ── Feedback Banners ── */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-sm animate-fade-in shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-teal-600 flex-shrink-0" />
          <p className="font-medium">Profile changes saved successfully!</p>
        </div>
      )}

      {saveError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm animate-fade-in shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to save profile</p>
            <p className="text-xs text-rose-600 mt-0.5">{saveError}</p>
          </div>
        </div>
      )}

      {/* ── 2. Profile Header Card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-100/80 bg-gradient-to-br from-white via-teal-50/20 to-sky-50/40 p-6 md:p-8 shadow-soft transition-all duration-300 hover:shadow-soft-md hover:border-teal-200/80 animate-fade-in-up">
        {/* Subtle decorative educational elements */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-gradient-to-br from-teal-200/20 to-sky-200/20 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-28 w-28 rounded-full bg-gradient-to-tr from-teal-100/30 to-emerald-100/20 blur-xl" />
        <div className="pointer-events-none absolute top-4 right-6 text-teal-200/40">
          <Sparkles className="h-10 w-10" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Overlay */}
          <div className="relative group flex-shrink-0">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-soft bg-gradient-to-tr from-teal-500 to-sky-400 flex items-center justify-center text-white text-2xl font-bold transition-transform duration-300 group-hover:scale-[1.02]">
              {activeAvatar ? (
                <img
                  src={activeAvatar}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{getInitials(editing ? editState.name || profile.name : profile.name)}</span>
              )}
            </div>

            {/* Camera / Edit Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Change Profile Picture"
              className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm transition-all duration-200 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 active:scale-95 cursor-pointer"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          {/* Student Profile Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            {/* Student Full Name - NO "Student" subtitle directly underneath */}
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight break-words">
              {editing ? editState.name || profile.name : profile.name}
            </h2>

            {/* Cleanly organized details: Grade, Section, Roll No, School, Email */}
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              {/* Grade */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/90 border border-teal-100 text-xs font-medium text-teal-800 shadow-xs">
                <GraduationCap className="h-3.5 w-3.5 text-teal-600" />
                <span>Grade: {currentGrade || "Not assigned"}</span>
              </div>

              {/* Section */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/90 border border-teal-100 text-xs font-medium text-teal-800 shadow-xs">
                <Layers className="h-3.5 w-3.5 text-teal-600" />
                <span>Section: {currentSection || "Not assigned"}</span>
              </div>

              {/* Roll Number */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/90 border border-slate-200/80 text-xs font-medium text-slate-700 shadow-xs">
                <Hash className="h-3.5 w-3.5 text-slate-500" />
                <span>Roll No: {currentRoll || "Not assigned"}</span>
              </div>
            </div>

            {/* School & Email Row */}
            <div className="mt-3.5 pt-3 border-t border-teal-100/60 flex flex-wrap items-center justify-center sm:justify-start gap-y-2 gap-x-5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <School className="h-4 w-4 text-teal-600 flex-shrink-0" />
                <span className="font-medium text-slate-800">
                  {profile.school?.name || "Institution not assigned"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-sky-600 flex-shrink-0" />
                <span className="text-slate-600 break-all">{profile.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── 3. Personal Information Card ── */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border border-slate-200/80 shadow-soft transition-all duration-300 hover:shadow-soft-md hover:border-slate-300 animate-fade-in-up">
            <CardHeader className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <User className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Personal Information</CardTitle>
              </div>

              {/* In-card edit trigger if not in edit mode */}
              {!editing && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </button>
              )}
            </CardHeader>

            <CardBody className="p-5 space-y-4">
              {!editing ? (
                /* View Mode */
                <div className="space-y-1">
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Full Name"
                    value={profile.name}
                  />
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Date of Birth"
                    value={formatDate(profile.date_of_birth)}
                  />
                  <InfoRow
                    icon={<Droplets className="h-4 w-4" />}
                    label="Blood Group"
                    value={profile.blood_group}
                  />

                  {/* Structured Address in View Mode */}
                  <div className="py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50/80 text-teal-600 flex-shrink-0 mt-0.5">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-400 mb-1">Residential Address</p>
                        {formatAddress(profile) ? (
                          <div className="text-sm font-medium text-slate-800 space-y-0.5">
                            {(profile.addr_door || profile.addr_building) && (
                              <p>
                                {[profile.addr_door, profile.addr_building].filter(Boolean).join(", ")}
                              </p>
                            )}
                            {profile.addr_street && <p>{profile.addr_street}</p>}
                            {(profile.addr_city || profile.addr_state || profile.addr_pincode) && (
                              <p className="text-slate-600">
                                {[profile.addr_city, profile.addr_state].filter(Boolean).join(", ")}
                                {profile.addr_pincode ? ` - ${profile.addr_pincode}` : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-300 italic">No address provided</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditInput
                      label="Full Name"
                      icon={<User className="h-3.5 w-3.5" />}
                      value={editState.name}
                      onChange={set("name")}
                      placeholder="Enter full name"
                    />
                    <EditInput
                      label="Date of Birth"
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      type="date"
                      value={editState.date_of_birth}
                      onChange={set("date_of_birth")}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditInput
                      label="Blood Group"
                      icon={<Droplets className="h-3.5 w-3.5" />}
                      value={editState.blood_group}
                      onChange={set("blood_group")}
                      placeholder="e.g. O+, A+, B+"
                    />
                  </div>

                  {/* Structured Address 6 separate fields */}
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal-600" />
                      Address Details
                    </p>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <EditInput
                          label="Door / House No."
                          icon={<Building className="h-3.5 w-3.5" />}
                          value={editState.addr_door}
                          onChange={set("addr_door")}
                          placeholder="Enter door / house number"
                        />
                        <EditInput
                          label="Residence / Building"
                          icon={<Building className="h-3.5 w-3.5" />}
                          value={editState.addr_building}
                          onChange={set("addr_building")}
                          placeholder="Enter residence or building name"
                        />
                      </div>

                      <EditInput
                        label="Street"
                        icon={<Compass className="h-3.5 w-3.5" />}
                        value={editState.addr_street}
                        onChange={set("addr_street")}
                        placeholder="Enter street name"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <EditInput
                          label="City"
                          icon={<MapPin className="h-3.5 w-3.5" />}
                          value={editState.addr_city}
                          onChange={set("addr_city")}
                          placeholder="Enter city"
                        />
                        <EditInput
                          label="State"
                          icon={<MapPin className="h-3.5 w-3.5" />}
                          value={editState.addr_state}
                          onChange={set("addr_state")}
                          placeholder="Enter state"
                        />
                        <EditInput
                          label="Pincode"
                          icon={<Hash className="h-3.5 w-3.5" />}
                          value={editState.addr_pincode}
                          onChange={set("addr_pincode")}
                          placeholder="Enter 6-digit pincode"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions inside Personal Information Card */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saving}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      loading={saving}
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── 5. Student / Academic Information Card ── */}
        <div className="lg:col-span-5">
          <Card className="rounded-2xl border border-slate-200/80 shadow-soft transition-all duration-300 hover:shadow-soft-md hover:border-slate-300 animate-fade-in-up">
            <CardHeader className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Academic Information</CardTitle>
              </div>
            </CardHeader>

            <CardBody className="p-5 space-y-4">
              {!editing ? (
                /* View Mode */
                <div className="space-y-1">
                  <InfoRow
                    icon={<School className="h-4 w-4" />}
                    label="School"
                    value={profile.school?.name}
                    placeholder="Not assigned"
                  />
                  <InfoRow
                    icon={<Mail className="h-4 w-4" />}
                    label="College / School Email"
                    value={profile.email}
                  />
                  <InfoRow
                    icon={<GraduationCap className="h-4 w-4" />}
                    label="Grade"
                    value={profile.grade}
                    placeholder="Not assigned"
                  />
                  <InfoRow
                    icon={<Layers className="h-4 w-4" />}
                    label="Section"
                    value={profile.section}
                    placeholder="Not assigned"
                  />
                  <InfoRow
                    icon={<Hash className="h-4 w-4" />}
                    label="Roll Number"
                    value={profile.roll_number}
                    placeholder="Not assigned"
                  />
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-4">
                  {/* School - Read-only (NO explanatory labels) */}
                  <EditInput
                    label="School"
                    icon={<School className="h-3.5 w-3.5" />}
                    value={profile.school?.name || "Institution not assigned"}
                    readOnly
                  />

                  {/* College/School Email - Read-only (NO explanatory labels) */}
                  <EditInput
                    label="College / School Email"
                    icon={<Mail className="h-3.5 w-3.5" />}
                    value={profile.email}
                    readOnly
                  />

                  {/* Grade - Editable */}
                  <EditInput
                    label="Grade"
                    icon={<GraduationCap className="h-3.5 w-3.5" />}
                    value={editState.grade}
                    onChange={set("grade")}
                    placeholder="e.g. 10th"
                  />

                  {/* Section - Editable */}
                  <EditInput
                    label="Section"
                    icon={<Layers className="h-3.5 w-3.5" />}
                    value={editState.section}
                    onChange={set("section")}
                    placeholder="e.g. A"
                  />

                  {/* Roll Number - Editable */}
                  <EditInput
                    label="Roll Number"
                    icon={<Hash className="h-3.5 w-3.5" />}
                    value={editState.roll_number}
                    onChange={set("roll_number")}
                    placeholder="e.g. 24"
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── 4. Parent / Guardian Information Card ── */}
        <div className="lg:col-span-12">
          <Card className="rounded-2xl border border-slate-200/80 shadow-soft transition-all duration-300 hover:shadow-soft-md hover:border-slate-300 animate-fade-in-up">
            <CardHeader className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Parent / Guardian Information</CardTitle>
              </div>
            </CardHeader>

            <CardBody className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Father Sub-Card */}
                <div className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <User className="h-4 w-4 text-teal-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Father</h4>
                  </div>

                  {!editing ? (
                    <div className="space-y-1">
                      <InfoRow
                        icon={<User className="h-4 w-4" />}
                        label="Father's Name"
                        value={profile.father_name}
                        placeholder="Not provided"
                      />
                      <InfoRow
                        icon={<Phone className="h-4 w-4" />}
                        label="Father's Mobile Number"
                        value={profile.father_mobile}
                        placeholder="Not provided"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <EditInput
                        label="Father's Name"
                        icon={<User className="h-3.5 w-3.5" />}
                        value={editState.father_name}
                        onChange={set("father_name")}
                        placeholder="Enter father's name"
                      />
                      <EditInput
                        label="Father's Mobile Number"
                        icon={<Phone className="h-3.5 w-3.5" />}
                        type="tel"
                        value={editState.father_mobile}
                        onChange={set("father_mobile")}
                        placeholder="Enter father's mobile number"
                      />
                    </div>
                  )}
                </div>

                {/* Mother Sub-Card */}
                <div className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <User className="h-4 w-4 text-teal-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Mother</h4>
                  </div>

                  {!editing ? (
                    <div className="space-y-1">
                      <InfoRow
                        icon={<User className="h-4 w-4" />}
                        label="Mother's Name"
                        value={profile.mother_name}
                        placeholder="Not provided"
                      />
                      <InfoRow
                        icon={<Phone className="h-4 w-4" />}
                        label="Mother's Mobile Number"
                        value={profile.mother_mobile}
                        placeholder="Not provided"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <EditInput
                        label="Mother's Name"
                        icon={<User className="h-3.5 w-3.5" />}
                        value={editState.mother_name}
                        onChange={set("mother_name")}
                        placeholder="Enter mother's name"
                      />
                      <EditInput
                        label="Mother's Mobile Number"
                        icon={<Phone className="h-3.5 w-3.5" />}
                        type="tel"
                        value={editState.mother_mobile}
                        onChange={set("mother_mobile")}
                        placeholder="Enter mother's mobile number"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
