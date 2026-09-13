# Roamwise — Design System

*Proposed visual direction. Written before any page code changes. Tailwind CSS v4 native — all tokens defined via `@theme` in `globals.css`, no new styling library.*

---

## 1. The Mood We're Going For

Roamwise coordinates **groups**, **money**, and **schedules**. That's the design problem: it needs to feel warm enough that planning a trip with friends is pleasant, but organized enough that you trust it with a ₹80,000 budget and a nine-day timetable.

The current UI is honest but anonymous — default Tailwind `blue-600` on pure-white with pure-gray text. It reads as a well-built internal admin tool, not a product you'd plan a holiday in.

**The direction: "Field Guide."** The visual reference is a well-made travel guidebook — warm paper stock, a confident editorial serif for headings, clean sans for body, and disciplined use of color where it carries meaning. Not a booking site's hard-sell gradients; not a dashboard's cold neutrality.

Three principles:

1. **Warm paper, not white screen.** Surfaces sit on a warm off-white ground with warm-tinted neutrals. Cards are white and lift off that ground — depth from contrast, not drop shadows.
2. **Color means something.** Six semantic roles already exist in the app (primary, success, danger, caution, disruption, info). The redesign preserves every one of those distinctions and makes them deliberate instead of incidental.
3. **Numbers deserve typography.** This app is full of costs, distances, times, and scores. Figures get a monospace face with tabular figures so columns align and totals are scannable.

---

## 2. Color Palette

### Lagoon — primary

Deep teal-cyan. Water and distance without defaulting to corporate blue. Carries primary actions, links, focus rings, and info states.

| Token | Hex | Use |
|---|---|---|
| `lagoon-50` | `#EFFAF9` | Tinted backgrounds, info banners |
| `lagoon-100` | `#D6F2EF` | Badge backgrounds |
| `lagoon-200` | `#AEE5DF` | Badge borders, subtle dividers |
| `lagoon-300` | `#7BD1C9` | Disabled primary, decorative |
| `lagoon-400` | `#46B5AC` | Chart fills, progress bars |
| `lagoon-500` | `#26988F` | Hover on light surfaces |
| `lagoon-600` | `#1A7A73` | **Primary button, primary action** |
| `lagoon-700` | `#17625D` | Primary hover, link text |
| `lagoon-800` | `#164E4A` | Badge text on `lagoon-100` |
| `lagoon-900` | `#11403D` | Deepest headings on tint |

### Ink — warm neutrals

Slight taupe cast rather than pure gray. Body text, borders, surfaces, muted labels.

| Token | Hex | Use |
|---|---|---|
| `ink-50` | `#FAF9F7` | **App background (the "paper")** |
| `ink-100` | `#F4F2EF` | Subtle fills, table headers, inactive tabs |
| `ink-200` | `#E7E3DD` | **Default border, dividers** |
| `ink-300` | `#D3CDC4` | Input borders, stronger dividers |
| `ink-400` | `#A9A199` | Placeholder text, disabled text |
| `ink-500` | `#7D756D` | Muted metadata (dates, counts) |
| `ink-600` | `#5C554F` | **Secondary body text** |
| `ink-700` | `#443E39` | Body text |
| `ink-800` | `#2C2825` | **Headings** |
| `ink-900` | `#1A1715` | Maximum-contrast display text |

### Ember — accent + disruption

Warm terracotta. Used sparingly as the brand accent (match scores, highlights) and as the dedicated **disruption/replan** color, which is where it already lives in the app today.

| Token | Hex | Use |
|---|---|---|
| `ember-50` | `#FEF6ED` | Replan panel background |
| `ember-100` | `#FCE9D2` | Disruption badge background |
| `ember-200` | `#F8D0A3` | Replan panel border |
| `ember-400` | `#EC8E3C` | Accent fills |
| `ember-500` | `#DE7220` | **Disruption action button** |
| `ember-600` | `#BF5716` | Disruption hover |
| `ember-800` | `#7C3717` | Disruption text on tint |

### Semantic roles

Green, red, and amber stay visually distinct from each other **and** from ember, so the six meanings never collide.

| Role | Token base | Key values | Currently used for |
|---|---|---|---|
| **Success** | `success` | `50 #F0FAF3` · `100 #D8F0E1` · `200 #B0E1C4` · `600 #2F8F55` · `700 #256F43` · `800 #1D5734` | Selected stay, packed items, accept changes, under budget |
| **Danger** | `danger` | `50 #FDF3F2` · `100 #FBE0DE` · `200 #F5BFBB` · `600 #C4463C` · `700 #9E362E` · `800 #7C2B25` | Form errors, essential flag, removed items |
| **Caution** | `caution` | `50 #FEF9EC` · `100 #FCEFCB` · `200 #F7DD9A` · `600 #B07D12` · `700 #8C620F` · `800 #6E4C0D` | Over-budget warning, sample-data banner, backtracking alert |

### Semantic mapping — old → new

This is the contract that keeps meaning intact while the look changes.

| Meaning | Today | After |
|---|---|---|
| Primary action / link | `blue-600` / `blue-700` | `lagoon-600` / `lagoon-700` |
| Category badge (itinerary, hotel score) | `blue-100` / `blue-800` | `lagoon-100` / `lagoon-800` |
| Success, selected, accept, packed | `green-500` / `green-600` / `green-50` | `success-600` / `success-700` / `success-50` |
| Error, essential, removed item | `red-50` / `red-100` / `red-600` | `danger-50` / `danger-100` / `danger-600` |
| Over-budget, sample-data, backtracking | `yellow-50` / `amber-50` | `caution-50` + `caution-200` border |
| Disruption / replan | `orange-500` / `orange-50` | `ember-500` / `ember-50` |
| Body text | `gray-600` | `ink-600` |
| Muted metadata | `gray-500` / `gray-400` | `ink-500` / `ink-400` |
| Borders | default gray | `ink-200` |
| Page background | white | `ink-50` |

Note two consolidations: over-budget (`yellow`) and sample-data (`amber`) become the same **caution** role — they are the same "read this before you proceed" message and were arbitrarily different. Replan keeps its own **ember** role so "something went wrong with your day" never looks like "you're over budget."

---

## 3. Typography

Geist is currently loaded in `layout.tsx` but never applies — `globals.css` sets `font-family: Arial, Helvetica, sans-serif` on `body` and wins. Every screen today is rendering Arial. Fixing that is part of this pass.

| Role | Face | Rationale |
|---|---|---|
| **Display / headings** | **Fraunces** (variable serif, via `next/font/google`) | Warm editorial serif with optical sizing. This is the single biggest character change — it's what makes the app read as a travel guide rather than an admin panel. Used for page titles, trip names, section headings. |
| **Body / UI** | **Geist Sans** (already installed) | Neutral, excellent at 13–16px, handles dense tables and forms without fuss. All body copy, labels, buttons, inputs. |
| **Figures** | **Geist Mono** (already installed) | All currency, distances, durations, scores, and times, with `font-variant-numeric: tabular-nums`. Makes the budget table and route legs align and scan correctly. |

### Type scale

| Name | Size / line-height | Weight | Face | Use |
|---|---|---|---|---|
| `display` | 2.5rem / 1.1 | 600 | Fraunces | Landing hero |
| `h1` | 1.875rem / 1.2 | 600 | Fraunces | Page titles |
| `h2` | 1.375rem / 1.3 | 600 | Fraunces | Section headings |
| `h3` | 1.0625rem / 1.4 | 600 | Geist Sans | Card titles, day headings |
| `body` | 0.9375rem / 1.6 | 400 | Geist Sans | Default |
| `small` | 0.8125rem / 1.5 | 400 | Geist Sans | Metadata, helper text |
| `micro` | 0.6875rem / 1.4 | 500 | Geist Sans | Badge labels, uppercase eyebrows |
| `figure` | inherits | 500 | Geist Mono | Costs, distances, scores |

---

## 4. Spacing, Radius, Elevation

Tailwind's default 4px scale is kept. What's codified is **usage convention**, so pages stop inventing their own rhythm:

| Convention | Value |
|---|---|
| Page gutter | `px-4` mobile, `px-6` from `sm` |
| Page vertical padding | `py-8` |
| Content max width | `max-w-4xl` (detail pages), `max-w-2xl` (forms), `max-w-md` (auth) |
| Section gap | `space-y-8` |
| Card padding | `p-5` (`p-4` for dense rows) |
| Stack gap inside cards | `space-y-3` |
| Control height | `h-10` (inputs, buttons) — consistent so they align in rows |

**Radius**

| Token | Value | Use |
|---|---|---|
| `--radius-control` | `0.5rem` (8px) | Buttons, inputs, selects |
| `--radius-card` | `0.75rem` (12px) | Cards, panels, banners |
| `--radius-pill` | `9999px` | Badges, tags, progress bars |

**Elevation** — restrained. Depth comes from the white-card-on-warm-ground contrast, not shadow stacks.

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(26 23 21 / 0.04), 0 1px 3px rgb(26 23 21 / 0.06)` | Resting cards |
| `--shadow-lift` | `0 2px 4px rgb(26 23 21 / 0.05), 0 4px 12px rgb(26 23 21 / 0.08)` | Hover on interactive cards |

---

## 5. Component Specifications

These become real components in `src/components/ui/` in Step 2. Every one replaces an existing ad-hoc pattern — none introduces a new interaction.

### Button
Variants, all `h-10` (`h-8` for `sm`), `--radius-control`, `font-medium`, focus ring `ring-2 ring-lagoon-400 ring-offset-2`, `disabled:opacity-50`.

| Variant | Style | Replaces |
|---|---|---|
| `primary` | `bg-lagoon-600` white text, hover `lagoon-700` | `bg-blue-600 ... hover:bg-blue-700` |
| `secondary` | white bg, `border-ink-300`, hover `bg-ink-100` | `border ... hover:bg-gray-50` |
| `ghost` | transparent, `text-ink-600`, hover `bg-ink-100` | bare `<button>` text links |
| `success` | `bg-success-600` white, hover `success-700` | `bg-green-600` (accept changes) |
| `disruption` | `bg-ember-500` white, hover `ember-600` | `bg-orange-500` (see proposed changes) |
| `danger` | `bg-danger-600` white, hover `danger-700` | (remove / destructive) |

### Card
`bg-white`, `border border-ink-200`, `--radius-card`, `shadow-card`. Optional `interactive` prop adds `hover:shadow-lift hover:border-ink-300 transition`. Replaces `border rounded-lg p-4` repeated across every page.

### Input / Textarea / Select
`h-10` (textarea auto), `bg-white`, `border-ink-300`, `--radius-control`, `px-3`, placeholder `ink-400`, focus `border-lagoon-500 ring-2 ring-lagoon-400/30`. Paired `Field` wrapper renders label + helper text + error message in one consistent block. Replaces `w-full border rounded px-3 py-2` and the hand-rolled label/error markup in every form.

### Badge
Pill, `micro` type, tonal. Tones: `lagoon` (category, score), `success`, `danger` (essential), `caution`, `ember` (disruption), `neutral` (amenities, member names). Replaces the six different inline `bg-*-100 text-*-800 px-2 py-1 rounded` combinations.

### Alert
Banner with tinted background, matching border, optional title + body. Tones: `caution` (over-budget, sample data, backtracking), `danger` (errors), `success`, `info`. Replaces `bg-red-50 border border-red-200 rounded-lg p-4` and its four siblings.

### PageHeader
Back link + title + optional subtitle/meta row + optional action slot. Standardizes the `← Dashboard` / `← Trip` pattern and the `h1` treatment that currently differs slightly on every page.

> **Scope note:** `PageHeader` renders only the links each page *already has*. This pass adds no new navigation destinations and removes none.

### Stat
The 3-up summary tile (label + figure + optional sub-detail) used on budget and route. Figure uses the mono face. Replaces `border rounded-lg p-4 text-center` triplets.

### Progress
Pill track `bg-ink-100` with `lagoon-400` (or `success-600` for packing) fill. Replaces the two hand-rolled bar implementations.

### EmptyState
Centered icon-free message + hint, inside a dashed-border card. Replaces the four near-identical "No X yet" blocks.

---

## 6. Tailwind v4 Token Definitions

Goes into `src/app/globals.css`. Abridged — full scales as tabulated above.

```css
@import "tailwindcss";

@theme {
  /* Primary */
  --color-lagoon-50:  #EFFAF9;
  --color-lagoon-100: #D6F2EF;
  --color-lagoon-200: #AEE5DF;
  --color-lagoon-300: #7BD1C9;
  --color-lagoon-400: #46B5AC;
  --color-lagoon-500: #26988F;
  --color-lagoon-600: #1A7A73;
  --color-lagoon-700: #17625D;
  --color-lagoon-800: #164E4A;
  --color-lagoon-900: #11403D;

  /* Warm neutrals */
  --color-ink-50:  #FAF9F7;
  --color-ink-100: #F4F2EF;
  --color-ink-200: #E7E3DD;
  --color-ink-300: #D3CDC4;
  --color-ink-400: #A9A199;
  --color-ink-500: #7D756D;
  --color-ink-600: #5C554F;
  --color-ink-700: #443E39;
  --color-ink-800: #2C2825;
  --color-ink-900: #1A1715;

  /* Accent / disruption */
  --color-ember-50:  #FEF6ED;
  --color-ember-100: #FCE9D2;
  --color-ember-200: #F8D0A3;
  --color-ember-400: #EC8E3C;
  --color-ember-500: #DE7220;
  --color-ember-600: #BF5716;
  --color-ember-800: #7C3717;

  /* Semantic */
  --color-success-50:  #F0FAF3;
  --color-success-100: #D8F0E1;
  --color-success-200: #B0E1C4;
  --color-success-600: #2F8F55;
  --color-success-700: #256F43;
  --color-success-800: #1D5734;

  --color-danger-50:  #FDF3F2;
  --color-danger-100: #FBE0DE;
  --color-danger-200: #F5BFBB;
  --color-danger-600: #C4463C;
  --color-danger-700: #9E362E;
  --color-danger-800: #7C2B25;

  --color-caution-50:  #FEF9EC;
  --color-caution-100: #FCEFCB;
  --color-caution-200: #F7DD9A;
  --color-caution-600: #B07D12;
  --color-caution-700: #8C620F;
  --color-caution-800: #6E4C0D;

  /* Type */
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
  --font-sans:    var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono:    var(--font-geist-mono), ui-monospace, monospace;

  /* Radius */
  --radius-control: 0.5rem;
  --radius-card:    0.75rem;

  /* Elevation */
  --shadow-card: 0 1px 2px rgb(26 23 21 / 0.04), 0 1px 3px rgb(26 23 21 / 0.06);
  --shadow-lift: 0 2px 4px rgb(26 23 21 / 0.05), 0 4px 12px rgb(26 23 21 / 0.08);
}

body {
  background: var(--color-ink-50);
  color: var(--color-ink-700);
  font-family: var(--font-sans);
}

.tabular { font-variant-numeric: tabular-nums; }
```

---

## 7. Decisions That Need Your Sign-Off

Three calls I'd rather you make than assume:

1. **Drop the dead dark-mode block.** `globals.css` declares a `prefers-color-scheme: dark` media query, but no page respects it — every screen hardcodes light-mode colors, so on a dark-mode OS the app is currently white cards on a black body with unreadable patches. I propose **committing to light-only now** and removing the dead query, while defining tokens semantically so a real dark theme is a later token swap rather than a rewrite. The alternative — building a genuine dark theme — is a meaningfully larger job than this pass.

2. **Adding Fraunces as a third webfont.** It's the change that actually creates the character. Cost is one additional variable font from Google Fonts (`next/font` self-hosts it, so no third-party runtime request). If you'd rather not add a face, the fallback is Geist Sans at heavier weights with tighter tracking for headings — more restrained, noticeably less distinctive.

3. **Fixing the Arial override.** Strictly a bug (Geist is loaded, paid for in bundle size, and never used), but it changes how every screen looks, so I'm flagging it rather than slipping it in.

---

## 8. What This Pass Will Not Touch

Restating the constraint as a checklist I'll hold myself to:

- No change to any server action, its signature, or what it writes
- No change to data fetching, Prisma queries, or validation rules
- No `onClick` / `onSubmit` / `action` handler removed, renamed, or rewired
- No form field `name` or `id` attributes changed — server actions read these off `FormData`
- Specifically preserved and re-verified after restyling: **replan propose/accept/reject**, **hotel select/remove**, **packing check + mark-essential** (both are inline server-action `<form>` submits, not decorative checkboxes), **budget optimize**, **itinerary generate**
- No test changes — if a restyle breaks a test, that's a signal to stop, not to edit the test
