import { useApp } from '../AppContext';
import { Dashboard } from './Dashboard';
import { ClientDashboard } from './ClientDashboard';
import { ConsultantDashboard } from './ConsultantDashboard';
import { SuperintendentDashboard, isSiteSuper } from './SuperintendentHome';

// Each tier gets its own dashboard. Administrators see another role's or
// person's with View as (Nov 13), which makes the whole app answer as them.
export function DashboardRouter() {
  const { tier, currentUser } = useApp();
  // A site superintendent gets their own home: their tasks, logs and timesheets only.
  if (isSiteSuper(currentUser?.roleKey)) return <SuperintendentDashboard />;
  const effective = tier;
  if (effective === 'client') return <ClientDashboard />;
  if (effective === 'consultant') return <ConsultantDashboard />;
  return <Dashboard />;
}
