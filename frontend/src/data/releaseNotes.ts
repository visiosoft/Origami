/**
 * Release notes -- what changed, in the office's words, newest first. Shown
 * under Help & Support -> What's new; the sidebar marks Help as "New" until
 * someone has seen the latest release. Add a release at the top with each
 * deploy that changes something people will notice.
 */
export interface ReleaseItem {
  area: string;
  /** One line: what's different, in plain words. */
  text: string;
  /** Where to find it, e.g. "People → Import from spreadsheet". */
  where?: string;
  kind?: 'new' | 'improved' | 'fixed';
}
export interface Release { id: string; date: string; title: string; items: ReleaseItem[] }

export const RELEASES: Release[] = [
  {
    id: '2026-10-28r',
    date: '2026-10-28',
    title: 'CRM: move a lead anywhere; someone owns every hold and referral',
    items: [
      { area: 'CRM', kind: 'new', text: '“Move to” in the lead panel sends a lead straight to any stage — e.g. Project Programming → Hold - 3 Months — with the same checks as dragging.', where: 'CRM & Leads → open a lead → Move to' },
      { area: 'CRM', kind: 'new', text: 'Putting a lead on hold asks who picks it back up; they get a task due on the hold date. Referring a lead out asks who monitors it. Both show (and can be changed) on Holding & Refer Out.', where: 'CRM & Leads; Holding & Refer Out' },
    ],
  },
  {
    id: '2026-10-28q',
    date: '2026-10-28',
    title: 'Dead leads: Cold / Lost and Cancelled / Pass, with the full reasons',
    items: [
      { area: 'CRM', kind: 'improved', text: 'The dead-lead columns are now Cold / Lost and Cancelled / Pass, and Holding & Refer Out groups them as “Dead leads”.', where: 'CRM & Leads; Holding & Refer Out' },
      { area: 'CRM', kind: 'new', text: 'Moving a lead to Cold / Lost asks: Cold (ours or theirs, with the last conversation date) or Lost (unclear, value, experience, reputation, trust, quality, timeline — one or more). Moving to Cancelled / Pass asks: Cancelled (budget, funding, legal, site, market or other, each with its own sub-reasons) or Pass (score too low, bandwidth, cash flow, too small, too big, scope). Our own notes go with every one.', where: 'CRM & Leads → drag to a dead column, or Reject' },
      { area: 'CRM', kind: 'new', text: 'Lost for Reputation asks where the review was found and makes a high-priority task for the lead’s owner to follow it up.', where: 'CRM & Leads' },
    ],
  },
  {
    id: '2026-10-28p',
    date: '2026-10-28',
    title: 'You can always see when something is loading',
    items: [
      { area: 'General', kind: 'improved', text: 'A thin bar runs along the top of the screen while a page or its data is on the way, so a slow first open no longer looks frozen.', where: 'Everywhere' },
      { area: 'General', kind: 'improved', text: 'Pages and panels show shimmering placeholders until their data arrives, instead of a blank space or a misleading “0” / “No one matches” (Dashboard, Projects, People, CRM & Leads and every list).', where: 'Everywhere' },
    ],
  },
  {
    id: '2026-10-28o',
    date: '2026-10-28',
    title: 'Task panel: actions first, history in pages',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Duplicate…, Convert to and Delete task now sit above the comments, so you don’t scroll past the whole history to reach them.', where: 'Open any task' },
      { area: 'Tasks', kind: 'improved', text: 'A task’s comments and history show 20 at a time with page numbers, loaded from the server a page at a time, so long histories open quickly.', where: 'Open any task → Activity' },
    ],
  },
  {
    id: '2026-10-28n',
    date: '2026-10-28',
    title: 'Faster pages: smaller downloads, pages, and quick back-and-forth',
    items: [
      { area: 'General', kind: 'improved', text: 'The app loads much less up front: each page’s code is fetched the first time you open it.', where: 'Everywhere' },
      { area: 'General', kind: 'improved', text: 'Going back to a page you just visited is instant: lists you opened in the last minute come from memory. Anything you open to edit is always fresh, and your own saves show straight away.', where: 'Everywhere' },
      { area: 'File Room', kind: 'improved', text: 'The File Room opens straight away: folders and counts load first, then files 50 a page with page numbers. Search covers every file.', where: 'File Room' },
      { area: 'Tasks', kind: 'improved', text: 'The Special Actions Log shows 50 entries a page, with page numbers and a page-size picker; search, filters and sorting cover every entry.', where: 'Special Actions → Task → Special Actions Log' },
      { area: 'Tasks', kind: 'improved', text: 'Long board columns show their first 25 cards with “Show more”.', where: 'Special Actions → Task' },
      { area: 'Dashboard', kind: 'improved', text: 'The Dashboard’s task cards and My Tasks load just the figures they show.', where: 'Dashboard' },
    ],
  },
  {
    id: '2026-10-28m',
    date: '2026-10-28',
    title: 'Task lists load in a moment',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'The Dashboard, My Tasks, the Task board, Special Actions, Meetings and My Calendar now get their task lists straight from the server’s memory instead of the database each time — they open in a moment, and any change anyone saves shows on the next load.', where: 'Dashboard · Special Actions → Task · My Tasks' },
    ],
  },
  {
    id: '2026-10-28l',
    date: '2026-10-28',
    title: 'Faster Task page and notifications',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'The Task board and the Special Actions Log open much faster: the list no longer carries every task’s full comment thread and history — a task’s comments and history load when you open it.', where: 'Special Actions → Task' },
      { area: 'General', kind: 'improved', text: 'The notifications bell now checks only your own open tasks, instead of downloading every task every two minutes in each open tab — the whole site is lighter as a result.', where: 'The bell, top right' },
    ],
  },
  {
    id: '2026-10-28k',
    date: '2026-10-28',
    title: 'Drawing markup: compare two revisions',
    items: [
      { area: 'Files', kind: 'new', text: 'Compare a drawing with another revision (⇄ Compare): what was removed shows in red, what was added in blue, and what’s unchanged in black. Flip to the older or newer one on its own, and nudge it to line up scans. Your markups stay on top.', where: 'All Files → a revised PDF → Mark up → ⇄ Compare' },
    ],
  },
  {
    id: '2026-10-28j',
    date: '2026-10-28',
    title: 'Drawing markup: links to other pages and files',
    items: [
      { area: 'Files', kind: 'new', text: 'Draw a 🔗 link box over a callout and point it at another page of the drawing (e.g. the detail sheet) or another file in the project — like an inspection card, which you can upload right from the link. Clicking someone’s link (or double-clicking your own) follows it; “← Back” takes you back.', where: 'All Files → a PDF → Mark up → 🔗' },
      { area: 'Files', kind: 'improved', text: 'In a downloaded marked-up PDF, page links are clickable and file links open the file in Origami.', where: 'All Files → a PDF → Mark up → Download marked-up PDF' },
    ],
  },
  {
    id: '2026-10-28i',
    date: '2026-10-28',
    title: 'Drawing markup: text size, search, clearer closing, faster',
    items: [
      { area: 'Files', kind: 'improved', text: 'Pick the text size (8–36 pt) before adding text, and make a selected text bigger or smaller with A− / A+.', where: 'All Files → a PDF → Mark up → T' },
      { area: 'Files', kind: 'new', text: 'Search a drawing (🔍 or Ctrl+F): room names, notes and sheet titles across every page, plus the notes on markups and pins. Each match is highlighted; Enter goes to the next.', where: 'All Files → a PDF → Mark up → 🔍' },
      { area: 'Files', kind: 'improved', text: 'Closing is clearer: “✕ Close drawing” closes it, “Hide list” only hides the side list, and Esc just backs out of what you’re doing — it no longer closes the drawing. Markups save as you draw (“✓ Saved”).', where: 'All Files → a PDF → Mark up' },
      { area: 'Files', kind: 'improved', text: 'Faster on big sheets: zooming no longer redraws on every step, pages you’ve just seen come back instantly, and zooming far in on a large drawing no longer leaves the page blank.', where: 'All Files → a PDF → Mark up' },
    ],
  },
  {
    id: '2026-10-28h',
    date: '2026-10-28',
    title: 'Drawing markup: pins with site photos, and named layers',
    items: [
      { area: 'Files', kind: 'new', text: 'Drop a pin (📌) on a drawing to mark a spot, with a note and site photos from your phone’s camera or files. Tap a photo to see it full size. From a pin you can make an RFI or a task, like any markup. Photos are kept in the project’s “Markup photos” folder.', where: 'All Files → a PDF → Mark up' },
      { area: 'Files', kind: 'new', text: 'Named layers: pick “+ New layer…” under Layers (e.g. “Electrical walk”, “Owner comments”), and what you draw goes on it. Rename a layer with ✎ and it changes for everyone; move a markup to another layer from its details. Show or hide layers, and the download or saved copy includes only the ones you’re showing.', where: 'All Files → a PDF → Mark up → Layers' },
    ],
  },
  {
    id: '2026-10-28g',
    date: '2026-10-28',
    title: 'See when a client opened what you sent',
    items: [
      { area: 'CRM', kind: 'new', text: 'A sent proposal shows “Opened Oct 28, 9:12 AM · 3 views” or “Not opened yet”, and the lead’s timeline and your notifications say when the client first opens it.', where: 'CRM & Leads → a lead on Proposal' },
      { area: 'Contracts', kind: 'improved', text: 'Each signer shows when they opened their contract and how many times.', where: 'Contracts → a contract' },
      { area: 'Finance', kind: 'new', text: 'Change orders emailed to the client now include a “View the change order” button (the PDF is still attached); the change order shows when they opened it.', where: 'Change Orders → a change order' },
      { area: 'Files', kind: 'new', text: 'Files emailed from the File Room show whether they’ve been opened. Opens count people only — email security scanners that check every link are left out.', where: 'All Files → Shared' },
    ],
  },
  {
    id: '2026-10-28f',
    date: '2026-10-28',
    title: 'Text a client from a template, through Quo',
    items: [
      { area: 'CRM', kind: 'new', text: '“Text client” on a lead, a contact and a project: pick an SMS template and it fills in the client’s name, the project and your name; edit and send. Every text — sent or not — is listed under it.', where: 'CRM & Leads → a lead · People → a contact · Projects → Overview' },
      { area: 'Settings', kind: 'new', text: 'Texts can go out through Quo from the office line (650) 761-4661, so replies come back to Quo. An administrator switches SMS to Quo and adds the Quo API key; Twilio still works as before.', where: 'Settings → SMS' },
    ],
  },
  {
    id: '2026-10-28e',
    date: '2026-10-28',
    title: 'Tasks first on the Dashboard',
    items: [
      { area: 'Dashboard', kind: 'improved', text: 'Needs attention / My latest tasks and This week now come first on the Dashboard, ahead of the project and money cards — on a phone they’re the first thing you see.', where: 'Dashboard' },
    ],
  },
  {
    id: '2026-10-28d',
    date: '2026-10-28',
    title: 'Save & close everywhere; Project People; audit trail on the Overview',
    items: [
      { area: 'Projects', kind: 'new', text: 'The project Overview has its audit trail back — who changed what and when. Changes since you last looked are marked New and highlighted.', where: 'Projects → a project → Overview' },
      { area: 'Projects', kind: 'improved', text: 'The Subcontractors tab is now Project People: who is on the project (consultants, subs, client), their subcontracts, and guest access, in one place. The separate Guest Access tab is folded in.', where: 'Projects → a project → Project People' },
      { area: 'Everywhere', kind: 'improved', text: 'Editing panels now end the same way: “Save & close” saves and closes in one press, and the × at the top right closes (your edits are kept). The separate “Done” buttons on the People and Project forms are gone; “Discard” appears only for a new record you haven’t named yet.', where: 'Tasks, Special Actions Log, Phase Board, Projects, People, RFIs, Change orders' },
    ],
  },
  {
    id: '2026-10-28c',
    date: '2026-10-28',
    title: 'Same task columns on every board',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Task board columns are now the same on every project’s board and General. Adding, renaming (saved when you leave the name), moving or deleting a column changes it on every board; a deleted column’s tasks move to each board’s first column.', where: 'Task → Board' },
      { area: 'Tasks', kind: 'new', text: '“Make every board match” lines every other board up with the one you’re on — once, after you confirm. No task is deleted. New project boards start with General’s columns.' },
      { area: 'Access', kind: 'improved', text: 'Only administrators and principals can add, rename, move or delete columns.' },
      { area: 'Tasks', kind: 'improved', text: 'The Task page controls stay in three fixed rows — views, then filters and sort, then saved views — so nothing moves when you switch between Dashboard, Board, Timeline and List. On a phone the pill groups swipe sideways instead of running off the screen.' },
    ],
  },
  {
    id: '2026-10-28b',
    date: '2026-10-28',
    title: 'Dead leads: Cold / Loss and Cancelled / Passed',
    items: [
      { area: 'CRM', kind: 'improved', text: '“Cold Lead” is now Cold / Loss and “Cancelled / Rejected” is now Cancelled / Passed.' },
      { area: 'CRM', kind: 'new', text: 'Moving a lead to Cold / Loss, or marking that the client passed, asks why: value proposition, experience, trust, quality, timeline or other. The reason shows on the card and is kept for marketing and training.' },
      { area: 'CRM', kind: 'new', text: 'Cold / Loss and Cancelled / Passed leads leave the board on their own 7 business days later (restore them from Archived). Leads on hold stay put. Leads already there get the full 7 business days from today.' },
    ],
  },
  {
    id: '2026-10-28a',
    date: '2026-10-28',
    title: 'Special Actions Log; update notice on the login page',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'The Request Log is renamed the Special Actions Log everywhere — the Task page toggle, Settings, Meetings, notifications and the audit log. Nothing in it changed.', where: 'Special Actions → Task → Special Actions Log' },
      { area: 'System', kind: 'improved', text: 'The system notice now shows on the login page too, and the login page says when the server is restarting for an update — so an update isn’t mistaken for an outage. Post one before each update instead of emailing everyone.', where: 'Settings → System notice' },
    ],
  },
  {
    id: '2026-10-27p',
    date: '2026-10-27',
    title: 'No more “Hi {client_name}” emails',
    items: [
      { area: 'Email', kind: 'fixed', text: 'Emails, letters, proposals and texts can’t be sent while a merge field is still unfilled — the compose box lists what’s missing (e.g. project title) and Send waits until it’s filled.' },
      { area: 'Email', kind: 'improved', text: 'Merge fields can be written {{clientName}} or {client_name} — both fill in. Your name and email now fill {{senderName}} and {{senderEmail}}, and the template Send window has a Project field.' },
      { area: 'Templates', kind: 'improved', text: 'Saving a template with a misspelt merge field is refused with a suggestion (“{{client_nme}} isn’t a merge field — did you mean {{clientName}}?”). The editor lists the fields you can use.', where: 'Library → Email, SMS & Documents / Agreements' },
    ],
  },
  {
    id: '2026-10-27o',
    date: '2026-10-27',
    title: 'Site visit invites go out from the app',
    items: [
      { area: 'CRM', kind: 'improved', text: '“Save & send invite” on Schedule Site Visit now sends a real Google Calendar invite from your calendar to the client and the site visit team — Edward, Langston and Astrid by default. Mark each person Required or Optional, remove anyone, or add another guest by email.', where: 'CRM & Leads → a lead on Schedule Site Visit' },
      { area: 'CRM', kind: 'new', text: 'The invite description carries the scope (project type, vision, budget, timing), any preliminary info you add, and — if you tick it — the lead’s Zoning Analysis. Preview it before sending. Rescheduling updates the same invite.' },
      { area: 'Settings', kind: 'new', text: 'Set who is invited to site visits by default, each required or optional.', where: 'Settings → Calendars → Site visit team' },
    ],
  },
  {
    id: '2026-10-27n',
    date: '2026-10-27',
    title: 'Assign and describe a task as you add it',
    items: [
      { area: 'Tasks', kind: 'improved', text: '“+ Add task” on the board now asks who it’s for and any details before you add it — no need to open the task afterwards.', where: 'Task → Board, List or Timeline → + Add task' },
      { area: 'Tasks', kind: 'improved', text: 'Subtasks take details too, when you add or edit one.' },
      { area: 'Tasks', kind: 'fixed', text: 'Collaborators added to a Request Log entry are now saved (they were being dropped), and a Request Log entry’s resolution is kept when it’s created.' },
    ],
  },
  {
    id: '2026-10-27m',
    date: '2026-10-27',
    title: 'Task numbers carry the project code',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Task numbers now start with the project’s code — NARV-T-2026-0007 — so the same number never means two tasks. Tasks on no project use GEN. The code is made from the project name; change it under Edit project → Task number prefix.', where: 'Projects → Edit project' },
      { area: 'Tasks', kind: 'fixed', text: 'A project’s board tasks and Request Log entries now share one number sequence, and task ids are made so two saves at the same moment can no longer collide (that could overwrite a task).' },
    ],
  },
  {
    id: '2026-10-27l',
    date: '2026-10-27',
    title: 'New Lead: every field answered or N/A',
    items: [
      { area: 'CRM', kind: 'improved', text: 'Every field on the New Lead intake is required, with an N/A button for anything that doesn’t apply. You can still save as you go; the lead can’t move past New Lead (except to a hold or closed) until every field is answered or N/A. Each section shows how many are left.', where: 'CRM & Leads → New Lead' },
      { area: 'CRM', kind: 'improved', text: '“Is there a secondary contact?” Yes / No: the extra contacts only open when there is one.' },
    ],
  },
  {
    id: '2026-10-27k',
    date: '2026-10-27',
    title: 'Lead contacts: spouse and partner kept apart',
    items: [
      { area: 'CRM', kind: 'improved', text: 'Every extra contact on a lead has “Relationship to the lead” — Spouse, Partner, Business Partner, Family Member and more — separate from their job title. Older contacts with “Spouse” typed as their title show it as the relationship.', where: 'CRM & Leads → a lead → contacts' },
    ],
  },
  {
    id: '2026-10-27j',
    date: '2026-10-27',
    title: 'Contracts signed in ODIN',
    items: [
      { area: 'Contracts', kind: 'new', text: 'Draft GC, owner, sub and consultant contracts and change orders (with the owner or a sub) from templates that fill in the project, the people and the change order. Attach the estimate, drawings and specs from the File Room.', where: 'Special Actions → Contracts' },
      { area: 'Contracts', kind: 'new', text: 'Each signer gets their own link: they read the contract and its attachments, initial every marked section and sign — no account needed. Origami signs last, in ODIN. The signed PDF is saved to the project’s File Room (Contracts folder) and can be downloaded by everyone who signed.' },
      { area: 'Contracts', kind: 'new', text: 'A change order with the owner signed this way is marked approved by the owner automatically.' },
      { area: 'Admin', kind: 'new', text: 'Edit the wording for each kind of contract, with fields to fill in and {{initials}} boxes. The starting wording should be reviewed by counsel. Add your contractor licence number under Branding.', where: 'Settings → Workspace → Contract templates' },
    ],
  },
  {
    id: '2026-10-27i',
    date: '2026-10-27',
    title: 'Contacts: import from a phone, Gmail or Outlook',
    items: [
      { area: 'People', kind: 'new', text: 'Import contacts exported from a phone (.vcf vCard), Google Contacts / Gmail or Outlook (CSV or vCard). Pick what kind of contacts they are; for firms, the person becomes the primary contact.', where: 'People → Import' },
      { area: 'People', kind: 'improved', text: 'Imports skip anyone who looks like a contact already here — same name, email or phone, expired contacts included — and say who they matched.' },
    ],
  },
  {
    id: '2026-10-27h',
    date: '2026-10-27',
    title: 'Contacts: Activity, point of contact and alerts',
    items: [
      { area: 'People', kind: 'new', text: 'Each contact has an Activity section: log calls, emails, meetings, site visits and notes; see their RFPs and proposals; and tick who is the point of contact for their company (one per company).', where: 'People → open a contact → Activity' },
      { area: 'People', kind: 'new', text: 'Alerts move a contact to Review: no “interested” reply to the last 2 RFPs, no response after an RFP closed, said interested but never submitted, 3 proposals without an award (give feedback), or no known interaction in 12 months. Review lifts on its own when the alert clears.' },
      { area: 'Contractors', kind: 'improved', text: 'Estimates & bids have two new outcomes — “RFP sent — no reply” and “Interested — not submitted” — and a Bids due date.', where: 'Manpower → Contractors → Estimates & bids' },
    ],
  },
  {
    id: '2026-10-27g',
    date: '2026-10-27',
    title: 'Contacts: Connections',
    items: [
      { area: 'People', kind: 'new', text: 'Connections on every contact: the companies they used to work at (with their role and when), and on a company, the people who used to work there and where they are now. Linking an expired record as the same person adds its old company automatically.', where: 'People → open a contact → Connections' },
    ],
  },
  {
    id: '2026-10-27f',
    date: '2026-10-27',
    title: 'Contacts: duplicate check and a reason for Expired',
    items: [
      { area: 'People', kind: 'new', text: 'Adding a contact checks for someone already here with the same name, email or phone — expired contacts first. Choose "Same person" to link the two records (each shows the other under Reference, read-only) or "Not a duplicate" to add it on its own.', where: 'People → Add' },
      { area: 'People', kind: 'improved', text: 'Marking a contact Expired asks why; the reason is required and shows wherever the status does.' },
    ],
  },
  {
    id: '2026-10-27e',
    date: '2026-10-27',
    title: 'Task filters: All by default, sorting, saved boards',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Special Actions → Task always opens on all tasks, everyone\'s. Saved views bring back the board and filters you use often.', where: 'Special Actions → Task' },
      { area: 'Tasks', kind: 'new', text: 'Sort the Board, Timeline and List views by due date, priority, status, name, assignee or created date (or keep the board\'s own order). Saved views remember the sort and which board they were made on.' },
    ],
  },
  {
    id: '2026-10-27d',
    date: '2026-10-27',
    title: 'On hold needs a reason; project task panels match the board',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Putting a task on hold — from its status, or by dragging it into an On Hold column — asks why. The reason is required and shows on the card.' },
      { area: 'Tasks', kind: 'improved', text: 'Task panels opened from a project\'s phase board work like the Task Board: emails go out when you press Save, subtasks can be edited in place, and the assigner and task number show at the top.' },
    ],
  },
  {
    id: '2026-10-27c',
    date: '2026-10-27',
    title: 'Pick a role\'s type',
    items: [
      { area: 'Users & Roles', kind: 'new', text: 'New role asks for its type — Internal, Client or Third Party — instead of using the tab you were on. A role\'s type can be changed in Edit role while nobody has the role; built-in roles keep theirs.', where: 'User Access & Roles → Roles → + Role' },
      { area: 'Users & Roles', kind: 'improved', text: '"Third-party" is now written "Third Party" everywhere.' },
    ],
  },
  {
    id: '2026-10-27b',
    date: '2026-10-27',
    title: 'What each priority means',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Every priority picker (tasks, Request Log, phase tasks, RFIs) shows what the chosen priority means, with "What do priorities mean?" for all four and their due windows.' },
      { area: 'Admin', kind: 'new', text: 'Admins can change the wording of each priority\'s meaning. The due-date windows stay as they are.', where: 'Settings → Workspace → Task priorities' },
    ],
  },
  {
    id: '2026-10-27a',
    date: '2026-10-27',
    title: 'Audit log across the app',
    items: [
      { area: 'Admin', kind: 'new', text: 'An audit log of every change saved anywhere in the app — who made it, when, which record, and what changed (before and after for projects, contacts, users, roles, tasks, leads, deals and RFIs). Finance changes are included from Finance\'s own log. Search, filter by person, record, project and dates, and export to CSV. Admins only.', where: 'Settings → Workspace → Audit log' },
      { area: 'Tasks', kind: 'fixed', text: 'A Request Log task\'s Date Change Audit Trail now lists the real due-date changes and who made them (it showed example entries before), and Open Days counts from the meeting date.' },
    ],
  },
  {
    id: '2026-10-25b',
    date: '2026-10-25',
    title: 'Budget & Time vs Used by Project, on live figures',
    items: [
      { area: 'Dashboard', kind: 'new', text: 'The Classic dashboard\'s Budget & Time vs Used by Project chart is in the new look, on real figures: each bar is the contract plus change orders plus approved reimbursables, filled with what\'s been billed, with a marker for time used. A second line compares time used with costs spent (for people who can see costs). Filter by DO / BO / DB / PDB; click a project for the breakdown.', where: 'Dashboard' },
      { area: 'Projects', kind: 'new', text: 'Projects have Pricing (LS, T&M, T&M NTE, CS) and Labour (PW, CP), shown as badges on the dashboard chart.', where: 'Projects → Edit project' },
    ],
  },
  {
    id: '2026-10-25a',
    date: '2026-10-25',
    title: 'Email task links open the task after signing in',
    items: [
      { area: 'Tasks', kind: 'fixed', text: 'Opening a task or subtask link from an email while signed out (a phone, or a session that had expired) now opens that task once you sign in — it used to land on the Dashboard.' },
    ],
  },
  {
    id: '2026-10-24a',
    date: '2026-10-24',
    title: 'Dashboard charts in the new look',
    items: [
      { area: 'Dashboard', kind: 'new', text: 'Invoiced vs Collected: the last six months of issued invoices against payments received, with what’s still open on each month’s invoices (past due in orange). Tiles add up past due, within terms and retention held; click a month to list its open invoices.', where: 'Dashboard' },
      { area: 'Dashboard', kind: 'new', text: 'Budget & Time Used by Project: each project’s contract with what’s paid, billed but not paid, and left to bill, and a marker for how much of the planned time has gone (from the project’s start date and duration). A red ! marks projects where time is running well ahead of billing.', where: 'Dashboard' },
      { area: 'Dashboard', kind: 'improved', text: 'Both use the live finance figures (the Classic look showed sample figures) and appear for anyone who can see Project Finance.' },
    ],
  },
  {
    id: '2026-10-23a',
    date: '2026-10-23',
    title: 'Mark up PDFs and drawings',
    items: [
      { area: 'Plan & File Room', kind: 'new', text: 'Open any PDF and press ✎ Mark up: pen, highlighter, text, line, arrow, box, ellipse and revision cloud, in seven colours and five thicknesses, with undo/redo. Each markup saves as you draw it; the drawing itself never changes.', where: 'Plan & File Room → a PDF → ✎ Mark up' },
      { area: 'Plan & File Room', kind: 'new', text: 'Measure on the drawing: set the scale by drawing over a dimension you know (e.g. a 20\'-0" string or the scale bar) and typing its length, then measure lengths (ft-in or metres) and areas (sq ft or m²).', where: '✎ Mark up → ⇔ then 📏 / ⬠' },
      { area: 'Plan & File Room', kind: 'new', text: 'Markups are layers: everyone on the project sees them, and each person’s layer can be shown or hidden. Tick “Private” to keep new markups to yourself until you share them.' },
      { area: 'Plan & File Room', kind: 'new', text: 'Select a markup and press Create RFI or Create task: the RFI is drafted with the drawing and page linked, and the RFI or task links back to that exact spot on the sheet.' },
      { area: 'Plan & File Room', kind: 'new', text: '“Download marked-up PDF” gives the drawing with the layers you’re showing drawn in; “Save marked-up copy” keeps one beside the drawing in the File Room (the clean drawing stays Current).' },
    ],
  },
  {
    id: '2026-10-21a',
    date: '2026-10-21',
    title: 'High Viz projects',
    items: [
      { area: 'Notifications', kind: 'new', text: 'Mark a whole project High Viz with the ☆ High Viz button next to its name. From then on its design and construction status changes, and every task move on it, go to everyone following High Viz — the way each chose in their notification settings. Tasks labelled “High Viz” still work for one-off items.', where: 'Design / Construction → a project → ☆ High Viz' },
      { area: 'Design & Construction', kind: 'improved', text: 'High Viz projects show a ★ HIGH VIZ badge on their board card.' },
    ],
  },
  {
    id: '2026-10-20c',
    date: '2026-10-20',
    title: 'Notifications your way: text or email, now or in a daily / weekly digest',
    items: [
      { area: 'Notifications', kind: 'new', text: 'For each event — incoming lead, lead status changes, design and construction status changes, High Viz, task status, newly assigned tasks, comments, @mentions, coming due in 1 day, past due, and a Monday three-week look-ahead — tick how you want to hear: a text or an email as it happens, a text or an email daily digest, a weekly digest, or None.', where: 'Settings → My account → Notifications' },
      { area: 'Notifications', kind: 'new', text: 'Add your mobile number for texts (your People record’s number is used until you do). If you pick texts with no number — or texting isn’t set up for the workspace — the page says so.', where: 'Settings → Notifications → Mobile number for texts' },
      { area: 'Notifications', kind: 'new', text: 'Digests go out once a day at the reminder hour (weekly ones on Mondays), as one email and/or one text with a link. Everything you’re notified about is also listed on the new Notifications page.', where: 'Bell → All notifications' },
      { area: 'Notifications', kind: 'new', text: 'High Viz: label a task “High Viz” and its moves go to everyone who follows High Viz — the team decides which work gets the label.' },
      { area: 'Tasks', kind: 'improved', text: 'When a task moves status or is done, everyone on it hears — assignee, collaborators, the assigner and the source — the way each chose.' },
    ],
  },
  {
    id: '2026-10-20b',
    date: '2026-10-20',
    title: 'From the Oct 20 sync: task rules, @mentions, People dashboard, design tabs',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Putting a start date on an assigned task moves it to In Progress — straight away if the date is today or earlier, otherwise on that day. Moving a task to In Progress still fills in today’s start date.', where: 'Tasks → a task → Start date' },
      { area: 'Tasks', kind: 'new', text: 'A task can’t go In Progress without an assignee: the option says “assign someone first”.' },
      { area: 'Tasks', kind: 'new', text: 'Marking a task complete asks “What was done?”. The note is shown on the task and in its Activity for the assigner to read before confirming. Closing a task (the assigner’s call) doesn’t ask.' },
      { area: 'Tasks', kind: 'new', text: 'Three roles on every task: Source (who asked for it — pick anyone), Assigner (whoever entered it; they confirm and close it) and Assignee (who does it). The top of the task shows its project, the assigner and the source.', where: 'Tasks → a task' },
      { area: 'Tasks', kind: 'new', text: 'Type @ in a comment to mention someone; they get an email saying you mentioned them.', where: 'Tasks → a task → Activity' },
      { area: 'Tasks', kind: 'improved', text: 'The Assignee list shows the people attached to the task’s project in People (the internal team for lead and General tasks); “Show everyone…” is at the bottom when needed.' },
      { area: 'Tasks', kind: 'improved', text: 'Subtasks are listed under their parent card on the board in their own tint, with who has each; click one to open it. Long titles and project names now wrap instead of being cut off.' },
      { area: 'People', kind: 'improved', text: 'The dashboard tiles are back on every view, and an “Out of compliance” list sits under the people. Click Compliance Alerts or Needs Review to filter.', where: 'People' },
      { area: 'People', kind: 'improved', text: 'The list shows name, role, company, compliance, type and tier — projects are a filter (All projects ▾) rather than a column.' },
      { area: 'People', kind: 'improved', text: 'People are entered with a first and last name, and a company’s primary contact the same way. Trade, discipline and company are picked from lists (“Other…” to type a new one).', where: 'People → Add member' },
      { area: 'Design & Construction', kind: 'improved', text: 'Project tabs are now Dashboard, Board, List, Timeline | Special Actions (the project’s tasks and RFIs), People (everyone on the project, then its subcontracts) and Financials.' },
    ],
  },
  {
    id: '2026-10-20a',
    date: '2026-10-20',
    title: 'Task activity newest first; start dates fill themselves',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'A task’s Activity now lists the newest entry at the top, with the comment box above it.', where: 'Tasks → open a task → Activity' },
      { area: 'Tasks', kind: 'new', text: 'Request Log tasks now have a Start date. It fills in with today the first time the task goes In Progress, as board tasks already do, and can still be changed by hand. Moving it back and forth later keeps the first date.', where: 'Tasks → Request Log → open a task' },
    ],
  },
  {
    id: '2026-10-18g',
    date: '2026-10-18',
    title: 'The PEOPLE ACCESS sheet is now the built-in default',
    items: [
      { area: 'User Access & Roles', kind: 'improved', text: 'The PEOPLE ACCESS sheet’s 25 roles, with each one’s level and extent for every menu item and financial item, are now built in and set up automatically on first start — no import needed. The Executive is the Administrator, which is never changed.', where: 'Admin → User Access & Roles' },
      { area: 'User Access & Roles', kind: 'improved', text: 'The accounts the sheet names are created (or moved to their role) at the same time, without emails: send each person their invite from their row when they’re ready. The passwords in the sheet are not used.', where: 'User Access & Roles → a person → Re-send the invitation (envelope button)' },
      { area: 'User Access & Roles', kind: 'improved', text: 'The “Import access sheet” button is gone. After the first start, roles are edited here and the sheet is never applied again.' },
    ],
  },
  {
    id: '2026-10-18f',
    date: '2026-10-18',
    title: 'Granular access: levels, extents, per-person changes, and the access sheet import',
    items: [
      { area: 'User Access & Roles', kind: 'new', text: 'Roles can now set an access level for every menu item — Block, Block as permit, View only, Input, User, Dashboard, Modify, Full edit — and an extent: Assigned projects or Portfolio, with an Overall access line that anything not set follows.', where: 'Admin → User Access & Roles' },
      { area: 'User Access & Roles', kind: 'new', text: '“Import access sheet” reads the PEOPLE ACCESS spreadsheet and shows a preview: every role (the Executive becomes the built-in Administrator), what it maps onto, and every account. Import creates the roles and the accounts and emails each new person an invite — the passwords in the sheet are ignored, and an Administrator always stays one.', where: 'User Access & Roles → Import access sheet' },
      { area: 'User Access & Roles', kind: 'new', text: 'Change a person’s access from their role’s (the lock button on their row): anything changed shows in red, with “Reset all to role”.', where: 'User Access & Roles → a person → Access' },
      { area: 'Projects', kind: 'improved', text: 'Staff whose access is “Assigned projects” see only the projects they’re linked to in People. Hiding individual financial figures (markups, profit, contingency…) per role comes in the next release; their settings are already imported.', where: 'Everywhere projects are listed' },
    ],
  },
  {
    id: '2026-10-18e',
    date: '2026-10-18',
    title: 'Progress Photos: photos in the Progress view, and every photo shows',
    items: [
      { area: 'Progress Photos', kind: 'fixed', text: 'The Progress view shows each category’s latest photos under its progress bar (click to open; “View all” when there are more), with “+ Add photos” for a category that has none.', where: 'Progress Photos → Progress' },
      { area: 'Progress Photos', kind: 'fixed', text: 'Photos always show: a tile falls back to the photo itself while Drive is still making its thumbnail, and the viewer shows a large preview that works for iPhone (HEIC) photos too. Download still gives the original.', where: 'Progress Photos' },
    ],
  },
  {
    id: '2026-10-18d',
    date: '2026-10-18',
    title: 'Progress Photos: progress updates and descriptions',
    items: [
      { area: 'Progress Photos', kind: 'new', text: 'Progress updates for each category: % complete, status (not started, in progress, on hold, complete) and a description of what’s happening, dated, with an option to share with the client. They show on the timeline, beside each category, and in a new Progress view with history; the Overall progress card averages the categories.', where: 'Progress Photos → + Progress update / Progress' },
      { area: 'Progress Photos', kind: 'improved', text: 'Each photo shows its description under it. Adding photos can post a progress update for the same category at the same time.', where: 'Progress Photos' },
    ],
  },
  {
    id: '2026-10-18c',
    date: '2026-10-18',
    title: 'Progress Photos',
    items: [
      { area: 'Progress Photos', kind: 'new', text: 'Every project’s photos by stage: Construction (existing conditions, framing, rough plumbing / electrical / HVAC, insulation, drywall, finishes, inspections, punch list, completion…) and Design (site survey, inspiration, sketches, drawings, renderings, samples, selections…). See them on a timeline by week, by category, or two dates side by side.', where: 'Construction → Progress Photos' },
      { area: 'Progress Photos', kind: 'new', text: 'Add photos (up to 20 at once; on a phone it opens the camera). Each keeps the date it was taken from the camera. Give a category, area or room and caption, and tick “Client can see” to share it with the client.', where: 'Progress Photos → + Add photos' },
      { area: 'Progress Photos', kind: 'new', text: '“Before it’s covered up” shows which framing, rough-in and insulation photos exist and which are still missing. Photos already in the File Room (including daily-report uploads) appear under Unsorted to be given a category.', where: 'Progress Photos' },
    ],
  },
  {
    id: '2026-10-18b',
    date: '2026-10-18',
    title: 'Completed tasks always in Done, and Close task',
    items: [
      { area: 'Task', kind: 'fixed', text: 'A completed task always shows in Done — on All tasks and on each board — instead of sometimes in To Do or a column like “In Review”. Dragging a finished card into a column that isn’t a status puts it back in progress. Existing tasks were straightened out once.', where: 'Task board' },
      { area: 'Task', kind: 'new', text: '“Close task” marks a task complete and moves it to the archive straight away (with its subtasks). Reopen it from Archived. It’s on the task window and in each card’s Move menu, and on Request Log tasks.', where: 'Task → a task → ✓ Close task' },
    ],
  },
  {
    id: '2026-10-18a',
    date: '2026-10-18',
    title: 'Business cards on contacts — snap, read, review, save',
    items: [
      { area: 'People', kind: 'new', text: 'Add a photo of a business card (front and back — on a phone it opens the camera). “Read card & fill in” reads it and fills the empty fields: name, title, company, phone, email, website and business address. Check them, and the contact saves with the card photos kept on it. For a company entry the firm becomes the name and the person on the card the primary contact.', where: 'People → Add (or Edit) → Business card' },
      { area: 'People', kind: 'new', text: 'A contact’s card photos show in their details — click for full size, or remove one.', where: 'People → a contact' },
      { area: 'Task', kind: 'improved', text: 'Subtasks have an Open link (as well as Edit) in the task’s Subtasks list.', where: 'Task → a task → Subtasks' },
      { area: 'Task', kind: 'improved', text: 'The Urgent priority badge is red.', where: 'Task board' },
    ],
  },
  {
    id: '2026-10-17j',
    date: '2026-10-17',
    title: 'Task emails on Save, editable subtasks, email links that open the task, and “My tasks” your way',
    items: [
      { area: 'Task', kind: 'fixed', text: 'The link in a task email opens that task or subtask — also when you have to sign in first (signing in used to drop the link and land on the dashboard).', where: 'Task emails' },
      { area: 'Task', kind: 'improved', text: 'Emails go out when you press Save & close, not while you type. A new subtask’s email waits for its parent to be saved. If the page is closed without saving, held emails still go out 15 minutes later.', where: 'Task and Request Log editors' },
      { area: 'Task', kind: 'improved', text: 'Subtasks can be edited: Edit on a subtask changes its title, who it’s assigned to and its due date. Clicking a subtask opens it in full, with a link back to its parent.', where: 'Task → a task → Subtasks' },
      { area: 'Task', kind: 'improved', text: '“My tasks” can show tasks assigned to you, ones you collaborate on and ones you originated — tick any mix.', where: 'Task → My tasks' },
      { area: 'Task', kind: 'improved', text: 'The originator, date and number are at the top of every task. On hold asks why, and the reason shows on the card. The status hints follow the agreed meanings, and Confirmed tasks archive a week later unless they are moved or changed.', where: 'Task' },
      { area: 'Task', kind: 'improved', text: 'Administrators set up the board’s columns: add, rename, delete and move them left or right.', where: 'Task → a project or General board' },
    ],
  },
  {
    id: '2026-10-17i',
    date: '2026-10-17',
    title: 'Link tasks to leads as well as projects',
    items: [
      { area: 'Task', kind: 'new', text: 'Every task can be linked to a lead as well as a project, for work done before a contract is signed. New Task, the Request Log task and the board task all have a Lead field, and the Request Log’s Project can now be changed after the task is made.', where: 'Special Actions → Task' },
      { area: 'Task', kind: 'new', text: 'The board’s Project picker lists open leads too: pick one to see and add that lead’s tasks. The Request Log filter and rows show “Lead · name”.', where: 'Task → Task Board / Request Log' },
      { area: 'CRM', kind: 'improved', text: 'Tasks on a lead follow it into the project when it converts, and stay linked to the lead.', where: 'CRM & Leads' },
    ],
  },
  {
    id: '2026-10-17h',
    date: '2026-10-17',
    title: 'Estimate and bid history on subcontractors',
    items: [
      { area: 'Subcontractors', kind: 'new', text: 'Each subcontractor record has an “Estimates & bids” log: the project (in Origami or not), trade, date received, amount, and whether it was awarded, not awarded, withdrawn or declined. Totals at the top show estimates received, projects bid, awards, and how many estimates they have sent since their last job.', where: 'Construction → Manpower & Resource → Contractors → a contractor' },
      { area: 'Subcontractors', kind: 'new', text: 'Subs with 3 or more estimates since their last award are flagged “without a job”. The contractor list has a Bids column, an “Owed a job” filter and a “Most bids without a job” sort, so they can be considered first.', where: 'Contractors list; People → a Sub' },
    ],
  },
  {
    id: '2026-10-17g',
    date: '2026-10-17',
    title: 'Change orders save themselves, serial numbers, and checklists that add themselves',
    items: [
      { area: 'Change Orders', kind: 'improved', text: 'A draft change order now saves by itself a moment after each change, like the other special actions. The footer shows “Saved just now”, and Save still forces it. Submitting or approving saves anything typed first.', where: 'Special Actions → Change Orders' },
      { area: 'Special Actions', kind: 'new', text: 'Tasks, FOR RECORD entries and meetings get a serial number per project and year — T-2026-0142, FR-2026-0031, MTG-2026-0012. It shows next to the originator and in the lists, and you can search by it. Existing records were numbered oldest first. RFIs and change orders keep RFI-004 and CO-003.', where: 'Task, FOR RECORD, Meetings' },
      { area: 'Checklists', kind: 'new', text: 'A checklist template can be marked “Add automatically to” all new tasks, all FOR RECORD entries, one type (e.g. Observations) or tasks with a label (e.g. Safety). New records start with its items; people can still remove items, add more or add another checklist.', where: 'Settings → Workspace → Checklist templates' },
    ],
  },
  {
    id: '2026-10-17f',
    date: '2026-10-17',
    title: 'Approvals for contracts and change orders, one priority scale, originators and more sorting',
    items: [
      { area: 'Approvals', kind: 'improved', text: 'Approvals now leads with contracts and change orders: subcontracts and purchase orders waiting to be approved, client contracts sent and not signed yet, and change orders in review. Everything else waiting on a decision is on the next tab.', where: 'Special Actions → Approvals' },
      { area: 'Priority', kind: 'improved', text: 'RFIs and Request Log tasks use the same priority scale as board tasks — None, Urgent, High, Medium, Low — and picking one fills in the due date (or the date sets the priority).', where: 'Any RFI or task' },
      { area: 'Special Actions', kind: 'new', text: 'Every task, FOR RECORD item, meeting, RFI and change order shows its originator, the date it was created and its number at the top.', where: 'Open any special action' },
      { area: 'RFI', kind: 'new', text: 'A dashboard at the top of RFIs: awaiting an answer, overdue, answered, drafts, cost impact and average days open. Click a card to filter.', where: 'Special Actions → RFI' },
      { area: 'Lists', kind: 'improved', text: 'More tables sort by their headings: People, Reimbursements, the finance approvals and the project portfolio.', where: 'People; Financial & Resource' },
    ],
  },
  {
    id: '2026-10-17e',
    date: '2026-10-17',
    title: 'The new menu, one set of task buckets, and all tasks in one place',
    items: [
      { area: 'Menu', kind: 'improved', text: 'The sidebar now follows the agreed structure: Main, Special Actions, CRM (with Feedback), Design, Preconstruction, Construction (QA/QC, Safety, Equipment, Procurement, Daily Reports, Manpower & Resource (Build), Progress Photos), Financial & Resource (Business, Project Invoicing, Manpower & Resource Management, Accounting, Affiliates), Insight & Documents and Admin. Modules still being built show what they’ll do.', where: 'Sidebar' },
      { area: 'Tasks', kind: 'new', text: 'The Task page opens on All tasks — every project and General Tasks — on the Dashboard for Everyone. On the board, the columns are the task buckets; moving a card sets its status. Each card shows its project.', where: 'Special Actions → Task' },
      { area: 'Tasks', kind: 'improved', text: 'Request Log tasks use the same buckets as the board: To Do, Assigned, In Progress, On hold, Complete, Confirmed. Open became To Do (or Assigned) and Closed became Complete. Only whoever raised a task can confirm it, and confirmed tasks go to the archive after 7 days.', where: 'Special Actions → Task → Request Log' },
      { area: 'Tasks', kind: 'new', text: '“From” joins Everyone, My tasks, From me and Assigned. For Assigned and From, type a name and pick from the suggestions.', where: 'Task board and Request Log' },
    ],
  },
  {
    id: '2026-10-17d',
    date: '2026-10-17',
    title: 'Transmittal and equipment forms in the Daily Report, and the weekly report',
    items: [
      { area: 'Daily Report', kind: 'new', text: 'VII. Deliveries now has the transmittal built in: supplier, PO / ticket number, items, quantity, who received it, condition on arrival and a photo. A damaged or short delivery can become a task. A signed paper transmittal can still be attached.', where: 'Daily Report (field) → VII. Deliveries' },
      { area: 'Daily Report', kind: 'new', text: 'VIII. Equipment now has the Equipment Utilization form: each machine, owned or rented (and from whom), operator, hours used and hours idle, with totals. Notes can become a task. The “Upload … form” task is only added when nothing was filled in or attached.', where: 'Daily Report (field) → VIII. Equipment used' },
      { area: 'Daily Reports', kind: 'new', text: 'Weekly report: pick a project and a week to see every day (and the days with no report), hours by cost code and by worker, delays, inspections, visitors, deliveries, equipment and notes. “Email PDF / Excel” sends it to the usual list or to anyone you type in.', where: 'Construction → Daily Reports → Weekly report' },
      { area: 'Daily Reports', kind: 'improved', text: 'The PDF and Excel copies emailed with each daily report now include the transmittal and the equipment form.', where: 'Daily report emails' },
    ],
  },
  {
    id: '2026-10-17c',
    date: '2026-10-17',
    title: 'Checklist templates, contact statuses and moving leads back',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Checklist templates: “Add from template” drops a ready-made checklist (e.g. Pre-pour inspection) into any task, unticked. “Save as template” turns a task’s checklist into one. Manage them in Settings → Checklist templates.', where: 'Any task → Checklist; Settings → Checklist templates' },
      { area: 'People', kind: 'new', text: 'Every contact is Active, Review or Expired. Anyone with no activity for 12 months (no edits, tasks or files sent to them) moves to Review by itself, and back to Active when there’s new activity. Expired is set by hand, with a reason. Filter by status, and see “Needs review” at the top.', where: 'People → status chips; open a person → Status' },
      { area: 'CRM', kind: 'new', text: 'Move a lead back a stage without dragging: “← Back to …” in the lead panel, or click an earlier stage on its progress bar. An optional reason goes in the timeline.', where: 'CRM & Leads → open a lead' },
    ],
  },
  {
    id: '2026-10-17b',
    date: '2026-10-17',
    title: 'Duplicate and convert special actions',
    items: [
      { area: 'Special Actions', kind: 'new', text: '“Duplicate…” copies a task, FOR RECORD item, meeting, RFI or change order — onto this project or onto several projects at once (Edward’s weather change order on every job). Copies start fresh; any project that can’t take one (say, no financials set up for a change order) is listed and the rest still go ahead.', where: 'Open any task, FOR RECORD item, meeting, RFI or change order → Duplicate…' },
      { area: 'Special Actions', kind: 'new', text: '“Convert to ▾” makes a new special action from this one: a FOR RECORD item into a task, RFI or change order; a task into an RFI or change order; an RFI into a task or change order; and so on. The original stays as it is.', where: 'Same panels → Convert to ▾' },
      { area: 'Audit trail', kind: 'new', text: 'Both records say what happened — “Converted from Observation #…”, “Converted to CO-003”, “Duplicated to Maple as RFI-007” — in their history, with chips at the top that open the other one. RFIs turned into change orders, and RFIs or change orders raised from a meeting, are recorded the same way.', where: 'History / activity on each record' },
    ],
  },
  {
    id: '2026-10-17a',
    date: '2026-10-17',
    title: 'Saved views, Clear all filters and sortable lists',
    items: [
      { area: 'Lists', kind: 'new', text: 'Set the filters you want, then “+ Save view” to keep them under a name. Views are yours alone and follow you to any device; click one to apply it, × to delete it. “Clear all filters” puts the list back to normal.', where: 'Tasks (board and Request Log), Special Actions, Meetings, FOR RECORD, RFI, Change Orders' },
      { area: 'Lists', kind: 'new', text: 'Click a column heading to sort by it — A–Z, newest / oldest, low / high — and again to reverse. Lists without headings have a “Sort” menu. The sort is saved with a view.', where: 'RFI, Change Orders, Request Log, task List view; Sort menu on Special Actions, Meetings, FOR RECORD and Approvals' },
    ],
  },
  {
    id: '2026-10-16b',
    date: '2026-10-16',
    title: 'Save & close, one Special Actions menu, Approvals, and receipt numbers',
    items: [
      { area: 'Saving', kind: 'improved', text: 'Task panels now have a “Save & close” button: it saves at once and closes. “Saved 58s ago” stays, and autosave still runs. The Save button elsewhere can always be pressed to force a save.', where: 'Any task' },
      { area: 'Menu', kind: 'improved', text: 'Special Actions now holds My Calendar, My Timesheets, Meetings, FOR RECORD, RFI, Task, Change Orders and Approvals. The separate “My Stuff” group is gone; Daily Report (field) moved under Construction.', where: 'Sidebar → Special Actions' },
      { area: 'Approvals', kind: 'new', text: 'One list of everything waiting on a decision — change orders, reimbursements and other finance items, submitted daily reports, timesheets and workforce requests. Each row opens the place where it’s approved.', where: 'Special Actions → Approvals' },
      { area: 'Reimbursements', kind: 'new', text: 'Each expense takes the receipt number and a CSI code. A receipt number already used on another expense shows a warning (“Receipt 1043 is already on RE-012”) so nothing is claimed twice. Both show in the list, and search finds receipt numbers.', where: 'Financial → Reimbursements → + Expense' },
      { area: 'Drawers', kind: 'fixed', text: 'Side panels (expenses, change orders, tasks) open over the whole page again instead of being cut off inside the page area.' },
    ],
  },
  {
    id: '2026-10-16a',
    date: '2026-10-16',
    title: 'Task buckets, originators and priorities that set due dates',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Tasks move through To Do → Assigned → In Progress → On Hold → Complete → Confirmed. Giving a To Do task an assignee makes it Assigned. Only whoever created a task (or an admin) can confirm it, and confirmed tasks move to the archive after 7 days. Anything can move back to any bucket.', where: 'Tasks → Task Board' },
      { area: 'Tasks', kind: 'improved', text: 'One status per task: a column named after a bucket (To Do, In Progress, On Hold, Done…) and the task’s status now stay together — drag a card into Done and it’s Complete; set it to On Hold and it moves to that column.', where: 'Tasks → Task Board' },
      { area: 'Tasks', kind: 'new', text: 'Picking a priority fills in the due date — Urgent: tomorrow, High: 5 business days, Medium: 2 weeks, Low: a month. Typing a due date first sets the priority instead. Anything you type yourself is never overwritten.', where: 'Any task → Priority / Due date' },
      { area: 'Tasks', kind: 'new', text: 'Each task shows its originator, the date it was made and its number. The start date fills in by itself when a task first goes In Progress.', where: 'Any task' },
      { area: 'Tasks', kind: 'improved', text: 'Views are now Dashboard (opens first, and the board remembers your last choice), Board, Timeline and List. Filter by Everyone, My tasks, From me (ones you created for others) or Assigned, with a person picker.', where: 'Tasks → Task Board' },
      { area: 'Tasks', kind: 'new', text: '“Move ▾” on each card moves it to another column without dragging — handy on a phone. The board’s sideways scrollbar is now always visible.', where: 'Tasks → Task Board → Board' },
    ],
  },
  {
    id: '2026-10-15a',
    date: '2026-10-15',
    title: 'Stop orders and holidays look after themselves',
    items: [
      { area: 'Daily Report', kind: 'new', text: 'Submitting a report with a stop order puts the project on HOLD (until the projected end date, or a follow-up in 14 days when the end is unknown). Only a person can take it off hold, from the project.', where: 'Daily Report (field) → II. Activity → No → Stop order' },
      { area: 'Daily Report', kind: 'new', text: 'Each stop-order or holiday day now gets a report made automatically as the day arrives (stop days only while the project stays on hold). Anyone can still file their own for that day — it’s kept as an update next to the automatic one.', where: 'Daily Report (field), Daily Reports' },
      { area: 'Daily Report', kind: 'new', text: 'A week and two days before a stop order’s end date, whoever filed it and the admins get an email to plan the restart.', where: 'Email' },
      { area: 'Daily Reports', kind: 'improved', text: 'The list shows no-work days with their reason, marks automatic reports, and labels updates.', where: 'Daily Reports' },
    ],
  },
  {
    id: '2026-10-14a',
    date: '2026-10-14',
    title: 'The Daily Report, FOR RECORD and meeting review',
    items: [
      { area: 'Daily Report', kind: 'new', text: 'The field daily log is now the full Daily Report in ten sections: General information (with % invoiced, % of schedule and task / RFI / change-order counts — never dollar amounts), Activity, Internal workers (the timesheet), Subcontractors, Inspectors, Site meeting & visitors, Deliveries, Equipment, Notes and Certification. Answering “No work today” marks Sections III–IX N/A so you can go straight to the signature.', where: 'Daily Report (field)' },
      { area: 'Daily Report', kind: 'new', text: 'Start a day blank, from a named template, or by duplicating the previous day. A duplicate keeps everything except Sections I and X, and anything you haven’t changed stays highlighted yellow until you do.', where: 'Daily Report (field)' },
      { area: 'Daily Report', kind: 'new', text: 'Delays (with a known or unknown get-well date), failed or partial inspections, visitors and notes can each be turned into a To Do task with “Convert to task”. Answering No to photos, transmittals or the equipment form adds an “Upload …” task for you when you submit.', where: 'Daily Report (field)' },
      { area: 'Daily Report', kind: 'new', text: 'A second report for a day you’ve already filed is kept as an update, with tabs between the original and each update. Save a draft and submit later, save any report as a template the whole team can use, and sign with your finger — the signing time is stamped once and kept. Filling it in for someone else sends them a copy.', where: 'Daily Report (field)' },
      { area: 'FOR RECORD', kind: 'new', text: '“Observations & FYI” is now FOR RECORD and holds observations, FYIs and decisions. Open any entry to attach it to a task or change order, or create a linked task or change-order draft from it.', where: 'Special Actions → FOR RECORD' },
      { area: 'Meetings', kind: 'new', text: 'Meetings hold a recording link and a transcript (link or pasted text). “Review notes & transcript” puts them beside a form to pull out tasks, RFIs, change orders, observations, FYIs and decisions — select a passage and “Use selection” fills it in.', where: 'Special Actions → Meetings' },
      { area: 'Meetings', kind: 'improved', text: 'Meetings are Scheduled, Rescheduled, Occurred, Reviewed, Complete or Cancelled; a reviewed meeting turns Complete by itself once everything raised in it is done. Meetings marked “Held” now show as Occurred. New meetings ask how they’re held — Virtual, Call, Text or In-Person — and the list filters by both.', where: 'Special Actions → Meetings' },
    ],
  },
  {
    id: '2026-10-08f',
    date: '2026-10-08',
    title: 'Task cards show subtasks and everyone on the task',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'Task cards are laid out more clearly: a tile with the task’s initials (click it to mark the task done), the title with “2 of 3 subtasks” under it and the priority beside it, labels in their own row, and files and due date at the bottom.', where: 'Tasks → Board' },
      { area: 'Tasks', kind: 'new', text: 'The assignee and all collaborators show as overlapping avatars at the bottom right of each card (and in the list view), with “+N” when there are more.', where: 'Tasks → Board / List' },
    ],
  },
  {
    id: '2026-10-08e',
    date: '2026-10-08',
    title: 'Email files to anyone, with a sent history',
    items: [
      { area: 'Files', kind: 'improved', text: 'When emailing files, type any email address or start typing a name to pick someone from People or the team. Several recipients can get the same email.', where: 'All Files → tick files → Email (or a file → Email this file)' },
      { area: 'Files', kind: 'new', text: 'Every file emailed from the File Room is recorded: who sent which files, to whom, when, and the note. See it for the whole project under Sent history, or for one file in its panel.', where: 'All Files → a project → Sent history; a file → Email history' },
    ],
  },
  {
    id: '2026-10-08d',
    date: '2026-10-08',
    title: 'Share, email or move several files at once',
    items: [
      { area: 'Files', kind: 'new', text: 'Tick several files in a project’s File Room (up to 25) and then copy all their share links, email them together in one message, or move them all into a folder or subfolder — in Google Drive too.', where: 'All Files → a project → tick files' },
    ],
  },
  {
    id: '2026-10-08c',
    date: '2026-10-08',
    title: 'Files, lead details on projects, invoice approval',
    items: [
      { area: 'Files', kind: 'new', text: 'Word, Excel, PowerPoint, PDF and Google documents now open as a preview in the file panel (with Open full screen) instead of downloading. Download is still there.', where: 'All Files → click a file' },
      { area: 'Files', kind: 'new', text: 'Move a file to another folder of its project with “Move to”. It moves in Google Drive too, along with its older versions. Renaming also renames it in Drive, so a sync no longer brings the old name back.', where: 'All Files → click a file' },
      { area: 'Files', kind: 'new', text: 'Standard project folders: list them once in settings and every new project’s File Room gets them in Drive the first time it’s synced. Existing projects get them with the Standard folders button.', where: 'Settings → Integrations → Google Workspace; All Files → a project' },
      { area: 'Projects', kind: 'new', text: 'A project’s Overview shows what the CRM knows about the client: contacts, lead source, site address, budget, timing, meetings and notes, with a link back to the lead.', where: 'Projects → open a project → Overview' },
      { area: 'Projects', kind: 'new', text: 'Site access: keep the lockbox / gate code and how to get on site on the project. Superintendents see it on their home page.', where: 'Projects → Overview; Superintendent home' },
      { area: 'Finance', kind: 'new', text: 'Approving an invoice is now its own permission. A draft sent for approval has to be approved (or returned) by someone with “Approve invoices” before it can be issued; editing it afterwards needs a fresh approval. Roles that can issue invoices can approve too until you set it.', where: 'Admin → Users & Roles → Financial actions; invoice drafts' },
    ],
  },
  {
    id: '2026-10-08b',
    date: '2026-10-08',
    title: 'Parent and child tasks',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Every subtask now has its own assignee and due date — both are needed to add one. The person it’s assigned to is emailed, it shows in their own task lists and reminders, and it’s flagged when it runs late.', where: 'Tasks → open a task → Subtasks' },
      { area: 'Tasks', kind: 'new', text: 'A parent task can’t be marked done until all its subtasks are done.', where: 'Tasks, Phase boards' },
      { area: 'Tasks', kind: 'new', text: 'Cards show a link badge: P with how many subtasks are done on a parent, C on a subtask (click it to open the parent).', where: 'Task board, list and phase views' },
    ],
  },
  {
    id: '2026-10-08a',
    date: '2026-10-08',
    title: 'From the Oct 6 sync: quick fixes',
    items: [
      { area: 'Sign in', kind: 'improved', text: 'Password fields have a Show / Hide button, so you can check what you typed — handy on a phone.', where: 'Sign in, Set password, Signed-out pop-up' },
      { area: 'Timesheets', kind: 'fixed', text: 'Changing someone in People to Staff now links them to an employee record straight away, so their timesheet shows up in My Stuff without waiting for a restart.', where: 'People → edit → Type: Staff' },
      { area: 'Files', kind: 'new', text: 'Each project’s File Room shows when its Drive folder was last synced, next to the Sync Drive button.', where: 'All Files → a project' },
      { area: 'Users & Roles', kind: 'improved', text: 'User groups are now Internal, Third-party (consultants, subcontractors, authorities) and Client.', where: 'Admin → Users & Roles' },
    ],
  },
  {
    id: '2026-10-07d',
    date: '2026-10-07',
    title: 'A separate Google client for the company connection',
    items: [
      { area: 'Settings', kind: 'new', text: 'Google Workspace settings can now take a second, optional OAuth client for the company connection (Gmail sending and Drive). Created in an Internal Google Cloud project, it needs no Google verification or yearly security assessment, so the main client only has to cover sign-in and Calendar. Leave it blank to keep using one client.', where: 'Settings → Integrations → Google Workspace' },
    ],
  },
  {
    id: '2026-10-07c',
    date: '2026-10-07',
    title: 'Meetings',
    items: [
      { area: 'Special Actions', kind: 'new', text: 'Meetings: schedule a meeting (type, project, date, time, where), add who’s attending from the team or by name, and keep its agenda and minutes — all saved as you type. Mark it held or cancelled, or add it to your Google Calendar (attendees get the invite).', where: 'Special Actions → Meetings' },
      { area: 'Special Actions', kind: 'new', text: 'Raise what came out of a meeting right from it: a task, FYI or observation goes to the Request Log linked to the meeting (the person it’s assigned to is emailed), and an RFI is drafted in the RFI log. Past meetings that were only recorded in the Request Log (by meeting type and date) are listed too, with their entries.', where: 'Special Actions → Meetings' },
      { area: 'Special Actions', kind: 'improved', text: 'The Design & Preconstruction and Construction Special Actions pages now include that phase’s meetings.', where: 'Design & Preconstruction / Construction → Special Actions' },
    ],
  },
  {
    id: '2026-10-07b',
    date: '2026-10-07',
    title: 'Business finances and the Schedule',
    items: [
      { area: 'Financial', kind: 'new', text: 'Business: every project’s finances added up — contract value, work done, billed, collected, still owed (and overdue), retention and, for roles that may see it, forecast margin. Split into Design + Build, Build only and Design only, with client payments collected per month and a sortable table of projects; click one to open its finances.', where: 'Financial → Business' },
      { area: 'Construction', kind: 'new', text: 'Schedule: every project on one timeline, its bar made of its phases dated from the phase tasks, with today marked. Projects with nothing dated yet use the estimated start and duration from the project card (shown hatched). Click a project to see each phase’s dates and progress; switch between 6 months, 12 months and 2 years.', where: 'Construction → Schedule' },
    ],
  },
  {
    id: '2026-10-07a',
    date: '2026-10-07',
    title: 'No more lost changes',
    items: [
      { area: 'Saving', kind: 'fixed', text: 'You no longer get signed out in the middle of work: while you’re using Origami your session renews itself. If a session does end (a tab left for a long time), a “You were signed out” box appears over the page — sign in there (password or Google) and you stay exactly where you were; anything not saved yet is sent the moment you’re back.', where: 'Everywhere' },
      { area: 'CRM', kind: 'fixed', text: 'Editing a lead right after scheduling a meeting or site visit, saving zoning or a fit score could be refused as “updated by someone else” and the edit lost. Every save now knows the lead’s latest version, so this no longer happens.', where: 'CRM & Leads' },
      { area: 'Saving', kind: 'fixed', text: 'Moving a lead to another stage, deleting a lead, renaming or deleting a Task Board section, and a few other quick saves used to fail silently (the board looked right until a refresh). They now keep retrying while the server restarts, wait for you to sign back in if needed, and tell you plainly if something still couldn’t be saved.', where: 'CRM, Tasks, Help' },
      { area: 'People', kind: 'fixed', text: 'Edits to a subcontractor in People (its type, name, phone or email) were being put back to the Manpower contractor’s values after every update was installed. They now stay as you left them.', where: 'People' },
    ],
  },
  {
    id: '2026-10-06r',
    date: '2026-10-06',
    title: 'Four new pages, and the menu reorganised',
    items: [
      { area: 'CRM', kind: 'new', text: 'Holding & Refer Out: every lead on hold with the date to pick it back up (overdue ones flagged), leads referred out and to whom, and cold or cancelled leads. Click one to open it on the CRM board.', where: 'CRM → Holding & Refer Out' },
      { area: 'Special Actions', kind: 'new', text: 'Observations & FYI: the observations and FYIs raised from site or meetings, open ones first, with + Observation and + FYI to add one. They are Request Log entries, so a new topic type “Observation” sits beside Task, FYI and RFI.', where: 'Special Actions → Observations & FYI' },
      { area: 'Construction', kind: 'new', text: 'Daily Reports: every site’s daily log — date, superintendent, crew, hours, notes and approval status. Click a day to see each worker’s hours, cost code and work done.', where: 'Construction → Daily Reports' },
      { area: 'Special Actions', kind: 'new', text: 'Special Actions for Design & Preconstruction and for Construction: that phase’s RFIs, tasks, observations and FYIs, and change orders in one list, open and overdue first. Each row opens the RFI, task or change order itself.', where: 'Design & Preconstruction / Construction → Special Actions' },
      { area: 'Menu', kind: 'improved', text: 'The menu follows the new outline: Design & Preconstruction is one section (with its own Manpower and Special Actions), Construction holds Project Management, Quality & Safety, Schedule, Manpower & Resource Management, Daily Reports and Special Actions, and Financial has Business, Project, Reimbursements, Resources and Affiliates. Consultant and subcontractor prequalifying share one entry.', where: 'Side menu' },
    ],
  },
  {
    id: '2026-10-06q',
    date: '2026-10-06',
    title: 'Hear when a timesheet is submitted',
    items: [
      { area: 'Timesheets', kind: 'new', text: 'When someone submits their weekly timesheet, administrators, HR and project coordinators — and the person’s supervisor — see it in the bell: “George Finau submitted a timesheet · Week of Oct 5 · 21 h”. Click it to open Manpower → Timesheets. It stays there until the week is approved or sent back, and a re-submitted week shows as new again.', where: 'Bell (top right)' },
    ],
  },
  {
    id: '2026-10-06p',
    date: '2026-10-06',
    title: 'Daily log: the whole crew, and a menu fix',
    items: [
      { area: 'Daily Report (field)', kind: 'improved', text: 'The superintendent’s daily log lists every worker assigned to the project in Manpower → Deployment — including people whose deployment starts later (marked “Deployment starts Oct 8”) and, on past days, people whose deployment has since ended. “+ Add worker” puts anyone else on the log (marked “Not deployed here”), so a whole day’s crew can always be submitted.', where: 'Daily Report (field)' },
      { area: 'Manpower', kind: 'fixed', text: 'The menus under People, Operations, Payroll, Employee Services and Setup open on top of the page again instead of behind the cards below them.', where: 'Manpower & Resources' },
      { area: 'Access', kind: 'fixed', text: 'Refreshing while an update was being installed could briefly show every page in the menu to someone whose role doesn’t include them (for example a superintendent). The menu now always follows your own role.', where: 'Side menu' },
    ],
  },
  {
    id: '2026-10-06o',
    date: '2026-10-06',
    title: 'Search the menu',
    items: [
      { area: 'Navigation', kind: 'new', text: 'There’s a search box at the top of the side menu. Type a few letters to narrow the menu to matching pages (“fin” shows the finance pages); press Enter to open the first one. The last line searches projects, people, leads and tasks for the same words, and Ctrl K still opens the full search from anywhere.', where: 'Side menu' },
    ],
  },
  {
    id: '2026-10-06n',
    date: '2026-10-06',
    title: 'Help & Support, answers first',
    items: [
      { area: 'Help', kind: 'improved', text: 'In the New look Help & Support opens on your common questions — filter them by category, search them, and click one to read the answer. Beside them: submit a ticket, the Finance guide, what’s new, search, the guides, and keyboard shortcuts. People who manage Help also see the ticket queue there and can change a ticket’s status or add and edit questions.', where: 'Admin → Help & Support' },
    ],
  },
  {
    id: '2026-10-06m',
    date: '2026-10-06',
    title: 'Settings, reorganised',
    items: [
      { area: 'Settings', kind: 'improved', text: 'In the New look Settings has three tabs. My account: your profile, a button to email yourself a password link, sign out, your notification choices and your Google Calendar, side by side. Workspace: branding, cost codes, CRM response times, calendars, Request Log statuses, the system notice and daily log backup. Integrations: Google Workspace and SMS.', where: 'Admin → Settings' },
      { area: 'Settings', kind: 'fixed', text: 'Settings no longer opens on a blank page — it starts on your notifications.', where: 'Admin → Settings' },
      { area: 'Settings', kind: 'fixed', text: 'Branding’s accent colour shows a real colour (#232321) again instead of the text “var(--forest)”.', where: 'Settings → Branding & letterhead' },
    ],
  },
  {
    id: '2026-10-06l',
    date: '2026-10-06',
    title: 'User Access & Roles on one page',
    items: [
      { area: 'Admin', kind: 'improved', text: 'In the New look, people and roles are side by side. People: filter by Internal / Client / Consultant, search, change someone’s role from the list, see when they were last active or that their invite is pending, and re-send the invite, edit or remove them with the icons. Roles: one column per role with a switch for every module (off → view → manage), a quick “all of this group” count per section, and the finance actions underneath. Changes collect until you press Save changes. Click a role’s name to rename or delete it; + Role adds one.', where: 'Admin → User Access & Roles' },
    ],
  },
  {
    id: '2026-10-06k',
    date: '2026-10-06',
    title: 'Task Board in the New look',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'In the New look the Task Board has light rounded cards: priority on top (High in yellow, Urgent in black), a round tick to mark a task done, the title, labels, then a footer with the due date (“Today” in yellow, “2d overdue” in black), subtask, checklist, comment and file counts, and who it’s assigned to. Columns get large headings with a count; dragging, reordering, renaming and adding tasks and sections work as before.', where: 'Tasks → Task Board' },
    ],
  },
  {
    id: '2026-10-06j',
    date: '2026-10-06',
    title: 'Your meetings on the Dashboard week',
    items: [
      { area: 'Dashboard', kind: 'new', text: 'The “This week” card on the Dashboard now shows your Google Calendar meetings for Monday to Sunday next to your tasks due, each with its time, earliest first. Click a meeting to open it in Google Calendar. If your calendar isn’t connected yet, the card offers a Connect Google Calendar button.', where: 'Dashboard → This week (New look)' },
    ],
  },
  {
    id: '2026-10-06i',
    date: '2026-10-06',
    title: 'Reimbursements page rebuilt around your expenses',
    items: [
      { area: 'Reimbursement', kind: 'improved', text: 'In the New look the Reimbursement page now follows how expenses actually move: four totals at the top (waiting for approval, approved and ready to bill, billed to clients, spent this month vs last), a status filter with counts, project filter and search, then every expense grouped by month with its amount, markup, receipt and status. Approve straight from the list; click an expense to open, edit or reject it. Spend by project and by category sits on the right, and expenses missing a receipt are called out.', where: 'Financial → Reimbursements' },
    ],
  },
  {
    id: '2026-10-06h',
    date: '2026-10-06',
    title: 'Projects board in the New look',
    items: [
      { area: 'Projects', kind: 'improved', text: 'In the New look the Projects board has light rounded cards instead of the dark banners: the project name in large type with its address underneath, the contract type and kind of work as small tags, the contract amount written in dollars (e.g. “2,413,262” shows as $2,413,262), a yellow progress bar, start and duration, and who it’s with. High-priority projects get a yellow tag. Drag and drop between CRM, Design, Construction and Closed works as before.', where: 'Projects' },
    ],
  },
  {
    id: '2026-10-06g',
    date: '2026-10-06',
    title: 'Dashboard shows your real numbers',
    items: [
      { area: 'Dashboard', kind: 'improved', text: 'In the New look every card on the Dashboard now comes from Origami: active projects, your open tasks, live leads, work done / invoiced / collected across contracts, client payments collected per month, and the share of contracts invoiced. The dark project card highlights the project with the most overdue invoices (or overdue tasks). The sample charts that used to sit below are hidden in the New look.', where: 'Dashboard (New look)' },
      { area: 'Dashboard', kind: 'improved', text: '“Needs attention” now lists your latest open tasks from both the Task Board and the Request Log, with overdue ones flagged. Click one to open it.', where: 'Dashboard → Needs attention' },
    ],
  },
  {
    id: '2026-10-06f',
    date: '2026-10-06',
    title: 'See who created a task',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Every task now shows who created it and when (“Created by Sara R. · Oct 1”, plus “reassigned by …” when someone else handed it on) under its subject in the Request Log, under the assignee when a task is open, on the Task Board, and in My tasks. It comes from the task’s history, so tasks assigned before today show it too. A new request’s Originator is filled in with whoever created it.', where: 'Tasks → Request Log / Task Board · Dashboard → My tasks' },
    ],
  },
  {
    id: '2026-10-06e',
    date: '2026-10-06',
    title: 'Tasks have a Subject and a Description',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'A new task now has a Subject (its name) and a separate Description. Before, the description’s first line doubled as the task’s name, so the name appeared twice. The subject can be edited at the top of an open task; older tasks keep showing their first line until a subject is typed.', where: 'Tasks → Request Log → + New Task' },
    ],
  },
  {
    id: '2026-10-06d',
    date: '2026-10-06',
    title: 'Projects by CRM, Design, Construction, Closed; people by level',
    items: [
      { area: 'Projects', kind: 'improved', text: 'The project board’s columns now read CRM, Design, Construction and Closed. CRM holds leads and won work that hasn’t started; Closed is what used to be Closeout.', where: 'Projects' },
      { area: 'People', kind: 'new', text: 'The internal team is split by level: Executive, Staff, Super, Foreman and Labor, each with its own filter. A level is suggested from the person’s role title (Principal → Executive, Superintendent → Super, Foreman, Laborer → Labor) and can be set by hand on their record.', where: 'People → filter chips · person form → Internal level' },
    ],
  },
  {
    id: '2026-10-06c',
    date: '2026-10-06',
    title: 'A new menu',
    items: [
      { area: 'Everywhere', kind: 'improved', text: 'The menu is reorganised into Main, My Stuff, Special Actions, CRM, Design, Preconstruction, Construction, Financial & Resource, Insight & Documents and Admin. Hover over an item to see what it is for.' },
      { area: 'Everywhere', kind: 'new', text: 'New entries: All Files (every project’s Drive files in one place, limited access), Special Actions → Task (opens the Request Log), and Schedule under Construction as well as Preconstruction. Modules still to be built (Meetings, Observations & FYI, Holding & Refer Out, Feedback, Warranty, GC and Subcontractor Prequalifying & RFP, Safety, Equipment, Deliveries, Daily Reports, Affiliates) show what they will do.' },
      { area: 'Admin', kind: 'improved', text: 'The new modules appear in User Access & Roles. Except where a menu entry reuses an existing page (Task, the second Schedule), roles see them only once an administrator ticks them.', where: 'Admin → User Access & Roles' },
    ],
  },
  {
    id: '2026-10-06b',
    date: '2026-10-06',
    title: 'New-look Dashboard, People and Reimbursement',
    items: [
      { area: 'Dashboard', kind: 'improved', text: 'In the New look the dashboard opens with a greeting, headline bars (budget used, time used, collected, overdue) and big numbers, then cards: a project that needs a look, monthly collections, a budget ring, what is closest to slipping, the lead funnel and team workload, and this week’s due dates.', where: 'Dashboard (New look)' },
      { area: 'People', kind: 'improved', text: 'People is now a clean list in the New look: search, filter chips with counts, tick boxes (ticked rows can be exported to a spreadsheet) and a Compliance chip when insurance or a licence needs attention.', where: 'People (New look)' },
      { area: 'Finance', kind: 'improved', text: 'Reimbursement is a month board in the New look: projects on the left, the month’s spend with a calendar in the middle, and the chosen expense with its receipts and Approve button on the right.', where: 'Reimbursement → Reimbursables (New look)' },
    ],
  },
  {
    id: '2026-10-06',
    date: '2026-10-06',
    title: 'Search everything from the top bar',
    items: [
      { area: 'Everywhere', kind: 'new', text: 'The search box in the top bar now works. Click it or press Ctrl+K (⌘K on a Mac), type a few letters, and jump straight to a project, lead, person, employee, task or page. It only shows what your role can open. Use ↑ ↓ and Enter to pick, Esc to close.', where: 'Top bar → Search' },
      { area: 'CRM', kind: 'fixed', text: 'Picking “Other” in a lead’s drop-downs (pronouns, lead source and the rest) is recognised again, so the box to say what the other thing is appears.', where: 'CRM & Leads → lead details' },
    ],
  },
  {
    id: '2026-10-05',
    date: '2026-10-05',
    title: 'A new look, and the classic one is a click away',
    items: [
      { area: 'Everywhere', kind: 'new', text: 'New look across the app: a warm cream background with a soft yellow glow, rounded cream cards, black pill buttons and one yellow highlight colour. The menu is a floating card and the page you are on is a black pill. Headings and numbers use a lighter, larger font, pages ease in, and dashboard figures count up.' },
      { area: 'Everywhere', kind: 'new', text: 'Prefer the original green look? Switch between the New and Classic looks with the round button next to the notifications bell. Your choice is remembered on that computer or phone.', where: 'Top bar → theme button (sun / leaf)' },
      { area: 'Everywhere', kind: 'improved', text: 'The New look now covers every page: cards lift softly off the cream background, small capital labels become calm sentence-case labels, buttons and chips are pills, the chosen tab is a black pill, inputs and drop-downs are rounded, and pop-ups blur what is behind them.' },
    ],
  },
  {
    id: '2026-09-28',
    date: '2026-09-28',
    title: 'A home screen made for the superintendent',
    items: [
      { area: 'Manpower', kind: 'new', text: 'Superintendents can request workers by trade from their dashboard, follow each request through approval and allocation, and fix and resend a rejected one. HR is emailed when a request is waiting for approval.', where: 'Dashboard → Workforce requests · Manpower → Workforce Requests' },
      { area: 'Manpower', kind: 'improved', text: 'The daily log is now a sheet inside the app: one row per employee deployed to that project. Click an hours button to put someone on the log, pick the cost code, task and team on the same row, fill down for everyone, and move with ↑ ↓ / Enter.', where: 'Daily Report (field)' },
      { area: 'Dashboard', kind: 'new', text: 'Superintendents get their own dashboard: today’s daily log, their tasks (overdue first), requests they’ve raised for others, their daily log history and their timesheets — no company figures or charts.', where: 'Dashboard (Site Superintendent role)' },
      { area: 'Tasks', kind: 'new', text: 'A superintendent’s Tasks page shows only their own tasks and the requests they’ve raised, with “+ New request” to ask the office or a team member for something. They can update their own tasks.', where: 'Tasks (Site Superintendent role)' },
      { area: 'Settings', kind: 'improved', text: 'The Site Superintendent role no longer includes the Projects page or the Plan & File Room; its menu is Dashboard, My Timesheet, Daily Report (field) and Tasks.', where: 'User Access & Roles → Site Superintendent' },
    ],
  },
  {
    id: '2026-09-27',
    date: '2026-09-27',
    title: 'Superintendents: a short menu and the daily log',
    items: [
      { area: 'Everywhere', kind: 'fixed', text: 'Staff who aren’t administrators saw every page and “Admin” under their name, whatever their role. Each login now sees only its role’s pages, with the right role name.' },
      { area: 'Manpower', kind: 'improved', text: 'On an employee whose designation is Superintendent, the Login card starts on the Site Superintendent role, and flags a login that has a different role with a one-click “Switch to Site Superintendent”.', where: 'Manpower → an employee → Login' },
      { area: 'Settings', kind: 'improved', text: 'The Site Superintendent role now shows just Dashboard, My Timesheet, Daily Report (field), Projects, Tasks and the Plan & File Room — the rest is hidden. Change it any time under User Access & Roles.', where: 'User Access & Roles → Site Superintendent' },
      { area: 'Manpower', kind: 'improved', text: 'The phone daily log shows in the menu only for superintendents — the Site Superintendent role or an employee whose designation is Superintendent. Everyone else sees and approves daily logs in Manpower.', where: 'Daily Report (field) · Manpower → Daily Log' },
    ],
  },
  {
    id: '2026-09-26',
    date: '2026-09-26',
    title: 'RFIs, one record per subcontractor, logins for clients and subs, spreadsheet import',
    items: [
      { area: 'Files', kind: 'new', text: 'Every file on a lead and on the project it becomes, in one numbered list — stage files, client uploads, and task files with the task number in front.', where: 'Lead → Files · Project → Files' },
      { area: 'Leads', kind: 'new', text: 'Welcome email for the client: a thank-you, a summary of what they told us, the documents we need, and a private upload link (no account, 30 days). Their uploads land in the lead’s Files.', where: 'Lead → Files → Send welcome email' },
      { area: 'Leads', kind: 'new', text: 'Files on every lead stage — site visit photos, surveys, the client’s plans — tagged with the stage they were added in.', where: 'Lead → Overview / Files' },
      { area: 'People', kind: 'new', text: 'Import people from a spreadsheet (CSV or Excel) with a template, a row-by-row preview, and matching to people already in the system.', where: 'People → Import from spreadsheet' },
      { area: 'People', kind: 'new', text: 'A subcontractor is one record: added in People or in Contractors it appears in both, and name, contact, licence, insurance and login stay the same everywhere.', where: 'People → Sub · Manpower → Contractors' },
      { area: 'People', kind: 'new', text: 'Anyone can be given a login from their People record — clients, consultants and subs (Subcontractor portal or project access). They get an email to set their own password.', where: 'People → a person → Login' },
      { area: 'Projects', kind: 'new', text: 'RFIs: numbered per project, emailed with a PDF, answered, closed — linked to the drawings in the File Room, and turned into a change order when there’s a cost.', where: 'RFIs · Project → Tasks & RFIs' },
      { area: 'Projects', kind: 'new', text: 'Subcontractors tab on every project: the companies on the job, their contacts, licence and insurance expiry, and their subcontracts.', where: 'Project → Subcontractors' },
      { area: 'Projects', kind: 'improved', text: 'Project layout: work at the top (Tasks & RFIs), money at the bottom; the Overview opens with open and overdue tasks and RFIs and ends with contract, billed and received.', where: 'Projects → a project' },
      { area: 'Change orders', kind: 'improved', text: 'Statuses now read Pending → Under client review → Approved / Rejected, and “Approve & send to client” emails the change order as a PDF for signature.', where: 'Project → Financial → Change orders' },
      { area: 'Tasks', kind: 'improved', text: '“Blocked” and “On hold” are one status, On hold; on a board with an On Hold column, the column and the status move together.', where: 'Project → Tasks & RFIs' },
      { area: 'Tasks', kind: 'new', text: 'Administrators can set the Request Log’s own statuses and choose which ones count as closed.', where: 'Settings → Request Log statuses' },
      { area: 'Manpower', kind: 'new', text: 'Payroll reports: taxes withheld and other deductions by employee or by pay run for any period, with CSV export.', where: 'Manpower → Payroll → Reports' },
      { area: 'Manpower', kind: 'new', text: 'Vacation and sick leave on each employee — balances side by side with their own “Record” — and a per-person yearly allowance.', where: 'Manpower → an employee → Overview' },
      { area: 'Manpower', kind: 'new', text: 'Picklists for departments, designations and skills & trades; new worker IDs carry the start year (W-2026-0012).', where: 'Manpower → Setup → Picklists' },
      { area: 'CRM', kind: 'fixed', text: 'Addresses on some leads (e.g. Qamaria Coffee, Joel Rodriguez) showed as missing or couldn’t be edited.' },
      { area: 'Projects', kind: 'fixed', text: 'The address on a project card is plain text again — clicking the card opens the project.' },
    ],
  },
  {
    id: '2026-09-25',
    date: '2026-09-25',
    title: 'Project hold, due-date reminders, maps and tap-to-call, autosave everywhere',
    items: [
      { area: 'Projects', kind: 'new', text: 'Put a project on hold with a reason and a follow-up date — the follow-up becomes a task for whoever picks it back up.', where: 'Project → Put on hold' },
      { area: 'Tasks', kind: 'improved', text: 'Due-date reminder emails: choose every morning, Mondays or off; tasks you collaborate on are included; each task links straight to it.', where: 'Settings → Notifications' },
      { area: 'Projects', kind: 'fixed', text: 'Construction projects no longer show on the Design board; construction phases (GC selection, CA, closeout) sit on the Construction side.' },
      { area: 'CRM', kind: 'new', text: 'Addresses open Google Maps and phone numbers dial on a phone; projects show the street address from the lead.' },
      { area: 'Manpower', kind: 'new', text: 'Each submitted daily log is emailed as a PDF and an Excel sheet as a backup.', where: 'Settings → Daily log backup' },
      { area: 'CRM', kind: 'improved', text: 'The proposal amount becomes the lead’s and the project’s contract amount — no retyping.' },
      { area: 'Everywhere', kind: 'new', text: 'A Save button and autosave (3 seconds after you stop typing) on tasks, leads, projects, people and Manpower.' },
      { area: 'People', kind: 'improved', text: 'People and Employees are one record, with the login managed on the employee record.' },
      { area: 'Manpower', kind: 'new', text: 'A daily log made for the superintendent’s phone on site.', where: 'Daily log (on a phone)' },
      { area: 'Tasks', kind: 'new', text: 'Collaborators on tasks, notes that collapse to two lines, and notes that turn into full tasks.' },
      { area: 'Everywhere', kind: 'new', text: 'A banner tells everyone when the system is about to update, and you stay signed in while it restarts.' },
    ],
  },
  {
    id: '2026-09-24',
    date: '2026-09-24',
    title: 'Project financials and the Manpower module',
    items: [
      { area: 'Finance', kind: 'new', text: 'Project financials: contract, schedule of values, invoices and payments; change orders, reimbursables and retention; job cost, profitability and reports.', where: 'Project → Financial' },
      { area: 'Finance', kind: 'new', text: 'Subcontractor portal: subs see their subcontracts, send invoices and follow payment.' },
      { area: 'Manpower', kind: 'new', text: 'Manpower & Resources: employees, deployment, timesheets, payroll, overtime, advances, leave, shifts, assets, housing and transport.', where: 'Manpower' },
      { area: 'Settings', kind: 'new', text: 'Company cost codes (CSI) and subcontractor trade classifications.', where: 'Settings → Cost Codes' },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0]?.id || '';
const SEEN_KEY = 'origami.releaseSeen';
export const releaseSeen = () => { try { return localStorage.getItem(SEEN_KEY) === LATEST_RELEASE; } catch { return true; } };
export const markReleaseSeen = () => { try { localStorage.setItem(SEEN_KEY, LATEST_RELEASE); window.dispatchEvent(new Event('origami:release-seen')); } catch { /* private window */ } };
