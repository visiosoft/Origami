export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  kind: string;
  category: string;
  updatedAt: string;
}

// Merge tokens ({{clientName}}, {{clientEmail}}, {{clientPhone}}, {{projectTitle}},
// {{projectScope}}, {{date}}) are filled in from the linked lead + project when the
// template is used. Left as-is here so the stored template stays reusable.
const INTRODUCTION_LETTER_BODY = `<p>{{clientName}},</p>

<p>Greetings! We are thrilled to have you and your family join our Origami Design + Build community and embark on this exciting journey together.</p>

<p>Prior to our official start, we have begun our preliminary "homework" -- zoning analysis and permit history research for <strong>{{projectTitle}}</strong>. We hope to create a long-term working relationship with you and your referrals.</p>

<p>Our Design + Build group has a specific method to manage client goals and expectations:</p>

<ol>
<li>Phone interview, goal summary &amp; project fit</li>
<li>Zoning Analysis and Building Permit History Review</li>
<li>Project Program DRAFT (with Milestone schedule &amp; Project Budget Projection), revised following a site meeting</li>
<li>Schedule of Services / Fee Proposal, following your Project Program review</li>
<li>Project Program Final</li>
<li>Client meeting and site review</li>
</ol>

<p>We will be sending the Project Program draft shortly. Please note this is a "living document" that summarizes your project goals, and will be adjusted following our site visit and throughout the design + build process.</p>

<p>Following your review and approval of the Project Program, you will be presented with your Schedule of Services (fee proposal), defining the entire process from napkin sketches through the front door key hand-off.</p>

<p>If you have any questions or comments, please feel free to call or email any time.</p>

<p>Sincerely,</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14pt;">
<tr>
<td style="width:50%;vertical-align:top;padding-right:10pt;">
<div style="font-size:8.5pt;color:#7E9B93;text-transform:uppercase;letter-spacing:0.06em;">Architect of Record</div>
<div style="font-weight:bold;">J Langston Ewell</div>
<div>P.O. Box 66518, Scotts Valley, CA</div>
<div>650.315.5763 &middot; langston@origamidb.com</div>
</td>
<td style="width:50%;vertical-align:top;">
<div style="font-size:8.5pt;color:#7E9B93;text-transform:uppercase;letter-spacing:0.06em;">General Contractor of Record</div>
<div style="font-weight:bold;">Edward Ciccarelli</div>
<div>405 El Camino Real, Suite 357, Menlo Park CA</div>
<div>650.283.9838 &middot; edward@origamidb.com</div>
</td>
</tr>
</table>`;

// A sample agreement, styled as real formatted HTML rather than plain text --
// the Agreements tab edits this kind of template with a rich text editor, and
// sends it as-is (no paragraph-wrapping) since it's already proper markup.
const SAMPLE_AGREEMENT_BODY = `<h1>Design + Build Services Agreement</h1>
<p>This Agreement is made as of {{date}} between <strong>Origami Design + Build</strong> ("the Company") and <strong>{{clientName}}</strong> ("the Client") for the project known as <strong>{{projectTitle}}</strong>.</p>
<p>The Company and the Client agree as follows:</p>

<h2>1. Scope of Work</h2>
<p>The Company will provide design and/or construction services for the Project as described in the Project Program, Schedule of Services, and any exhibits attached to or referenced by this Agreement. Work not described in those documents is outside the scope of this Agreement unless added by a written Change Order.</p>

<h2>2. Compensation</h2>
<p>The Client agrees to pay the Company the amounts set out in the attached fee proposal, invoiced according to the payment schedule described there. Fees for phases not yet contracted (e.g. construction, following a design-only agreement) will be the subject of a separate agreement once that scope is defined.</p>

<h2>3. Schedule</h2>
<p>The Company will perform the Work according to the milestone schedule provided at the start of each phase. Schedules are estimates based on information available at the time and may be affected by permitting, weather, material availability, and decisions pending from the Client.</p>

<h2>4. Change Orders</h2>
<p>Any change to the scope, schedule, or fee must be documented in a written Change Order signed by both parties before the change is performed. Verbal instructions are not a basis for additional compensation.</p>

<h2>5. Payment Terms</h2>
<ol>
  <li>Invoices are due within 15 days of receipt unless otherwise agreed in writing.</li>
  <li>A retainer, where applicable, is credited against the final invoice of the phase it was collected for.</li>
  <li>Work may be paused if an invoice remains unpaid more than 30 days past its due date, after written notice.</li>
</ol>

<h2>6. Termination</h2>
<p>Either party may terminate this Agreement with 14 days' written notice. The Client remains responsible for fees earned and reimbursable costs incurred up to the termination date.</p>

<h2>7. Governing Law</h2>
<p>This Agreement is governed by the laws of the state in which the Project is located.</p>

<h2>Signatures</h2>
<p>By signing below, both parties agree to the terms of this Agreement.</p>
<p>{{clientSignature}}<br/>{{clientName}}, Client<br/>Date: {{signedDate}}</p>
<p>__________________________________<br/>Origami Design + Build<br/>Date: ____________________</p>`;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'TPL-agreement-design-build',
    key: 'agreement_design_build',
    name: 'Design + Build Services Agreement',
    subject: 'Agreement — {{projectTitle}}',
    body: SAMPLE_AGREEMENT_BODY,
    kind: 'agreement',
    category: 'Sample',
    updatedAt: '',
  },
  {
    id: 'TPL-introduction-letter',
    key: 'introduction_letter',
    name: 'Introduction Letter',
    subject: 'Welcome to Origami Design + Build — {{projectTitle}}',
    body: INTRODUCTION_LETTER_BODY,
    kind: 'email',
    category: 'Client Onboarding',
    updatedAt: '',
  },

  // --- SMS ---
  // No subject: a text has none. Merge fields match the email templates.
  {
    id: 'TPL-sms-first-contact',
    key: 'sms_first_contact',
    name: 'First Contact',
    subject: '',
    body: 'Hi {{clientName}}, this is {{senderName}} at Origami Design + Build about your project enquiry. Is now a good time for a quick call?',
    kind: 'sms',
    category: 'Chasing a Lead',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-follow-up',
    key: 'sms_follow_up',
    name: 'Follow-Up — No Answer',
    subject: '',
    body: 'Hi {{clientName}}, {{senderName}} from Origami again. Tried you earlier about {{projectTitle}}. Reply here any time and I will work around you.',
    kind: 'sms',
    category: 'Chasing a Lead',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-appointment',
    key: 'sms_appointment_confirmation',
    name: 'Appointment Confirmation',
    subject: '',
    body: 'Confirming our meeting on {{date}} for {{projectTitle}}. Reply C to confirm or R to reschedule. - {{senderName}}, Origami Design + Build',
    kind: 'sms',
    category: 'Scheduling',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-appointment-reminder',
    key: 'sms_appointment_reminder',
    name: 'Appointment Reminder',
    subject: '',
    body: 'Reminder: we are meeting {{date}} about {{projectTitle}}. Let me know if anything has changed. - {{senderName}}, Origami',
    kind: 'sms',
    category: 'Scheduling',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-site-visit',
    key: 'sms_site_visit',
    name: 'Site Visit — On My Way',
    subject: '',
    body: 'Hi {{clientName}}, on my way to {{projectTitle}} now, with you shortly. - {{senderName}}, Origami',
    kind: 'sms',
    category: 'Scheduling',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-proposal-sent',
    key: 'sms_proposal_sent',
    name: 'Proposal Sent',
    subject: '',
    body: 'Hi {{clientName}}, your proposal for {{projectTitle}} is in your inbox from {{senderEmail}}. Happy to walk you through it whenever suits.',
    kind: 'sms',
    category: 'Proposals',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-document-request',
    key: 'sms_document_request',
    name: 'Document Request',
    subject: '',
    body: 'Hi {{clientName}}, still need {{documentName}} to keep {{projectTitle}} moving. Send it here or by email whenever you can.',
    kind: 'sms',
    category: 'Project Delivery',
    updatedAt: '',
  },
  {
    id: 'TPL-sms-payment-reminder',
    key: 'sms_payment_reminder',
    name: 'Payment Reminder',
    subject: '',
    body: 'Hi {{clientName}}, a friendly reminder that invoice {{invoiceNumber}} for {{projectTitle}} is now due. Ring me with any questions.',
    kind: 'sms',
    category: 'Finance',
    updatedAt: '',
  },

  // --- Client personality ---
  // The intake asks how a client communicates and decides; these are the same
  // message written for each of those answers. They are variants of *tone and
  // structure*, not of substance: every one of them says what has happened,
  // what is needed, and by when. A client who is told less is not told
  // something different.
  {
    id: 'TPL-personality-analytical',
    key: 'client_email_analytical',
    name: 'Client Update — Analytical / Detail-Oriented',
    subject: '{{projectTitle}} — status, figures and next step',
    body: `{{clientName}},

Here is where {{projectTitle}} stands as of {{date}}.

1. Scope: {{projectScope}}
2. Completed since the last update: [what finished, with dates]
3. In progress now: [what is running, and who holds it]
4. Budget: [committed to date] against [projection], a variance of [amount]
5. Schedule: [weeks elapsed] of [total], currently [on / ahead of / behind] plan

Supporting documents are attached so you can check the figures yourself.

What I need from you: [the single decision or document], by [date]. If anything in the numbers does not reconcile against your own records, tell me which line and I will trace it.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-driver',
    key: 'client_email_driver',
    name: 'Client Update — Driver / Decisive',
    subject: '{{projectTitle}} — one decision needed by [date]',
    body: `{{clientName}},

Bottom line: [the decision], by [date].

Option A: [option] — [cost], [time impact]
Option B: [option] — [cost], [time impact]

My recommendation is [A or B], because [one sentence].

Everything else on {{projectTitle}} is on track. Reply with a letter and I will run with it. Detail is attached if you want it; you do not need it to decide.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-expressive',
    key: 'client_email_expressive',
    name: 'Client Update — Expressive / Visionary',
    subject: '{{projectTitle}} — something to show you',
    body: `{{clientName}},

There is something worth seeing on {{projectTitle}} this week.

[What has taken shape, described as the client will experience it — the light in the room, the approach to the door, the way the space opens up.]

[What is coming next, and what it will feel like when it lands.]

Attached: [renderings, images, samples].

Tell me what you react to and what you do not — that reaction shapes the next round more than anything else we do. If it is easier to talk it through, I will find twenty minutes this week.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-amiable',
    key: 'client_email_amiable',
    name: 'Client Update — Amiable / Collaborative',
    subject: '{{projectTitle}} — where we are, and how it is sitting with you',
    body: `Hello {{clientName}},

A quick note on {{projectTitle}} so you are never wondering.

Since we last spoke: [what happened]. Next: [what happens now, and who on our side is doing it].

There is one thing we would like your thoughts on: [the question]. There is no wrong answer, and no rush on it — we would rather take the extra day and get it right with you than move fast past something that matters.

How is all of this sitting with you? If a call is easier than email, say the word and we will find a time that suits.

Warm regards,
{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-skeptical',
    key: 'client_email_skeptical',
    name: 'Client Update — Skeptical / Cautious',
    subject: '{{projectTitle}} — update, with the reasoning behind it',
    body: `{{clientName}},

An update on {{projectTitle}}, with the reasoning set out so you can judge it rather than take it on trust.

What we did: [action]
Why: [reason]
What it is based on: [the code section, the survey, the quote, the inspection]
What could still change it: [the honest risk], and how we would handle that: [mitigation]

Costs to date are [amount] against a projection of [amount]. Nothing has been committed beyond what you have approved in writing.

Attached is the documentation behind the above. If you want a second opinion on any of it, I will send the file to whoever you nominate.

No decision is needed from you this week unless you want one made.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-overwhelmed',
    key: 'client_email_overwhelmed',
    name: 'Client Update — Overwhelmed / Needs Guidance',
    subject: '{{projectTitle}} — one small thing this week',
    body: `Hello {{clientName}},

Short note, and only one thing to do.

Where we are: [one plain sentence].

The only thing we need from you this week: [the single request]. That is it — everything else is with us.

If you would rather talk it through than read it, ring me on [phone] and we will do it in five minutes. And if this week is not a good week, tell me and we will move it; nothing breaks.

You are not behind. The project is where it should be.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-hands-off',
    key: 'client_email_hands_off',
    name: 'Client Update — Hands-Off / Delegator',
    subject: '{{projectTitle}} — for your records, no action needed',
    body: `{{clientName}},

For the record, on {{projectTitle}}:

Completed: [what finished]
Underway: [what is running]
Budget: [committed] of [projection]
Schedule: [status]

We are proceeding as planned and will handle [the decisions in hand] within the authority you have already given us.

One item sits above that line: [the item], at [amount]. Unless you tell us otherwise by [date], we will proceed as described.

Nothing else needs you.

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
  {
    id: 'TPL-personality-neutral',
    key: 'client_email_neutral',
    name: 'Client Update — Standard',
    subject: '{{projectTitle}} — project update',
    body: `{{clientName}},

An update on {{projectTitle}} as of {{date}}.

Completed: [what finished]
In progress: [what is running]
Next: [what happens next, and when]

Budget stands at [committed] against a projection of [amount]. The schedule is [status].

What we need from you: [request], by [date].

Any questions, reply here or ring me on [phone].

{{senderName}}
Origami Design + Build`,
    kind: 'email',
    category: 'Client Personality',
    updatedAt: '',
  },
];
