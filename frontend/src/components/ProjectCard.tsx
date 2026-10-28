import type { DragEvent, ReactNode } from 'react';
import type { Project } from '../data/projects';
import './ProjectCard.css';

/** Soft tile colours, picked from the name so a project keeps its own. */
const TONES = ['#F3D9B1', '#CFE0CC', '#F2CFC4', '#D5DCE8', '#F5E3A1', '#E3D3EC', '#CFE5E4', '#EBD8C8'];
const toneFor = (name: string) => TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
/** "Narvaes Residence (91-1062 Kuhina St)" -> name and the bracketed address. */
const splitName = (n: string) => {
  const m = n.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m && m[1] ? { title: m[1], addr: m[2] } : { title: n, addr: '' };
};
const initials = (n: string) => n.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
/** Contract amounts are typed freely ("$12000", "2,413,262"); show plain numbers as dollars. */
export const fmtAmount = (s?: string) => {
  const raw = (s || '').trim();
  if (!raw) return '';
  const n = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && /^[$\d,.\s]+$/.test(raw) ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : raw;
};

/**
 * A project on the board in the New look: a cream rounded card with a soft
 * initials tile, a priority pill, the contract amount in the display face and
 * a yellow progress bar. The whole card opens the project; it can be dragged
 * between stage columns.
 */
export function ProjectCard({ p, hold, draggable, dragging, onOpen, onDragStart, onDragEnd, index = 0 }: {
  p: Project;
  hold?: ReactNode;
  draggable?: boolean;
  dragging?: boolean;
  onOpen: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  index?: number;
}) {
  const { title, addr } = splitName(p.name || 'Untitled project');
  const where = p.location || addr;
  const amount = fmtAmount(p.contractAmt);
  const meta = [['Est. start', p.estStart], ['Duration', p.duration]].filter(([, v]) => v);
  return (
    <div
      className={'pc-card' + (hold ? ' is-hold' : '') + (dragging ? ' is-dragging' : '') + (draggable ? ' is-draggable' : '')}
      style={{ animationDelay: Math.min(index, 10) * 0.04 + 's' }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      <div className="pc-top">
        <span className="pc-tile" style={{ background: toneFor(title) }}>{initials(title)}</span>
        <span className={'pc-prio is-' + String(p.priority || '').toLowerCase()}>{p.priority}</span>
        <span className="pc-arrow" aria-hidden>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
      </div>

      <div className="pc-name">{title}</div>
      {where && (
        <div className="pc-where">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></svg>
          <span>{where}</span>
        </div>
      )}

      {p.scope && <div className="pc-scope">{p.scope}</div>}

      <div className="pc-chips">
        {p.contractType && <span className="pc-chip is-dark">{p.contractType}</span>}
        {p.typeOfWork && <span className="pc-chip" title={p.typeOfWork}>{p.typeOfWork}</span>}
        {hold}
      </div>

      {amount && <div className="pc-amount">{amount}</div>}

      {p.progress > 0 && (
        <div className="pc-progress">
          <div className="pc-bar"><div className="pc-bar-fill" style={{ width: Math.min(100, p.progress) + '%' }} /></div>
          <span>{p.progress}%</span>
        </div>
      )}

      {meta.length > 0 && (
        <div className="pc-meta">
          {meta.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
        </div>
      )}

      {(p.referral || p.contactedBy) && (
        <div className="pc-foot">
          {p.contactedBy && <span className="pc-owner"><i>{initials(p.contactedBy)}</i>{p.contactedBy}</span>}
          {p.referral && <span className="pc-ref">Ref · {p.referral}</span>}
        </div>
      )}
    </div>
  );
}
