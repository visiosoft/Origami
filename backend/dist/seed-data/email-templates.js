"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EMAIL_TEMPLATES = void 0;
const INTRODUCTION_LETTER_BODY = `{{date}}

Attention:  {{clientName}}

{{clientEmail}}
{{clientPhone}}

Subject:  {{projectTitle}}

Project Scope summary
{{projectScope}}


{{clientName}}
Greetings! We are thrilled to have you and your family join our Origami Design + Build (Origami) community and embark on this exciting journey together.

At Origami, we believe that every project is an opportunity to create something extraordinary. Our name reflects our commitment to transforming ideas into beautifully crafted spaces, just as an origami artist transforms a simple sheet of paper into a stunning work of art. We are dedicated to bringing your vision to life with precision, creativity, and a collaborative spirit.

Collaboration is at the heart of what we do. Our dedicated team of skilled professionals listen, innovate, and guide you hand-in-hand throughout the process, from start and even beyond finish. We believe that the best results come from open communication and a shared commitment to excellence. Your ideas and feedback are invaluable, and we encourage you to be an active part of every decision along the way.

As leaders in the construction field, we take pride in our ability to navigate challenges with creativity and integrity. Our team is not just here to build structures; we're here to build a vision, a lifestyle, and relationships based on mutual trust and respect. Our leadership is here to advise you every step of the way, ensuring that your experience is seamless and enjoyable. We want you to feel confident and excited to begin this significant investment into your life and lifestyle as we transform your vision into a creative Origami reality that reflect your unique vision and values.

Like the folds to an Origami, we handcraft specific and intentional tactics, techniques, and procedures techniques that organize your goals, manage your expectations and achieve your vision. While your specific Origami is custom, based on your specific desires, our five-step pre-contract process will help us expeditiously create a remarkable Origami:

1. Analyze - This process will help determine what is possible based on your specific site and local municipal codes.:
   a. Phone interview, goal summary & project fit

2. Meet - This will be a 30 minute to 1-hour Virtual meeting where our objective analysis meets your vision:
   a. Client meeting and site review
   b. Zoning Analysis and Municipal process review
   c. Determine AEC Team outline

3. Propose - This process will help us define the parameters of how we will operate together:
   a. Project Program
   b. Schedule of Services (design fee proposal)
   c. Contract Review

4. Onboard - This process will outline the method of how we intend to achieve your vision.
   a. Approve the design contract and retainer
   b. Present the Design + Build Milestone Schedule*
   c. Present the Rough Budget Analysis (Draft)*
   d. Activate the AEC Team*

*These are living documents that may evolve throughout the Design + Build process.

5. Kickoff - This is where we begin the Design Process!

While we have yet to officially start, based on data that we have already gathered from our interactions our team has already begun sketching preliminary ideas in our excitement and look forward to sharing them with you.

If you have any questions or comments, please feel free to call or email any time.

Sincerely,



J Langston Ewell                                        Edward Ciccarelli
Origami Design + Build                                  Origami Design + Build
Chief of Design                                         Chief of Construction`;
exports.DEFAULT_EMAIL_TEMPLATES = [
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
//# sourceMappingURL=email-templates.js.map