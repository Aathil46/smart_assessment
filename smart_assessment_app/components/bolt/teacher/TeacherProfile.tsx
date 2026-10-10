"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, SectionTitle } from "@/components/shared/StatCard";
import {
  User, Mail, Phone, Calendar, MapPin, GraduationCap,
  Edit2, Save, X, School, Shield, BookOpen, Hash,
  CheckCircle2, Camera, ChevronRight, Layers, Sparkles,
} from "lucide-react";
import { TeacherAiCredentialsCard } from "./TeacherAiCredentialsCard";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  email: string;           // college / auth email — not editable
  name: string;
  role: string;
  phone: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  avatar_url: string | null;
  created_at: string;
  school: { id: string; name: string } | null;
  subjects: string[];
  grades: string[];
  // Structured address
  addr_door: string | null;
  addr_building: string | null;
  addr_street: string | null;
  addr_city: string | null;
  addr_state: string | null;
  addr_pincode: string | null;
}

interface EditState {
  name: string;
  phone: string;
  personal_email: string;
  date_of_birth: string;
  gender: string;
  avatar_url: string;
  addr_door: string;
  addr_building: string;
  addr_street: string;
  addr_city: string;
  addr_state: string;
  addr_pincode: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (!iso) return "—";
  // date-only strings like "1990-05-20" need timezone-safe parsing
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatGender(g: string | null): string {
  if (!g) return "—";
  const map: Record<string, string> = {
    male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Prefer not to say",
  };
  return map[g] ?? g;
}

/** Build a single readable address string from structured parts, for view mode */
function formatAddress(p: ProfileData): string | null {
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
  placeholder = "Not provided",
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium break-words ${value ? "text-slate-900" : "text-slate-300 italic"} ${mono ? "font-mono tracking-wide" : ""}`}>
          {value || placeholder}
        </p>
      </div>
    </div>
  );
}

function EditField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  children,
  halfWidth = false,
}: {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  halfWidth?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${halfWidth ? "" : ""}`}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <span className="text-slate-400">{icon}</span>
        {label}
      </label>
      {children ?? (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
      )}
    </div>
  );
}

// Pill badge for subjects/grades
function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-medium text-brand-700">
      {text}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TeacherProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    name: "", phone: "", personal_email: "", date_of_birth: "",
    gender: "", avatar_url: "",
    addr_door: "", addr_building: "", addr_street: "",
    addr_city: "", addr_state: "", addr_pincode: "",
  });
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.profile) setProfile(json.profile);
        else setError(json.error?.message ?? "Failed to load profile.");
      })
      .catch(() => { if (!cancelled) setError("Failed to load profile."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Edit ──────────────────────────────────────────────────────────────

  function handleEdit() {
    if (!profile) return;
    setSaveError(null);
    setSaveSuccess(false);
    setEditState({
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      personal_email: profile.personal_email ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      gender: profile.gender ?? "",
      avatar_url: profile.avatar_url ?? "",
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

  function set(field: keyof EditState) {
    return (v: string) => setEditState((s) => ({ ...s, [field]: v }));
  }

  // ── Avatar upload (base64 preview — stored as data URL or uploadable URL) ──

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setEditState((s) => ({ ...s, avatar_url: result }));
    };
    reader.readAsDataURL(file);
  }

  // ── Save ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);

    const n = <T extends string | null>(v: string, fallback: T): string | T =>
      v.trim() !== "" ? v.trim() : fallback;

    const payload = {
      name: n(editState.name, profile.name),
      phone: n(editState.phone, null),
      personal_email: n(editState.personal_email, null),
      date_of_birth: editState.date_of_birth || null,
      gender: editState.gender || null,
      avatar_url: editState.avatar_url || null,
      addr_door: n(editState.addr_door, null),
      addr_building: n(editState.addr_building, null),
      addr_street: n(editState.addr_street, null),
      addr_city: n(editState.addr_city, null),
      addr_state: n(editState.addr_state, null),
      addr_pincode: n(editState.addr_pincode, null),
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "Failed to save changes.");

      const p = json.profile;
      setProfile((prev) =>
        prev ? {
          ...prev,
          name: p.name ?? prev.name,
          phone: p.phone ?? null,
          personal_email: p.personal_email ?? null,
          date_of_birth: p.date_of_birth ?? null,
          gender: p.gender ?? null,
          avatar_url: p.avatar_url ?? null,
          addr_door: p.addr_door ?? null,
          addr_building: p.addr_building ?? null,
          addr_street: p.addr_street ?? null,
          addr_city: p.addr_city ?? null,
          addr_state: p.addr_state ?? null,
          addr_pincode: p.addr_pincode ?? null,
        } : prev
      );
      setEditing(false);
      setSaveSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-48 rounded-lg bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Manage your personal information." />
        <div className="flex items-center justify-center py-20 text-center">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-100 text-error-600 mx-auto mb-3">
              <X className="h-7 w-7" />
            </div>
            <p className="text-slate-700 font-semibold">Failed to load profile</p>
            <p className="text-slate-400 text-sm mt-1">{error ?? "Unknown error"}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const initials = getInitials(profile.name);
  const teacherId = profile.id.split("-")[0].toUpperCase();
  const avatarPreview = editing ? editState.avatar_url : profile.avatar_url;

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <PageHeader
        title="My Profile & Settings"
        description="View and update your personal information and AI credentials."
        action={
          !editing ? (
            <Button id="btn-edit-profile" onClick={handleEdit}>
              <Edit2 className="h-4 w-4" /> Edit Profile
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button id="btn-cancel-profile" variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button id="btn-save-profile" onClick={handleSave} loading={saving}>
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </div>
          )
        }
      />

      {/* ── Banners ───────────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-50 border border-success-200 text-success-700 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Profile updated successfully.
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm font-medium">
          <X className="h-4 w-4 flex-shrink-0" />
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══════════════════════════════════════════════════════════════
            LEFT — Profile header card
        ══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            {/* Gradient band */}
            <div className="h-24 bg-gradient-to-br from-brand-500 to-brand-700 relative select-none">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            </div>

            <CardBody className="pt-0 -mt-12 flex flex-col items-center text-center pb-6 px-5">
              {/* Avatar */}
              <div className="relative mb-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={profile.name}
                    className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 border-4 border-white shadow-md flex items-center justify-center text-white text-2xl font-bold">
                    {initials}
                  </div>
                )}
                {/* Camera overlay — triggers file input when editing */}
                {editing && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </>
                )}
                {!editing && (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow text-slate-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                    title="Edit profile picture"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Name */}
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {profile.name}
              </h2>

              {/* Key info chips */}
              <div className="w-full mt-5 space-y-2.5">
                <HeaderDetail icon={<Hash className="h-3.5 w-3.5" />} label="Teacher ID" value={teacherId} mono />
                <HeaderDetail icon={<School className="h-3.5 w-3.5" />} label="School" value={profile.school?.name ?? "—"} />
                <HeaderDetail icon={<Mail className="h-3.5 w-3.5" />} label="College Email" value={profile.email} />
                <HeaderDetail icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={profile.phone ?? "—"} />
              </div>

              {/* Edit button */}
              {!editing && (
                <button
                  onClick={handleEdit}
                  className="mt-5 w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                </button>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT — Detail cards
        ══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Section Navigation */}
          <div className="flex items-center gap-2 pb-1 overflow-x-auto select-none">
            <a
              href="#personal-info"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap"
            >
              Personal Info
            </a>
            <a
              href="#ai-credentials"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="h-3 w-3 text-teal-600" />
              AI Credentials
            </a>
            <a
              href="#school-info"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap"
            >
              School & Professional
            </a>
          </div>

          {/* ── Personal Information ─────────────────────────────────── */}
          <Card id="personal-info">
            <CardHeader>
              <div className="flex items-center justify-between">
                <SectionTitle
                  title="Personal Information"
                  className="mb-0"
                />
                {!editing && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
            </CardHeader>

            <CardBody>
              {!editing ? (
                /* ── View mode ─────────────────────────────────────── */
                <div>
                  <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={profile.name} />
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={formatDate(profile.date_of_birth)} />
                  <InfoRow icon={<User className="h-4 w-4" />} label="Gender" value={formatGender(profile.gender)} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile Number" value={profile.phone} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="Personal Email" value={profile.personal_email} />

                  {/* Address */}
                  <div className="flex items-start gap-3 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 flex-shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Address</p>
                      {formatAddress(profile) ? (
                        <AddressView profile={profile} />
                      ) : (
                        <p className="text-sm font-medium text-slate-300 italic">Not provided</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Edit mode ─────────────────────────────────────── */
                <div className="space-y-6">
                  {/* Basic fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <EditField label="Full Name" icon={<User className="h-3.5 w-3.5" />}
                        value={editState.name} onChange={set("name")} placeholder="Your full name" />
                    </div>

                    <EditField label="Date of Birth" icon={<Calendar className="h-3.5 w-3.5" />}
                      type="date" value={editState.date_of_birth} onChange={set("date_of_birth")} />

                    <EditField label="Gender" icon={<User className="h-3.5 w-3.5" />}>
                      <select
                        value={editState.gender}
                        onChange={(e) => set("gender")(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </EditField>

                    <EditField label="Mobile Number" icon={<Phone className="h-3.5 w-3.5" />}
                      type="tel" value={editState.phone} onChange={set("phone")} placeholder="+91 98765 43210" />

                    <EditField label="Personal Email" icon={<Mail className="h-3.5 w-3.5" />}
                      type="email" value={editState.personal_email} onChange={set("personal_email")} placeholder="personal@email.com" />

                    {/* College email — read-only */}
                    <div className="sm:col-span-2">
                      <EditField label="College Email" icon={<Mail className="h-3.5 w-3.5" />}>
                        <input disabled value={profile.email}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 cursor-not-allowed" />
                        <p className="text-xs text-slate-400 mt-1">College email is managed by your institution.</p>
                      </EditField>
                    </div>
                  </div>

                  {/* Profile picture URL input */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-slate-400" /> Profile Picture
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                        {editState.avatar_url ? (
                          <img src={editState.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <User className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Choose Image
                        </button>
                        {editState.avatar_url && (
                          <button type="button" onClick={() => set("avatar_url")("")}
                            className="ml-2 text-xs text-error-500 hover:text-error-600">Remove</button>
                        )}
                        <p className="text-xs text-slate-400">JPG, PNG up to 2 MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Structured address */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> Address
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EditField label="Door / House No." icon={<Hash className="h-3.5 w-3.5" />}
                        value={editState.addr_door} onChange={set("addr_door")} placeholder="Enter door / house number" />
                      <EditField label="Residence / Building" icon={<MapPin className="h-3.5 w-3.5" />}
                        value={editState.addr_building} onChange={set("addr_building")} placeholder="Enter residence or building name" />
                      <div className="sm:col-span-2">
                        <EditField label="Street" icon={<ChevronRight className="h-3.5 w-3.5" />}
                          value={editState.addr_street} onChange={set("addr_street")} placeholder="Enter street name" />
                      </div>
                      <EditField label="City" icon={<MapPin className="h-3.5 w-3.5" />}
                        value={editState.addr_city} onChange={set("addr_city")} placeholder="Enter city" />
                      <EditField label="State" icon={<MapPin className="h-3.5 w-3.5" />}
                        value={editState.addr_state} onChange={set("addr_state")} placeholder="Enter state" />
                      <EditField label="Pincode" icon={<Hash className="h-3.5 w-3.5" />}
                        value={editState.addr_pincode} onChange={set("addr_pincode")} placeholder="Enter 6-digit pincode" />
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── AI Credentials ────────────────────────────────────────── */}
          <TeacherAiCredentialsCard />

          {/* ── School & Professional Information — read-only ─────────── */}
          <Card id="school-info">
            <CardHeader>
              <SectionTitle title="School & Professional Information" className="mb-0" />
            </CardHeader>

            <CardBody>
              <InfoRow icon={<School className="h-4 w-4" />} label="School Name"
                value={profile.school?.name} placeholder="Not assigned" />
              <InfoRow icon={<Shield className="h-4 w-4" />} label="Teacher ID"
                value={teacherId} mono />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="College Email"
                value={profile.email} />

              {/* Subjects */}
              <div className="flex items-start gap-3 py-3 border-b border-slate-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 flex-shrink-0 mt-0.5">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">Subject(s)</p>
                  {profile.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.subjects.map((s) => <Pill key={s} text={s} />)}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-300 italic">No classes assigned</p>
                  )}
                </div>
              </div>

              {/* Grades */}
              <div className="flex items-start gap-3 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 flex-shrink-0 mt-0.5">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">Grade(s)</p>
                  {profile.grades.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.grades.map((g) => <Pill key={g} text={g} />)}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-300 italic">No classes assigned</p>
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

// ─── Header detail row (left card) ──────────────────────────────────────────

function HeaderDetail({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-left w-full">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-semibold text-slate-800 truncate ${mono ? "font-mono tracking-wider" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Structured address view ─────────────────────────────────────────────────

function AddressView({ profile }: { profile: ProfileData }) {
  const lines: string[] = [];
  if (profile.addr_door || profile.addr_building) {
    lines.push([profile.addr_door, profile.addr_building].filter(Boolean).join(", "));
  }
  if (profile.addr_street) lines.push(profile.addr_street);
  const cityState = [profile.addr_city, profile.addr_state].filter(Boolean).join(", ");
  const cityStatePincode = [cityState, profile.addr_pincode].filter(Boolean).join(" – ");
  if (cityStatePincode) lines.push(cityStatePincode);

  return (
    <div className="space-y-0.5">
      {lines.map((l, i) => (
        <p key={i} className="text-sm font-medium text-slate-900 leading-snug">{l}</p>
      ))}
    </div>
  );
}
