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
        body: 'Confirming our meeting on {{date}} for {{projectTitle}}. Reply C to confirm or R to reschedule. — {{senderName}}, Origami Design + Build',
        kind: 'sms',
        category: 'Scheduling',
        updatedAt: '',
    },
    {
        id: 'TPL-sms-appointment-reminder',
        key: 'sms_appointment_reminder',
        name: 'Appointment Reminder',
        subject: '',
        body: 'Reminder: we are meeting {{date}} about {{projectTitle}}. Let me know if anything has changed. — {{senderName}}, Origami',
        kind: 'sms',
        category: 'Scheduling',
        updatedAt: '',
    },
    {
        id: 'TPL-sms-site-visit',
        key: 'sms_site_visit',
        name: 'Site Visit — On My Way',
        subject: '',
        body: 'Hi {{clientName}}, on my way to {{projectTitle}} now, with you shortly. — {{senderName}}, Origami',
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
];
//# sourceMappingURL=email-templates.js.map