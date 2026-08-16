"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TASKS = exports.DEFAULT_SECTIONS = exports.defaultSectionsFor = exports.sectionId = exports.DEFAULT_SECTION_NAMES = void 0;
exports.DEFAULT_SECTION_NAMES = ['To Do', 'In Progress', 'In Review', 'Done'];
const sectionId = (projectId, idx) => `S-${projectId}-${idx}`;
exports.sectionId = sectionId;
const defaultSectionsFor = (projectId) => exports.DEFAULT_SECTION_NAMES.map((name, idx) => ({ id: (0, exports.sectionId)(projectId, idx), projectId, name, order: idx }));
exports.defaultSectionsFor = defaultSectionsFor;
exports.DEFAULT_SECTIONS = (0, exports.defaultSectionsFor)(1);
exports.DEFAULT_TASKS = [
    {
        id: 'T-1001', projectId: 1, sectionId: (0, exports.sectionId)(1, 0), title: 'Confirm site survey with owner', order: 0,
        completed: false, assignee: 'Sara R.', dueDate: '2026-09-05', priority: 'High',
        description: 'Schedule the topographic survey and share access details with the surveyor.',
        parentId: null, attachments: [], comments: [{ id: 'c1', author: 'Edward M.', text: 'Owner prefers mornings.', date: '2026-08-14' }],
        createdAt: '2026-08-10',
    },
    { id: 'T-1002', projectId: 1, sectionId: (0, exports.sectionId)(1, 0), title: 'Draft preliminary budget', order: 1, completed: false, assignee: 'Noah K.', dueDate: '2026-09-10', priority: 'Medium', description: 'Rough order-of-magnitude for the remodel + lanai addition.', parentId: null, attachments: [], comments: [], createdAt: '2026-08-10' },
    { id: 'T-1003', projectId: 1, sectionId: (0, exports.sectionId)(1, 1), title: 'Schematic floor plans', order: 0, completed: false, assignee: 'Aisha D.', dueDate: '2026-09-18', priority: 'High', description: 'First-pass plans for review.', parentId: null, attachments: [{ name: 'Concept sketch', url: 'https://example.com/sketch.pdf' }], comments: [], createdAt: '2026-08-11' },
    { id: 'T-1004', projectId: 1, sectionId: (0, exports.sectionId)(1, 1), title: 'Permit pre-check with county', order: 1, completed: false, assignee: 'Sara R.', dueDate: '2026-09-20', priority: 'Urgent', description: '', parentId: null, attachments: [], comments: [], createdAt: '2026-08-11' },
    { id: 'T-1005', projectId: 1, sectionId: (0, exports.sectionId)(1, 3), title: 'Kickoff meeting notes', order: 0, completed: true, assignee: 'Edward M.', dueDate: '2026-08-05', priority: 'Low', description: 'Signed off.', parentId: null, attachments: [], comments: [], createdAt: '2026-08-01' },
    { id: 'T-1006', projectId: 1, sectionId: (0, exports.sectionId)(1, 1), title: 'Ground floor layout', order: 0, completed: true, priority: 'Medium', parentId: 'T-1003', attachments: [], comments: [], createdAt: '2026-08-11' },
    { id: 'T-1007', projectId: 1, sectionId: (0, exports.sectionId)(1, 1), title: 'Lanai addition layout', order: 1, completed: false, priority: 'Medium', parentId: 'T-1003', attachments: [], comments: [], createdAt: '2026-08-11' },
];
//# sourceMappingURL=project-tasks.js.map