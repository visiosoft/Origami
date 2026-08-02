import { useParams } from 'react-router-dom';
import './ModuleSpec.css';

const MODULE_SPECS: Record<string, { title: string; purpose: string; screens: string[]; fields: string[] }> = {
  design: { title: 'Design', purpose: 'Track design phases, deliverables, and review cycles across all active projects.', screens: ['Design Dashboard', 'Design Board (Kanban)', 'Drawing Register', 'Review & Markup'], fields: ['drawing_id', 'title', 'discipline', 'revision', 'status', 'author', 'reviewer', 'due_date'] },
  selections: { title: 'Selections & Specifications', purpose: 'Manage client selections and material specifications with approval workflows.', screens: ['Selection Schedule', 'Specification Library', 'Client Portal View'], fields: ['item', 'category', 'allowance', 'selected_product', 'vendor', 'cost', 'status', 'approved_by'] },
  estimating: { title: 'Estimating', purpose: 'Build and manage project cost estimates with bid leveling and historical cost data.', screens: ['Estimate Builder', 'Bid Comparison', 'Cost History'], fields: ['line_item', 'description', 'quantity', 'unit', 'unit_cost', 'total', 'division', 'bid_source'] },
  planroom: { title: 'Plan & File Room', purpose: 'Central document repository for drawings, specs, and project files with version control.', screens: ['File Browser', 'Upload Queue', 'Version History'], fields: ['filename', 'type', 'version', 'uploaded_by', 'date', 'size', 'project', 'folder'] },
  manpower_pre: { title: 'Manpower & Resources (Pre)', purpose: 'Plan and allocate preconstruction resources across projects.', screens: ['Resource Calendar', 'Allocation Matrix', 'Availability View'], fields: ['person', 'role', 'project', 'hours_allocated', 'start_date', 'end_date', 'utilization_pct'] },
  prequal: { title: 'Consultant & Sub Prequalifying', purpose: 'Evaluate and track subcontractor and consultant qualifications and compliance.', screens: ['Prequalification Form', 'Vendor Scorecards', 'Compliance Tracker'], fields: ['company', 'trade', 'license', 'insurance_expiry', 'bonding_capacity', 'safety_rating', 'tier', 'references'] },
  pm: { title: 'Project Management', purpose: 'Day-to-day project management with issue tracking and daily logs.', screens: ['PM Board (Kanban)', 'Daily Log', 'Issue Tracker', 'Meeting Minutes'], fields: ['issue_id', 'type', 'priority', 'assignee', 'status', 'created', 'resolved', 'notes'] },
  quality: { title: 'Quality & Safety', purpose: 'Track quality inspections, safety incidents, and compliance across job sites.', screens: ['Inspection Checklist', 'Incident Log', 'Safety Dashboard'], fields: ['inspection_id', 'type', 'location', 'inspector', 'result', 'deficiencies', 'corrective_action', 'date'] },
  schedule: { title: 'Schedule', purpose: 'Master schedule with critical path, milestones, and progress tracking.', screens: ['Gantt View', 'Milestone Tracker', 'Look-ahead Schedule'], fields: ['activity', 'start', 'finish', 'duration', 'predecessors', 'percent_complete', 'resource', 'critical'] },
  rfis: { title: 'RFIs', purpose: 'Request for Information workflow with response tracking and distribution.', screens: ['RFI Log', 'RFI Detail', 'Response Queue'], fields: ['rfi_number', 'subject', 'from', 'to', 'date_sent', 'date_due', 'date_answered', 'status', 'cost_impact'] },
  changeorders: { title: 'Change Orders', purpose: 'Manage change orders from request through approval with cost and schedule impact.', screens: ['CO Log', 'CO Detail & Approval', 'Impact Summary'], fields: ['co_number', 'description', 'requested_by', 'amount', 'schedule_impact_days', 'status', 'approved_date'] },
  reimbursement: { title: 'Reimbursement', purpose: 'Track reimbursable expenses with receipt capture and billing integration.', screens: ['Expense Log', 'Receipt Upload', 'Billing Summary'], fields: ['expense_id', 'description', 'amount', 'category', 'project', 'submitted_by', 'receipt', 'billed'] },
  manpower_con: { title: 'Manpower & Resources (Construction)', purpose: 'Track field crew allocation, equipment usage, and labor hours during construction.', screens: ['Crew Board', 'Equipment Tracker', 'Timecard Summary'], fields: ['worker', 'crew', 'project', 'hours', 'date', 'equipment', 'task', 'foreman'] },
  fin_business: { title: 'Business Finance', purpose: 'Company-level financial overview with P&L, cash flow, and forecasting.', screens: ['P&L Statement', 'Cash Flow', 'Forecast'], fields: ['account', 'period', 'budget', 'actual', 'variance', 'category'] },
  fin_project: { title: 'Project Finance', purpose: 'Per-project financial tracking with job costing and billing management.', screens: ['Job Cost Report', 'Billing Schedule', 'Retention Tracker'], fields: ['project', 'cost_code', 'committed', 'actual', 'projected', 'billed', 'retention'] },
  fin_resources: { title: 'Resource Finance', purpose: 'Track resource costs, utilization billing, and rate cards.', screens: ['Rate Card Manager', 'Utilization Report', 'Cost Allocation'], fields: ['person', 'role', 'bill_rate', 'cost_rate', 'hours', 'project', 'period'] },
  reports: { title: 'Reports & Analytics', purpose: 'Configurable reports and dashboards for project and business intelligence.', screens: ['Report Builder', 'Saved Reports', 'Executive Dashboard'], fields: ['report_name', 'type', 'filters', 'schedule', 'recipients'] },
  library: { title: 'Document & Template Library', purpose: 'Shared templates, standard documents, and company knowledge base.', screens: ['Template Browser', 'Document Editor', 'Category Manager'], fields: ['template_name', 'category', 'version', 'last_updated', 'author'] },
  users: { title: 'User Access & Roles', purpose: 'Manage user accounts, role assignments, and permission scopes.', screens: ['User List', 'Role Editor', 'Activity Log'], fields: ['user', 'email', 'role', 'permissions', 'last_login', 'status'] },
  help: { title: 'Help & Support', purpose: 'In-app help documentation and support ticket system.', screens: ['Help Center', 'Submit Ticket', 'FAQ'], fields: ['article_title', 'category', 'content', 'related_module'] },
};

export function ModuleSpec() {
  const { slug } = useParams<{ slug: string }>();
  const spec = MODULE_SPECS[slug || ''];

  if (!spec) {
    return <div className="module-spec">Module not found.</div>;
  }

  return (
    <div className="module-spec" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="spec-header-card">
        <div className="spec-title-row">
          <h2 className="spec-title">{spec.title}</h2>
          <span className="spec-badge">Planned</span>
        </div>
        <p className="spec-purpose">{spec.purpose}</p>
      </div>

      <div className="spec-grid">
        <div className="spec-section">
          <div className="spec-section-label">Screens in this module</div>
          <ol className="spec-screen-list">
            {spec.screens.map((s, i) => (
              <li key={i} className="spec-screen-item">
                <span className="spec-screen-num">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="spec-section">
          <div className="spec-section-label">Data captured</div>
          <div className="spec-fields">
            {spec.fields.map((f) => (
              <span key={f} className="spec-field-chip">{f}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="spec-footer">
        This module is scoped but not yet designed. It will be built using the patterns
        established by the implemented screens.
      </div>
    </div>
  );
}
