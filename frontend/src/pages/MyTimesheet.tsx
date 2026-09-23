import { useEffect, useState } from 'react';
import { api } from '../api';
import { RecentTimesheets, TimesheetEditor, mondayOf, type CsiCode } from '../components/Timesheets';
import { BG, INK, MUTED, card, todayISO, type Project } from '../components/manpowerUi';

/** Every internal user's own weekly timesheet: fill in, submit, see what was approved. */
export function MyTimesheet() {
  const [me, setMe] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [week, setWeek] = useState(mondayOf(todayISO()));
  const [projects, setProjects] = useState<Project[]>([]);
  const [csiCodes, setCsiCodes] = useState<CsiCode[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    api.timesheets.me().then((r: any) => setMe(r?.employee || null)).catch(() => setMe(null));
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).filter((p: any) => p.stage !== 'Kickoff').map((p: any) => ({ id: p.id, name: p.name })))).catch(() => {});
    api.csiCodes.list().then((r: any) => setCsiCodes(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  return (
    <div style={{ padding: '28px 32px', background: '#FBF8F2', minHeight: '100%' }}>
      <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: INK, margin: 0 }}>My Timesheet</h1>
      <p style={{ margin: '6px 0 18px', fontSize: 13, color: MUTED }}>
        Log the hours you spend on each project and on internal work, add notes, mark any leave, and submit the week for approval. Approved hours go to payroll.
      </p>
      {me === undefined && <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>}
      {me === null && (
        <div style={{ ...card, padding: '18px 20px', maxWidth: 640, fontSize: 13, color: INK, lineHeight: 1.7 }}>
          <b>Your login isn't linked to an employee record yet.</b><br />
          Ask HR to add you in Manpower &amp; Resources › Employees with the same email you sign in with — it links automatically the next time you open this page.
        </div>
      )}
      {me && (
        <div style={{ display: 'grid', gap: 18 }}>
          <TimesheetEditor employeeId={me.id} weekStart={week} onWeek={setWeek} projects={projects} csiCodes={csiCodes} onChanged={() => setRefresh((n) => n + 1)} />
          <div style={{ maxWidth: 520 }}><RecentTimesheets employeeId={me.id} onPick={setWeek} refreshKey={refresh} /></div>
        </div>
      )}
    </div>
  );
}
