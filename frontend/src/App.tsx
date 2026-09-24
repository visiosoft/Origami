import { MyTimesheet } from './pages/MyTimesheet';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { DashboardRouter } from './pages/DashboardRouter';
import { Pipeline } from './pages/Pipeline';
import { Projects } from './pages/Projects';
import { People } from './pages/People';
import { Tasks } from './pages/Tasks';
import { ModuleSpec } from './pages/ModuleSpec';
import { FinanceHome } from './pages/FinanceHome';
import { FinanceGuide } from './pages/FinanceGuide';
import { Manpower } from './pages/Manpower';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Help } from './pages/Help';
import { Auth } from './pages/Auth';
import { SetPassword } from './pages/SetPassword';
import { Privacy } from './pages/Privacy';
import { Home } from './pages/Home';
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
      <div style={{ padding: 40, fontSize: 13, color: '#7E9B93', lineHeight: 1.6 }}>
        {reconnecting ? (
          <>
            <div style={{ fontWeight: 700, color: '#173326', fontSize: 14 }}>Reconnecting…</div>
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
      <Route path="/home" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      {/* Public on purpose — a prospect signs a proposal from an emailed link, no account. */}
      <Route path="/sign-proposal" element={<SignProposal />} />
      {/* Public on purpose — where a guest access link logs a client/consultant in. */}
      <Route path="/guest" element={<GuestEntry />} />
      <Route path="/portal/*" element={<RequireAuth><Portal /></RequireAuth>} />
      {/* The daily log made for a phone on site -- full screen, outside the app frame. */}
      <Route path="/daily-log" element={<RequireAuth><NotPortal><FieldDailyLog /></NotPortal></RequireAuth>} />
      <Route element={<RequireAuth><NotPortal><AppShell /></NotPortal></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/my-calendar" element={<MyCalendar />} />
        <Route path="/my-timesheet" element={<MyTimesheet />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/people" element={<People />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Admin />} />
        <Route path="/design" element={<Design />} />
        <Route path="/design/:projectId" element={<DesignProject />} />
        <Route path="/pm" element={<Design scope="construction" />} />
        <Route path="/pm/:projectId" element={<DesignProject />} />
        <Route path="/library" element={<Library />} />
        <Route path="/planroom" element={<FileRoom />} />
        <Route path="/my-program" element={<MyProjectProgram />} />
        <Route path="/prequal" element={<ConsultantMatrix />} />
        <Route path="/manpower_con" element={<Manpower />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/finance" element={<FinanceGuide />} />
        <Route path="/fin_project" element={<FinanceHome />} />
        <Route path="/changeorders" element={<FinanceHome initial="changes" />} />
        <Route path="/reimbursement" element={<FinanceHome initial="reimbursables" />} />
        <Route path="/:slug" element={<ModuleSpec />} />
      </Route>
    </Routes>
  );
}
