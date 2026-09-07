# Smart Assessment UI system

## Visual language
Calm, confident, educational SaaS. Use white panels on a cool neutral canvas, deep navy text, a single strong blue primary, muted status colors, and a restrained violet accent for AI-assisted content.

## Tokens
- Background: `#f5f7fb`
- Foreground: `#10233f`
- Muted: `#61708a`
- Border: `#dfe6ef`
- Primary: `#2457d6`
- Primary strong: `#1846ba`
- AI: `#7358d6`
- Success: `#1d9a67`
- Warning: `#c8841b`
- Error: `#d25454`
- Radius: 12px controls, 16px cards, 28px hero surfaces

## Patterns
- Persistent role-aware shell on desktop; compact header on mobile.
- PageHeader establishes location, purpose, and one main action.
- Cards use borders rather than heavy shadows.
- Status is communicated with text + badge, never color alone.
- AI content uses a violet-tinted callout and Sparkles icon; AI does not own deterministic scores.
- Long lists stack into cards on mobile.
- Assessment-taking should be distraction-free with large tap targets and clear progress.
- Empty, error, and processing states are first-class surfaces.
- Motion is short and purposeful; `prefers-reduced-motion` is respected.

## Product hierarchy
Teacher: Dashboard → Classes → Assessments → Results → Student detail.
Student: Dashboard → Join class → Assessment → Results → Learning gaps/practice.
Principal: Overview → Classes/Teachers/Assessments → Read-only analytics → AI review.

## Data display
Use charts only for distribution, trends, and comparisons that benefit from visual encoding. Keep core metrics as readable numbers and labels.
