// Icon path data ported verbatim from the Origami v4 design prototype (navIA()).
// 24x24 viewBox stroke paths, round caps, no fill.

export const ICONS: Record<string, string> = {
  dash: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  crm: 'M22 12h-4l-3 9L9 3l-3 9H2',
  folder:
    'M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2Z',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87',
  check: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  pen: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  calc:
    'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M8 6h8 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15h8',
  files:
    'M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
  crew:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  shieldc: 'M9 12l2 2 4-4 M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z',
  clip: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6v4H9z M9 12h6 M9 16h4',
  shielda: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
  cal: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  q: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
  swap: 'M21 2v6h-6 M3 12a9 9 0 0 1 15-6.7L21 8 M3 22v-6h6 M21 12a9 9 0 0 1-15 6.7L3 16',
  receipt: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2V2z M9 7h6 M9 11h6 M9 15h4',
  bank: 'M3 21h18 M5 21V7l7-4 7 4v14 M9 21v-6h6v6',
  dollar: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  db: 'M12 2C6.5 2 2 4 2 6.5S6.5 11 12 11s10-2 10-4.5S17.5 2 12 2z M2 6.5v11C2 20 6.5 22 12 22s10-2 10-4.5v-11',
  chart: 'M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3',
  book:
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  key: 'M15.5 7.5a5.5 5.5 0 1 0-4 9.4 M2 22l6-6 M19 4l-9 9 M17 6l3 3 2-2-3-3z',
  life: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.9 4.9l4.2 4.2 M14.9 14.9l4.2 4.2 M14.9 9.1l4.2-4.2 M4.9 19.1l4.2-4.2',
  search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0 M21 21l-4.35-4.35',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  back: 'M19 12H5 M12 19l-7-7 7-7',
};

export function Icon({
  name,
  size = 16,
  stroke = 'currentColor',
  strokeWidth = 1.8,
  style,
}: {
  name: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const paths = (ICONS[name] || '').split(' M').map((p, i) => (i === 0 ? p : 'M' + p));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
