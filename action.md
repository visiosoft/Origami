# Action plan: Oct 26 review notes (work.pdf)

The source is a 32-slide PDF (the deck has 32 pages, not 50) covering Projects, CRM & Leads, Change Orders, Meetings, Navigation and Project.
Each item says what the slide asks for, what ODIN already does, and what's left.
Status: ✅ done · 🟡 partly built · ⬜ new · ❓ needs a decision first.

Working rules:
- Small commits; lint and tests before each one; staging only.
- Ask before any data-changing migration.
- Push to `master-oisp14` / `master` / `main`; Prod only when asked.

---

## A. Project card (slides 2–7, 31)

| # | Slide asks | Today | Action | Status |
|---|---|---|---|---|
| A1 | **Tab bar regroup** (slide 2): Project Overview · Special Actions · CRM Phase · Design Phase · Precon Phase · Build Phase · Project Financials · Project People · Project Files. | Tabs: Overview, Tasks & RFIs, Phase Board, Project Program, Project People, Financial, Files. | Rename and regroup the project drawer tabs. Design Phase = Phase Board (design phases) + Project Program; Build Phase = Phase Board (construction phases) + the other construction tools; CRM Phase = the lead's history (stages, notes, files) read-only from the pipeline. Precon Phase holds estimating, selections and schedule links for the project. | ✅ done (78e0704f) |
| A2 | **Overview contents** (slide 3): Project details (Priority, Stage, Location, Type of work, Short description, Referral), Site access, a **Financial dashboard** (contract type, base design contract, design CO amount, base build contract, build CO amount, current total), **one-line summaries** of each special action (Meetings, For Record, RFI, Task, CO, Approvals), then the Audit trail. | Details and site access ✅; audit trail ✅ (Oct 27); summary cards for tasks and RFIs only; no design/build contract split. | Add a "Short description" field. Add a Financial dashboard card fed from Financial (contract plus approved COs split Design / Build). Add count cards for Meetings, For Record, CO and Approvals next to Tasks and RFIs. | 🟡 → ✅ special-action tiles (Meetings, FOR RECORD, COs, Approvals); scope = short description; money summary existed. Design/Build contract split still open |
| A3 | **Special Actions tab** (slides 4, 31): keep the Tasks / RFIs switcher and add every special action (Meetings, For Record, Change Orders, Approvals) as buttons, all project-scoped. Keep the "24 late" chip. A button **blinks** when something in it changed since you last looked. | Tasks and RFIs only. | Add Meetings, For Record, Change Orders and Approvals views filtered to the project. Store a per-user "last seen" time per project and per kind; a button pulses when something changed after it. | ✅ done (5a36430f) |
| A4 | **Design Phase** (slide 5): put the Phase Board and the Project Program under "Design Phase"; do the same for construction under "Build Phase". | Separate tabs. | Part of A1: sub-tabs inside Design Phase (Board / Program) and Build Phase (Board / Daily reports / QA). | ✅ done with A1 (78e0704f) |
| A5 | **Project People** (slide 6): everyone on the project across each phase (CRM, Design, Precon, Construction), with Guest Access managed here. | ✅ Project People tab with guest access folded in (Oct 27). | Add a **phase** column/filter per person (CRM / Design / Precon / Construction). | ✅ done: phase chips + phase filter on Project People |
| A6 | **Project Files / markup** (slide 7). | Done in markup parts 1–4: named layers, pins with photos, links to pages and files, compare overlay, text size, PDF search; markups → RFI/task. | Left: (a) **stamp icons** that scale with the PDF (a small icon library: check, X, warning, north arrow, section and detail bubbles); (b) **"Save marked-up copy"**: say clearly that it's a new file and the original is untouched, and add "Revert to original" for the drawing in that file group; (c) a **pin → special action** button (Task, RFI, CO, For Record) right on the pin. | ✅ stamps (d749d21a); a markup makes an RFI, task, change order or FOR RECORD item; “Revert to original (v1)” and “Make current” in Version history; “Save marked-up copy” never changes the original |

## B. CRM & Leads (slides 8–14)

| # | Slide asks | Today | Action | Status |
|---|---|---|---|---|
| B1 | Lead panel tabs become **Current Stage · Special Actions · Client Card · CRM Files · Full Details**. "Overview" is confusing; the audit trail stays in Current Stage. | Overview · Notes · Client · Tasks · Files · (Programming) · Full Details. | Rename Overview → **Current Stage** (keep the stage tools and the audit trail). Tasks + Notes → **Special Actions** (FYI replaces "Notes"; no change orders in CRM). Client → **Client Card**. Files → **CRM Files** (follows the file decision). | ✅ done (a584f1bb) |
| B2 | **Full Details**: every stage's data, latest values only, tabbed by stage; a cell that changed shows **orange**; each stage can show **previous versions**. | One long Full Details view. | Stage tabs inside Full Details; keep a version history per stage (snapshot on each save); orange cells where the value differs from the previous version; "Previous versions" list per stage. | ✅ done: section tabs, orange changes, earlier versions (lead_versions table) |
| B3 | **Change lead status from the panel**, e.g. Project Programming → Hold 3 Months, and **assign People to roles** on the lead. | Only "Move to next" / "Back"; the role picker exists on the lead contacts. | Add a "Move to…" stage picker (all stages, including Hold 1/3/6/12, Cold/Lost, Cancelled/Pass, Referred) in the panel footer. Show the role assignments (PC, PM, …) in the panel header with quick edit. | ✅ “Move to…” stage picker (81979601); role assignments already on the Roles tab |
| B4 | **Holding & Refer Out**: when put on hold, assign someone to **follow up**; when referred out, assign a **Monitor**. Rename the "Cold or cancelled" card to **Dead Leads**; archive after 7 business days. | Holds and referrals listed; archiving after 7 business days ✅ (Oct 27); no follow-up owner or monitor. | Add a `followUpById` (hold) and `monitorById` (referred) person on the lead, asked for on the move; show it on the cards; the follow-up owner gets the "due to pick back up" reminder; the monitor gets the updates. Rename the card to "Dead Leads". | ✅ follow-up person (task due on hold date) + Monitor; “Dead leads” card |
| B5 | **Dead lead stages renamed**: Cold Lead → **Cold / Lost**, Cancelled / Rejected → **Cancelled / Pass**. | Stage names Cold Lead, Cancelled / Rejected. | Rename the labels only (keys stay `cold` / `rejected`, so no data change). | ✅ done (43dbda34) |
| B6 | **Reasons (slide 13–14)**. Cold: Ours / Theirs plus the last conversation date and notes. Lost: Unclear, Value, Experience, Reputation (asks *where found*, auto-creates a task), Trust, Quality, Timeline; more than one allowed, plus notes. Cancelled: Financial/Budget, Funding, Legal, Site conditions, Market, Other, each with sub-reasons, more than one allowed, plus notes. Pass: client score shown, reasons (score too low, bandwidth, cash flow, too small, too big, scope we don't do). | `LOSS_REASONS` has 6 flat reasons, single choice. | Replace with a reason tree (`dead-leads.ts`): kind (cold/lost/cancelled/pass) → reasons → sub-reasons, multi-select, plus notes and the last-conversation date. Reputation creates a task "Find the bad review" assigned to the lead owner. Existing single reasons map into the new tree (labels only; the old value is kept). | ✅ done (933bd585) |
| B7 | **Client score** on every client's Client section, visible in each CRM phase and in the project. | A Project Fit score exists at the Project Fit review stage. | Show the latest client score as a chip on the Client Card, the lead header, the Pass dialog and the project Overview. | ✅ done (57527d0e) |

## C. Change orders (slides 15–18)

| # | Slide asks | Today | Action | Status |
|---|---|---|---|---|
| C1 | **Workflow**: CE (change event) → PCO (potential CO, sent to the relevant subs like an RFP) → COR (formal proposal from prime or sub; internal Validated / Hold / Rejected; several CORs can be lumped into one PCCO) → **PCCO** (prime contract CO, owner signs; everyone sees scope and time, not cost) → **CCO** (commitment CO to each sub; only that sub sees its cost; signed). Plus a **CCD/DCD** directive path that proceeds before pricing (signature, or verbal/email noted). Approved PCCO updates the prime contract schedule of values; CCO updates the subcontract SOV. | One change order record: draft → submitted → approved/rejected, with client email and signature. | A change-event pipeline: new `change_events` (CE → PCO) with linked `cor` rows per sub; COR validation; group CORs into a PCCO (the existing CO becomes the PCCO); per-sub CCOs generated from the CORs, visible only to that sub; CCD/DCD as a directive flag on a CE that lets work start. SOV updates on approval. | ✅ |
| C2 | **Drivers and categories** (slide 18): driven by Force Majeure, Unknown site conditions, Authority, Procurement, Client request, Design E&O, Builder, Sub/third party. Category is one or more of Additive / Deductive / Zero-sum (dollar, time, scope). Originator and approver: Internal / Client / Third party. | `category` free text. | Add `driver` (picklist), `effects` (multi: additive/deductive/zero-sum × dollar/time/scope), `originator` and `approver` type. Filter by them on the CO list. | ✅ done (b9ca6e13) |

## D. Meetings (slides 19–27)

| # | Slide asks | Today | Action | Status |
|---|---|---|---|---|
| D1 | **SOP for outside meetings** (city on Teams, someone else's invite). | Not covered. | Add a "Outside meeting" type: paste the invite or link, organiser, platform; the same review flow afterwards. Write the SOP as a doc. | ✅ (SOP below and in the app) |
| D2 | **Import meeting data** from Google Meet docs: recording, transcript, full notes, quick notes. | Transcript and recording links are typed in by hand. | "Import from Google Doc": paste the Gemini notes doc link → read it through the connected Google account (Docs API) → fill the recording link, transcript, full notes and quick notes. | ⬜ ❓ (D2a) |
| D3 | **Quick notes summary → FOR RECORD** as Observation / FYI / Decision, convertible to other special actions. Each heading is the **title**, and **each bullet becomes its own item** (title repeated per bullet). Each keeps its source ("Hom Cafe Weekly Sync – 2026/10/24 12:45 PDT"). | Review step lets you add items by hand. | Parser: headings → title, bullets → one FOR RECORD item each (default type Observation, changeable), source = meeting title and time. Shown as a checklist to accept, edit or drop before saving. | ✅ done: “Turn notes into items” (81c2b3cf) |
| D4 | **Next steps → Tasks**: `[Name]` → assignee (changeable), "Title: detail" → title and description, a due date read from the text ("Monday", "Tuesday the 27th"); no date → priority High until changed. Source kept. | Not automatic. | Parser for next-step lines: match the bracketed name to a person; read relative dates against the meeting date; create tasks on the project board with `source`. Same review checklist as D3. | ✅ done (same commit) |
| D5 | **Visibility tags** on items from meetings: Internal, Client, External, Financial, CRM, Design, Construction (more than one). Anything financial is Internal until changed. | Not present. | Add a `tags` multi-select on special actions with those values; "Financial" forces Internal; filters on the lists honour them. | ✅ done (2d242b79) |
| D6 | **Quo texts and calls → Tasks**: a task created in Quo comes into ODIN as a Task with its origin ("Quo, text from Alton HVAC to Edward on Oct 21 2026 1:09 PM") and a link to the conversation if possible. Closing the task in ODIN closes it in Quo. Quo items always arrive as Tasks; the team re-buckets them. | Quo is wired for sending texts (item 11). | Quo webhook / poll for tasks (`/v1/tasks` if the API offers it) → create a Request Log task with `source`. On close in ODIN → mark it done in Quo. | ❓ (D6a) |

## E. Navigation (slide 29)

Colour key: red = not done, to discuss · orange = 50% · cyan = 90%, minor tweaks · yellow = more work.

| # | Item | Action |
|---|---|---|
| E1 | Dashboard, All Files (red) | Discuss what the dashboard must show and how All Files limits access. ❓ |
| E2 | Meetings, For Record, Change Orders, Design (orange) | Covered by D and C above. Design = the Asana-style board. |
| E3 | Projects, People, RFI, Task, CRM & Leads, Holding & Refer Out (cyan) | Covered by A and B. |
| E4 | Feedback and Warranty on hold | No work. |
| E5 | Consultant and GC/Sub Prequalify & RFP: RFP, proposals, leveling and selection; a selected party joins the project directory. | Check what's missing after A5 (project directory per phase). |

---

Done and on staging: A1, A2 (tiles), A3–A6, B1–B7, C1, C2, D1, D3, D4, D5, plus the loading states. Waiting on answers: D2, D6; A2's design/build contract split.
Done and on staging: A2 (tiles), A3, A5, A6, B1–B6, C2, D3, D4, plus the loading states. Waiting on answers: A1, B7, C1, D2, D5, D6 (questions below); A2's design/build contract split.

## Order of work (each one a small commit with tests, a browser check and a release note)

1. **B5** dead lead stage labels + **B4** "Dead Leads" card name. Labels only.
2. **B3** "Move to…" stage picker in the lead panel + role chips.
3. **B4** follow-up owner (hold) and Monitor (referred). Nullable columns.
4. **B6** reason tree (cold / lost / cancelled / pass) with notes and the Reputation task.
5. **B1** lead panel tabs renamed and regrouped (Current Stage, Special Actions, Client Card, CRM Files, Full Details).
6. **B2** Full Details by stage, orange changes, previous versions.
7. **A3** project Special Actions tab with every kind, plus the "changed" blink.
8. **A2** Overview: short description, Financial dashboard, summary cards.
9. **A1 / A4** project tab regroup (needs A1a).
10. **A5** phase per person on Project People.
11. **A6** markup: stamps, revert to original, pin → special action.
12. **C2** CO drivers, effects, originator and approver.
13. **D3 / D4** quick notes and next steps → FOR RECORD and Tasks (paste the text first; Google Doc import in D2).
14. **D5** visibility tags.
15. **D2** Google Doc import; **D1** outside meeting type and SOP.
16. **C1** full CE → PCO → COR → PCCO → CCO flow (needs C1a).
17. **D6** Quo tasks in and close-back (needs D6a).
18. **B7** client score everywhere (needs B7a).

## Answers (Oct 28)
- A1a: yes, all nine tabs (CRM Phase read-only lead history; Design = Phase Board design phases + Program; Precon = Estimating, Selections, Schedule; Build = construction phases + daily reports / QA).
- C1a: everything in one release (CE, PCO, COR, PCCO, CCO per sub, CCD/DCD, SOV updates).
- B7a: the client score is the Project Fit score.
- D5a: multi-select tags; Financial forces Internal.
- Still open: D2a (Google Docs access), D6a (Quo tasks API).

## Questions to settle before building those items
- **A1a**: Should the project tabs be exactly Overview · Special Actions · CRM Phase · Design Phase · Precon Phase · Build Phase · Financials · People · Files? And what goes into Precon Phase: Estimating, Selections and the Schedule for this project?
- **B7a**: Is the "client score" the Project Fit score, or a new score? If new, what goes into it?
- **C1a**: Build the whole CE → CCO flow at once, or start with CE → COR → PCCO (owner side) and add sub CCOs next? Should the existing change orders become PCCOs?
- **D2a**: Are the Gemini notes docs owned by the account that's connected in Settings → Google? Reading them needs the Docs read scope.
- **D5a**: Tags (multi-select) as listed, or a fixed "audience" plus phase tags?
- **D6a**: Does Quo's API expose tasks? Its public API lists messages, calls and contacts; if tasks aren't there, the fallback is a "Create ODIN task" from a Quo message link pasted into ODIN.

## SOP: outside meetings (D1)
For a meeting someone else set up — the city on Teams, a consultant's Zoom, a sub's call.
1. **When the invite arrives**: Special Actions → Meetings → + Meeting → Type **Outside**. Paste the invite and press *Fill in from the invite*. Check the title, date, time, organiser, their company and platform; pick the project.
2. **Who goes**: add our attendees. Accept the invite in your own calendar as usual — ODIN doesn't reply to it.
3. **During**: take notes in *Notes / minutes*. If they record it, ask for the recording or transcript.
4. **Afterwards**: paste their notes, the transcript or the recording link (or ours), set the status to *Occurred*, then *Review notes & transcript for special actions* — tasks, FOR RECORD items, RFIs and change orders, the same as our own meetings.
5. **Done**: the meeting turns *Complete* by itself once everything raised from it is done.

---

# Oct 31 requests

Status: ✅ done · 🟡 partly built · ⬜ new · ❓ needs an answer first.

## F. Drawings (PDF markup)

| # | Request | Today | Plan | Status |
|---|---|---|---|---|
| F1 | Change a markup's colour after it's drawn | Colour is picked before drawing only | Colour swatches in the selected markup's panel (author or admin) | ✅ |
| F2 | White, to cover black lines | 7 colours, no white | Add white to the palette (shows with a grey outline so it's visible) | ✅ |
| F3 | Text box that can be resized, text wraps | Text is one line that runs across the page | Text gets a width: drag the box's side handle to resize, the text wraps; saved and drawn the same in the PDF | ✅ |
| F4 | Copy / paste to duplicate with the select tool | None | Ctrl/⌘+C / V (and a Duplicate button) on the selected markup; pasted slightly offset, then drag it | ✅ |
| F5 | Polyline measure: segments totalled in one measurement | Length is one segment; area is a polygon | "Measure path": click points, double-click to finish, one total (each segment shown on hover) | ✅ |
| F6 | Multi-line with straight segments (not measuring) | Pen is freehand; line is one segment | "Polyline" tool: click points, double-click to finish | ✅ |
| F7 | Shapes: triangle, square, circle, polyshape, each outline or with a see-through fill | Box, ellipse, cloud — outline only | Add triangle and polyshape; a Fill toggle (25% of the colour) for box, ellipse, triangle, polyshape | ✅ |
| F8 | Markup labels | Each markup shows its kind (e.g. "Cloud — Andrea") | A short note on any markup, shown as a small tag beside it, in the list and in the PDF; searchable | ✅ |
| F9 | Upload symbols to drop like a pin, with a hover label | 7 built-in stamp icons | A symbol library (PNG/SVG) per company; Symbol tool drops one; its name shows on hover and in the list | ✅ |
| F10 | Name pages by sheet title (A100, E103) | "Page 1, 2, 3" | Read the sheet number from the page text (title block, bottom-right), let it be corrected; used in the page picker, links, search, list | ✅ |
| F11 | Make special actions without leaving the drawing | Creating an RFI/task/CO/record closes the drawing and opens its page | Create it in place; a toast offers "Open it"; the drawing stays open | ✅ |
| F12 | Touch: two-finger pinch to zoom, two-finger drag to pan, one finger / stylus draws | Mouse-wheel zoom; touch draws only | Pinch and two-finger pan on the drawing; one finger or a pen draws | ✅ |
| F13 | Mark up photos | Markup works on PDFs only | Open JPG/PNG files (and pin photos) in the same viewer, with the same tools | ✅ |
| F14 | i-1 and i-2 see all markups | Private markups show only to their author | Those roles see every markup, private ones too | ✅ |

## G. Priorities (six levels)

| Priority | Due |
|---|---|
| Emergency | 1–3 hours |
| Urgent | within 24 hours |
| High | within 5 business days |
| Medium | within 2 weeks |
| Low | within a month |
| Very Low | past one month |

Today: Urgent / High / Medium (a month) / Low (past a month). Plan: add Emergency and Very Low everywhere a priority is picked, filtered, sorted or checked; new default due dates (Emergency = today, Medium = 2 weeks, Low = 1 month, Very Low = 2 months); Settings → Task priorities shows the six. Existing tasks keep their priority (no data is rewritten). ✅

## H. Templates

| # | Request | Today | Plan | Status |
|---|---|---|---|---|
| H1 | How to add formatting | Agreement and Introduction templates have the formatting toolbar; Email, Document and Proposal templates are plain text | Formatting toolbar for Email, Document and Proposal templates too (emails send as HTML with a plain-text copy); SMS stays plain | ✅ |
| H2 | Preview a template (Settings and the Library) | None | "Preview" beside the editor: the template filled with sample (or a picked project's) data, as the email or PDF will look | ✅ |
| H3 | More merge fields ("tag options") | 10 fixed fields | Add more (client address, project address, project number, PM name/phone/email, company name/phone/address, today's date in words, proposal total…); a "+ Insert field" picker in the editor | ✅ (client first name, project address/number/type, your phone, company name/phone/email/address/website) |
| H4 | The Project Program PDF doesn't look good | — | Redesign the PDF: cover/header with logo, clear phase table, spacing and type | ✅ (laid out by the app, no Google Docs conversion) |

Order agreed (Oct 31): G priorities → F drawings → H templates.

## I. Oct 30 sync (System and file structure)

| # | Request | Status |
|---|---|---|
| I1 | Access: roles enforced on every module; "Assigned projects" holds everywhere; every login linked to People | ✅ (on Prod) |
| I8 | Contracts: a pasted contract keeps its formatting; owner name and other fields fill in; email yourself a preview | ✅ (paste cleanup for Word / Google Docs, ⤓ Word import of .docx, fields grouped under + Insert field, "Email me a preview" with the PDF) |
| I7 | Tags: standard set + custom tags in one shared list, reusable and filterable; auto-tags | ✅ (shared tag bank, Settings → Tags; auto: Internal by default, CRM/Design/Construction by origin, Financial with a CO, personal tags Internal; filters on board and Log) |
| I10 | Layer access: choose who sees each layer (Internal only, a given sub) | ✅ (Everyone / Our team / picked people or companies; downloads follow it) |
| I11 | iPad: tune markup tools for tablets | ✅ (44px+ tools, bigger swatches/grips, slide-over list in portrait, Pencil palm rejection) |
| I6 | Navigation regroup | ✅ (Special Actions under Main; Pre-construction back office only; Construction regrouped with QA/QC & Safety and Plan & File Room; Resource Enterprise Management = Procurement + Equipment + Manpower) |
| I5 | Two file areas: All Files vs per-project Plan & File Room (build set) | ✅ (☆ build-set folders per project; field roles see only those; file changes need File Room manage, enforced on the server) |
| I3 | Drive as the backup of record (PDF, REV1/REV2) | ✅ for signed contracts and the Project Program as sent ("Backups of record" folder). Renderings and Word files: open |
| I4 | Per-project backup Google Sheet, refreshed on a schedule | ✅ (Tasks, RFIs, COs, FOR RECORD, Meetings tabs; nightly 2am once switched on; Refresh now) |
| I2 | People without logins (name + rate) for daily reports and weekly pay | ✅ checked, no change needed: a People “Staff” entry without email gets its Manpower employee at once; the rate is set in Manpower → Employees; daily report crew, weekly timesheets and payroll use the employee, not an email (only self-service “My Timesheet” needs a login) |
| I9 | Emergency tasks alert the team at once | ✅ (assignee, collaborators, originator + every admin; text + email + bell, always on; sent once) |

## J. Nov 3 sync (Weekly Sync – Ehsan + Origami DB)

| # | Request | Status |
|---|---|---|
| J1 | Superintendent (George) sees too much: projects, leads, address book; resource management changes only by Astrid / accounting | ✅ field roles default to Assigned projects; leads follow Assigned projects; outside contacts only on your projects; writes in Manpower, leads and People need manage |
| J2 | Markup notes typed in the side panel appear on the drawing; email markups; iPhone scrolling conflicts | ✅ notes stay in the panel (not drawn), up to 1,000 chars; Email button (saves a copy, emails its link); safe-area padding and touch handling on iPhone |
| J3 | Automate drawing titles (OCR, no AI) | ✅ number + title from the title-block text; scans via Drive OCR; ↻ to re-read; ✎ to fix |
| J4 | Photos: thumbnails, date sort out of order, duplicates / missing sort buttons | ✅ Progress Photos already shows thumbnails and sorts by ISO date; fixed photos chaining as versions (same name) and added a Name / Newest / Oldest sort to the File Room grid and list |
| J5 | Working in a project bounces you out of it | ✅ project + tab in the URL (Back works), “← Back to <project>” on pages opened from it, wider overview |
| J6 | Add the field report to the approvals view (no switching logins) | ✅ field form in admins’ menu; Approvals opens the report; project links pre-filter |
| J7 | Meeting transcripts and notes integrated, tasks created and assigned from them | ✅ hourly pull of “Notes by Gemini” from Drive into the meeting; Import from Google (link or search); parser reads Gemini headings, decisions and next steps for review → tasks / FOR RECORD |
| J8 | CSI codes on drawing markups, tracked through change orders to the base contract | ✅ CSI code on markups, RFIs and Log entries; carried from a markup onto its CO line / RFI / task; CSI filters on RFIs and the Log |
| J9 | Remove duplicate user roles | ✅ built; waiting on an admin to press “Merge duplicates” on staging after checking who moves |
| J10 | Markup mobile-friendly on iPhone and iPad | ✅ one-row header + ⋯ More; tool groups; Done pill + double-tap; long-press select + action bar; bottom sheets; touch gestures; landscape rail; phone canvas cap; home-screen app |

## K. Financial tab: Estimate / Prime contract (from the Development Task Tracker, Nov 4)

| # | Item | Status |
|---|---|---|
| K1 | Estimate maths F1–F19 (line price, NIS = $0, GR, total build = (subtotal + GR) ÷ (1 − profit% − contingency%), discount, design cost, cost split, payments) with formula descriptions; tested on the Catherine example | ✅ |
| K2 | Estimate tables: estimates (revisions), scopes, lines (items + Details/Inclusions/Exclusions/A&C rows, sub columns, markup), GR lines, custom columns | ✅ |
| K3 | Estimate API: list, create (EST-001 + standard GR lines), open with live totals, save whole sheet (version-checked), settings, mark sent (frozen), revise (Rev 2), delete draft | ✅ (accept comes with K9) |
| K4 | Spreadsheet-style editor in Precon → Estimating (rows, columns, tables, paste from Excel, undo, ⓘ formulas) | ✅ /estimating?project=; band show/hide; row menu; GR, totals, payments; freeze on send. Custom columns are K5 |
| K5 | Custom columns with formulas; company estimate template | ⏳ |
| K6 | Canned statements per CSI code + suggestions from past estimates | ⏳ |
| K7 | Who sees what (money data types × role, book type per project), enforced on the server | ⏳ |
| K8 | Estimate letter PDF, email, e-sign; .xlsx export | ⏳ |
| K9 | On acceptance: SOV, budget per CSI, draft subcontracts, contract value, billing schedule | ⏳ |
| K10 | Sub bid packages (without our amounts) | ⏳ |
