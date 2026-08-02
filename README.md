# Handoff: Origami Design + Build — CRM & Project Delivery Platform

## Overview

A single-tenant internal web platform for Origami Design + Build, a design-build
construction firm. It covers the full lifecycle of a job: inbound lead → qualification →
pipeline → awarded project → design & preconstruction → construction delivery → financial
close-out. The prototype in this bundle implements the CRM, project, people, task, and
dashboard surfaces in full working detail; the remaining modules exist as navigable
specification screens (see "Module status" below).

The audience is internal staff: principals, project managers, designers, estimators,
site superintendents, and admin. There is also a role-scoped read-only mode concept for
clients and subcontractors (see "Role scoping").

## About the design files

The files in this bundle are **design references created in HTML**. They are prototypes
that demonstrate intended look, layout, data shape, and interaction behavior. They are
**not production code to lift directly**.

The task is to **recreate these designs in the target codebase's existing environment** —
React, Vue, SwiftUI, Rails+Hotwire, whatever the team already runs — using its established
component library, routing, state management, and data layer. If no environment exists yet,
choose the framework appropriate to the team and implement the designs there.

Two specific things not to carry over:

- **All data is hardcoded** in methods on the component class (`getFinance()`,
  `getPipelineData()`, `getAllTasks()`, `getPeople()`, `getInvoiceLedger()`, etc.).
  These are fixture generators, and they double as an **implicit schema** — read them as
  the field list each entity needs, then replace with real API calls.
- **All styling is inline** and all state lives in one large component. That is a
  constraint of the prototyping medium, not a recommendation. Decompose into
  components/routes and move styles into the codebase's styling system.

## Fidelity

**High-fidelity (hifi).** Colors, typography, spacing, radii, and interaction states are
final and should be reproduced faithfully. Exact values are in "Design tokens" below.

The one deliberate exception: file upload controls throughout are **visual placeholders**.
They render the drop zone and file chips but have no upload pipeline behind them. They need
real implementation.

## Application shell

Fixed two-column layout, no page reloads — a single client-side routed app.

**Sidebar** — 248px wide, full height, background `#0E1F16`, no border. Collapses to icons
only below 1024px. Contains:
- Brand block at top: 32px logo mark, wordmark "Origami" in Bricolage Grotesque 700 / 17px,
  subtitle "Design + Build" in 10px `#7E9B93`, uppercase, letter-spacing `0.1em`.
- Grouped nav (structure below). Group labels are 9.5px, 700, uppercase, letter-spacing
  `0.12em`, color `rgba(255,255,255,0.34)`, 18px top margin.
- Nav item: 38px tall, 10px radius, 11px horizontal padding, 12.5px / 600 label,
  20px stroke icon (1.6 stroke width). Rest `rgba(255,255,255,0.62)`; hover
  `rgba(255,255,255,0.06)` background; **active** `#DCE7DE` background with `#0E1F16` text.
- Badge on a nav item: pill, 9.5px / 700, `#D2822E` background, white text, right-aligned.
- `note: 'Board'` items render a small 9px `rgba(255,255,255,0.3)` caption after the label —
  it signals the module opens as a kanban board rather than a table.
- User chip pinned to bottom: avatar circle, name, role, sign-out affordance.

**Main column** — background `#FBF8F2`, scrolls independently.
- **Topbar**: 64px tall, sticky, white, bottom border `1px solid rgba(20,8,31,0.07)`.
  Holds the page title (Bricolage Grotesque 700 / 20px, letter-spacing `-0.02em`),
  a global search field, notification bell, and the role switcher.
- **Content area**: 26px padding, max-width 1440px.

### Navigation structure

Groups and their items, in order. `route` is the internal page key used by the prototype's
router — reuse them as URL slugs.

| Group | Item | route | Notes |
|---|---|---|---|
| Main | Dashboard | `dashboard` | Built |
| Projects & CRM | CRM & Leads | `pipeline` | Built — kanban board, badge = live deal count |
| | Projects | `projects` | Built |
| | People | `people` | Built |
| | Tasks | `tasks` | Built — badge `32` |
| Design & Preconstruction | Design | `design` | Spec — board |
| | Selections & Specifications | `selections` | Spec |
| | Estimating | `estimating` | Spec |
| | Plan & File Room | `planroom` | Spec |
| | Manpower & Resources | `manpower_pre` | Spec |
| | Consultant & Sub Prequalifying | `prequal` | Spec |
| Construction | Project Management | `pm` | Spec — board |
| | Quality & Safety | `quality` | Spec |
| | Schedule | `schedule` | Spec |
| | RFIs | `rfis` | Spec |
| | Change Orders | `changeorders` | Spec |
| | Reimbursement | `reimbursement` | Spec |
| | Manpower & Resources | `manpower_con` | Spec |
| Financial | Business | `fin_business` | Spec |
| | Project | `fin_project` | Spec |
| | Resources | `fin_resources` | Spec |
| Insight & Documents | Reports & Analytics | `reports` | Spec |
| | Document & Template Library | `library` | Spec |
| Admin | User Access & Roles | `users` | Spec |
| | Help & Support | `help` | Spec |

### Module status

- **Built** (7 routes): Dashboard, CRM & Leads, Projects, People, Tasks, plus the
  Qualification Scorecard and Workflow Editor which open as modals rather than routes.
  These are complete and are the reference for the app's interaction vocabulary.
- **Spec** (19 routes): render a consistent "module specification" screen — purpose
  statement, list of screens the module will contain, and the data fields it captures.
  These are **scoped but not designed**. Build them from the module-spec content plus the
  patterns established by the built screens; expect a design pass per module before
  implementation.

---

## Screens

### 1. Dashboard (`dashboard`)

Purpose: morning-check view. Answer "what is off track today" in under ten seconds.

Layout: vertical stack, 14px gaps.
1. KPI tile row — CSS grid, `repeat(auto-fit, minmax(190px, 1fr))`, 12px gap.
2. Chart grid — two columns `1.35fr 1fr`, 14px gap, collapsing to one column below 1100px.
3. Secondary row — activity feed and upcoming items.

**KPI tiles.** White, 14px radius, `1px solid rgba(20,8,31,0.06)`, 18px padding.
Label 10px / 700 / uppercase / `0.1em` / `#7E9B93`. Value Bricolage Grotesque 700 / 28px /
`-0.02em` / `#0B1A12`. Delta line 11px, green `#2F7D4A` up or red `#B8410F` down.
Tiles: Active Projects, Lead Pipeline (`9 · 3 won / 1 lost / 5 live`), Contract Value,
Outstanding Invoices.

The **Outstanding Invoices** tile is clickable — opens the invoice drawer (below).

**Chart 1 — Budget vs. Spend.** The most detailed component in the app; read carefully.

One row per project. Each row contains:
- Project name, 12.5px / 700. Exec code chip (`D`, `B`, `DB`, `DBB`) and contract type
  (`T&M`, `Fixed`, `Cost+`) as 9.5px pills beside it.
- **Contract track**: full-width bar, 13px tall, radius 4px, track `#EDF2ED`. Bar width is
  proportional to the project's total contract against the largest project in view.
  Inside it, three segments in source order — base contract used, change orders used,
  reimbursables used — each separated by a `1px solid rgba(255,255,255,0.55)` divider.
  **All three segments are the same color**: `#2F7D4A` normally, `#8E2E0A` when the project
  is "hot" (>90% spent, or spend outpacing schedule).
- **Time marker**: a black triangle sitting above the bar at the `% time elapsed` position.
  This is the visual anchor for "should we have spent this much by now."
- **Dual-progress bar** below: a single 13px track split horizontally into two 50%-height
  rows — top row grey-green `#7E9B93` = % time used; bottom row `#2F7D4A` / `#8E2E0A` =
  % money spent. Followed by the readout `NN% time | NN% spent`.
- **Breakdown line**: `$base + $co + $reimb`, all in `#173326`, 9.5px / 700, separated by
  `+` in `#7E9B93`.
- A `!` flag appears when spend or schedule slippage is out of tolerance.

Legend (three swatches, one row): On track `#2F7D4A` · Over 90% spent or slipping `#8E2E0A` ·
Schedule time used `#7E9B93`.

**Responsive**: below 620px the axis and gridlines are dropped, bars run full container
width as a percentage of contract rather than scaled against the largest project, and the
time/dollar figures wrap under the project name.

Scope control: `budgetScope` toggles `active` / `all` projects.

**Chart 2 — Revenue by month.** Stacked vertical bars, one per month, 3px gap between
stack segments, chart height fixed. Segments: collected (green) and outstanding (orange
`#D2822E`). **Clicking the orange segment** opens the invoice drawer filtered to that month.

**Chart 3 — Lead Funnel.** Horizontal stage bars, count and conversion % per stage.
Title is role-dependent: internal → "Lead Funnel", construction → "Bid & Award Funnel",
client → "Project Phase Progress".

**Chart 4 — Workload by person.** One row per team member: name, horizontal bar, task
count. Bar color encodes load: `#2F7D4A` has room (≤6), `#D2822E` at capacity (7–10),
`#B8410F` over capacity (>10).

**Chart detail popover — click, not hover.** Every data element in all four charts opens a
detail popover **on click**. Behavior:
- Click an element → popover appears anchored at the cursor (`clientX` / `clientY`).
- Click the same element again → dismisses.
- Click anywhere else in the document → dismisses (document-level click listener).
- The popover itself is `pointer-events: none`, so it never intercepts the dismiss click.
- Popover: dark `#173326` surface, white text, title row plus a set of label/value rows,
  with a per-chart accent color on the title.

This replaced an earlier hover implementation. Hover tooltips are not acceptable here —
the data is dense enough that users need to point at a bar, read, and move the mouse away
without the reading disappearing. Preserve click semantics on touch as tap.

**Invoice drawer.** Slides from the right, ~480px wide, white, list of invoices. Each row:
invoice number, project, amount, issued date, payment terms (Net 15 / Net 30 / Net 45),
computed due date, days late (red when > 0), and retention condition. The list is derived
from a ledger where each project carries programmed terms — terms, retention %, and billing
basis — so due dates and lateness are **computed, not stored**. Implement the same way.

---

### 2. CRM & Leads (`pipeline`)

Purpose: work inbound leads through to won or lost.

Kanban board, 11 stages, horizontally scrolling columns. Column: 280px wide, header with
stage name, count, and stage color as a 3px top border. Cards are draggable between columns;
dropping advances the deal's stage.

Card: white, 12px radius, 14px padding, 8px gap between cards. Contains deal name (13px/700),
client, value (`#173326`, 700), assigned person avatar, and stage age in days.

Controls: role filter (`pipelineRoleFilter`), and a kanban/list view toggle (`leadsView`).

Clicking a card opens the **deal drawer** with full detail, activity log, and stage actions.

**Qualification Scorecard** — modal. Five weighted criteria (location, scope, budget,
timeline, reputation), each a slider. Produces a total score that gates whether a lead can
advance. Scores persist on the lead.

**Workflow Editor** — modal. Lead stages are configurable per project type (`residential`,
`commercial`). Each stage carries: id, display name, color, default assignee role, and a
set of document templates (label + background/foreground color pair). The board renders
from this configuration — it is data, not hardcoded columns. Build it that way.

---

### 3. Projects (`projects`)

Card grid of active projects, `repeat(auto-fill, minmax(310px, 1fr))`, 10px gap.
Card shows project name, client, phase, contract value, and a compact budget bar.

Clicking opens **project detail** with tabs (`projDetailTab`): Overview, Budget, Team,
Documents, Photos. New/edit project is a full modal form.

Documents tab renders a folder tree with expand/collapse state (`openDocFolders`).
**Open question — confirm before building**: whether a document click should open in
SharePoint or in a new browser tab. Not yet decided.

Photos tab has album filtering (`photoAlbum`).

---

### 4. People (`people`)

Purpose: one directory covering staff, consultants, subcontractors, and vendors.

Header row: title, count, then a **project filter dropdown** pushed right with
`margin-left: auto`.

**The project filter is a custom popover, not a native `<select>`.** A native select was
tried and its clicks were unreliable in embedded contexts. Implementation:
- Trigger: pill, 7px/13px padding, 999px radius, 12px/700 text. Unfiltered state is white
  background with `#7E9B93` text; filtered state is `#173326` background with white text.
  Chevron rotates 180° on open, 0.15s transition.
- Menu: absolutely positioned, `top: calc(100% + 6px)`, right-aligned, min-width 190px,
  z-index 60, white, 12px radius, `0 12px 30px rgba(11,26,18,0.16)` shadow, 5px padding,
  max-height 260px with overflow scroll.
- Item: 8px/11px padding, 8px radius, 12px. Selected item is 700 weight, `#173326` text,
  `#DCE7DE` background.
- Opens on trigger click with `stopPropagation`; menu clicks `stopPropagation`; a
  document-level click listener closes it.

First option is always "All projects" (clears the filter).

View toggle (`peopleView`): `cards` / table. Cards are 310px min, showing avatar circle
(38px, colored by person kind), name, role, company, project chips (max N, then `+k`),
and a compliance badge — green dot + date when current, red when lapsed, "n/a" when not
applicable.

Person kinds have distinct colors: Internal, Client, Consultant, Subcontractor, Vendor.
Contacts can be grouped by company (`contactGroup`).

Clicking a person opens the person drawer. New person is a modal form capturing name, kind,
role, company, contact, phone, email, tier, projects, compliance date, compliance reference.

---

### 5. Tasks (`tasks`)

Purpose: track action items originating from meetings across all parties.

Three tabs (`taskTab`): **Internal**, **Owner**, **Subcontractor**. Each tab shows its count,
and counts respond to the active project filter.

Header row: tabs left; then the **project filter dropdown**, then **+ New Task** on the
right. The project filter uses the identical popover pattern as People (same trigger,
same menu, same dismiss behavior) — but with a slightly larger trigger (9px/16px padding,
13px/600 text) to match the button beside it. Build one shared component and use it in
both places.

Task record fields: `id` (formatted `YYYYMMDD-NN`), `meetingType`, `meetingDate`,
`assignedTo`, `status`, `originator`, `topicType`, `description`, `project`, plus due date
and closure detail. The project filter matches on `task.project`.

Table columns: ID, description, assigned to, originator, meeting date, status. Status is a
colored pill — Open, In Progress, Closed.

Clicking a row opens the task detail modal.

---

### 6. Module specification screens (19 routes)

Consistent template for every not-yet-built module. Max-width 1080px, vertical stack,
14px gaps, `fadeIn 0.3s ease` on mount.

1. **Header card** — 26px padding, `3px solid #D2822E` left border. Module title in
   Bricolage Grotesque 700 / 24px / `-0.02em`, a `#FBE9AE`/`#93520F` "planned" pill beside
   it, and the purpose statement at 14px, line-height 1.65, `#43514D`, max-width 680px,
   `text-wrap: pretty`.
2. **Two-column grid** `1.35fr 1fr`:
   - Left: "Screens in this module" — numbered list. Each row is `#FBF8F2`, 9px radius,
     10px/12px padding, with a 20px `#DCE7DE` numbered square.
   - Right: "Data captured" — field chips, 11.5px/600, `#EEF3EE` background,
     `1px solid rgba(23,51,38,0.1)`, 999px radius. Optional link row to a related built module.
3. **Footer note** — `#EEF3EE`, `1px dashed rgba(23,51,38,0.2)`, 12px radius, explaining
   the screen is a sketch pending prioritization.

Section headers throughout use the `hd()` pattern: 10px / 700 / uppercase / `0.1em` /
`#7E9B93` / 12px bottom margin.

---

## Role scoping

A role switcher in the topbar changes what the app presents. Three modes:

- **Internal** (default) — everything.
- **Construction** — funnel retitles to "Bid & Award Funnel"; construction modules foreground.
- **Client** — funnel retitles to "Project Phase Progress"; financial internals hidden.

Treat this as a presentation-layer concern in the prototype. In production it must be
enforced server-side — the prototype's client-side switching is a demo affordance only.

---

## Interactions & behavior

- **Routing**: `currentPage` selects the screen. All navigation is client-side; no reloads.
- **Drawers**: slide in from the right over a scrim. Dismiss on scrim click or Esc.
- **Modals**: centered over a scrim, dismiss on scrim click or Esc.
- **Popovers** (chart detail, project filters): dismiss on outside click via a single
  document-level listener registered on mount and removed on unmount. Register all
  dismissible state in that one handler rather than adding a listener per component.
- **Drag and drop**: pipeline cards between stage columns.
- **Toast**: success confirmation, `showSuccessToast` + `successToastMsg`, auto-dismisses.
- **Transitions**: bar widths `width 0.5s ease`; chevrons `transform 0.15s`; page mount
  `fadeIn 0.3s ease`. Nothing else animates — keep it restrained.
- **Responsive**: sidebar collapses to icons below 1024px; dashboard chart grid goes single
  column below 1100px; budget card enters its compact mode below 620px. Window width is
  tracked via a resize listener.

## State

Top-level state keys the prototype uses, grouped by concern. Most map to URL params or
local component state in a real implementation rather than a single global store.

**Routing / shell**: `currentPage`, `navOpen`, `winW`, role mode.
**Dashboard**: `dashTip` (`{key, title, rows, accent, x, y}`), `dashHelpBudget`,
`budgetScope`, `invoiceMonth`.
**People**: `peopleProject`, `peopleProjOpen`, `peopleView`, `contactGroup`,
`selectedPersonId`, `showNewPerson`, `newPerson`.
**Tasks**: `taskTab`, `taskProjectFilter`, `taskProjOpen`, `selectedTaskId`, `showNewTask`.
**Pipeline**: `selectedPipelineCard`, `pipelineRoleFilter`, `leadsView`, `selectedLeadId`,
`showLeadDetail`, `showNewLead`, `showConvertModal`, `convertType`, `showQualification`,
`qualScores`, `scores`.
**Workflow**: `wfPhase`, `editingWorkflowType`, `showWorkflowModal`, `selectedWorkflowTask`.
**Projects**: `selectedProjectId`, `projDetailTab`, `showProjectDetail`, `showEditProject`,
`showNewProject`, `editProjectIsNew`, `openDocFolders`, `photoAlbum`.
**Global**: `showSuccessToast`, `successToastMsg`, `showTemplatesLib`, `templateTabActive`.

## Data requirements

Replace each fixture method with an API call. The methods define the required shape:

| Method | Entity | Notes |
|---|---|---|
| `getFinance()` | Project budget | `name, exec, contract, labor, phase, base, co, reimb, baseUsed, coUsed, reimbUsed, timePct` |
| `getPipelineData()` | Deals | stage, value, client, owner, age, qualification scores |
| `getAllTasks()` | Tasks | keyed `internal` / `owner` / `subcontractor` |
| `getPeople()` | Directory | kind, role, company, contacts, projects[], compliance |
| `getInvoiceLedger()` | Invoices | amount, issued, terms, retention %, billing basis |
| `getWorkflows()` | Stage config | per project type; drives the kanban columns |
| `moduleSpec()` | Static content | purpose/screens/fields per unbuilt module — can stay static |

Derived, never stored: invoice due date and days-late (from issued + terms); budget
percentages; funnel conversion rates; workload counts; nav badge counts.

## Design tokens

**Colors**

| Token | Hex | Use |
|---|---|---|
| Ink | `#0B1A12` | Primary text |
| Forest | `#173326` | Headings, active fills, popover surface |
| Sidebar | `#0E1F16` | Sidebar background |
| Canvas | `#FBF8F2` | App background, list row background |
| Surface | `#FFFFFF` | Cards, drawers, menus |
| Body | `#43514D` | Body copy |
| Muted | `#7E9B93` | Secondary text, labels, schedule-time bar |
| Mint | `#DCE7DE` | Active nav, selected menu item |
| Mist | `#EEF3EE` | Chips, info panels |
| Track | `#EDF2ED` | Progress bar track |
| Success | `#2F7D4A` | On track |
| Success deep | `#1C5230` / `#145C33` | Chip text, won stage |
| Alert | `#8E2E0A` | Over-budget / slipping |
| Alert alt | `#B8410F` | Over capacity, negative delta |
| Amber | `#D2822E` | Outstanding, badges, spec accent |
| Amber deep | `#93520F` | Chip text on `#FBE9AE` |
| Amber light | `#FBE9AE` | Planned pill, template chips |
| Teal | `#2F6F68` / `#D6E8E5` | Template chip pair |
| Border | `rgba(20,8,31,0.06–0.12)` | Card and divider borders |

**Type**

- Display: **Bricolage Grotesque**, 700, letter-spacing `-0.02em` — page titles (20px),
  section titles (24px), KPI values (28px).
- UI: system sans. Sizes 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 14px.
- Section header: 10px / 700 / uppercase / letter-spacing `0.1em` / `#7E9B93`.
- Nav group label: 9.5px / 700 / uppercase / letter-spacing `0.12em`.
- Body: 14px / line-height 1.65.

**Spacing** — 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 26px.

**Radius** — 4px (bars) · 6px · 8px (menu item) · 9px · 10px (nav item) · 12px (menu, card) ·
14px (card) · 999px (pill).

**Shadow** — popover/menu `0 12px 30px rgba(11,26,18,0.16)`. Cards use borders, not shadows.

**Icons** — 24×24 viewBox stroke paths, `stroke-width: 1.6`, round caps, no fill. Defined
inline in `navIA()`; swap for the codebase's icon set, matching weight.

## Assets

No raster assets, no external images. Icons are inline SVG paths. The only external
dependency is the **Bricolage Grotesque** webfont — self-host it or load from the team's
font service. Avatars are initials on colored circles, generated from names.

## Open items

1. **File uploads** are placeholders everywhere — needs a real pipeline (storage, progress,
   validation, virus scanning if required).
2. **Construction workflow sequence** is not baselined. The Construction board's stage list
   needs sign-off from the delivery team before it is built.
3. **Document open behavior** — SharePoint deep link vs. new browser tab. Undecided.
4. **19 spec modules** need a design pass each before implementation.

## Files

- `Origami v4.dc.html` — the complete prototype. All screens, state, and fixture data.
- `support.js` — runtime support for the prototype format. **Not part of the design**;
  needed only to open the HTML file locally. Do not port it.

Open `Origami v4.dc.html` directly in a browser to walk the prototype.
