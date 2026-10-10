import { describe, it, expect } from "vitest";
import {
  buildYouTubeSearchQuery,
  formatIsoDuration,
  decodeHtmlEntities,
  deriveRelevanceLabel,
  normalizeGrade,
} from "@/lib/youtube";
import { generateCacheKey } from "@/lib/services/recommendedVideos";

describe("Recommended Videos - Query Building & Utilities", () => {
  it("builds focused YouTube search queries with subject, topic, and grade", () => {
    const q1 = buildYouTubeSearchQuery({
      concept: "Glucose",
      subject: "Biology",
      topic: "Photosynthesis",
      grade: "10",
    });
    expect(q1).toBe("Photosynthesis Glucose Biology class 10");

    const q2 = buildYouTubeSearchQuery({
      concept: "Latent Heat",
      subject: "Science",
      topic: "Matter",
      grade: "5TH",
    });
    expect(q2).toBe("Matter Latent Heat Science class 5");

    const q3 = buildYouTubeSearchQuery({
      concept: "Diffusion",
      subject: "Chemistry",
    });
    expect(q3).toBe("Diffusion Chemistry");
  });

  it("normalizes grade strings properly", () => {
    expect(normalizeGrade("5TH")).toBe("class 5");
    expect(normalizeGrade("10th")).toBe("class 10");
    expect(normalizeGrade("Grade 8")).toBe("class 8");
    expect(normalizeGrade(null)).toBeNull();
  });

  it("decodes HTML entities from titles and channels", () => {
    expect(decodeHtmlEntities("Specific Heat &amp; Latent Heat")).toBe("Specific Heat & Latent Heat");
    expect(decodeHtmlEntities("Khan&#39;s Academy")).toBe("Khan's Academy");
    expect(decodeHtmlEntities("&quot;Photosynthesis&quot;")).toBe('"Photosynthesis"');
  });

  it("formats ISO 8601 durations into readable strings", () => {
    expect(formatIsoDuration("PT16M14S")).toBe("16:14");
    expect(formatIsoDuration("PT8M")).toBe("8 min");
    expect(formatIsoDuration("PT1H5M20S")).toBe("1h 5m");
    expect(formatIsoDuration("PT45S")).toBe("45s");
    expect(formatIsoDuration(null)).toBeNull();
  });

  it("derives educational relevance labels", () => {
    expect(deriveRelevanceLabel("Photosynthesis Class 10 CBSE", "10:00")).toBe("Curriculum Aligned");
    expect(deriveRelevanceLabel("Latent Heat One Shot Revision", "15:00")).toBe("Quick Review");
    expect(deriveRelevanceLabel("Diffusion Explained Simply", "8:00")).toBe("Concept Deep Dive");
    expect(deriveRelevanceLabel("Quick Summary", "3:00")).toBe("Quick Review");
  });

  it("generates consistent normalized cache keys", () => {
    const k1 = generateCacheKey("Latent Heat", "Science", "5TH");
    const k2 = generateCacheKey("latent heat ", " science", "5th");
    expect(k1).toBe(k2);
    expect(k1).toBe("yt:latent heat:science:5th");
  });
});
