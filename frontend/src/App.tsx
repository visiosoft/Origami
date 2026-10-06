import { MyTimesheet } from './pages/MyTimesheet';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ClientUpload } from './pages/ClientUpload';
import { RfisPage } from './pages/Rfis';
import { AppShell } from './components/AppShell';
import { DashboardRouter } from './pages/DashboardRouter';
import { Pipeline } from './pages/Pipeline';
import { Projects } from './pages/Projects';
import { People } from './pages/People';
import { Tasks } from './pages/Tasks';
import { SuperintendentTasks, isSiteSuper } from './pages/SuperintendentHome';
import { ModuleSpec } from './pages/ModuleSpec';
import { PublicPage } from './pages/PublicPage';
import { HoldingReferOut } from './pages/HoldingReferOut';
import { Observations } from './pages/Observations';
import { DailyReports } from './pages/DailyReports';
import { SpecialActions } from './pages/SpecialActions';
import { BusinessFinance } from './pages/BusinessFinance';
import { Schedule } from './pages/Schedule';
import { Meetings } from './pages/Meetings';
import { FinanceHome } from './pages/FinanceHome';
import { FinanceGuide } from './pages/FinanceGuide';
import { Manpower } from './pages/Manpower';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Help } from './pages/Help';
import { Auth } from './pages/Auth';
import { SetPassword } from './pages/SetPassword';
import { Design } from './pages/Design';
import { DesignProject } from './pages/DesignProject';
import { Library } from './pages/Library';
import { FileRoom } from './pages/FileRoom';
import { MyProjectProgram } from './pages/MyProjectProgram';
import { ConsultantMatrix } from './pages/ConsultantMatrix';
import { MyCalendar } from './pages/MyCalendar';
import { SignProposal } from './pages/SignProposal';
import { GuestEntry } from './pages/GuestEntry';
import { Portal } from './pages/Portal';
import { FieldDailyLog } from './pages/FieldDailyLog';
import { useApp } from './AppContext';

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
  if (!authUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Subcontractor portal accounts live in the portal; the rest of the app isn't theirs. */
function NotPortal({ children }: { children: ReactNode }) {
  const { authUser } = useApp();
  if (authUser?.roleKey === 'vendor_portal') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
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
        <Route path="/daily-log" element={<FieldDailyLog />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/people" element={<People />} />
        <Route path="/tasks" element={<TasksRouter />} />
        <Route path="/requests" element={<TasksRouter initialMode="log" />} />
        <Route path="/settings" element={<Settings />} />
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
        <Route path="/help" element={<Help />} />
        <Route path="/help/finance" element={<FinanceGuide />} />
        <Route path="/fin_project" element={<FinanceHome />} />
        <Route path="/changeorders" element={<FinanceHome initial="changes" />} />
        <Route path="/reimbursement" element={<FinanceHome initial="reimbursables" />} />
        <Route path="/rfis" element={<RfisPage />} />
        <Route path="/fin_business" element={<BusinessFinance />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/crm_holding" element={<HoldingReferOut />} />
        <Route path="/observations" element={<Observations />} />
        <Route path="/daily_reports" element={<DailyReports />} />
        <Route path="/actions_design" element={<SpecialActions key="design" phase="design" />} />
        <Route path="/actions_con" element={<SpecialActions key="construction" phase="construction" />} />
        <Route path="/:slug" element={<ModuleSpec />} />
      </Route>
    </Routes>
  );
}

/** A site superintendent's Tasks page is just their own work and requests. */
function TasksRouter({ initialMode }: { initialMode?: 'board' | 'log' }) {
  const { currentUser } = useApp();
  return isSiteSuper(currentUser?.roleKey) ? <SuperintendentTasks /> : <Tasks key={initialMode || 'board'} initialMode={initialMode} />;
}
