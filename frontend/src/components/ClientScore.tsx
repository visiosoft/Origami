import { useEffect, useState } from 'react';
import { api } from '../api';
import { totalPossible, type ScoringCriterion } from '../data/scoring';

// The scoring template's maximum, read once per page load.
let maxOnce: Promise<number> | null = null;
const maxScore = () => (maxOnce ??= api.scoring.getTemplate().then((t) => (Array.isArray(t) ? totalPossible(t as ScoringCriterion[]) : 0)).catch(() => 0));

/**
 * The client score (Oct 26 review notes: the Project Fit score from the lead's
 * Project Fit Review), shown wherever the client is: the lead, its Client Card,
 * the Pass dialog and the project.
 */
export function ClientScore({ score, compact }: { score?: number | null; compact?: boolean }) {
  const [max, setMax] = useState(0);
  useEffect(() => { let live = true; void maxScore().then((m) => { if (live) setMax(m); }); return () => { live = false; }; }, []);
  const has = score !== null && score !== undefined && Number.isFinite(Number(score));
  const ratio = has && max ? Number(score) / max : null;
  const tone = ratio === null ? { bg: 'var(--c-efede8)', c: 'var(--muted)' } : ratio >= 0.7 ? { bg: '#DCEFE0', c: '#1E6B34' } : ratio >= 0.4 ? { bg: '#FBECC4', c: '#8A5A0B' } : { bg: '#F6DED6', c: '#8E2E0A' };
  return (
    <span title="Client score — the Project Fit score from the lead's Project Fit Review" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: compact ? '2px 8px' : '3px 10px', borderRadius: 999, background: tone.bg, color: tone.c, fontSize: compact ? 11 : 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      Client score {has ? <>{Number(score)}{max ? ` / ${max}` : ''}</> : 'not scored yet'}
    </span>
  );
}
