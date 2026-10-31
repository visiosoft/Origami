import { useEffect, useState } from 'react';
import { api } from '../api';
import { STAGES, type Deal, type TimelineEvent } from '../data/pipeline';
import { AllFiles } from './AllFiles';
import { Skeleton } from './Skeleton';

type Note = { id: string; text: string; stageName: string; date: string; at?: string; by?: string };
const when = (e: { at?: string; date: string }) => (e.at ? new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : e.date);
const h4 = { margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--muted)' };

/**
 * A project's CRM phase (Oct 26 review notes): the lead it came from, read-only
 * -- the stages it went through (its audit trail), its FYI notes and its files.
 * Changes are made on the lead itself, in CRM & Leads.
 */
export function ProjectCrmPhase({ leadId, onOpen }: { leadId: string | null; onOpen: () => void }) {
  const [deal, setDeal] = useState<(Deal & { stageNotes?: Note[] }) | null | undefined>(undefined);
  useEffect(() => {
    if (!leadId) { setDeal(null); return; }
    let live = true;
    setDeal(undefined);
    api.pipeline.get(leadId).then((d: any) => { if (live) setDeal(d?.id ? d : null); }).catch(() => { if (live) setDeal(null); });
    return () => { live = false; };
  }, [leadId]);

  if (!leadId) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>This project wasn’t made from a CRM lead, so it has no CRM history.</div>;
  if (deal === undefined) return <Skeleton rows={6} label="Loading the lead…" />;
  if (!deal) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>The lead this project came from couldn’t be found.</div>;

  const stage = STAGES.find((s) => s.key === deal.stage);
  const timeline = [...((deal.timeline || []) as TimelineEvent[])].reverse();
  const notes = [...(deal.stageNotes || [])].sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date)));
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{deal.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{[deal.client, stage ? `last stage: ${stage.name}` : '', deal.source].filter(Boolean).join(' · ')}</div>
        </div>
        <button type="button" onClick={onOpen} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--body)' }}>Open in CRM & Leads →</button>
      </div>

      <section>
        <h4 style={h4}>Stage history · {timeline.length}</h4>
        {!timeline.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No history recorded.</div> : (
          <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '6px 10px', borderRadius: 8, background: 'var(--panel)' }}>
                <span style={{ color: 'var(--muted)', flex: '0 0 150px' }}>{when(e)}</span>
                <span style={{ color: 'var(--body)', flex: 1 }}>{e.action}{e.role ? <span style={{ color: 'var(--muted)' }}> — {e.role}</span> : null}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 style={h4}>FYI notes · {notes.length}</h4>
        {!notes.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notes on the lead.</div> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>{n.stageName} · {when(n)}{n.by ? ` · ${n.by}` : ''}</div>
                <div style={{ fontSize: 12.5, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 style={h4}>CRM files</h4>
        <AllFiles leadId={leadId} />
      </section>
    </div>
  );
}
