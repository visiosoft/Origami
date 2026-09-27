# Design System: Origami Operations Dashboard

This document is the visual source of truth for Stitch-generated screens and future dashboard design work. Origami is a design-build operations platform used by principals, project managers, designers, estimators, site superintendents, administrators, clients, and consultants.

The dashboard has one job: answer **what needs attention today** in under ten seconds, then make the next action obvious.

## 1. Visual Theme & Atmosphere

Origami should feel like a well-run design studio's operations room: calm, tactile, materially warm, and precise enough for financial decisions. Preserve the existing forest-and-paper character, but remove visual competition between the many small status treatments.

- **Density:** Daily App Balanced, `6/10`. Show enough projects, money, schedule, and work queues for a morning check without turning the screen into a spreadsheet.
- **Variance:** Offset Asymmetric, `5/10`. Use a strong editorial hierarchy and unequal chart columns, but keep repeated operational rows predictable.
- **Motion:** Fluid CSS, `4/10`. Motion confirms state changes and hierarchy; it never decorates a financial or task surface.
- **Tone:** Architectural, grounded, quietly premium, and human. Use short labels and real operational language.
- **Primary composition:** A stable application shell with a dense left rail, a calm page header, one dominant “attention” region, then supporting evidence.
- **Dashboard promise:** The first viewport must make overdue work, upcoming deadlines, cash exposure, and project health scannable without opening a modal.

Do not use a marketing hero on an authenticated dashboard. The dashboard header is a compact orientation band: page title, date or current context, one primary action, and no filler copy.

## 2. Color Palette & Roles

Use one unified neutral palette. The only accent is **Measured Amber**, reserved for action, attention, and active filter states. Forest tones are structural brand neutrals, not additional accent colors.

- **Paper Canvas** (`#F8F4EA`) — Main application background. Warm paper tone behind the workspace.
- **Quiet Surface** (`#FFFCF6`) — Cards, tables, drawers, and input surfaces. Use sparingly so the page does not become a field of floating white boxes.
- **Forest Shell** (`#10271A`) — Sidebar, dark utility panels, and high-contrast navigation surfaces.
- **Deep Ink** (`#132019`) — Primary text and high-value numbers. Never use pure black.
- **Studio Body** (`#52605A`) — Body copy, project locations, descriptions, and supporting labels.
- **Faded Moss** (`#829188`) — Metadata, timestamps, chart axes, and disabled controls.
- **Structural Line** (`rgba(19,32,25,0.12)`) — Dividers and one-pixel boundaries. Prefer lines to shadows in dense areas.
- **Soft Track** (`#E8E7DD`) — Progress tracks and chart baselines.
- **Measured Amber** (`#C47A2C`) — The single accent. Use for primary actions, active filters, due-soon markers, selected navigation, and focus rings. Do not turn it into a glow.
- **Quiet Positive** (`#2E5C43`) — Forest-derived status text for healthy or complete states; use with a label or icon, never as decorative fill everywhere.
- **Critical Rust** (`#8B3B22`) — Reserved semantic error/overdue text and border. Use only when the user must intervene.

Color rules:

- Do not introduce purple, electric blue, neon gradients, or gradient text.
- Do not use multiple unrelated greens for every module. Positive state stays forest-derived.
- Pair every status color with a word, icon, or pattern. Color alone must never carry meaning.
- Use the amber accent on no more than one primary action per viewport.
- Avoid saturated pills. Status chips should be quiet, compact, and text-first.

## 3. Typography Rules

- **Display:** `Bricolage Grotesque`, weight `700–800`. Use for page titles, KPI values, and key project names. Keep tracking between `-0.025em` and `-0.01em`; hierarchy comes from weight and placement, not oversized type.
- **UI and body:** `Plus Jakarta Sans`, weight `400–700`. Use for navigation, labels, controls, descriptions, and task rows. Body line height is `1.5–1.65`.
- **Data mono:** `Geist Mono` or `JetBrains Mono`, weight `500–700`. Use for invoice amounts, dates, percentages, IDs, and chart readouts when values must align.
- **Page title:** `clamp(1.35rem, 1.2rem + 0.5vw, 1.75rem)`, line height `1.1`.
- **KPI value:** `1.75rem–2rem`, display face, with aligned tabular numerals.
- **Body minimum:** `14px` on mobile and `14px–15px` on desktop. Do not compress operational copy to unreadable 9px text.
- **Metadata:** `11px–12px`, with clear contrast against the canvas. Uppercase labels may be `10px` but should not contain essential information alone.
- **Measure:** Keep explanatory copy under `65ch`. Do not let dashboard descriptions become full-width paragraphs.

Inter, generic system stacks, and generic serif fonts are banned. Serif typography is not used in dashboard software.

## 4. Dashboard Information Architecture

### Internal dashboard

Use this order in the first viewport:

1. **Orientation row:** “Dashboard”, current date/context, and one primary action such as `Add task` or `Review pipeline`.
2. **Attention strip:** overdue tasks, at-risk projects, and invoices needing action. This is a compact, actionable list rather than four decorative KPI cards.
3. **KPI rail:** Active projects, open tasks, contract value, and outstanding invoices. Each KPI is selectable, but the selected state must be unmistakable without changing layout height.
4. **Evidence grid:** Budget vs. used by project as the dominant `1.35fr` region, with deadlines/activity as the supporting region.
5. **Secondary analysis:** lead funnel, workload, and recent activity below the first viewport.

### Client dashboard

Prioritize reassurance and decisions over internal finance language:

- Header: project context and one clear action, such as `Review selections`.
- Project progress list: project name, phase, next milestone, progress, and one outstanding approval.
- “Awaiting you” queue before financial summaries.
- Hide internal execution codes, margin language, and staff-only filters.

### Consultant dashboard

Prioritize personal accountability:

- Header: assigned scopes and the next due date.
- “My queue” is the primary content block and is sorted by urgency.
- Show project, due date, status, and one direct action in each row.
- Keep assigned-scope count as a supporting KPI, not a hero statistic.

Do not make the three roles look like unrelated products. They share shell, typography, spacing, row behavior, and status semantics; only the information priority changes.

## 5. Component Stylings

### Navigation and shell

- Sidebar width is `248px` on desktop and collapses to an icon rail below `1024px`; below `768px`, use a labeled drawer or bottom navigation with `44px` touch targets.
- Sidebar uses Forest Shell with quiet, low-contrast group labels. The active item uses a pale structural fill or a thin amber edge, never a bright gradient pill.
- Keep the topbar `64px` tall, sticky, and visually quiet. Search, notifications, and role switching should read as utilities, not competing CTAs.
- The content column uses `max-width: 1440px`, `padding: 24px–32px`, and independent scrolling.

### KPI tiles

- Use a compact grid, `repeat(4, minmax(0, 1fr))` at wide desktop and two columns at tablet.
- Surface: Quiet Surface, `1px` Structural Line, `12px` radius, `16px–18px` padding. Avoid heavy shadows.
- Each tile contains one label, one value, one short interpretation, and optionally one small action affordance.
- Make the entire tile clickable only when it filters a visible region. Label the active state “Showing…” rather than “Filtering” in tiny text.
- Never use a KPI tile as a decorative count with no next action.

### Attention list and queues

- Use a border-top divider list for dense work, not nested cards.
- Each row has a stable grid: status marker, task/project name, context, due date, and one action.
- Keep the action visible on hover and keyboard focus; do not require a tooltip to discover the primary route.
- Overdue rows use Critical Rust text plus a clear “Overdue” label. Due-soon rows use Measured Amber. Healthy rows stay neutral or Quiet Positive.
- Empty states should say what is true and what to do next, for example: “Nothing due this week. Add a task or review upcoming milestones.”

### Charts and financial surfaces

- Use chart labels and axis values at readable sizes; never make the legend the only explanation.
- Budget rows should show project name, execution type, contract total, used amount, time elapsed, and variance in one stable row.
- Keep the time marker visually distinct from the money bar through shape and label, not another saturated color.
- Invoice drawers open from the right with a clear title, total, filter context, and close button. The drawer must not hide the dashboard’s only route back to the source data.
- Use tabular or mono numerals for money and percentages. Align currency symbols and decimal values vertically.

### Buttons and controls

- Primary button: Measured Amber fill, Deep Ink text, `10px` radius, minimum `44px` height. Use one per viewport.
- Secondary button: Quiet Surface or transparent, Structural Line border, Deep Ink text.
- Destructive action: Critical Rust text/border with explicit wording; never make it the same size and color as a normal action.
- Segmented controls are for mutually exclusive dashboard filters only. Keep the selected option filled and the unselected options quiet.
- Inputs use a label above the field, a stable height of `44px`, and inline helper/error text below. No floating labels.
- All icons need a tooltip when their meaning is not universally obvious. Icon-only controls still have `44px` hit areas.

### Loading, errors, and notifications

- Use skeleton blocks that match KPI, chart, and row dimensions. Never use a generic circular spinner for page loading.
- Errors appear inline beside the affected data and include a recovery action such as `Try again`.
- Toasts confirm completed actions but never carry the only error message.

## 6. Layout Principles

- Use CSS Grid for dashboard structure. Avoid percentage flexbox math and `calc()` layout hacks.
- Keep the first viewport visually weighted toward one primary region. Four equal cards followed by four equal cards creates noise and should be avoided.
- Prefer `2fr 1fr` or `1.35fr 1fr` evidence grids, with the dominant panel carrying the user's main question.
- Dense tables and queues use dividers, aligned columns, and negative space instead of card-on-card nesting.
- Cards have a maximum `14px` radius in this operational product. Do not use oversized `2.5rem` marketing radii.
- Maintain a spacing rhythm based on `4px`: `8px` internal micro-gap, `12px` row gap, `16px–20px` panel padding, `24px–32px` section separation.
- No content overlap, clipped labels, or absolute-positioned text stacked over charts. Every piece of information occupies a clear spatial zone.
- Full-height containers use `min-height: 100dvh`, never `height: 100vh`.

## 7. Responsive Rules

- **Below `1100px`:** collapse the evidence grid to one column; keep the attention strip above charts.
- **Below `1024px`:** collapse the sidebar to an icon rail with an accessible expanded state; reduce content padding to `20px`.
- **Below `768px`:** all multi-column dashboard regions become one column. KPI tiles become a two-column grid, then one column below `480px`.
- **Below `620px`:** remove chart axes and decorative grid lines, stack money/time readouts beneath project names, and let bars use the full content width.
- **At `375px` and `390px`:** no horizontal scroll, no clipped segmented controls, and no essential data below `14px`.
- Controls and rows have at least `44px` touch height. Avoid hover-only disclosure on mobile.
- Long project names wrap naturally; they must never push due dates or actions offscreen.
- Navigation becomes a labeled drawer or bottom sheet. Do not expose a tiny unlabeled hamburger as the only route to modules.

## 8. Motion & Interaction

- Motion is restrained and functional. Use `stiffness: 100, damping: 20` for interactive feedback where a spring engine is available.
- Page entry: fade and translate the main content by `4px–6px` over `180ms–240ms`.
- Lists reveal with a short stagger of `40ms–70ms`; cap the cascade so long task lists do not feel slow.
- Filter changes should update the selected state and visible data with a brief opacity/transform transition. Do not animate width, height, `top`, or `left`.
- Primary buttons use a tactile `translateY(1px)` or `scale(0.98)` active state. No outer glow.
- Progress bars may animate once on first load, but financial values must settle quickly and must not endlessly pulse.
- A status dot may use a very subtle opacity pulse only when data is actively syncing. Avoid perpetual animation on static dashboard metrics.
- Respect `prefers-reduced-motion` by removing stagger, pulse, and transform transitions.

## 9. Anti-Patterns (Banned)

- Never use emojis in the interface, labels, or empty states.
- Never use Inter, generic system typography, Times New Roman, Georgia, Garamond, or Palatino.
- Never use pure black (`#000000`), AI-purple/blue neon, neon gradients, gradient text, or glowing buttons.
- Never turn every status into a different saturated color. Use one amber action accent and restrained semantic states.
- Never use a centered marketing hero, oversized inspirational copy, or “Scroll to explore” filler on an authenticated dashboard.
- Never use four decorative KPI cards with no visible next action.
- Never use three equal feature cards, card-inside-card nesting, or a page made entirely of floating white boxes.
- Never hide overdue work behind a modal, hover-only state, or tiny icon.
- Never make a chart legible only through color; labels, values, and shapes must carry meaning too.
- Never use circular spinners, fake percentages, placeholder names, “Acme”, “John Doe”, or invented success metrics.
- Never use copywriting clichés such as “Elevate”, “Seamless”, “Unleash”, or “Next-Gen”.
- Never allow horizontal scrolling, clipped text, overlapping elements, or controls below a `44px` touch target.
- Never use broken Unsplash URLs or decorative stock imagery in the operations dashboard. Data and work context are the visual content.