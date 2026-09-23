/** Construction trades seeded once as the shared list employees are classified by. */
export const DEFAULT_TRADES = [
  'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Steel Fixer', 'Painter',
  'Scaffolder', 'Equipment Operator', 'Crane Operator', 'Driver', 'Helper', 'General Labor',
  'Foreman', 'Supervisor', 'Engineer', 'Quantity Surveyor',
].map((name, i) => ({ id: 'TRD-' + String(i + 1).padStart(2, '0'), name, active: true, order: i }));
