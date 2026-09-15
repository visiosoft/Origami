import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { DashboardRouter } from './pages/DashboardRouter';
import { Pipeline } from './pages/Pipeline';
import { Projects } from './pages/Projects';
import { People } from './pages/People';
import { Tasks } from './pages/Tasks';
import { ModuleSpec } from './pages/ModuleSpec';
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
import { SignProposal } from './pages/SignProposal';
import { GuestEntry } from './pages/GuestEntry';
import { useApp } from './AppContext';

/** Sends anyone without a valid session to the log-in screen. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { authUser, authReady } = useApp();
  const location = useLocation();
  if (!authReady) return <div style={{ padding: 40, fontSize: 13, color: '#7E9B93' }}>Loading…</div>;
  if (!authUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRouter />} />
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
        <Route path="/help" element={<Help />} />
        <Route path="/:slug" element={<ModuleSpec />} />
      </Route>
    </Routes>
  );
}
