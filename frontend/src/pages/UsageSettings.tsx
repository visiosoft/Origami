import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { todayISO } from '../data/localDate';

const MASK = '••••••••';
type Service = 'quo' | 'twilio' | 'openai';
interface Credit { amount?: number; units: number; since: string }
interface Row {
  service: Service; label: string; unit: string; credit: Credit | null;
  thisMonth: { units: number; calls: number; failures: number }; lastError: string | null;
  used: number; share: number | null; left: number | null; daysLeft: number | null; level: 'none' | 'ok' | 'low' | 'out';
}
const num = (n: number) => n.toLocaleString('en-US');
const card = { padding: 16, borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', display: 'grid', gap: 10 } as const;
const input = { padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)', width: 110 } as const;
const today = todayISO;

/**
 * Nov 20 Weekly Sync ("monitor API usage", "credits running low"): what
 * Origami used of each paid service and the credit loaded with each. Quo and
 * OpenAI don't report the balance left, so the office types in what it loaded
 * and Origami counts against it; admins are emailed at 80% and when a provider
 * refuses for lack of credit. Also where the ChatGPT key is kept.
 */
export function UsageSettings() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Partial<Record<Service, { amount: string; units: string; since: string }>>>({});
  const [aiKey, setAiKey] = useState('');
  const load = () => api.usage.status().then((r) => setRows(r.services as Row[])).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); api.settings.get().then((s) => setAiKey(s['ai.openaiKey'] ? MASK : '')).catch(() => { }); }, []);

  const saveCredit = (s: Service) => {
    const e = edit[s]; if (!rows || !e) return;
    const credits: Record<string, Credit> = {};
    for (const r of rows) if (r.credit && r.service !== s) credits[r.service] = r.credit;
    if (Number(e.units) > 0) credits[s] = { units: Number(e.units), amount: Number(e.amount) || undefined, since: e.since || today() };
    api.usage.setCredits(credits).then((r) => { setRows(r.services as Row[]); setEdit((x) => ({ ...x, [s]: undefined })); toast('Credit saved'); }).catch((err: Error) => toast('⚠ ' + err.message));
  };
  const saveKey = () => {
    if (aiKey === MASK) return;
    api.settings.save({ 'ai.openaiKey': aiKey.trim() }).then(() => { setAiKey(aiKey.trim() ? MASK : ''); toast(aiKey.trim() ? 'ChatGPT key saved' : 'ChatGPT key cleared'); }).catch((e: Error) => toast('⚠ ' + e.message));
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Usage &amp; credits</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
          What Origami used of each paid service. Quo and OpenAI don’t tell Origami how much credit is left, so enter what you loaded and when —
          Origami counts against it and emails the administrators at 80% and the moment a service refuses for lack of credit (at most once a day).
        </div>
      </div>
      {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontWeight: 600 }}>{error}</div>}
      {!rows && !error && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      {rows?.map((r) => {
        const e = edit[r.service];
        const pct = r.share == null ? null : Math.min(100, Math.round(r.share * 100));
        const tone = r.level === 'out' ? '#8E2E0A' : r.level === 'low' ? '#A35A00' : 'var(--forest)';
        return (
          <section key={r.service} style={card} aria-label={r.label}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b style={{ color: 'var(--ink)', fontSize: 14 }}>{r.label}</b>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>This month: {num(r.thisMonth.units)} {r.unit} · {num(r.thisMonth.calls)} call{r.thisMonth.calls === 1 ? '' : 's'}{r.thisMonth.failures ? ` · ${r.thisMonth.failures} failed` : ''}</span>
            </div>
            {r.credit ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(var(--rgb-shade), 0.08)', overflow: 'hidden' }} aria-label={`${pct}% used`}>
                  <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
                </div>
                <div style={{ fontSize: 12.5, color: tone, fontWeight: 600 }}>
                  {num(r.used)} of {num(r.credit.units)} {r.unit} used since {r.credit.since}{r.credit.amount ? ` ($${r.credit.amount})` : ''} · {num(r.left ?? 0)} left
                  {r.daysLeft != null ? ` · about ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} at this rate` : ''}
                  {r.level === 'low' ? ' — running low' : r.level === 'out' ? ' — used up' : ''}
                </div>
              </div>
            ) : <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No credit entered — usage is counted, but there’s nothing to warn against.</div>}
            {r.lastError && <div style={{ fontSize: 12, color: '#8E2E0A' }}>Last refusal: {r.lastError}</div>}
            {e ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                <label>Loaded $ <input aria-label={`${r.label} amount`} style={input} inputMode="decimal" value={e.amount} onChange={(ev) => setEdit((x) => ({ ...x, [r.service]: { ...e, amount: ev.target.value } }))} /></label>
                <label>buys <input aria-label={`${r.label} ${r.unit}`} style={input} inputMode="numeric" value={e.units} onChange={(ev) => setEdit((x) => ({ ...x, [r.service]: { ...e, units: ev.target.value } }))} /> {r.unit}</label>
                <label>on <input aria-label={`${r.label} loaded on`} type="date" style={{ ...input, width: 150 }} value={e.since} onChange={(ev) => setEdit((x) => ({ ...x, [r.service]: { ...e, since: ev.target.value } }))} /></label>
                <button type="button" className="ak-btn is-dark" onClick={() => saveCredit(r.service)}>Save</button>
                <button type="button" className="ak-btn" onClick={() => setEdit((x) => ({ ...x, [r.service]: undefined }))}>Cancel</button>
              </div>
            ) : (
              <div><button type="button" className="ak-btn" onClick={() => setEdit((x) => ({ ...x, [r.service]: { amount: String(r.credit?.amount ?? ''), units: String(r.credit?.units ?? ''), since: today() } }))}>
                {r.credit ? 'Credit added — update' : 'Enter credit loaded'}
              </button></div>
            )}
          </section>
        );
      })}
      <section style={card} aria-label="ChatGPT key">
        <b style={{ color: 'var(--ink)', fontSize: 14 }}>ChatGPT (OpenAI) key</b>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Kept masked. Nothing in Origami uses AI yet; once a feature does, its use is counted above. Edward asked that AI be a last resort, to keep costs down.</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input aria-label="ChatGPT key" type="password" autoComplete="off" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="sk-…" style={{ ...input, width: 320 }} />
          <button type="button" className="ak-btn is-dark" disabled={aiKey === MASK} onClick={saveKey}>Save key</button>
        </div>
      </section>
    </div>
  );
}
