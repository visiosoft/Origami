"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TRADES = void 0;
exports.DEFAULT_TRADES = [
    'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Steel Fixer', 'Painter',
    'Scaffolder', 'Equipment Operator', 'Crane Operator', 'Driver', 'Helper', 'General Labor',
    'Foreman', 'Supervisor', 'Engineer', 'Quantity Surveyor',
].map((name, i) => ({ id: 'TRD-' + String(i + 1).padStart(2, '0'), name, active: true, order: i }));
//# sourceMappingURL=trades.js.map