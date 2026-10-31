import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { isSiteSuper } from './data/siteSuper';
import { Auth } from './pages/Auth';
import { useApp } from './AppContext';
import { rememberReturnTo } from './returnTo';
import { Suspense, lazy, type ComponentType } from 'react';
import { BusyWhileMounted, PageSkeleton, TopProgress } from './components/Skeleton';

/**
 * Each page's code is downloaded the first time it's opened, not all up front:
 * the app shell and the page you land on load first, the rest when needed.
 */
function page<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T & string) {
  return lazy(() => load().then((m) => ({ default: m[name] as unknown as ComponentType<any> })));
}
const Approvals = page(() => import('./pages/Approvals'), 'Approvals');
const MyTimesheet = page(() => import('./pages/MyTimesheet'), 'MyTimesheet');
const ClientUpload = page(() => import('./pages/ClientUpload'), 'ClientUpload');
const RfisPage = page(() => import('./pages/Rfis'), 'RfisPage');
const DashboardRouter = page(() => import('./pages/DashboardRouter'), 'DashboardRouter');
const Pipeline = page(() => import('./pages/Pipeline'), 'Pipeline');
const Projects = page(() => import('./pages/Projects'), 'Projects');
const People = page(() => import('./pages/People'), 'People');
const Tasks = page(() => import('./pages/Tasks'), 'Tasks');
const SuperintendentTasks = page(() => import('./pages/SuperintendentHome'), 'SuperintendentTasks');
const ModuleSpec = page(() => import('./pages/ModuleSpec'), 'ModuleSpec');
const ProgressPhotos = page(() => import('./pages/ProgressPhotos'), 'ProgressPhotos');
const PublicPage = page(() => import('./pages/PublicPage'), 'PublicPage');
const HoldingReferOut = page(() => import('./pages/HoldingReferOut'), 'HoldingReferOut');
const Observations = page(() => import('./pages/Observations'), 'Observations');
const DailyReports = page(() => import('./pages/DailyReports'), 'DailyReports');
const SpecialActions = page(() => import('./pages/SpecialActions'), 'SpecialActions');
const BusinessFinance = page(() => import('./pages/BusinessFinance'), 'BusinessFinance');
const Schedule = page(() => import('./pages/Schedule'), 'Schedule');
const Meetings = page(() => import('./pages/Meetings'), 'Meetings');
const FinanceHome = page(() => import('./pages/FinanceHome'), 'FinanceHome');
const FinanceGuide = page(() => import('./pages/FinanceGuide'), 'FinanceGuide');
const Manpower = page(() => import('./pages/Manpower'), 'Manpower');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const NotificationsFeed = page(() => import('./pages/NotificationsFeed'), 'NotificationsFeed');
const Admin = page(() => import('./pages/Admin'), 'Admin');
const Help = page(() => import('./pages/Help'), 'Help');
const SetPassword = page(() => import('./pages/SetPassword'), 'SetPassword');
const Design = page(() => import('./pages/Design'), 'Design');
const DesignProject = page(() => import('./pages/DesignProject'), 'DesignProject');
const Library = page(() => import('./pages/Library'), 'Library');
const FileRoom = page(() => import('./pages/FileRoom'), 'FileRoom');
const MyProjectProgram = page(() => import('./pages/MyProjectProgram'), 'MyProjectProgram');
const ConsultantMatrix = page(() => import('./pages/ConsultantMatrix'), 'ConsultantMatrix');
const MyCalendar = page(() => import('./pages/MyCalendar'), 'MyCalendar');
const SignProposal = page(() => import('./pages/SignProposal'), 'SignProposal');
const SignContract = page(() => import('./pages/SignContract'), 'SignContract');
const Contracts = page(() => import('./pages/Contracts'), 'Contracts');
const GuestEntry = page(() => import('./pages/GuestEntry'), 'GuestEntry');
const Portal = page(() => import('./pages/Portal'), 'Portal');
const DailyReport = page(() => import('./pages/DailyReport'), 'DailyReport');

/** Sends anyone without a valid session to the log-in screen. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { authUser, authReady, reconnecting } = useApp();
  const location = useLocation();
  if (!authReady) {
    return (
      <div style={{ padding: 40, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        {reconnecting ? (
          <>
            <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: 14 }}>Reconnecting…</div>
            The server is restarting (usually an update being installed). You're still signed in — this page will continue by itself in a moment.
          </>
        ) : 'Loading…'}
      </div>
    );
  }
  if (!authUser) {
    // Back to exactly this page after signing in -- e.g. the task an email linked to.
    rememberReturnTo(location.pathname + location.search);
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Subcontractor portal accounts live in the portal; the rest of the app isn't theirs. */
function NotPortal({ children }: { children: ReactNode }) {
  const { authUser } = useApp();
  if (authUser?.roleKey === 'vendor_portal') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

/** Shown for the moment a page's code is downloading. */
export function PageLoading() {
  return <div style={{ padding: '32px 24px' }}><BusyWhileMounted /><TopProgress /><PageSkeleton label="Loading…" /></div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/set-password" element={<SetPassword />} />
      {/* Public on purpose — Google must be able to read these without signing in. */}
      <Route path="/home" element={<PublicPage file="home" />} />
      <Route path="/privacy" element={<PublicPage file="privacy" />} />
      <Route path="/terms" element={<PublicPage file="terms" />} />
      {/* Public on purpose — a prospect signs a proposal from an emailed link, no account. */}
      <Route path="/sign-proposal" element={<SignProposal />} />
      <Route path="/sign-contract" element={<SignContract />} />
      {/* Public on purpose — where a guest access link logs a client/consultant in. */}
      <Route path="/guest" element={<GuestEntry />} />
      {/* Public on purpose — a client uploads their documents from the welcome email's private link. */}
      <Route path="/upload" element={<ClientUpload />} />
      <Route path="/portal/*" element={<RequireAuth><Portal /></RequireAuth>} />
      <Route element={<RequireAuth><NotPortal><AppShell /></NotPortal></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/my-calendar" element={<MyCalendar />} />
        <Route path="/my-timesheet" element={<MyTimesheet />} />
        {/* The superintendent's daily log -- a sheet of the crew, inside the app. */}
        <Route path="/daily-log" element={<DailyReport />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/people" element={<People />} />
        <Route path="/tasks" element={<TasksRouter />} />
        <Route path="/requests" element={<TasksRouter initialMode="log" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<NotificationsFeed />} />
        <Route path="/users" element={<Admin />} />
        <Route path="/design" element={<Design />} />
        <Route path="/design/:projectId" element={<DesignProject />} />
        <Route path="/pm" element={<Design scope="construction" />} />
        <Route path="/pm/:projectId" element={<DesignProject />} />
        <Route path="/library" element={<Library />} />
        <Route path="/planroom" element={<FileRoom />} />
        {/* All Files: the same Drive-backed file browser, opened on every project; its own (limited) permission. */}
        <Route path="/allfiles" element={<FileRoom />} />
        <Route path="/my-program" element={<MyProjectProgram />} />
        <Route path="/prequal" element={<ConsultantMatrix />} />
        <Route path="/manpower_con" element={<Manpower />} />
        <Route path="/manpower_build" element={<Manpower />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/finance" element={<FinanceGuide />} />
        <Route path="/fin_project" element={<FinanceHome />} />
        <Route path="/changeorders" element={<FinanceHome initial="changes" />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/reimbursement" element={<FinanceHome initial="reimbursables" />} />
        <Route path="/rfis" element={<RfisPage />} />
        <Route path="/fin_business" element={<BusinessFinance />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/schedule_con" element={<Schedule />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/crm_holding" element={<HoldingReferOut />} />
        <Route path="/observations" element={<Observations />} />
        <Route path="/daily_reports" element={<DailyReports />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/actions_design" element={<SpecialActions key="design" phase="design" />} />
        <Route path="/actions_con" element={<SpecialActions key="construction" phase="construction" />} />
        <Route path="/progress_photos" element={<ProgressPhotos />} />
        <Route path="/:slug" element={<ModuleSpec />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

/** A site superintendent's Tasks page is just their own work and requests. */
function TasksRouter({ initialMode }: { initialMode?: 'board' | 'log' }) {
  const { currentUser } = useApp();
  return isSiteSuper(currentUser?.roleKey) ? <SuperintendentTasks /> : <Tasks key={initialMode || 'board'} initialMode={initialMode} />;
}
