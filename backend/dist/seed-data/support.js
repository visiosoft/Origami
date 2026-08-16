"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FAQS = void 0;
exports.DEFAULT_FAQS = [
    { id: 'FAQ-1', question: 'How do I add a new project?', answer: 'Go to Projects → New Project, fill in the details and save. It is stored in the database and appears on the board immediately.', category: 'Projects', order: 0 },
    { id: 'FAQ-2', question: 'How do I manage user roles and access?', answer: 'Open Settings or User Access & Roles (Admin). Create/edit roles and their per-module permissions, then assign a role to each user.', category: 'Admin', order: 1 },
    { id: 'FAQ-3', question: 'How do task boards work per project?', answer: 'Open a project and go to its Tasks tab, or use the global Task Board and pick a project. Add sections, drag tasks between them, and open a task for subtasks, attachments and comments.', category: 'Tasks', order: 2 },
    { id: 'FAQ-4', question: 'How is the lead fit score calculated?', answer: 'The Project Fit Review stage scores a lead against the Lead Qualification template (Settings → Templates). Pick the matching option per criterion; the total shows out of the template maximum.', category: 'CRM', order: 3 },
    { id: 'FAQ-5', question: 'Who can see what?', answer: 'Access is controlled by your role. Internal, Client and Consultant tiers each get their own dashboard and page access; within Internal, granular roles (PM, Coordinator, etc.) control per-module view/manage.', category: 'Access', order: 4 },
];
//# sourceMappingURL=support.js.map