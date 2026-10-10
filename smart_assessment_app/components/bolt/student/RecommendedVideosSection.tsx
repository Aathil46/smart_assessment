"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  ExternalLink,
  Sparkles,
  Clock,
  RotateCcw,
  AlertCircle,
  Video,
  CheckCircle2,
  Tv2,
} from "lucide-react";
import type { RecommendedVideo } from "@/lib/youtube";
import type { AttemptRecommendationsResponse, ConceptRecommendationResult } from "@/lib/services/recommendedVideos";

interface RecommendedVideosSectionProps {
  attemptId: string;
}

export function RecommendedVideosSection({ attemptId }: RecommendedVideosSectionProps) {
  const [data, setData] = useState<AttemptRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = `/api/student/recommendations/videos?attemptId=${encodeURIComponent(attemptId)}${
        isRefresh ? "&refresh=true" : ""
      }`;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to load recommendations.");
      }

      setData(json);
    } catch (err) {
      console.error("Error fetching recommended videos:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load video recommendations at the moment."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId) {
      fetchRecommendations(false);
    }
  }, [attemptId, fetchRecommendations]);

  // ─── 1. Loading State: Skeleton Cards ─────────────────────────────────────
  if (loading) {
    return (
      <section className="space-y-6 pt-6 border-t border-slate-200">
        <div>
          <div className="h-7 w-56 rounded-lg bg-slate-200 animate-pulse" />
          <div className="h-4 w-80 rounded-md bg-slate-100 animate-pulse mt-2" />
        </div>

        <div className="space-y-6">
          {[1, 2].map((group) => (
            <div
              key={group}
              className="rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full bg-slate-200 animate-pulse" />
                  <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
              <div className="h-4 w-64 rounded bg-slate-100 animate-pulse" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {[1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden space-y-3 p-3"
                  >
                    <div className="aspect-video w-full rounded-lg bg-slate-200 animate-pulse" />
                    <div className="h-4 w-5/6 rounded bg-slate-200 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-slate-200 animate-pulse" />
                    <div className="h-8 w-full rounded-lg bg-slate-200 animate-pulse mt-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ─── 2. Error State: Friendly Retry ───────────────────────────────────────
  if (error) {
    return (
      <section className="space-y-4 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            Recommended for You
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Resources based on concepts you may want to strengthen.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center max-w-xl mx-auto space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 mx-auto">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-rose-950">
            Unable to load video recommendations
          </h3>
          <p className="text-xs text-rose-700">
            We encountered a temporary issue retrieving video recommendations. Please try again.
          </p>
          <button
            onClick={() => fetchRecommendations(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition active:scale-95 shadow-2xs cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try Again
          </button>
        </div>
      </section>
    );
  }

  // ─── 3. Empty State: No Weak Concepts ─────────────────────────────────────
  if (!data || !data.hasWeakConcepts || data.recommendations.length === 0) {
    return (
      <section className="space-y-4 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            Recommended for You
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Resources based on concepts you may want to strengthen.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-7 text-center max-w-2xl mx-auto shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto mb-3 shadow-2xs">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-emerald-950">
            You&apos;re doing well! No learning gaps were identified from this assessment.
          </h3>
          <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
            You scored well across all evaluated concepts. Video recommendations are only curated
            for concepts where targeted practice is needed.
          </p>
        </div>
      </section>
    );
  }

  // ─── 4. Success State: Grouped Weak Concept Video Cards ──────────────────
  return (
    <section className="space-y-6 pt-6 border-t border-slate-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-2xs">
              <Video className="h-4 w-4" />
            </span>
            Recommended for You
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Resources based on concepts you may want to strengthen.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchRecommendations(true)}
            disabled={refreshing}
            title="Refresh video recommendations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition active:scale-95 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Weak Concept Groups */}
      <div className="space-y-6">
        {data.recommendations.map((group, groupIdx) => (
          <WeakConceptVideoGroup
            key={group.concept}
            group={group}
            index={groupIdx}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Weak Concept Group Component ────────────────────────────────────────────
function WeakConceptVideoGroup({
  group,
  index,
}: {
  group: ConceptRecommendationResult;
  index: number;
}) {
  const isHighPriority = group.priority === "high";

  return (
    <div
      className={`rounded-2xl border-2 ${
        isHighPriority
          ? "border-rose-200/90 bg-gradient-to-b from-rose-50/30 via-white to-white"
          : "border-amber-200/90 bg-gradient-to-b from-amber-50/30 via-white to-white"
      } p-5 lg:p-6 shadow-xs hover:shadow-md transition-shadow duration-200 space-y-4`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Concept Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div className="flex items-start sm:items-center gap-2.5">
          <span
            className={`inline-block h-3 w-3 rounded-full shrink-0 mt-1 sm:mt-0 ${
              isHighPriority ? "bg-rose-500 animate-pulse" : "bg-amber-500"
            }`}
            aria-hidden="true"
          />
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {group.concept}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {group.statusMessage || "You may need more practice with this concept."}
            </p>
          </div>
        </div>

        {/* Priority & Accuracy Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isHighPriority
                ? "bg-rose-100 text-rose-800 border border-rose-200"
                : "bg-amber-100 text-amber-800 border border-amber-200"
            }`}
          >
            {isHighPriority ? "High Priority" : "Needs Review"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {group.accuracyPercentage}% accuracy
          </span>
        </div>
      </div>

      {/* Videos List / Empty State */}
      {group.videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center space-y-1">
          <Tv2 className="h-6 w-6 text-slate-400 mx-auto mb-1" />
          <p className="text-xs font-medium text-slate-600">
            We couldn&apos;t find suitable videos for this concept yet.
          </p>
          <p className="text-2xs text-slate-400">
            Please ask your teacher or check your textbook notes for additional guidance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 pt-1">
          {group.videos.map((video, vIdx) => (
            <VideoCard key={video.id} video={video} index={vIdx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Video Card Component ────────────────────────────────────────────────────
function VideoCard({ video, index }: { video: RecommendedVideo; index: number }) {
  return (
    <div
      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-1 transition duration-200 motion-reduce:transform-none motion-reduce:transition-none"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div>
        {/* Thumbnail Container */}
        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
          />

          {/* Semi-transparent dark overlay for play button */}
          <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-md group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white transition-all duration-200">
              <Play className="h-4 w-4 fill-current ml-0.5" />
            </span>
          </div>

          {/* Relevance Label Badge */}
          {video.relevanceLabel && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-600/90 backdrop-blur-xs px-2 py-0.5 text-2xs font-bold text-white shadow-xs">
                <Sparkles className="h-2.5 w-2.5" />
                {video.relevanceLabel}
              </span>
            </div>
          )}

          {/* Duration Badge */}
          {video.duration && (
            <div className="absolute bottom-2 right-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-black/80 backdrop-blur-xs px-2 py-0.5 text-2xs font-semibold text-white shadow-xs">
                <Clock className="h-2.5 w-2.5" />
                {video.duration}
              </span>
            </div>
          )}
        </div>

        {/* Video Metadata */}
        <div className="p-3.5 space-y-1.5">
          <h4
            className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug"
            title={video.title}
          >
            {video.title}
          </h4>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="truncate" title={video.channelTitle}>
              {video.channelTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Card Action */}
      <div className="p-3.5 pt-0">
        <a
          href={video.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-blue-600 text-slate-700 hover:text-white text-xs font-semibold border border-slate-200/80 hover:border-blue-600 transition duration-200 active:scale-95 shadow-2xs group/btn cursor-pointer"
        >
          <span>Watch Video</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-white transition-colors" />
        </a>
      </div>
    </div>
  );
}
