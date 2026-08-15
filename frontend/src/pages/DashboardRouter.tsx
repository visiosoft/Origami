import { useApp } from '../AppContext';
import { Dashboard } from './Dashboard';
import { ClientDashboard } from './ClientDashboard';
import { ConsultantDashboard } from './ConsultantDashboard';

// Each tier gets its own dashboard. Internal users (admins/staff) can preview the
// other tiers via the topbar "View as" switch; Client/Consultant users always land
// on their own dashboard.
export function DashboardRouter() {
  const { tier, viewMode } = useApp();
  const effective = tier === 'internal' ? viewMode : tier;
  if (effective === 'client') return <ClientDashboard />;
  if (effective === 'consultant') return <ConsultantDashboard />;
  return <Dashboard />;
}
