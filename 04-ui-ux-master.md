# 04 — UI/UX MASTER REFERENCE
## BoxCostPro — Mobile-First Design System & Interaction Guidelines

> **Purpose**: Complete reference for UI/UX decisions across BoxCostPro. Covers layout, typography, color, components, interaction patterns, accessibility, and mobile-vs-desktop adaptation rules. A frontend engineer can implement every screen from this document without the original designs.

---

## INDEX

1. [Design Philosophy](#1-design-philosophy)
2. [Breakpoints & Layout Grid](#2-breakpoints--layout-grid)
3. [Typography System](#3-typography-system)
4. [Color System & Themes](#4-color-system--themes)
5. [Spacing & Density](#5-spacing--density)
6. [Navigation Patterns](#6-navigation-patterns)
7. [Touch & Click Targets](#7-touch--click-targets)
8. [Form Design](#8-form-design)
9. [Data Tables & Lists](#9-data-tables--lists)
10. [Modals, Drawers & Sheets](#10-modals-drawers--sheets)
11. [Loading, Empty & Error States](#11-loading-empty--error-states)
12. [Notifications & Feedback](#12-notifications--feedback)
13. [Calculator & Costing UI](#13-calculator--costing-ui)
14. [Quote Builder UI](#14-quote-builder-ui)
15. [Document & File UI](#15-document--file-ui)
16. [PDF Preview & Output UI](#16-pdf-preview--output-ui)
17. [Reports & Analytics UI](#17-reports--analytics-ui)
18. [Bulk Import UI](#18-bulk-import-ui)
19. [Admin / Settings UI](#19-admin--settings-ui)
    - [19.1 Settings Shell Layout](#191-settings-shell-layout)
    - [19.2 Admin Dashboard / Overview](#192-admin-dashboard--overview)
    - [19.3 Master Data Grids](#193-master-data-grids)
    - [19.4 Team & User Management](#194-team--user-management)
    - [19.5 Invitation Flow UI](#195-invitation-flow-ui)
    - [19.6 Role & Permission UI](#196-role--permission-ui)
    - [19.7 Audit Log UI](#197-audit-log-ui)
    - [19.8 Billing & Plan UI](#198-billing--plan-ui)
    - [19.9 AI & Extraction Config UI](#199-ai--extraction-config-ui)
    - [19.10 Template Editor UI](#1910-template-editor-ui)
    - [19.11 Email Automation / Follow-Up Rules UI](#1911-email-automation--follow-up-rules-ui)
    - [19.12 Client-Wise Pricing Policies UI](#1912-client-wise-pricing-policies-ui)
    - [19.13 Tally Integration Settings UI](#1913-tally-integration-settings-ui)
    - [19.14 Spec / Job Card / QA Template Controls UI](#1914-spec--job-card--qa-template-controls-ui)
    - [19.15 Platform Admin (Super-Admin) UI](#1915-platform-admin-super-admin-ui)
    - [19.16 Onboarding / First-Run Wizard](#1916-onboarding--first-run-wizard)
    - [19.17 Danger Zone](#1917-danger-zone)
20. [Accessibility (WCAG 2.1 AA)](#20-accessibility-wcag-21-aa)
21. [Motion & Animation](#21-motion--animation)
22. [Illustrations & Icons](#22-illustrations--icons)
23. [Dark Mode](#23-dark-mode)
24. [Performance Budgets](#24-performance-budgets)
25. [Component Checklist by Screen](#25-component-checklist-by-screen)
26. [Deal Pipeline UI](#26-deal-pipeline-ui)
    - [26.1 Pipeline Board (Kanban)](#261-pipeline-board-kanban)
    - [26.2 Quote Activity Feed](#262-quote-activity-feed)
    - [26.3 Win / Loss Modal](#263-win--loss-modal)
    - [26.4 Pipeline Analytics Dashboard](#264-pipeline-analytics-dashboard)
27. [Price Revision Letter UI](#27-price-revision-letter-ui)
    - [27.1 Revision Preview Table](#271-revision-preview-table)
    - [27.2 Bulk Client Selection](#272-bulk-client-selection)
    - [27.3 Send & PDF Actions](#273-send--pdf-actions)
28. [Multi-Accounting Integration UI](#28-multi-accounting-integration-ui)
    - [28.1 Integration Cards](#281-integration-cards)
    - [28.2 OAuth Connect Flow](#282-oauth-connect-flow)
    - [28.3 Field Mapping Editor](#283-field-mapping-editor)
    - [28.4 Push History Log](#284-push-history-log)

---

## 1 — DESIGN PHILOSOPHY

### 1.1 Core Principles

| # | Principle | What it means in practice |
|---|-----------|--------------------------|
| 1 | **Mobile-first** | Every screen is designed for 375 px viewport first, then expanded for tablet and desktop |
| 2 | **Thumb-zone aware** | Primary actions placed in the bottom 40% of phone screens; destructive actions require reach |
| 3 | **Data-dense but not cramped** | BoxCostPro is a professional tool; users expect density. Use compact mode defaults with comfortable mode as a user preference |
| 4 | **One primary action per screen** | Every screen has exactly one dominant CTA. Secondary actions are icon buttons or overflow menus |
| 5 | **Progressive disclosure** | Show summary first; detail on demand. Collapsible sections, drawers, and modals keep primary views clean |
| 6 | **Offline-tolerant** | Input fields accept offline entry; sync state clearly indicated. Never lose unsaved data on connection drop |
| 7 | **Keyboard-first for desktop** | Tab order, keyboard shortcuts, and focus rings are never disabled. Power users work without a mouse |

### 1.2 Design Persona

The primary user is a **salesperson or estimator at a corrugated packaging company** — often on a mobile phone at a factory or client site. They need:
- Fast quote creation (under 2 minutes)
- Clear cost breakdown without jargon
- Instant share (WhatsApp / email in one tap)
- Confidence that numbers are correct

Secondary user: **owner/manager** reviewing team performance on a desktop.

### 1.3 UX Anti-Patterns (Prohibited)

- ❌ Full-screen modals on mobile for simple confirmations → use bottom sheets
- ❌ Disabled buttons with no explanation → show tooltip or inline message
- ❌ Pagination without virtualization for long price lists → use virtual scroll
- ❌ Form validation only on submit → validate on blur (or on change after first blur)
- ❌ Numeric inputs using `type="text"` → always `type="number"` or `inputmode="decimal"` for mobile keyboards
- ❌ Tables that scroll horizontally without a visual hint (fade or scrollbar) → always show scroll hint
- ❌ Hover-only interactions (tooltips that only appear on hover) → must also work on tap
- ❌ Auto-playing audio or video
- ❌ Color as the sole differentiator (e.g. red = error, green = success with no icon or text)

---

## 2 — BREAKPOINTS & LAYOUT GRID

### 2.1 Breakpoint Scale

| Name | Min width | Max width | Target device |
|------|-----------|-----------|--------------|
| `xs` | 0 px | 479 px | Small phones (iPhone SE, Galaxy A03) |
| `sm` | 480 px | 767 px | Large phones, small phones landscape |
| `md` | 768 px | 1023 px | Tablets portrait, large phones landscape |
| `lg` | 1024 px | 1279 px | Tablets landscape, small laptops |
| `xl` | 1280 px | 1535 px | Standard desktop monitors |
| `2xl` | 1536 px | ∞ | Large monitors, TV screens |

> **Implementation**: Tailwind CSS breakpoint config. All utilities are mobile-first (no prefix = `xs`).

### 2.2 Layout Grid

| Breakpoint | Columns | Gutter | Margin (page edge) |
|------------|---------|--------|--------------------|
| `xs` | 4 | 16 px | 16 px |
| `sm` | 4 | 16 px | 24 px |
| `md` | 8 | 24 px | 32 px |
| `lg` | 12 | 24 px | 40 px |
| `xl` | 12 | 32 px | 48 px |
| `2xl` | 12 | 32 px | 80 px (content capped at 1440 px) |

### 2.3 Content Max-Width

```
Content containers: max-w-screen-xl (1280 px) centered with mx-auto
Prose / reading content: max-w-3xl (768 px)
Form pages (single-column): max-w-xl (576 px)
Full-bleed (tables, dashboards): 100% width with page margins
```

### 2.4 App Shell Layout

#### Mobile (`xs`/`sm`)
```
┌──────────────────────────┐
│  Top bar (56 px)         │  ← Logo + page title + overflow menu (⋮)
├──────────────────────────┤
│                          │
│  Page content            │  ← Scrollable
│  (full width)            │
│                          │
├──────────────────────────┤
│  Bottom nav bar (56 px)  │  ← 4–5 icon tabs (safe area aware)
└──────────────────────────┘
```

#### Tablet (`md`)
```
┌────────────────────────────────────┐
│  Top bar (64 px)                   │
├──────────┬─────────────────────────┤
│ Sidebar  │  Page content           │
│ (240 px) │  (scrollable)           │
│ icons +  │                         │
│ labels   │                         │
└──────────┴─────────────────────────┘
```

#### Desktop (`lg`+)
```
┌──────────────────────────────────────────┐
│  Top bar (64 px)                         │
├─────────────┬────────────────────────────┤
│  Sidebar    │  Page content              │
│  (256 px)   │  (max-w-screen-xl, capped) │
│  expanded   │                            │
│  persistent │                            │
└─────────────┴────────────────────────────┘
```

---

## 3 — TYPOGRAPHY SYSTEM

### 3.1 Font Stack

```
Primary:   'Inter', system-ui, -apple-system, sans-serif
Mono:      'JetBrains Mono', 'Fira Code', monospace  ← used for formula display, code blocks
```

> Load Inter via `@fontsource/inter` (self-hosted, no Google Fonts external request). Include weights: 400, 500, 600, 700.

### 3.2 Type Scale

| Token | Size | Line height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display-xl` | 36 px / 2.25rem | 1.2 | 700 | Hero numbers, big stats |
| `display-lg` | 30 px / 1.875rem | 1.25 | 700 | Page hero titles |
| `heading-xl` | 24 px / 1.5rem | 1.3 | 600 | H1 on most pages |
| `heading-lg` | 20 px / 1.25rem | 1.35 | 600 | H2, section titles |
| `heading-md` | 16 px / 1rem | 1.4 | 600 | H3, card titles |
| `heading-sm` | 14 px / 0.875rem | 1.4 | 600 | Table column headers |
| `body-lg` | 16 px / 1rem | 1.6 | 400 | Default body text |
| `body-md` | 14 px / 0.875rem | 1.57 | 400 | Secondary body, list items |
| `body-sm` | 12 px / 0.75rem | 1.5 | 400 | Captions, timestamps, meta |
| `label-md` | 14 px / 0.875rem | 1 | 500 | Form labels, nav items |
| `label-sm` | 12 px / 0.75rem | 1 | 500 | Badges, tags, chips |
| `mono-md` | 14 px / 0.875rem | 1.5 | 400 | Numbers in tables, formula output |
| `mono-sm` | 12 px / 0.75rem | 1.5 | 400 | Code snippets |

### 3.3 Mobile Typography Rules

- **Minimum readable size**: 12 px (`body-sm`) — never go smaller on any device
- **Minimum tap label size**: 14 px (`body-md`) — all interactive text labels
- **Numeric values** (prices, dimensions): always `mono-md` (`font-variant-numeric: tabular-nums`) so decimal points align in lists and tables
- **Long numbers** (₹ prices): include thousands separator via `Intl.NumberFormat`; format server-side for locale

---

## 4 — COLOR SYSTEM & THEMES

### 4.1 Palette Tokens

```
-- Brand
--color-brand-50:   #eff6ff   (lightest tint)
--color-brand-100:  #dbeafe
--color-brand-500:  #3b82f6   (primary blue — CTA buttons)
--color-brand-600:  #2563eb   (hover state)
--color-brand-700:  #1d4ed8   (active / pressed state)

-- Neutral (surface, text)
--color-neutral-0:   #ffffff
--color-neutral-50:  #f8fafc
--color-neutral-100: #f1f5f9
--color-neutral-200: #e2e8f0
--color-neutral-300: #cbd5e1
--color-neutral-400: #94a3b8
--color-neutral-500: #64748b
--color-neutral-700: #334155
--color-neutral-900: #0f172a   (primary text)

-- Semantic
--color-success-500: #22c55e
--color-success-100: #dcfce7
--color-warning-500: #f59e0b
--color-warning-100: #fef3c7
--color-error-500:   #ef4444
--color-error-100:   #fee2e2
--color-info-500:    #0ea5e9
--color-info-100:    #e0f2fe
```

### 4.2 Semantic Surface Tokens

| Token | Light value | Dark value |
|-------|-------------|------------|
| `surface-page` | `neutral-50` | `neutral-950` |
| `surface-card` | `neutral-0` | `neutral-900` |
| `surface-raised` | `neutral-0` shadow | `neutral-800` |
| `surface-sunken` | `neutral-100` | `neutral-950` |
| `surface-overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` |
| `text-primary` | `neutral-900` | `neutral-50` |
| `text-secondary` | `neutral-500` | `neutral-400` |
| `text-disabled` | `neutral-400` | `neutral-600` |
| `border-default` | `neutral-200` | `neutral-700` |
| `border-strong` | `neutral-300` | `neutral-600` |

### 4.3 Color Contrast Requirements (WCAG 2.1 AA)

| Foreground | Background | Minimum ratio | Status |
|-----------|------------|---------------|--------|
| `text-primary` on `surface-page` | `neutral-900` / `neutral-50` | 7:1 | ✅ AAA |
| `text-secondary` on `surface-page` | `neutral-500` / `neutral-50` | 4.5:1 | ✅ AA |
| White text on `brand-500` | 3.07:1 | ❌ Fail on small text | Use `brand-600` (#2563eb) for white text |
| White text on `brand-600` | 4.74:1 | ✅ AA |
| `error-500` icon on white | 3.1:1 | ❌ Fail | Pair with error text label — never use color alone |

> **Rule**: Never use color as the sole means of conveying information. All status indicators (success, error, warning) must include an icon AND a text label in addition to color.

### 4.4 Status Color Usage

| Status | Color | Icon | Usage |
|--------|-------|------|-------|
| Success / Active | `success-500` | ✓ CheckCircle | Saved, sent, accepted |
| Warning / Review needed | `warning-500` | ⚠ AlertTriangle | AI confidence medium, draft rows |
| Error / Failed | `error-500` | ✕ XCircle | Validation failed, push failed |
| Info / In-progress | `info-500` | ℹ Info | Processing, loading, AI extracting |
| Neutral / Draft | `neutral-400` | ○ Circle | Draft, unsent, pending |

---

## 5 — SPACING & DENSITY

### 5.1 Spacing Scale (4-px base unit)

```
0.5 →  2 px    (divider gaps)
1   →  4 px    (inline icon-to-label gap)
2   →  8 px    (tight component inner padding)
3   →  12 px   (input inner padding vertical)
4   →  16 px   (standard component padding, grid gap mobile)
5   →  20 px   (form field gap)
6   →  24 px   (card padding, section gap)
8   →  32 px   (section spacing)
10  →  40 px   (large section spacing)
12  →  48 px   (page section spacing desktop)
16  →  64 px   (hero spacing)
```

### 5.2 Density Modes

The app supports two density modes, switchable per-user in profile settings:

| Mode | Component padding | Row height | Table cell | Default for |
|------|------------------|------------|-----------|-------------|
| **Compact** | `p-3` (12 px) | 40 px | 36 px | Desktop power users; default |
| **Comfortable** | `p-4` (16 px) | 52 px | 44 px | Touch-first; auto-set on mobile (`md` and below) |

> Mobile devices always use Comfortable density regardless of the user setting.

### 5.3 Vertical Rhythm

```
Within a card:        gap-4   (16 px between elements)
Between form fields:  gap-5   (20 px)
Between cards:        gap-4 md:gap-6
Between page sections: gap-8 md:gap-12
```

---

## 6 — NAVIGATION PATTERNS

### 6.1 Mobile — Bottom Navigation Bar

5 tabs maximum. More items go into an overflow drawer accessible via the last tab.

| Tab | Icon | Label |
|-----|------|-------|
| 1 | Calculator | Quote |
| 2 | FileText | Quotes |
| 3 | BarChart2 | Reports |
| 4 | Folder | Documents |
| 5 | Menu | More |

**Rules:**
- Tab bar height: 56 px + safe area inset (CSS `env(safe-area-inset-bottom)`)
- Active tab: filled icon + `brand-500` label
- Inactive tab: outline icon + `neutral-400` label
- Badge count (notification dots): max `9+` display; red dot no number for simple new items
- Never use text-only tabs on mobile (icon + label minimum)

### 6.2 Mobile — Top Bar

```
Height: 56 px (+ safe-area-inset-top on notched phones)
Left:   Back arrow (when inside a sub-page) OR app logo (root pages)
Center: Page title (heading-md, truncated with ellipsis)
Right:  1–2 icon actions only (e.g. Search, Filter) + overflow menu (⋮)
```

**Rule**: Maximum 3 actionable elements in the top bar (back + 2 right icons). Additional actions go in the overflow menu.

### 6.3 Desktop — Sidebar

```
Width: 256 px (expanded) / 64 px (collapsed icon-only mode)
Toggle: Pin icon at the top of sidebar; state persisted in localStorage
```

**Sidebar sections** (with visual separators):

```
WORKSPACE
  ─ Calculator
  ─ My Quotes
  ─ Bulk Import

CLIENTS
  ─ Party Profiles
  ─ Documents

SALES
  ─ Follow-Ups
  ─ Price Increases
  ─ Templates

REPORTS
  ─ Reports

SETTINGS (bottom-pinned)
  ─ Masters
  ─ Team
  ─ AI & Extraction
  ─ Integrations
  ─ Account
```

Active item: `brand-50` background + `brand-600` left border (4 px) + `brand-700` text.

### 6.4 Breadcrumbs (Desktop Only)

Show breadcrumbs on any page deeper than 2 levels:
```
Home  /  Quotes  /  Q-2024-089  /  Items
```

- Separator: `/` in `neutral-300`
- Current page (last crumb): `text-primary`, non-clickable
- Ancestors: `text-secondary`, clickable links
- Max 4 crumbs; collapse middle crumbs with `...` if longer

### 6.5 Search (Global)

Accessible via:
- Desktop: keyboard shortcut `Cmd/Ctrl + K` → opens command palette overlay
- Mobile: search icon in top bar → opens full-screen search view

Search results show: quotes, parties, items — grouped by type with clear section labels.

---

## 7 — TOUCH & CLICK TARGETS

### 7.1 Minimum Target Sizes

| Interaction type | Minimum size | Notes |
|-----------------|-------------|-------|
| Touch (mobile) | 44 × 44 px | Apple HIG / WCAG 2.5.5 AAA |
| Mouse (desktop) | 24 × 24 px | WCAG 2.5.8 AA (32 px recommended) |
| Inline text link | Full line-height hit area | Use `display: inline-block` padding to extend |
| Toggle / checkbox | 44 × 44 px tap zone | Extend beyond the visual element with padding |

**Rule**: If a visible element is smaller than 44 px (e.g. a 16 px icon), add transparent padding to extend the tap zone to 44 × 44 px without changing the visual size.

```css
/* Example: 16px icon with 44px tap zone */
.icon-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 7.2 Spacing Between Targets

Minimum 8 px gap between adjacent tap targets. Inline tags/badges inside a list row: use 4 px gap with extra padding per badge.

### 7.3 Gesture Support

| Gesture | Action |
|---------|--------|
| Swipe left on list row | Reveal quick actions (delete, archive) |
| Pull to refresh | Refresh list content (with spinner) |
| Pinch-zoom | Permitted on document viewer / PDF preview only |
| Long press | Show context menu (alternative to right-click) |
| Swipe down on bottom sheet | Dismiss the sheet |

All gestures must have a non-gesture equivalent (button in overflow menu).

---

## 8 — FORM DESIGN

### 8.1 Input Field Anatomy

```
[Label] — 14px/500 — above field, always visible (never placeholder-only labels)
[Input]
  ├─ Border: 1.5px neutral-300 → focus: 2px brand-500 ring
  ├─ Border-radius: 8px (rounded-lg)
  ├─ Height: 44px (comfortable) / 36px (compact)
  ├─ Padding: px-3 py-2.5
  └─ Font: body-md
[Helper text] — 12px neutral-500 — below field
[Error message] — 12px error-500 + error icon — replaces helper text on error
```

### 8.2 Input Type Mapping

| Data type | HTML input | `inputmode` | Notes |
|-----------|-----------|-------------|-------|
| Price / cost | `number` | `decimal` | `min="0"` `step="0.01"` |
| Dimensions (L/W/H mm) | `number` | `decimal` | `min="1"` `step="1"` |
| GSM / BF weight | `number` | `numeric` | Integer only; `step="1"` |
| Quantity | `number` | `numeric` | `min="1"` `step="1"` |
| Email | `email` | `email` | |
| Phone | `tel` | `tel` | |
| Percentage | `number` | `decimal` | `min="0"` `max="100"` `step="0.01"` |
| Search | `search` | `search` | |
| Free text | `text` | — | |
| Long text / notes | `textarea` | — | `rows="3"` minimum; auto-resize |

> **Never use `type="number"` for inputs where spinners (up/down arrows) are undesirable** — use `type="text" inputmode="decimal"` and validate manually for those cases.

### 8.3 Labels

- Always visible above the field — never inside the field as the only label (placeholder is supplementary, not a label replacement)
- Required fields: mark with `*` after the label text; explain `"* Required"` once per form above the first required field — not per field
- Optional fields: explicitly label `(optional)` in muted text after the label

### 8.4 Validation Timing

| Phase | Rule |
|-------|------|
| On blur (field loses focus) | Validate individual field |
| On change (after first blur) | Re-validate live as user types |
| On submit | Re-validate all fields; focus the first error field |
| Never | Validate on initial focus (before user types) |

### 8.5 Error Messages

- Place error message directly below the field it refers to
- Error text: 12 px, `error-500`, preceded by `⚠` icon
- Field border turns `error-500` (2 px)
- Do not use only red border without text — always explain what is wrong
- Error text must be constructive: `"BF value must be between 14 and 40"` not `"Invalid BF value"`

### 8.6 Mobile Form Layout

- Single-column layout always on `xs`/`sm`
- Two-column grid allowed at `md`+ for related pairs (L × W × H, GSM + Shade)
- Full-width submit button on mobile (not right-aligned)
- Sticky submit button at the bottom of long forms (position: sticky bottom-0)

```
Mobile form submit area:
┌────────────────────────────────┐
│  [Secondary action — text btn] │
│  [Primary action — full width] │
│  ──── safe area inset ────     │
└────────────────────────────────┘
```

### 8.7 Select / Dropdown

- Use native `<select>` on mobile for OS-native picker (faster interaction)
- Use custom Combobox / Listbox on desktop for better search and keyboard support
- Searchable select (Combobox) mandatory when list has >10 items (e.g., paper shade list, party list)

### 8.8 Number Stepper (Quantity / Markup %)

For small-range integers, use a stepper component:
```
  [−]  [  42  ]  [+]
```
- `−`/`+` buttons: 44 px touch targets
- Input in center: editable directly, `inputmode="numeric"`
- Stepper used for: quantity (1–9999), GST % (0–28)
- Not used for: prices, dimensions (use plain numeric input instead)

---

## 9 — DATA TABLES & LISTS

### 9.1 Table vs List Card Decision

| Condition | Pattern |
|-----------|---------|
| `xs`/`sm` — any tabular data | **Card list** — one card per row, key fields visible |
| `md`+ — up to 6 columns | **Responsive table** — all columns visible |
| `md`+ — 7+ columns | **Responsive table** with horizontal scroll + sticky first column |
| Dashboard summary data | **Stats cards** (not tables) on mobile |

### 9.2 Responsive Table Rules

- First column (item name / quote number): **sticky left** on horizontal scroll
- Last column (action): **sticky right** — always visible even when table scrolls
- Horizontal scroll container has a right gradient fade (`::after` pseudo-element) to hint scrollability
- Table header: `heading-sm`, `neutral-700`, sticky top when table body scrolls vertically
- Column alignment:
  - Text columns: left-aligned
  - Numeric columns (price, quantity, %, dimensions): **right-aligned**, `font-variant-numeric: tabular-nums`
  - Status/badge columns: center-aligned
  - Action column: center-aligned

### 9.3 Mobile Card List Pattern

Each row becomes a card:
```
┌─────────────────────────────────────┐
│  [Main label]          [Status badge]│
│  [Sub-label / secondary info]        │
│  ─────────────────────────────────── │
│  [Key metric 1]     [Key metric 2]   │
│                     [Action chevron] │
└─────────────────────────────────────┘
```

Tap anywhere on the card navigates to the detail view. The chevron (`›`) is a visual affordance, not a separate tap target.

### 9.4 Quote Items List (Core pattern for calculator)

On mobile, each quote item card shows:
```
┌────────────────────────────────────────┐
│ 📦 RSC Box — Item 1        [Draft ○]  │
│ 300×200×150 mm  |  BF 18  |  Kraft    │
│ ─────────────────────────────────────  │
│ Cost: ₹12.40/box     Qty: 1,000 boxes  │
│ Total: ₹12,400                [›]      │
└────────────────────────────────────────┘
```

Swipe left: reveal "Edit" (brand-500) and "Delete" (error-500) actions.

### 9.5 Empty States in Tables

When a table/list has no data:
```
     [Illustration — subtle, single-color SVG]
          No quotes yet
     Start by creating your first quote.
          [+ Create Quote]   ← CTA button
```

- Illustration max height: 120 px
- Heading: `heading-md`
- Body: `body-md`, `neutral-500`
- CTA: primary button

### 9.6 Sorting & Filtering

- Sort: click column header on desktop; bottom sheet sort panel on mobile
- Filter: filter icon opens filter drawer (both platforms)
- Active filters: shown as dismissible chips below the search bar
- "Clear all" link when any filter is active

---

## 10 — MODALS, DRAWERS & SHEETS

### 10.1 When to Use Each

| Pattern | Use when | Mobile | Desktop |
|---------|----------|--------|---------|
| **Bottom sheet** | Quick action, short form (≤3 fields), confirmation | ✅ Primary | Use modal |
| **Drawer (side panel)** | Contextual detail, filter panel, long settings form | Slides from bottom (full-screen) | Slides from right (480 px wide) |
| **Modal dialog** | Destructive confirmation, isolated workflow | Centered (90 vw) | Centered (480–600 px) |
| **Inline expand** | Accordion, nested detail within a list | ✅ Preferred | ✅ Preferred |
| **Full-screen takeover** | Multi-step form (3+ steps), rich editor, PDF viewer | ✅ Required | Avoid (use drawer or page navigation) |

### 10.2 Bottom Sheet Rules (Mobile)

- Drag handle: 4 × 36 px rounded pill, centered, `neutral-300`, 8 px from top
- Default height: `50 vh` (snaps to `90 vh` on drag up)
- Dismiss: drag down past `25%` of sheet height OR tap backdrop
- Always include a visible "Close" (✕) icon at top-right in addition to drag-to-dismiss
- Scroll within sheet: sheet is internally scrollable once at max height; does not compete with page scroll
- Do not open a bottom sheet from inside another bottom sheet (one level max)

### 10.3 Modal Dialog Rules

- Backdrop: `rgba(0,0,0,0.4)`, click to dismiss only for non-destructive modals
- Width: 90 vw on mobile (max 480 px); fixed 480 px on desktop
- Border-radius: 16 px (`rounded-2xl`)
- Close button (✕): always present top-right, even if modal has a Cancel button
- Focus trap: keyboard focus stays within modal
- Escape key: dismisses modal (unless destructive action is in progress)
- Scroll: modal content scrolls internally; viewport does not scroll behind modal
- Animation: fade + scale up (`scale-95` → `scale-100`, 150 ms ease-out)

### 10.4 Confirmation Dialogs

Destructive confirmation pattern (e.g., "Delete Quote"):
```
┌────────────────────────────────┐
│  Delete Quote?                 │  ← heading-lg
│                                │
│  This will permanently delete  │  ← body-md, neutral-700
│  Q-2024-089 and all its items. │
│  This cannot be undone.        │
│                                │
│  [Cancel]   [Delete]           │  ← Cancel: ghost; Delete: error-500 filled
└────────────────────────────────┘
```

- Primary action for destructive operations: `error-500` background, white text
- Button order on mobile: Cancel (left), Destructive action (right)
- Never auto-focus the destructive button

---

## 11 — LOADING, EMPTY & ERROR STATES

### 11.1 Loading Patterns

| Duration | Pattern |
|----------|---------|
| < 300 ms | No loader shown (prevents flash) |
| 300 ms – 1 s | Skeleton screen (content shape placeholder) |
| 1 s – 5 s | Skeleton screen + subtle spinner in top bar |
| > 5 s | Progress indicator with message ("Extracting 24 items…") |

**Skeleton screens**: match the shape of the real content (card skeletons for card lists, row skeletons for tables). Use a shimmer animation (`background: linear-gradient(90deg, neutral-100, neutral-200, neutral-100)` with `animation: shimmer 1.5s infinite`).

**Never use a full-page blocking spinner** for operations < 5 s. Use inline skeleton or optimistic UI.

### 11.2 Optimistic Updates

For actions with high success probability (save, send, add item):
1. Update UI immediately as if the action succeeded
2. Send request in the background
3. On error: roll back UI change + show error toast
4. Examples: adding a quote item, marking a follow-up as sent, toggling a feature

### 11.3 Error States

**Page-level error** (e.g., failed to load quotes list):
```
     [Error illustration]
     Couldn't load quotes
     Check your connection and try again.
          [Retry]
```

**Inline API error** (form submit failure):
- Show a non-modal alert banner at the top of the form (dismissible)
- Color: `error-100` background, `error-700` text, error icon

**Network offline indicator**:
- Persistent banner at top: `warning-100` background, `"You're offline — changes will sync when reconnected"`
- Does not block interaction; user can continue entering data

---

## 12 — NOTIFICATIONS & FEEDBACK

### 12.1 Toast / Snackbar

- Position: bottom-center on mobile; top-right on desktop
- Width: full-width minus 16 px margins on mobile; 360 px max on desktop
- Duration: 4 s auto-dismiss; 8 s for error toasts (user may need to read)
- Maximum 1 toast visible at a time; queue subsequent toasts
- Close button (✕): always present on error toasts; optional on success

| Type | Background | Icon | Auto-dismiss |
|------|-----------|------|-------------|
| Success | `success-100` | ✓ | 4 s |
| Error | `error-100` | ✕ | 8 s (stays until dismissed) |
| Warning | `warning-100` | ⚠ | 6 s |
| Info | `info-100` | ℹ | 4 s |

### 12.2 Inline Banners

Used for persistent states that need user attention but don't block interaction:

- AI extraction job in progress: `info-100` banner at top of bulk import page
- AI confidence warning on a draft row: `warning-100` inline row highlight
- Tally push failed: `error-100` inline row in push log
- Plan limit approaching (80% usage): `warning-100` banner in Settings → Billing

### 12.3 Badge Counts

- On nav tabs: red dot (no number) for ≤9 new items; `9+` for more
- Badge background: `error-500`; text: white 10 px
- Badge position: top-right of icon, 2 px outside the icon boundary
- On page: plain number badge in `neutral-100`/`neutral-700` for non-urgent counts

---

## 13 — CALCULATOR & COSTING UI

### 13.1 Input Section Layout (Mobile)

The calculator is the most-used screen. Layout optimized for single-hand use:

```
[Top bar: "New Quote Item"]          ← Back + title + Save button
─────────────────────────────
  Section: Box Specifications       ← Collapsible section header
  ┌─────────────┬──────────────┐
  │ Length (mm) │  Width (mm)  │    ← 2-col grid at sm+
  └─────────────┴──────────────┘
  ┌─────────────┐
  │ Height (mm) │                   ← Single field
  └─────────────┘
  BF Grade: [18 ▾]
  Paper Shade: [Kraft/Natural ▾]
─────────────────────────────
  Section: Costing Parameters       ← Collapsed by default; expand to show
─────────────────────────────
  Section: Result Summary           ← Sticky at bottom on mobile
  ┌─────────────────────────────────┐
  │ Cost/Box: ₹12.40                │
  │ Sell Price: ₹14.28    [Save]   │
  └─────────────────────────────────┘
```

### 13.2 Result Summary Card

Prominently displayed. Shows:

| Row | Value | Style |
|-----|-------|-------|
| Raw material cost | ₹X.XX / box | `body-md` |
| Conversion cost | ₹X.XX / box | `body-md` |
| **Total cost/box** | **₹X.XX** | `heading-lg`, `neutral-900` |
| Markup % | XX% | `body-md`, `neutral-500` |
| **Sell price/box** | **₹X.XX** | `heading-xl`, `brand-700` |
| Total for quantity | **₹XX,XXX** | `display-lg`, `brand-700` |

All monetary values: `mono-md`, right-aligned, `tabular-nums`.

### 13.3 Live Recalculation

- Formula engine runs on every field change (debounced 150 ms)
- While recalculating: result values show a subtle shimmer / opacity 0.4
- No "Calculate" button — always live
- On error (e.g., missing required field): show empty `—` in result row + inline field error

### 13.4 Costing Breakdown Accordion

Expandable section below the result card:
- Layer-by-layer paper cost table
- Each layer: paper type, GSM, width, weight (kg), rate (₹/kg), cost (₹/box)
- Toggle row: "Show formula breakdown" → reveals each formula step for auditability

---

## 14 — QUOTE BUILDER UI

### 14.1 Quote Item List

Multi-item quote: scrollable list of item cards above a sticky "Add Item" FAB.

**FAB (Floating Action Button)** on mobile:
- Position: bottom-right, 16 px from bottom edge + safe area
- Size: 56 px circular
- Icon: `+` (Plus)
- Color: `brand-600`
- Shadow: `shadow-lg`
- Only FAB is used for the primary add action on mobile — no additional "Add" button in the list header

### 14.2 Grouped Items UI

When items are grouped:
- Group header card: slightly elevated shadow, group name in `heading-md`, group total in `brand-700`
- Member items: indented 16 px, smaller card, `neutral-100` background
- Collapse/expand chevron on group header
- "Ungroup" action: overflow menu on the group header card (not a swipe action)

### 14.3 Quote Header Section

Collapsible top section:
- Party name (searchable select)
- Quote number (auto-generated, editable)
- Valid until (date picker — uses native date input on mobile)
- Company profile selector (if multiple profiles exist)

---

## 15 — DOCUMENT & FILE UI

### 15.1 Document Upload

**Drag-and-drop zone** on desktop:
```
┌─────────────────────────────────────────┐
│  📎  Drop files here or click to browse  │
│                                          │
│  PDF, Excel, JPEG, PNG · Max 20 MB      │
└─────────────────────────────────────────┘
```

**Mobile upload**: tap zone triggers the OS file picker (camera + files app). No drag-and-drop on mobile.

- Upload progress: inline progress bar per file (0–100%)
- Multiple file upload: allowed; queue shown as a list with individual progress
- Error per file: shown inline below the file name (e.g., "File too large — max 20 MB")
- Success: file replaced with a document thumbnail row

### 15.2 Document List Row

```
┌──────────────────────────────────────────┐
│ 📄  spec-brief-client-abc.pdf   [Category] │
│     1.2 MB  ·  Uploaded 2 May             │
│     Linked to: ABC Packaging Co.  [›]     │
└──────────────────────────────────────────┘
```

Swipe left: "Download" and "Delete" quick actions on mobile.

---

## 16 — PDF PREVIEW & OUTPUT UI

### 16.1 PDF Viewer

- Full-screen takeover on mobile (slide-up from bottom with `translateY` animation)
- Embedded `<iframe src="signed-url">` or `<embed>` for PDF rendering
- Controls bar at top: Close (✕), Download, Share
- Pinch-to-zoom enabled inside the viewer frame

### 16.2 Output Type Selector (before sending)

Before sending a quote via email or WhatsApp, user selects:
```
  ○ Customer PDF (commercial, no internal prices)
  ● Full Detail PDF (with per-box breakdown)
  ○ Spec Sheet only
```

On mobile: radio button group in a bottom sheet.

### 16.3 Send Confirmation Screen

```
To: contact@partyname.com
Subject: Quotation — Q-2024-089
         [Preview email]   [Edit]
         [Send Quote]  ← full-width primary button
```

---

## 17 — REPORTS & ANALYTICS UI

### 17.1 Summary Stats Row

At the top of the Reports page, 3–4 stat cards in a horizontal scroll row on mobile:

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  Quotes │ │ Revenue │ │Accepted │ │Avg Cost │
│    42   │ │ ₹2.4L   │ │  68%    │ │ ₹11.20  │
│ this mo │ │ this mo │ │         │ │  /box   │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
← horizontal scroll on mobile →
```

On desktop: 4-column grid, no horizontal scroll.

### 17.2 Date Range Picker

- Preset options: Today, This week, This month, Last 3 months, Custom
- Custom range: uses a calendar date picker (inline on desktop; bottom sheet on mobile)
- Selected range shown as a chip: `"1 Apr – 30 Apr"` with ✕ to clear

### 17.3 Charts

- Bar chart: revenue by month
- Library: **Recharts** (lightweight, responsive, accessible)
- Responsive container: `<ResponsiveContainer width="100%" height={240}>`
- Chart tooltips: custom-styled to match design system
- Fallback: show a data table below the chart (accessibility + no-JS)

---

## 18 — BULK IMPORT UI

### 18.1 Step Indicator

Bulk import uses a 4-step wizard. Show step progress:

```
Desktop: [1 Upload] → [2 Review] → [3 Approve] → [4 Done]
Mobile:  "Step 2 of 4 — Review"  (compact text indicator, no full stepper)
```

### 18.2 Draft Row Review Table

Each draft row is a review card on mobile / table row on desktop.

Confidence indicator (AI-sourced rows):
- High (≥ 0.85): green dot + "Auto-accepted"
- Medium (0.60–0.84): amber dot + "Needs review" — row is expanded by default
- Low (< 0.60): red dot + "Blocked — correct manually" — row highlighted in `error-100`

Each medium/low row shows:
- All extracted fields with inline edit capability
- Per-field confidence chip (e.g., `"BF: 73%"` in `warning-100`)
- "Accept anyway" and "Reject" actions per row
- Corrected fields flagged as `user_corrected: true` (for pattern learning)

### 18.3 Bulk Action Bar

When rows are checked:
```
[✓ 12 rows selected]  [Accept all]  [Reject all]  [More ▾]
```

Sticky at the top of the review table, replacing the column header area.

---

## 19 — ADMIN / SETTINGS UI

### 19.1 Settings Shell Layout

#### Desktop two-panel layout
```
┌──────────────────────┬────────────────────────────────────────┐
│  Settings nav        │  Content panel                         │
│  (240 px)            │  max-w-2xl, scrollable independently   │
│  ────────────────    │                                        │
│  WORKSPACE           │  [Page heading]                        │
│  ▶ Masters      ›    │  [Section subheading]                  │
│    ▸ Paper           │  [Form / grid content]                 │
│    ▸ Flute           │                                        │
│    ▸ Tax & Biz       │  [Save Changes]  ← sticky bottom       │
│    ▸ Quote Terms     │                                        │
│    ▸ Email           │                                        │
│  ────────────────    │                                        │
│  COMPANY             │                                        │
│  ▶ Profile      ›    │                                        │
│  ────────────────    │                                        │
│  TEAM                │                                        │
│  ▶ Members      ›    │                                        │
│  ▶ Invitations  ›    │                                        │
│  ────────────────    │                                        │
│  SALES & AI          │                                        │
│  ▶ AI & Extraction ► │                                        │
│  ▶ Automation   ►    │                                        │
│  ▶ Templates    ►    │                                        │
│  ▶ Client Pricing►   │                                        │
│  ────────────────    │                                        │
│  INTEGRATIONS        │                                        │
│  ▶ Tally        ►    │                                        │
│  ────────────────    │                                        │
│  ACCOUNT             │                                        │
│  ▶ Billing      ►    │                                        │
│  ▶ Audit Log    ►    │                                        │
└──────────────────────┴────────────────────────────────────────┘
```

- Active nav item: `brand-50` background + 4 px `brand-600` left border
- Section group labels: `label-sm`, `neutral-400`, uppercase, 8 px letter-spacing
- Nested expand/collapse: single level only; expand state persisted in `localStorage`
- Content panel: independently scrollable; sidebar stays fixed
- "Save Changes" button: `sticky bottom-0 py-4 bg-surface-card border-t border-default`; only visible when that section has a form

#### Mobile layout
- Settings nav renders as a **flat list of cards** — one card per section group
- Tap a group → push-navigate to a sub-page showing its items
- Tap an item → push-navigate to the full-screen settings form
- Back arrow always visible top-left
- No sticky save button; submit button at bottom of each form, full-width

---

### 19.2 Admin Dashboard / Overview

First page after login for `owner` or `admin` roles. Surfaces key health metrics at a glance.

#### Layout
```
[Top bar: BoxCostPro  |  tenant name  |  [avatar]]
────────────────────────────────────────────────────
  [Welcome back, Ravi]         [Date range: This month ▾]

  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Quotes   │ │ Revenue  │ │ Accepted │ │ Pending  │
  │   42     │ │  ₹2.4L   │ │  68%     │ │   11     │
  │ +8 today │ │ ↑ 12%    │ │          │ │follow-ups│
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  ← 4-col grid desktop / 2-col tablet / horizontal scroll mobile →

  ┌──────────────────────┐  ┌──────────────────────┐
  │  Revenue by month    │  │  Top salespersons    │
  │  [Bar chart]         │  │  1. Ravi   ₹82,000   │
  │                      │  │  2. Priya  ₹61,000   │
  │                      │  │  3. Anil   ₹44,000   │
  └──────────────────────┘  └──────────────────────┘
  ← 2-col on lg+ / single col stacked on mobile →

  ┌──────────────────────────────────────────────────┐
  │  Recent Activity (last 10 audit events)          │
  │  [Row]  [Row]  [Row]        [View full log →]    │
  └──────────────────────────────────────────────────┘
```

**Stat cards:**
- Value: `display-xl`, `neutral-900`
- Delta badge (↑ 12%): `success-100`/`error-100` + arrow icon
- Sub-label: `body-sm`, `neutral-500`
- Card: `surface-card`, `rounded-xl`, `shadow-sm`, `p-5`
- On mobile: 2×2 grid; horizontal scroll row if >4 stats

**Activity feed:**
- Max 10 rows on dashboard; "View full log" links to Audit Log page
- Each row: icon + actor name + action text + relative timestamp ("2 hours ago")
- Timestamp: `body-sm`, `neutral-400`, right-aligned

---

### 19.3 Master Data Grids

All master data (Paper rates, BF prices, Flute settings, Shade premiums, Tax defaults) uses an **inline-editable grid**, not individual modals.

#### Grid component rules
- Desktop: full `<table>` with inline-edit cells
- Mobile (xs/sm): **stacked card per row** (Pattern 4 from §9); tap a card → opens a bottom sheet with that row's fields
- Each editable cell: click/tap → turns into an `<input>` in-place; blur → validates and marks dirty
- Dirty cells: `warning-100` background until saved
- "Save All" button: sticky bottom; disabled when no changes; `brand-600` filled when changes exist
- "Discard changes" text link next to Save All
- Unsaved changes indicator: amber dot on the left-nav item label

#### Add / Delete rows
- Add row: `[+ Add row]` button below the last row — inserts empty inline row, focus on first cell
- Delete row: trash icon far right; inline confirmation tooltip "Delete this row?" for 3 s; second click confirms
- Rows with linked FK data: delete blocked — show "Used in X quotes — cannot delete" inline error

#### Sections covered
| Section | Key columns | Notes |
|---------|------------|-------|
| Paper Rates | Shade, GSM, Rate (₹/kg) | Rate right-aligned mono |
| BF Prices | BF value, Rate (₹/kg) | Integer BF |
| Flute Settings | Flute code, ratio, waste % | Ratio 2 decimal places |
| Shade Premiums | Shade, Premium ₹/kg | Can be 0 |
| Tax & Business | GST %, default markup % | Single-row form, not a grid |
| Quote Terms | Title, body text | Textarea per row |

---

### 19.4 Team & User Management

#### Member list (desktop table / mobile cards)
```
Desktop columns:
[Avatar+Name]  [Email]  [Role badge]  [Status]  [Last active]  [Actions ⋮]

Mobile card:
┌──────────────────────────────────────┐
│ [Av] Priya Sharma         [Manager]  │
│      priya@abc.com                   │
│      Last active: 3 hours ago   [⋮]  │
└──────────────────────────────────────┘
```

- Role badge color-coded pills:
  - Owner: `brand-100` / `brand-700`
  - Admin: `warning-100` / `warning-700`
  - Manager: `info-100` / `info-700`
  - Salesperson: `neutral-100` / `neutral-700`
  - Viewer: `neutral-100` / `neutral-500`
- Status badge: Active `success-100` / Invited `info-100` / Suspended `error-100`
- Actions overflow menu (⋮): Change role / Suspend / Remove

#### Filters
- Filter chips: All | Active | Invited | Suspended
- Search by name or email (inline input)

#### Invite button
- Desktop: `[+ Invite Member]` top-right
- Mobile: FAB `+` bottom-right (same pattern as quote builder)

---

### 19.5 Invitation Flow UI

**Trigger**: `[+ Invite Member]` / FAB → bottom sheet (mobile) or modal (desktop):

```
┌────────────────────────────────────────┐
│  Invite a team member                  │
│                                        │
│  Email *                               │
│  [___________________________]         │
│                                        │
│  Role *                                │
│  [Manager              ▾]              │
│                                        │
│  [Cancel]          [Send Invite]       │
└────────────────────────────────────────┘
```

- Role select: shows only roles the current user can assign (owner → all; admin → cannot assign owner)
- On success: row appears immediately with status `Invited` (optimistic update)
- Invitation expires in 7 days — expiry date shown in the Invited row
- Resend invite: overflow menu → `Resend` → success toast
- Revoke invite: overflow menu → `Revoke` → inline confirmation tooltip

**Accept invite page (recipient):**
- Standalone page, no auth required to view
- Shows: company name, inviter name, role offered
- `[Accept Invitation]` → prompts to create password → logs in
- Expired invite: error state with `[Request new invite]` link

---

### 19.6 Role & Permission UI

Read-only permission matrix. Visible to `owner` and `admin` only.

```
Desktop:
┌──────────────────────┬───────┬───────┬─────────┬─────────────┬────────┐
│  Action              │ Owner │ Admin │ Manager │ Salesperson │ Viewer │
├──────────────────────┼───────┼───────┼─────────┼─────────────┼────────┤
│  Create quote        │   ✓   │   ✓   │    ✓    │      ✓      │   —    │
│  Delete quote        │   ✓   │   ✓   │    —    │      —      │   —    │
│  View all quotes     │   ✓   │   ✓   │    ✓    │  Own only   │  Own   │
│  Manage masters      │   ✓   │   ✓   │    —    │      —      │   —    │
│  Invite members      │   ✓   │   ✓   │    —    │      —      │   —    │
│  View audit log      │   ✓   │   ✓   │    —    │      —      │   —    │
└──────────────────────┴───────┴───────┴─────────┴─────────────┴────────┘
```

- ✓ = full access; `—` = no access; `Own only` = scoped to user's records
- Mobile: stacked label:value per action (Pattern 4) — too many columns for mobile table
- Not editable in UI (roles are fixed; custom roles not supported in V3)
- Help tooltip `?` next to each role heading shows a one-line role summary

---

### 19.7 Audit Log UI

Full audit trail. Accessible by `owner` and `admin` only.

#### Layout
```
[Search ____]  [Date range ▾]  [Event type ▾]  [Actor ▾]  [Export CSV]
──────────────────────────────────────────────────────────────────────────
[Audit row]
[Audit row]
...
[Virtual scroll / Load more]
```

#### Audit row anatomy
```
Desktop:
[Icon]  [Actor name]  [Action description]             [Entity]  [Time]
  ✎     Priya Sharma  Updated BF price: 18 → ₹52.00   Paper     2 h ago

Mobile card:
┌──────────────────────────────────────────┐
│ ✎  Priya Sharma              2 hours ago │
│    Updated BF price: 18 → ₹52.00         │
│    Entity: Paper master                  │
└──────────────────────────────────────────┘
```

- Event icons: Create `+` `success-500` / Update pencil `info-500` / Delete trash `error-500` / Auth key `neutral-500` / AI sparkle `brand-500` / Export download `neutral-500`
- Timestamps: relative ("2 hours ago") with absolute tooltip on hover/long-press
- Update descriptions show old → new values: `"18 → ₹52.00"`
- Virtualized list (infinite scroll mobile; 50-row pages desktop)

#### Filters
- Event type multi-select: Create / Update / Delete / Auth / AI / Export
- Date range chips: Today / Last 7 days / Last 30 days / Custom
- Actor: searchable dropdown of team members
- Active filters: dismissible chips row

#### Export
- `[Export CSV]` button top-right (desktop) / overflow menu (mobile)
- Exports currently-filtered view
- Plan-gated: Business and above; Starter sees locked state + upgrade prompt

---

### 19.8 Billing & Plan UI

#### Plan overview card
```
┌──────────────────────────────────────────────────────────┐
│  Current Plan: Business                   [Upgrade ▸]    │
│  Renews: 1 June 2026                                     │
│  ─────────────────────────────────────────────────────   │
│  Quotes used this month                                  │
│  [████████████░░░░░░░]  240 / 500           48%          │
│                                                          │
│  Team members                                            │
│  [██████░░░░░░░░░░░░░]  3 / 10              30%          │
│                                                          │
│  AI extractions this month                               │
│  [███████████████░░░░]  38 / 50             76%          │
│  ⚠ Approaching limit                                    │
└──────────────────────────────────────────────────────────┘
```

- Usage bars: `brand-500` fill; `neutral-200` track; `warning-500` fill when > 80%
- `⚠ Approaching limit`: `warning-100` inline banner when any metric > 80%
- `[Upgrade ▸]`: `brand-600` filled; always visible

#### Plan comparison table
- Columns: Starter / Business / Enterprise — current plan column highlighted `brand-50`
- Mobile: horizontal scroll (Pattern 3 from §9) with current plan column sticky
- Feature rows: quote limit, team size, AI extractions, Tally, bulk import, audit log, CSV export, templates

#### Billing history table
- Columns: Date / Invoice # / Amount / Status / Download PDF
- Status: Paid `success-100` / Due `warning-100` / Failed `error-100`
- Mobile: card per invoice row

---

### 19.9 AI & Extraction Config UI

Two collapsible accordion sub-sections on the AI & Extraction settings page.

**Sub-section A — AI Engine Config**
```
  Confidence thresholds
  ─────────────────────
  Auto-accept threshold  [0.85]  ← numeric, 0.00–1.00, step 0.01
  Review gate threshold  [0.60]

  Fallback behaviour
  ──────────────────
  When AI blocked:  ○ Block row   ● Require manual entry

  AI provider
  ───────────
  Model: [GPT-4o (default)  ▾]
  API key: [••••••••••••]  [Rotate key]
  [Test connection]  →  ✓ Connected  or  ✕ Failed — error text inline
```

**Sub-section B — Pattern Learning**
```
  Tenant-local patterns    [● Enabled]
  Contribute to global     [○ Disabled]  ← opt-in; shows privacy note when toggled on

  Pattern library
  ───────────────
  142 patterns saved   [View patterns ▸]   [Clear all patterns]

  Privacy note (shown when global opt-in enabled):
  ┌───────────────────────────────────────────────────────┐
  │  ℹ  Contributed patterns are fully anonymized.       │
  │     No client names, prices, or quantities shared.   │
  └───────────────────────────────────────────────────────┘
```

- All toggles: 44 px touch target; `brand-500` when on
- `[Test connection]`: inline result below button; spinner during test (10 s timeout)
- `[Clear all patterns]`: outlined `error-500` → confirmation bottom sheet (mobile) / modal (desktop)

---

### 19.10 Template Editor UI

#### Template list page
```
[+ New Template]                            [Channel: All ▾]
──────────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────┐
│ 📧 Quote Sent — Standard      [Email]  [Default ✓]     │
│    Last edited 2 May · Used in 38 emails          [⋮]  │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ 💬 Quote Follow-Up — Day 3    [WhatsApp]               │
│    Last edited 28 Apr · Used in 12 messages       [⋮]  │
└────────────────────────────────────────────────────────┘
```

- Channel badge: Email `info-100` / WhatsApp `success-100` / PDF `neutral-100`
- Default badge: `brand-100` — one default per channel type
- Overflow (⋮): Edit / Duplicate / Set as default / Delete
- Plan limit (Starter): 3 templates max; `[+ New Template]` disabled + upgrade tooltip when exceeded

#### Template editor (full-screen mobile / right-panel drawer desktop)
```
[Template name — editable inline]              [Preview]  [Save]
──────────────────────────────────────────────────────────────────
  Subject (email only): [__________________________________]

  ┌─ Toolbar ─────────────────────────────────────────────┐
  │  B  I  U  |  ≡ ≡ ≡  |  🔗  |  {{ }}  |  🖼           │
  └───────────────────────────────────────────────────────┘
  ┌─ Editor ──────────────────────────────────────────────┐
  │  Dear {{party_name}},                                 │
  │                                                       │
  │  Please find attached your quotation...               │
  └───────────────────────────────────────────────────────┘

  Variable picker:
  [{{party_name}}] [{{quote_number}}] [{{total}}]
  [{{valid_until}}] [{{salesperson_name}}]  [+ more]
```

- Rich editor: Tiptap or Quill; output sanitized HTML (bleach allowlist per §26 of 03-admin-flow-master)
- Variable chips: `neutral-100`; click inserts `{{variable}}` at cursor
- Preview: side-by-side on `lg`+; toggle tab on mobile; variable stubs shown as `brand-100` highlighted spans

---

### 19.11 Email Automation / Follow-Up Rules UI

#### Rules list
```
[+ New Rule]                        [3 active / 1 paused]
──────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────┐
│ Follow-up Rule 1               [● Active]    [⋮]   │
│ Trigger: Quote sent → Day 3, 7, 14             [›]  │
│ Template: Quote Follow-Up Standard                  │
└────────────────────────────────────────────────────┘
```

#### Rule editor (drawer desktop / full-screen mobile)
```
  Trigger event
  ─────────────
  [Quote Sent ▾]  →  after  [3]  days   [+ Add interval]
                             [7]  days   [✕]
                            [14]  days   [✕]

  Channel
  ───────
  ○ Email   ● WhatsApp   ○ Both

  Template
  ────────
  [Quote Follow-Up Standard ▾]

  Stop conditions
  ───────────────
  ☑ Quote accepted by client
  ☑ Client replies
  ☐ Manually stopped only

  [Cancel]                    [Save Rule]
```

- Day interval inputs: stepper chips; `[+ Add interval]` appends another
- Paused rules: toggle `[● Active / ○ Paused]` — no confirmation needed (reversible)
- Delete: overflow menu → `Delete` → confirmation bottom sheet / modal

---

### 19.12 Client-Wise Pricing Policies UI

#### Policy list
```
[+ New Policy]           [Search party _______________]
────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────┐
│ ABC Packaging Co.                          [›]   │
│ Client markup: 22%  ·  Floor: ₹8.00/box          │
└──────────────────────────────────────────────────┘
```

#### Policy editor (drawer / full-screen)
```
  Party
  ─────
  [ABC Packaging Co.  ▾]   ← searchable combobox

  ┌──────────────────────────────────────────────────┐
  │  ℹ  Price resolution order:                     │
  │  Global markup → Client markup → Discount →     │
  │  final_cost_per_box → Negotiated price →         │
  │  Floor check                                    │
  └──────────────────────────────────────────────────┘

  Client markup %    [22.00]   (overrides global if set)
  Client discount %  [——]      (optional)
  Floor price ₹/box  [8.00]    (sell price never below this)

  [Cancel]                    [Save Policy]
```

- Resolution order block: always visible, `info-100` background, read-only
- All numeric fields: `inputmode="decimal"`, right-aligned mono
- Delete: overflow menu → `Delete` → inline confirmation tooltip

---

### 19.13 Tally Integration Settings UI

```
  Connection
  ──────────
  Tally host     [localhost               ]
  Port           [9000]
  Protocol        ○ HTTP   ● HTTPS
  Company name   [My Company Pvt Ltd      ]  ← must match Tally exactly

  [Test Connection]  →  ✓ Connected to Tally 6.4.5
                     or  ✕ Connection refused — check host/port

  Push settings
  ─────────────
  Auto-push on invoice confirmed   [● Enabled]
  Default ledger group             [Sales ▾]
  Party ledger prefix              [BCP-]

  [Save Settings]
```

- `[Test Connection]`: `info-500` outlined; spinner during test (10 s timeout); result inline below button
- Security note (always visible, collapsible on mobile):
  ```
  ┌──────────────────────────────────────────────────────────┐
  │  ⚠  Tally must be on the same local network.            │
  │     Do not expose Tally's port to the public internet.  │
  └──────────────────────────────────────────────────────────┘
  ```
  `warning-100` background, `warning-700` text

---

### 19.14 Spec / Job Card / QA Template Controls UI

```
  Spec Sheet
  ──────────
  Show company logo        [● Yes  ○ No]
  Show pricing             [○ Yes  ● No]  ← default off
  Watermark text           [CONFIDENTIAL     ]  max 20 chars
  Preview: ░ CONFIDENTIAL ░  (live preview chip, neutral-300 italic)

  Job Card
  ────────
  Default production notes
  [__________________________________________________]
  [__________________________________________________]  ← textarea, 4 rows

  QA Report
  ─────────
  Default checklist items:
  [⠿]  Dimensions verified
  [⠿]  Print quality OK
  [⠿]  Ply count correct
       [+ Add item]

  [Save Settings]
```

- Watermark live preview chip updates as user types; max 20 chars enforced
- QA checklist reorder: drag handle `⠿` on desktop; up/down icon-buttons on mobile (44 px touch zone)

---

### 19.15 Platform Admin (Super-Admin) UI

Accessed by **Platform Admin** role only. Separate login at `/platform-admin`.

#### Tenant list
```
[Search tenants ___________]  [Plan ▾]  [Status ▾]
────────────────────────────────────────────────────
┌────────────────────────────────────────────────┐
│ tenant_id: t_abc123                [Business]  │
│ ABC Packaging — owner@abc.com       [Active ✓] │
│ Created 1 Jan 2025 · Last active 3h ago   [⋮]  │
└────────────────────────────────────────────────┘
```

- Overflow (⋮): View details / Impersonate / Suspend / Delete tenant
- "Impersonate" enters read-only tenant view with persistent non-dismissible banner:
  ```
  ┌─────────────────────────────────────────────────────────┐
  │  🔴  Platform Admin — Impersonating ABC Packaging       │
  │                                          [Exit ▸]       │
  └─────────────────────────────────────────────────────────┘
  ```
  `error-100` background; sticky top

#### Tenant detail tabs
- **Overview**: plan, usage metrics, error rate, last login
- **Members**: tenant member list (read-only)
- **Billing**: plan + payment history
- **Audit Log**: filtered to this tenant
- **Settings**: force plan change, reset passwords, suspend members

#### API key management
- Platform API key shown only once after generation (copy-to-clipboard field)
- `[Rotate Key]` → confirmation modal → shows new key → old key invalidated immediately
- Key never stored in plaintext after generation

---

### 19.16 Onboarding / First-Run Wizard

Shown to `owner` only on first login. 5 steps.

#### Step indicator
```
Desktop: [1 Company] → [2 Masters] → [3 Team] → [4 Try a Quote] → [5 Done]
Mobile:  "Step 1 of 5 — Company Profile"  (text indicator, no full stepper)
```

Progress bar: 4 px `brand-500` fill strip at top of wizard, animates forward per step.

**Step 1 — Company Profile**
```
  Company name  *  [______________________]
  GSTIN (opt.)     [______________________]
  Logo             [Upload logo]
  Address          [______________________]
                                  [Next →]
```

**Step 2 — Set Up Masters**
```
  "Paper and BF rates are pre-filled with Indian market defaults.
   Customize now or later."

  [Review Paper Rates]  [Review BF Prices]
  [Skip — use defaults]

             [← Back]  [Next →]
```

**Step 3 — Invite Your Team** (optional)
```
  [Email ____________]   [Role ▾]   [+ Add another]
  [Skip for now]
             [← Back]  [Next →]
```

**Step 4 — Create Your First Quote**
- Embedded mini-calculator (same component as §13, no navigation away)
- "Try entering a box dimension and see cost calculated live."
- "Save" on this step marks Step 4 complete; skip link available

**Step 5 — Done**
```
     ✓  You're all set!

  Profile saved · First quote ready · Share in one tap.

             [Go to My Quotes]
```

**Wizard rules:**
- Exit via `✕` top-right → "Exit setup? You can finish later in Settings." confirmation
- Wizard state persisted server-side; incomplete wizard shows Dashboard banner: "Complete your setup → [Continue]" until all 5 steps done
- Can re-run from Settings → Account → "Redo setup wizard"

---

### 19.17 Danger Zone

Present at the bottom of: Account settings page, individual member profile (for removal), and relevant master data pages.

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ Danger Zone                                              │
│  ──────────────────────────────────────────────────────────  │
│  Delete tenant account                                       │
│  Permanently removes all data, quotes, and team members.     │
│  This cannot be undone.               [Delete Account ▸]     │
│                                                              │
│  Export all data before deleting      [Export ZIP ▸]         │
└──────────────────────────────────────────────────────────────┘
```

Section background: `error-100`.

- `[Delete Account ▸]`: outlined `error-500` (NOT filled at this stage)
- `[Export ZIP ▸]`: `brand-600` outlined; no confirmation needed

**Final confirmation modal:**
```
┌──────────────────────────────────────────────────────────┐
│  Type your company name to confirm deletion              │
│  [__________________________________]                    │
│  [Cancel]                 [Delete Everything]            │
└──────────────────────────────────────────────────────────┘
```

- `[Delete Everything]`: filled `error-500`; disabled until exact company name is typed (case-insensitive, trimmed)
- Mobile: both buttons full-width, stacked; Cancel on top, Delete below

---

## 20 — ACCESSIBILITY (WCAG 2.1 AA)

### 20.1 Required Standards

BoxCostPro targets **WCAG 2.1 Level AA** compliance throughout.

### 20.2 Focus Management

- All interactive elements have a visible focus ring: `outline: 2px solid brand-500; outline-offset: 2px`
- Never suppress focus rings with `outline: none` without providing an alternative
- When a modal/sheet opens: focus moves to the first interactive element inside
- When a modal/sheet closes: focus returns to the element that triggered it

### 20.3 Screen Reader Support

- All icon-only buttons have `aria-label`
- Status badges have `role="status"` and descriptive `aria-label` (not just `"Active"` but `"Quote status: Active"`)
- Data tables use `<th scope="col">` and `<th scope="row">` correctly
- Form fields use `<label for="...">` or `aria-labelledby`
- Error messages linked to fields via `aria-describedby`
- Loading states: `aria-busy="true"` on the container; `aria-live="polite"` for background updates
- Destructive confirmations: `aria-modal="true"` on dialog; `role="alertdialog"` for warnings

### 20.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations must be disabled when `prefers-reduced-motion: reduce` is set.

### 20.5 Touch Accessibility

- Avoid requiring complex gestures (two-finger swipe, double-tap) for core functions
- All gestures have button equivalents
- Inputs show appropriate virtual keyboards (`inputmode` set — see §8.2)

---

## 21 — MOTION & ANIMATION

### 21.1 Principles

- Animations serve a purpose: communicate state change, guide attention, or provide feedback
- Never animate for decoration alone
- Duration: fast (100–200 ms) for micro-interactions; medium (250–400 ms) for layout changes; never > 500 ms for UI transitions

### 21.2 Standard Durations

| Motion type | Duration | Easing |
|-------------|----------|--------|
| Button press (scale) | 100 ms | ease-out |
| Toast appear | 200 ms | ease-out |
| Modal open | 200 ms | ease-out |
| Modal close | 150 ms | ease-in |
| Bottom sheet open | 300 ms | cubic-bezier(0.32, 0.72, 0, 1) |
| Bottom sheet close | 250 ms | ease-in |
| Page transition (mobile) | 300 ms | ease-in-out |
| Skeleton shimmer | 1500 ms | linear (loop) |
| Accordion expand | 200 ms | ease-out |

### 21.3 Page Transitions (Mobile)

Use a horizontal slide for forward/back navigation:
- Push (navigate deeper): current page slides left, new page slides in from right
- Pop (back): current page slides right, previous page reveals from left
- Root tab switch: cross-fade (no slide) — avoids implying direction

---

## 22 — ILLUSTRATIONS & ICONS

### 22.1 Icon Library

**Lucide React** — consistent, MIT-licensed, tree-shakable.

Default icon sizes:
| Context | Size |
|---------|------|
| Navigation icons | 20 px |
| Button icons | 16 px |
| Inline (text-level) icons | 14 px |
| Empty state illustrations | 80–120 px |
| Status dot | 8 px |

All icons must have `aria-hidden="true"` when decorative (next to text labels). Provide `aria-label` when icon is the only label.

### 22.2 Illustrations

- Used for: empty states, onboarding steps, error pages
- Style: single-color or two-tone (brand + neutral); flat; no gradients
- SVG inline (not `<img>`) for accessibility and theme adaptability
- Color variables used in SVG fill: `currentColor` or CSS custom properties, so they adapt to dark mode

---

## 23 — DARK MODE

### 23.1 Implementation

Use CSS custom properties (design tokens from §4.2) toggled by a `data-theme="dark"` attribute on `<html>`. System default detected via `prefers-color-scheme: dark`. User override stored in `localStorage`.

### 23.2 Dark Mode Token Overrides

All `surface-*` and `text-*` tokens flip (see §4.2). Additional overrides:
- Shadows become lighter (dark surface with light shadow looks wrong): replace `shadow-md` with `ring-1 ring-neutral-700` in dark mode
- Images: no filter. Do not invert or dim photos
- Charts: use `neutral-700` grid lines; `neutral-400` axis text
- Skeleton shimmer: `neutral-800` → `neutral-700`

### 23.3 Dark Mode Toggle

In the top bar (desktop) or profile page (mobile):
```
[☀ Light]  [System]  [🌙 Dark]   ← segmented control
```

---

## 24 — PERFORMANCE BUDGETS

### 24.1 Core Web Vitals Targets

| Metric | Target | Notes |
|--------|--------|-------|
| LCP (Largest Contentful Paint) | < 2.5 s | Applies to the calculator page (hero screen) |
| FID / INP (Interaction to Next Paint) | < 200 ms | Formula recalculation must not block the main thread |
| CLS (Cumulative Layout Shift) | < 0.1 | Skeleton screens must match real content dimensions precisely |
| TTFB (Time to First Byte) | < 600 ms | FastAPI + Redis cache for master data |

### 24.2 Asset Budgets

| Asset type | Max size (gzipped) |
|------------|-------------------|
| Initial JS bundle | 150 KB |
| Per-route code-split chunk | 50 KB |
| Total CSS | 30 KB |
| Web fonts (Inter, all weights) | 60 KB |
| Total initial page weight | < 300 KB |

### 24.3 Mobile Performance Rules

- Lazy-load all route components (React `lazy` + `Suspense`)
- Virtualize any list with > 50 rows (`react-virtual` or `@tanstack/react-virtual`)
- Debounce formula recalculation: 150 ms
- Debounce search inputs: 300 ms
- Memoize expensive components (`React.memo`, `useMemo`) for the quote item list
- Master data (BF prices, flute settings, shades): loaded once at app init, cached in Zustand / React Query; never re-fetched per-route

---

## 25 — COMPONENT CHECKLIST BY SCREEN

Quick reference: the key UI components each screen must implement.

### Calculator (New Quote Item)
- [ ] 2-col dimension grid (L/W/H)
- [ ] BF select (native on mobile, combobox on desktop)
- [ ] Shade select (combobox, searchable, 11+ items)
- [ ] Live result summary card (sticky bottom on mobile)
- [ ] Costing breakdown accordion
- [ ] Save button (primary, full-width on mobile)
- [ ] Input validation on blur

### Quote Builder (Multi-Item)
- [ ] Item cards list (virtual scroll if > 30 items)
- [ ] FAB `+` on mobile
- [ ] Grouped item UI (indented members, collapse/expand)
- [ ] Quote header collapsible section
- [ ] Send button (opens output selector + send confirm)

### Bulk Import
- [ ] Upload zone (drag-drop desktop / tap mobile)
- [ ] File queue with per-file progress
- [ ] Step indicator (mobile: text; desktop: step bar)
- [ ] Draft row table with confidence dots
- [ ] Per-field inline edit with confidence chips
- [ ] Bulk action bar on selection

### Reports
- [ ] Stat cards horizontal scroll (mobile) / 4-col grid (desktop)
- [ ] Date range preset selector + custom picker
- [ ] Recharts bar chart with responsive container
- [ ] Table with sticky first/last columns + horizontal scroll hint
- [ ] CSV export button (plan-gated with tooltip on Starter)

### Settings / Masters
- [ ] Two-panel layout (desktop) / stack navigation (mobile)
- [ ] Inline-editable BF price grid
- [ ] Unsaved changes banner + yellow dot indicator
- [ ] Danger zone section
- [ ] Plan badge in sidebar / header

### Notifications (All Screens)
- [ ] Toast snackbar (bottom-center mobile / top-right desktop)
- [ ] Offline banner (persistent warning)
- [ ] AI job progress inline banner on bulk import page

---

## 26 — DEAL PIPELINE UI

### 26.1 Pipeline Board (Kanban)

Accessed via **Reports → Pipeline** (Owner, Admin, Manager). Shows all active quotes as cards in stage columns.

#### Layout
```
[Pipeline]  Filter: [All salespersons ▾]  [Date range ▾]  [Search ___]
─────────────────────────────────────────────────────────────────────────
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Sent    │ │Responded │ │Negotiating│ │   Won    │ │   Lost   │
│  (8)     │ │  (3)     │ │   (4)    │ │  (22)    │ │  (10)    │
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│[Card]    │ │[Card]    │ │[Card]    │ │[Card]    │ │[Card]    │
│[Card]    │ │          │ │[Card]    │ │          │ │          │
│[Card ⚠] │ │          │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
← Horizontal scroll on mobile; fixed columns on desktop (lg+) →
```

**Won and Lost columns**: show last 30 days only; "View all →" link loads full list.

#### Quote card anatomy
```
┌────────────────────────────────────────┐
│ ABC Packaging Co.          Q-2026-0042 │
│ ₹1,24,000  ·  3 items                 │
│ Ravi (Salesperson)                     │
│ Last activity: Opened — 2d ago    [⋮]  │
│ ⚠ 8 days in Sent without reply        │  ← amber ring, warning-500 text
└────────────────────────────────────────┘
```

- Card: `surface-card`, `rounded-xl`, `shadow-sm`, `p-4`
- Amber urgency ring: `ring-2 ring-warning-500` when in `Sent`/`Opened` stage > `inactivity_alert_days` (§33.6)
- `⋮` overflow: View details / Mark Won / Mark Lost / Send follow-up
- Mobile: columns become a **horizontal scroll row of cards**; tap a stage header to filter

### 26.2 Quote Activity Feed

In Reports → Quote detail → **Activity** tab. Unified timeline of all events for one quote.

```
┌─────────────────────────────────────────────────────────────────┐
│  Activity                                                       │
├─────────────────────────────────────────────────────────────────┤
│  📨  Follow-up #2 sent via Email        2 May 2026, 10:00 AM   │
│  👁  Client opened the email            1 May 2026,  3:45 PM   │
│  📖  Client read the WhatsApp message  30 Apr 2026,  9:10 AM   │
│  📱  Follow-up #1 sent via WhatsApp    30 Apr 2026,  8:00 AM   │
│  ✉️  Quote sent via Email + WhatsApp   27 Apr 2026, 11:22 AM   │
│  📝  Quote created                     27 Apr 2026, 11:00 AM   │
└─────────────────────────────────────────────────────────────────┘
```

- Icon colors: send = `brand-500`, open/read = `info-500`, follow-up = `warning-500`, won = `success-500`, lost = `error-500`
- Timestamps: absolute; relative tooltip on hover/long-press
- Mobile: full-width cards in the Activity tab
- Empty state: "No activity yet — send the quote to start tracking."

### 26.3 Win / Loss Modal

Triggered by overflow → **Mark as Won** or **Mark as Lost**.

**Mark as Won:**
```
┌──────────────────────────────────────────────┐
│  Mark quote as Won?                          │
│  Q-2026-0042 · ABC Packaging Co. · ₹1,24,000│
│                                              │
│  [Cancel]              [Confirm — Mark Won]  │
└──────────────────────────────────────────────┘
```
No reason required. `[Confirm]` is `success-600` filled.

**Mark as Lost:**
```
┌──────────────────────────────────────────────┐
│  Mark quote as Lost                          │
│  Q-2026-0042 · ABC Packaging Co.             │
│                                              │
│  Reason *                                    │
│  ◉ Price too high                            │
│  ○ Went with competitor                      │
│  ○ No response                               │
│  ○ Project cancelled                         │
│  ○ Other: [_________________________]        │
│                                              │
│  Note (optional):                            │
│  [_______________________________________]   │
│                                              │
│  [Cancel]           [Mark as Lost]           │
└──────────────────────────────────────────────┘
```
`[Mark as Lost]`: outlined `error-500` (NOT filled) → filled `error-500` only after reason selected.
Mobile: bottom sheet, full-width buttons stacked (Cancel top, Lost below).

### 26.4 Pipeline Analytics Dashboard

Available from Reports → Pipeline → **Analytics** tab.

```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  Win rate      │ │  Avg days      │ │  Avg deal      │ │  Quotes sent   │
│  45.8%         │ │  to close 8.3d │ │  value ₹1.4L   │ │  48 this month │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Stage funnel                    │  │  Loss reason breakdown           │
│  [Funnel / bar chart]            │  │  [Horizontal bar chart]          │
│  Sent 48 → Opened 38 →          │  │  Price too high  ████  4         │
│  Responded 24 → Negotiating 18  │  │  Competitor      ███   3         │
│  → Won 22 / Lost 10             │  │  No response     ██    2         │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

- Date range picker (same component as Admin Dashboard — §19.2)
- Salesperson filter: applies to all cards + charts
- Charts: Recharts; funnel is a horizontal bar chart with connecting arrows
- Mobile: stat cards 2-col / horizontal scroll; charts full-width stacked

---

## 27 — PRICE REVISION LETTER UI

### 27.1 Revision Preview Table

Accessed from Reports → **Price Increase** (Owner / Admin / Manager only).

#### Step 1 — Select items
```
[Party ▾]  [Date range ▾]  [Select all]  [Clear]  [Preview Increase ▶]
────────────────────────────────────────────────────────────────────────
□  Box A  ·  5-ply E-flute  ·  Old: ₹12.50  ·  Q-2026-0038
□  Box B  ·  3-ply B-flute  ·  Old: ₹8.20   ·  Q-2026-0039
□  Box C  ·  7-ply BC       ·  Old: ₹18.00  ·  Q-2026-0041
```
Checkbox multi-select; "Select all" applies to current filter.

#### Step 2 — Preview comparison table
```
┌──────────────────────────────────────────────────────────────────────┐
│  Price Increase Preview                              [Edit all +%]   │
├──────────────┬──────────────┬──────────────┬──────────┬─────────────┤
│  Box         │  Old price   │  New calc.   │  Δ%      │  Proposed   │
│              │  (₹/box)     │  (₹/box)     │          │  (₹/box)    │
├──────────────┼──────────────┼──────────────┼──────────┼─────────────┤
│  Box A       │  12.50       │  14.20       │ +13.6%   │ [14.20]  ✎  │
│  Box B       │   8.20       │   9.10       │ +10.9%   │ [ 9.00]  ✎  │
│  Box C       │  18.00       │  20.40       │ +13.3%   │ [20.40]  ✎  │
└──────────────┴──────────────┴──────────────┴──────────┴─────────────┘
  Δ% badge: success-100/700 if decrease, warning-100/700 if <15%, error-100/700 if ≥15%
```

- **Proposed price**: editable inline (click → number input, `inputmode="decimal"`, right-aligned mono)
- **[Edit all +%]**: opens a popover — enter a flat % → applies to all proposed prices simultaneously
- Dirty proposed cells: `warning-100` background
- Mobile: stacked label:value per row (Pattern 4 from §9); Proposed price gets a prominent full-width editable field

#### Reason note
```
  Reason (shown in notification to client):
  [BF 20 price up by ₹4/kg since March — effective 1 June 2026.    ]
  (max 200 chars)
```

#### Actions
```
[Generate PDF Letter]   [Save & Send Notification]   [Cancel]
```

### 27.2 Bulk Client Selection

**Scenario**: A paper price increase affects all clients with Box A–type specs. User can target multiple clients at once.

Filter bar above the item list:
```
[Party: All ▾]  [Box type: 5-ply E-flute ▾]  [Date: Last 6 months ▾]
```

Selecting "All" clients with a given box type pre-populates the comparison table with one row per client-box combination (flattened). Each row shows which client it belongs to:

```
│  Box A — ABC Packaging    │  12.50  │  14.20  │  +13.6%  │ [14.20] │
│  Box A — XYZ Industries   │  11.80  │  14.20  │  +20.3%  │ [14.20] │
```

- After confirmation, separate price revision letters are generated and sent per client
- Progress shown as: "Sent 3 of 7 notifications..." inline banner

### 27.3 Send & PDF Actions

**[Generate PDF Letter]**:
- Generates a formal price revision letter PDF:
  - Company letterhead (logo, address)
  - Date + client address block
  - Subject: *"Price Revision Effective [Date]"*
  - Reason paragraph (from note field)
  - Comparison table (box name / old price / new price / Δ%)
  - Closing note on negotiation contact
- PDF downloadable immediately; also stored in the quote's document repository (§32 of 02-flow)

**[Save & Send Notification]**:
- Saves the `PriceIncreaseEvent` records (§38.2 of 02-flow)
- Sends notification to each selected client via their preferred channel (Email / WhatsApp)
- Uses the `price_increase` template category (§40 of 02-flow)
- After send: rows in the table show `[Notified ✓ — 2 May 2026]` status badge

---

## 28 — MULTI-ACCOUNTING INTEGRATION UI

### 28.1 Integration Cards

Lives under **Settings → Integrations**. Shows one card per supported integration.

```
┌──────────────────────────────────────────────────────┐
│  Tally ERP / Prime                    [Connected ✓]  │
│  Local XML push · Last push: 2 May 2026               │
│  [Configure]  [View Push Log]                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Zoho Books                           [Connect ▸]    │
│  REST API · OAuth 2.0                                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  QuickBooks India                     [Connect ▸]    │
│  REST API · OAuth 2.0                                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Busy Accounting                      [Configure]    │
│  XML file export — download & import manually        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Generic CSV Export                   [Configure]    │
│  Download CSV for any software                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Generic Webhook / Custom ERP         [Configure]    │
│  JSON POST to your endpoint                          │
└──────────────────────────────────────────────────────┘
```

- Status badge: Connected `success-100` / Not connected `neutral-100` / Reconnect required `error-100`
- Auto-push badge: shown on the active auto-push integration only: `brand-100` pill "Auto-push on accept"
- Mobile: cards stack full-width

### 28.2 OAuth Connect Flow

For Zoho Books and QuickBooks:

1. User clicks **[Connect ▸]** on the integration card.
2. Modal opens (desktop) / bottom sheet (mobile):
   ```
   ┌──────────────────────────────────────────────┐
   │  Connect Zoho Books                          │
   │                                              │
   │  You'll be redirected to Zoho to authorize   │
   │  BoxCostPro to create invoices and contacts. │
   │                                              │
   │  Required permissions:                       │
   │  · Create & read invoices                   │
   │  · Create & read contacts                   │
   │                                              │
   │  [Cancel]       [Authorize with Zoho ▸]     │
   └──────────────────────────────────────────────┘
   ```
3. **[Authorize with Zoho ▸]** opens the OAuth URL in the same tab (OAuth PKCE flow).
4. After Zoho redirect back to `/api/v1/admin/integrations/zoho/oauth/callback`:
   - Backend stores tokens in `accounting_integrations.credentials_encrypted`.
   - Frontend shows success toast: "Zoho Books connected."
   - Integration card status updates to `Connected ✓`.
5. On re-auth needed: card shows `error-100` banner "Reconnect required — your session expired. [Reconnect ▸]".

### 28.3 Field Mapping Editor

For Generic CSV only. Accessible from the CSV card → **[Configure]**:

```
┌─────────────────────────────────────────────────────────┐
│  CSV Column Mapping                                      │
├─────────────────────┬───────────────────────────────────┤
│  BoxCostPro field   │  Your column name                 │
├─────────────────────┼───────────────────────────────────┤
│  invoice_date       │  [Bill Date              ]        │
│  party_name         │  [Customer Name          ]        │
│  box_description    │  [Item Description       ]        │
│  quantity           │  [Qty                    ]        │
│  unit_price         │  [Rate                   ]        │
│  grand_total        │  [Total Amount           ]        │
│  gstin              │  [GSTIN                  ]        │
│  hsn_sac            │  [HSN/SAC Code           ]        │
└─────────────────────┴───────────────────────────────────┘
  Date format:  [DD/MM/YYYY ▾]   Decimal separator: [. ▾]
  ☑ Include header row

  [Preview CSV]   [Save Mapping]   [Reset to defaults]
```

- **[Preview CSV]**: generates a sample row with mock data; shows a `<pre>` block with the first 3 lines of the CSV
- Inputs: plain text, no validation (user knows their target software's column names)
- Mobile: stacked label above input per row

### 28.4 Push History Log

Accessible from any connected integration card → **[View Push Log]**. Also available globally from Settings → Integrations → **Push History** tab.

```
[Search ___]  [Integration: All ▾]  [Status: All ▾]  [Date ▾]  [Export CSV]
────────────────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────────────┐
│  Q-2026-0042 · ABC Packaging    Zoho Books   [Success ✓]  2 May 11:00   │
│  Q-2026-0039 · XYZ Industries   QuickBooks   [Failed ✗]   1 May 15:22   │
│  Q-2026-0038 · ABC Packaging    Tally        [Success ✓]  30 Apr 9:00   │
└──────────────────────────────────────────────────────────────────────────┘
```

- Status: Success `success-100` / Failed `error-100` / Pending `info-100`
- Failed rows: expand → show `error_message` + **[Retry Push]** button
- **[Retry Push]**: re-triggers the push for that specific quote + integration
- Mobile: card per row; Failed rows show retry button below the error message
- CSV export: exports the filtered log

---

## 29 — WHATSAPP ADMIN UI [V3 New Module]

This section covers all UI components visible to the **platform admin** in the WhatsApp module. Tenant-facing WhatsApp UI is in §30.

### 29.1 Platform Config Card

Location: **Platform Admin → WhatsApp → Configuration**

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Business Configuration                   ● Connected  │
├─────────────────────────────────────────────────────────────────┤
│  Phone Number ID      [ 1234567890               ]              │
│  WABA ID              [ 9876543210               ]              │
│  API Token            [ ••••••••••••••••  [Show] ]              │
│  Display Name         [ BoxCostPro                ]              │
├─────────────────────────────────────────────────────────────────┤
│  Webhook URL (read-only)                                        │
│  https://platform.boxcostpro.com/api/v1/webhooks/whatsapp       │
│                                              [Copy URL]         │
│  Webhook Verify Token  [ auto-generated-token  ] [Regenerate]   │
├─────────────────────────────────────────────────────────────────┤
│              [Test Connection]       [Save Changes]             │
└─────────────────────────────────────────────────────────────────┘
```

- **Connection status badge**: `success-600` dot + "Connected" when `is_active = TRUE`; `error-600` dot + "Not Connected" otherwise.
- **API Token field**: type `password`; `[Show]` button toggles visibility for 10 seconds then auto-hides.
- **Webhook URL**: `input` with `readOnly`; `[Copy URL]` button copies to clipboard with "Copied!" toast.
- **[Regenerate]** on verify token: confirmation modal ("This will break Meta's webhook until you update it in Meta Business Suite. Continue?").
- **[Test Connection]**: inline spinner → green "✓ Connection successful" or red "✗ Error: {message}".
- **[Save Changes]**: disabled until any field changes. On save: spinner, success toast "WhatsApp configuration saved".

**Opt-out keywords** section (expandable accordion below the card):
```
Opt-out Keywords (auto opt-out when client sends these words)
[ STOP        ] [×]
[ UNSUBSCRIBE ] [×]
[ OPT OUT     ] [×]
                [+ Add keyword]
```

### 29.2 Template Builder

Location: **Platform Admin → WhatsApp → Templates → [+ New Template]** or **[Edit]**

Full-width 2-panel layout (60/40 split on desktop; stacked on mobile):

**Left panel — builder:**
```
Template Name*    [ quote_notification_v2        ]  (snake_case only, validated)
Display Name*     [ Quote Notification            ]
Language          [ English (India) ▾ ]    Category  [ UTILITY ▾ ]

─── HEADER ──────────────────────────────────────────────────────
  [None] [Text ✓] [Image] [Video] [Document]
  Header text: [ New Quote from {{1}}          ]  16 / 60

─── BODY* ───────────────────────────────────────────────────────
  [Rich textarea — supports {{variable}} insertion]
  Dear {{1}}, your quote *{{2}}* for ₹{{3}} is ready.
  Valid until {{4}}.

  Tap below to view your quote. 🔗
                                              312 / 1024
  [+ Insert Variable ▾]   ← dropdown: picks alias from variable_map

─── FOOTER ──────────────────────────────────────────────────────
  [ BoxCostPro — Packaging Cost Platform  ]  42 / 60

─── BUTTONS ─────────────────────────────────────────────────────
  [Quick Reply] [URL] [Phone]
  ┌─ Button 1: URL ──────────────────────────────────────────┐
  │  Label: [ Open Quote Portal     ]  20/25                 │
  │  URL:   [ https://bcp.to/q/{{7}}]  [+ Dynamic variable]  │
  └──────────────────────────────────────────────────────────┘
  [+ Add Button]  (disabled at 3)

─── VARIABLE MAPPING ────────────────────────────────────────────
  {{1}}  party_name        →  quote.party.name          [Edit]
  {{2}}  quote_ref         →  quote.ref                 [Edit]
  {{3}}  total_amount      →  quote.grand_total_formatted [Edit]
  {{4}}  valid_until       →  quote.valid_until_formatted [Edit]
  {{7}}  quote_public_link →  quote.public_link          [Edit]
```

**Right panel — live phone preview:**
```
     ┌─────────────────────────┐
     │ ●●●  BoxCostPro  ●●●    │
     │─────────────────────────│
     │ ┌─────────────────────┐ │
     │ │ New Quote from      │ │  ← header
     │ │ Sharma Packaging    │ │
     │ │─────────────────────│ │
     │ │ Dear Sharma Pack..  │ │  ← body (sample values)
     │ │ your quote QT-0091  │ │
     │ │ for ₹48,500 is ready│ │
     │ │ Valid until 15 May. │ │
     │ │                     │ │
     │ │ Tap below to view 🔗│ │
     │ │─────────────────────│ │
     │ │ BoxCostPro — Pack.. │ │  ← footer
     │ │─────────────────────│ │
     │ │  [ Open Quote Portal]│ │  ← URL button
     │ └─────────────────────┘ │
     └─────────────────────────┘
         Sample values used for preview
```

The preview refreshes in real-time as the admin types. Sample values come from a stub quote fixture. Variables not yet mapped show `[{{1}}]` in red.

**Action bar (bottom of page):**
```
[Cancel]          [Save as Draft]    [Preview with Real Quote ▾]    [Submit to Meta →]
```
- **[Submit to Meta]**: disabled if `status != 'draft'` or any field has a validation error.
- **[Preview with Real Quote]**: opens a dropdown to pick any existing quote; re-renders the preview panel with real data.

### 29.3 Template Library

Location: **Platform Admin → WhatsApp → Templates**

```
WhatsApp Templates                          [+ New Template]  [Sync from Meta ↻]

Filter: [All Categories ▾] [All Statuses ▾] [All Languages ▾]
Search: [                              🔍]

┌──────────────────────────────────────────────────────────────────────────────┐
│  Template Name         │ Category  │ Language │ Status          │ Used  │ ··· │
├──────────────────────────────────────────────────────────────────────────────┤
│  Quote Notification V2 │ UTILITY   │ en_IN    │ ● Approved      │ 1,204 │ ··· │
│  Follow-up Reminder V1 │ UTILITY   │ en_IN    │ ● Approved      │   876 │ ··· │
│  Price Increase Notice │ MARKETING │ en_IN    │ ◌ Pending       │     0 │ ··· │
│  Payment Reminder V1   │ UTILITY   │ en_IN    │ ● Approved      │   312 │ ··· │
│  Old Quote Notif V1    │ UTILITY   │ en_IN    │ ○ Disabled      │ 3,100 │ ··· │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Status badge colours:**
- `● Approved` → `success-700` text, `success-100` bg
- `◌ Pending` → `warning-700` text, `warning-100` bg
- `✗ Rejected` → `error-700` text, `error-100` bg
- `○ Disabled` → `neutral-500` text, `neutral-100` bg
- `— Draft` → `info-700` text, `info-100` bg
- `⏸ Paused` → `warning-700` text, `warning-50` bg

**`···` action menu per row:**
- Draft: Edit / Submit to Meta / Delete
- Pending: View / Cancel Submission
- Approved: View / Duplicate & Edit / Publish / Restrict to tenants / Disable
- Rejected: View Rejection Reason / Edit & Resubmit / Delete
- Disabled: View / Re-enable

**[Sync from Meta ↻]** button: spinner + toast "Synced 12 templates. 2 status changes."

**[Publish]** action opens a mini-modal:
```
Publish Template
Make "Quote Notification V2" available to tenants?

  Availability:
  ● All activated tenants
  ○ Selected tenants only  → [Select tenants ▾]

  [Cancel]  [Publish Template]
```

### 29.4 Tenant Activation Table

Location: **Platform Admin → WhatsApp → Tenant Activations**

```
WhatsApp Tenant Activations
Active: 14 / 32 tenants

[Search tenant...] [Status: All ▾]

┌───────────────────────────────────────────────────────────────────────┐
│ Tenant Name       │ Plan    │ WA Status   │ Quota  │ Used   │ Actions │
├───────────────────────────────────────────────────────────────────────┤
│ Sharma Packaging  │ Pro     │ ● Active    │ 500/mo │ 234    │ [Edit] [Deactivate] │
│ Gupta Corrugation │ Basic   │ ● Active    │ 100/mo │  67    │ [Edit] [Deactivate] │
│ Delhi Box Works   │ Starter │ ○ Inactive  │  —     │   0    │ [Activate]          │
│ Punjab Cartons    │ Pro     │ ● Active    │  ∞     │ 891    │ [Edit] [Deactivate] │
└───────────────────────────────────────────────────────────────────────┘
```

**[Activate] / [Edit] modal:**
```
Activate WhatsApp for Sharma Packaging

  Monthly message quota
  ○ Unlimited
  ● Custom limit:  [ 500    ] messages/month

  Internal notes (optional)
  [ Paid WhatsApp Basic plan - INR 999/mo                    ]

  [Cancel]              [Confirm Activation]
```

**[Deactivate] modal:** simple confirmation — "WhatsApp will be disabled immediately. In-progress messages will not be recalled."

**Quota bar:** `used / quota` rendered as a thin progress bar (`success` when <80%, `warning` 80–99%, `error` at 100%).

### 29.5 Analytics Dashboard

Location: **Platform Admin → WhatsApp → Analytics**

```
WhatsApp Analytics   [Period: Last 30 days ▾]  [All Tenants ▾]  [Export CSV]

┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐
│  Sent    │ │ Delivered │ │   Read   │ │  Failed  │
│  2,340   │ │  2,041    │ │  1,430   │ │    87    │
│ ↑ 12.3%  │ │  87.2%    │ │  61.1%   │ │   3.7%   │
│ [spark]  │ │ [spark]   │ │ [spark]  │ │ [spark]  │
└──────────┘ └───────────┘ └──────────┘ └──────────┘

Delivery Funnel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Sent    2,340  100%
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  Delivered 2,041  87.2%
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━   Read      1,430  61.1%
      ━━━━━━━━━━━━━━━━━━━          Replied     197   8.4%

Template Performance
┌─────────────────────────────────────────────────────────────────────┐
│ Template Name         │ Sent  │ Delivered │ Read  │ CTA Click │ Status│
├─────────────────────────────────────────────────────────────────────┤
│ Quote Notification V2 │ 1,204 │ 92%       │ 68%   │ 34%       │ ✓ Approved │
│ Follow-up Reminder V1 │   876 │ 89%       │ 54%   │ 12%       │ ✓ Approved │
│ Payment Reminder V1   │   260 │ 91%       │ 61%   │  —        │ ✓ Approved │
└─────────────────────────────────────────────────────────────────────┘

Tenant Consumption (Top 10)              Time-of-day Read Rate
┌──────────────────────────┐             ┌─────────────────────────┐
│ Sharma Packaging  ████░░ │  234/500    │  Mon ░░░░▓▓████▓▓░░░░░░ │
│ Gupta Corrugation ██░░░░ │   67/100    │  Tue ░░░░░▓▓███▓▓░░░░░░ │
│ Punjab Cartons    █████░ │  891/∞      │  ...                    │
│ ...                      │             └─────────────────────────┘
└──────────────────────────┘
```

- **Period selector**: 7d / 30d / 90d / Custom date range (date picker popover).
- **Tenant filter**: "All Tenants" or select one from dropdown; when a tenant is selected, the tenant consumption chart is hidden.
- **[Export CSV]**: downloads filtered `wa_message_log` CSV (§37.4).
- Funnel bars rendered in `brand-400`; width proportional to the sent count.
- Template table sortable by any column; "CTA Click" column hidden for templates without URL buttons.
- Heatmap cells: `neutral-50` at 0% read rate → `brand-600` at 80%+ read rate.

---

## 30 — WHATSAPP TENANT UI [V3 New Module]

### 30.1 Template Picker in Send Flow

When a tenant user clicks **Send** on a quote → **WhatsApp** tab:

```
Send via WhatsApp

Recipient:  +91 98765 43210 ✓   [Change]

Select Template
┌───────────────────────────────────────────────────────────────────┐
│  ● Quote Notification      UTILITY   [Preview ▾]                  │
│  ○ Follow-up Reminder      UTILITY   [Preview ▾]                  │
│  ○ Price Increase Notice   MARKETING [Preview ▾]                  │
└───────────────────────────────────────────────────────────────────┘

Preview (auto-filled)
┌──────────────────────────────┐
│ New Quote from               │  ← header
│ Sharma Packaging Pvt Ltd     │
│──────────────────────────────│
│ Dear Sharma Packaging,       │
│ your quote QT-2024-0091      │
│ for ₹48,500 is ready.        │
│ Valid until 15 May 2026.     │
│                              │
│ Tap below to view your       │
│ quote. 🔗                    │
│──────────────────────────────│
│ BoxCostPro                   │
│──────────────────────────────│
│ [ Open Quote Portal ]        │
└──────────────────────────────┘

Variable overrides (optional — expand to edit)
  ▸ All variables auto-filled from quote. Tap to override any.

[Cancel]                            [Send WhatsApp Message]
```

- Templates listed as radio cards; only `is_published = TRUE` templates available to this tenant are shown.
- **[Preview ▾]** expands inline below the card showing the rendered preview (same phone-frame as §29.2 but read-only, smaller).
- **Variable overrides**: collapsed accordion by default. Expanding shows `<label> <input>` for each `{{N}}` variable with the auto-filled value pre-populated; user can edit any field.
- **[Send WhatsApp Message]**: primary `brand-600` filled button; disabled if no template selected or recipient phone is empty/invalid.
- On success: button replaced with `✓ Sent` badge; bottom of modal shows "Delivered to WhatsApp" once status updates.

### 30.2 Message History Tab (Quote Detail)

Each quote detail page has a **Messages** tab alongside Summary / Items / PDF:

```
Messages

Filter: [All Channels ▾]  [All Statuses ▾]

─────────────────────────────────────────────────────────────────────
 [WA] Quote Notification   →  +91 98765 43210 (Sharma Packaging)
      Sent: 3 May 2026  14:32               ✓✓ Read  15:01
      Template: Quote Notification V2
      ─────────────────────────────────────────────────────────────
      Reply from client (15:04): "Please check the ply spec again"

─────────────────────────────────────────────────────────────────────
 [Email] Quote sent        →  contact@sharma.in
      Sent: 3 May 2026  14:30               ✓ Opened  14:58
─────────────────────────────────────────────────────────────────────
 [WA] Follow-up Reminder   →  +91 98765 43210
      Sent: 5 May 2026  10:00               ✓ Delivered  (not yet read)
─────────────────────────────────────────────────────────────────────
```

**Channel badge:** `[WA]` in `success-100` bg / `success-700` text; `[Email]` in `info-100` / `info-700`.

**Delivery status icons (WhatsApp ticks, styled like native WA):**
- `○` = Queued
- `✓` (grey) = Sent to Meta
- `✓✓` (grey) = Delivered to device
- `✓✓` (blue / `brand-600`) = Read
- `✗` (red / `error-600`) = Failed — hover shows error reason

**Inbound reply:** displayed as an indented bubble below the relevant sent message row, with timestamp and reply text. Reply text is truncated at 120 chars with "Show more" toggle.

### 30.3 WA Add-on Locked / Upgrade State

If the tenant's WA add-on is **not activated**, the WhatsApp tab in the Send modal shows:

```
┌──────────────────────────────────────────────────────────┐
│  🔒 WhatsApp Messaging                                   │
│                                                          │
│  Send quotes directly via WhatsApp with delivery         │
│  & read receipts — no app switching needed.              │
│                                                          │
│  ✓ Template-based sending                                │
│  ✓ Delivery & read tracking                              │
│  ✓ Auto follow-up via WhatsApp                           │
│  ✓ Reply detection & pipeline automation                 │
│                                                          │
│     Contact your account manager to activate             │
│              WhatsApp messaging.                         │
│                                                          │
│         [Contact Support to Activate]                    │
└──────────────────────────────────────────────────────────┘
```

- The lock icon and upgrade panel replace the template picker entirely — no partial functionality is shown.
- The `[Contact Support to Activate]` button opens a pre-filled support email / in-app ticket.
- An inline wa.me fallback link is offered below the panel: *"Or send manually via WhatsApp →"* (generates the wa.me link for the user to tap manually).

### 30.4 Quota Warning Banner

When the tenant has used ≥80% of their monthly quota, a non-dismissible warning banner appears at the top of any send flow that includes the WhatsApp tab:

```
⚠  You have used 432 / 500 WhatsApp messages this month (86%).
   Contact your account manager to increase your limit.                   [×]
```

At 100% quota: banner turns `error-50` bg / `error-700` text; WhatsApp send button is disabled; wa.me fallback is offered automatically.

### 30.5 Settings → WhatsApp (Tenant View)

Location: **Settings → WhatsApp** (tenant — visible only if WA add-on is active)

```
WhatsApp Messaging

Add-on status:   ● Active   Activated: 12 Apr 2026
Messages used:   ████████░░  432 / 500 this month   (Resets 1 Jun 2026)

Analytics tab:   [Overview] [Templates] [Message Log]

(See §37.2 for analytics content spec)
```

---

## 31 — WHATSAPP OTP AUTHENTICATION UI [V3 New Module]

### 31.1 Login Page — WhatsApp Option

URL: `/login`

The login page presents two tabs/methods: **Email + Password** (existing) and **WhatsApp OTP** (new). WA OTP tab is the default when `wa_auth_settings.enabled = TRUE`.

```
┌─────────────────────────────────────────────────────────┐
│                     BoxCostPro                          │
│              The Packaging Cost Platform                │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │ [  WhatsApp OTP  ] │ Email & Password           │     │
│  ├────────────────────────────────────────────────┤     │
│  │                                                │     │
│  │  Login with WhatsApp                           │     │
│  │                                                │     │
│  │  WhatsApp Number*                              │     │
│  │  [+91 ▾] [ 98765 43210                    ]   │     │
│  │                                                │     │
│  │  [ Send OTP via WhatsApp ]                     │     │
│  │                                                │     │
│  │  ──────────── or ───────────────               │     │
│  │  New to BoxCostPro? [Sign Up with WhatsApp]    │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Phone input details:**
- Country code selector (`[+91 ▾]`) — dropdown with flag icons; defaults to India (+91).
- Number field: numeric only, auto-formats as user types (spaces every 5 digits for readability; sent to API stripped).
- Validation: real-time via `libphonenumber-js` — red border + "Invalid phone number" if not a valid mobile number for the selected country.
- **[Send OTP via WhatsApp]**: disabled until valid phone entered; on click shows inline spinner.

**On success (OTP sent):**
```
┌──────────────────────────────────────────────────────────┐
│  OTP sent to +91 98765 ****10 via WhatsApp  ✓            │
│  ──────────────────────────────────────────────────────  │
│  Enter your 6-digit code                                 │
│                                                          │
│  [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]                    │
│                                                          │
│  Code expires in  04:32                                  │
│                                                          │
│  [Verify & Login]                                        │
│                                                          │
│  Didn't receive it?  [Resend] (available after 60s)      │
│  Try a different method: [Send via Email instead]        │
└──────────────────────────────────────────────────────────┘
```

See §31.2 for full OTP input spec.

**When WA auth is disabled (admin toggle OFF):**
```
  [ WhatsApp OTP ] tab is greyed out and non-clickable
  Tooltip on hover: "WhatsApp login is temporarily unavailable. Use Email & Password."
```

### 31.2 OTP Input Component (Shared)

Used on login, signup, and phone verification screens.

```
OTP input: 6 individual single-character `<input type="text" inputmode="numeric" maxlength="1">` boxes
           rendered in a flex row with 8px gap.
```

**Behaviour:**
- Auto-advance: typing a digit moves focus to next box automatically.
- Backspace on empty box: moves focus to previous box and clears it.
- Paste: pasting a 6-digit string fills all boxes at once and auto-submits.
- On mobile: `inputmode="numeric"` triggers numeric keyboard.
- Auto-submit: when all 6 digits filled, form submits without needing [Verify] button tap.
- Error state: all boxes shake (CSS keyframe animation, 0.3s) and turn `error-300` border; error message below: "Incorrect code. X attempts remaining."
- Expired state: all boxes grey out; "Code expired — [Resend]" replaces the timer.
- Loading state: all boxes disabled + spinner while API call in-flight.

**Countdown timer:** `MM:SS` format; when timer hits 0:00, boxes grey out and "Resend" link becomes active.

**Resend:** disabled for 60 seconds after send; shows `(Resend in 00:42)` countdown. Clicking resend calls `send-otp` again; resets OTP boxes and countdown. After 3 resends in the session, "Resend" is hidden with "Please wait 10 minutes before trying again."

### 31.3 Signup via WhatsApp Screen

URL: `/signup` with WA tab active

**Step 1 — Details form:**
```
┌────────────────────────────────────────────────────────┐
│  Create your BoxCostPro account                        │
│                                                        │
│  [  WhatsApp OTP  ] │ Email & Password                 │
│  ───────────────────────────────────────────────────── │
│                                                        │
│  Your Name*         [ Rahul Sharma                  ]  │
│  Company Name*      [ Sharma Packaging Pvt Ltd      ]  │
│  WhatsApp Number*   [+91 ▾] [ 98765 43210          ]  │
│  Email (optional)   [ rahul@sharma.in               ]  │
│  Referral Code      [                               ]  │
│                                                        │
│  [  Send OTP to Verify  ]                              │
│                                                        │
│  By continuing you agree to our Terms & Privacy Policy │
└────────────────────────────────────────────────────────┘
```

**Validation:**
- Name: required, 2–100 chars.
- Company: required, 2–100 chars.
- Phone: valid mobile number, not already registered (checked async on blur with `GET /api/v1/auth/check-phone`).
  - If already registered: "This number has an account. [Login instead]"
- Email: optional; if provided, must be valid format and not already registered.

**Step 2 — OTP verify:**
Same OTP input screen (§31.2), with header "Verify your WhatsApp number". On success: account created, automatic login, redirect to onboarding flow.

**Post-signup WhatsApp welcome message** (triggered by backend):
```
Welcome to BoxCostPro, Rahul! 🎉

Your account is ready. Log in at:
https://app.boxcostpro.com

Need help? Reply to this message anytime.
```
(UTILITY template — separate from auth template.)

### 31.4 Phone Verification for Existing Users

Location: **Settings → Profile → Phone Number → [Verify via WhatsApp]**

```
Verify WhatsApp Number

Your current phone: +91 98765 43210

[Send verification code via WhatsApp]

────────────────────────────────────────────────────────
Once verified you can:
  ✓ Log in using WhatsApp OTP
  ✓ Receive quote notifications on WhatsApp
  ✓ Get automated follow-ups
```

After clicking send: inline OTP boxes appear below (§31.2). On verify success: phone shown as `+91 98765 ****10  ✓ Verified` with green tick. "Log in with WhatsApp OTP" now enabled for this account.

If user already has a different verified phone: "Verifying this number will replace your current verified number (+91 XXXXX ****XX). Continue?" confirmation dialog.

### 31.5 Error States & Edge Cases

| Scenario | UI Behaviour |
|----------|-------------|
| Phone not registered (login attempt) | Error below input: "No account found for this number. [Sign up instead]" |
| Phone already registered (signup attempt) | Error below input: "Account exists. [Log in instead]" |
| WA delivery failed, fallback enabled | Auto-switch to email OTP tab with banner: "WhatsApp delivery failed. Code sent to your registered email instead." |
| WA delivery failed, fallback disabled | Error: "WhatsApp delivery failed. Please try again or use Email & Password." |
| Max attempts (5 wrong OTPs) | All boxes locked, message: "Too many incorrect attempts. Request a new code." [Get New Code] button |
| Rate limited (3 sends/10 min) | Toast: "Too many attempts. Please wait 10 minutes before requesting another code." |
| OTP expired | Boxes greyed, "Code expired" message, [Resend] active |
| Network error during verify | Toast: "Connection error. Your code is still valid — please try again." |

### 31.6 Platform Admin — Auth Settings UI

Location: **Platform Admin → WhatsApp → Authentication**

(Full spec in §38.2 — this section covers only the UI tokens for consistency.)

Toggles use the standard `<Switch>` component (`brand-600` when ON, `neutral-300` when OFF) with label on the left. Saving shows a full-page spinner while `PUT /api/v1/platform-admin/wa/auth-settings` resolves, then success toast: "Authentication settings saved."

OTP template selector: `<Select>` dropdown showing template `display_name` + status badge. Only AUTHENTICATION-category templates with `status = 'approved'` are listed. If none: dropdown shows "No approved OTP templates — [Create one]" linked to the template builder.

---

*End of 04-ui-ux-master.md*
*See also: [01-formula-master.md](./01-formula-master.md) | [02-system-flow-master.md](./02-system-flow-master.md) | [03-admin-flow-master.md](./03-admin-flow-master.md)*
