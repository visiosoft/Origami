import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { Projects } from './pages/Projects';
import { People } from './pages/People';
import { Tasks } from './pages/Tasks';
import { ModuleSpec } from './pages/ModuleSpec';
import { Auth } from './pages/Auth';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/people" element={<People />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/:slug" element={<ModuleSpec />} />
      </Route>
    </Routes>
  );
}
