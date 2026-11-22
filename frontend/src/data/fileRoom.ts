// Types and style tokens for the File Room, per the design handoff.

export interface FileRoomFile {
  id: string;
  projectId: number;
  folderPath: string[];
  name: string;
  ext: string;
  size: number;
  mimeType?: string;
  driveId?: string;
  uploadedBy?: string;
  uploadedById?: string;
  updatedAt?: string;
  /** Revisions of one document share a group; exactly one of them is latest. */
  groupId?: string | null;
  isLatest?: boolean;
  /** Free notes about the document, shown and edited in the drawer. */
  notes?: string;
  /** Small copies (Nov 5): pending | ready | none | failed; null for files not done yet. */
  previewState?: string | null;
  /** Set when the thumbnail is ready; part of its URL, so the browser keeps it for good. */
  thumbV?: string | null;
  /** Nov 17: who it is for -- internal (also when empty), client, external. */
  access?: FileAccess | null;
  /** Nov 20 drawing sets: Rev 1.0 (architect) / 1.02 (our published markups), the approved set, the city flag. */
  revMajor?: number | null;
  revMinor?: number | null;
  approvedAt?: string | null;
  notCityApproved?: boolean | null;
  cityNote?: string | null;
}

/** "Rev 0", "Rev 0.01", "Rev 1", "Rev 1.02" -- mirrors backend file-room/drawing-sets.ts. */
export function revLabel(major?: number | null, minor?: number | null): string {
  if (major == null) return '';
  return minor ? `Rev ${major}.${String(minor).padStart(2, '0')}` : `Rev ${major}`;
}

/** Nov 17: the three audience tags on every file. Colour plus an icon and a word, never colour alone. */
export type FileAccess = 'internal' | 'client' | 'external';
export const FILE_ACCESS: { key: FileAccess; label: string; icon: string; bg: string; c: string; hint: string }[] = [
  { key: 'internal', label: 'Internal', icon: '🔒', bg: 'var(--c-efede8)', c: 'var(--body)', hint: 'Our team only' },
  { key: 'client', label: 'Client', icon: '👤', bg: '#E3EDF8', c: '#1F4E80', hint: 'Our team and the client' },
  { key: 'external', label: 'External', icon: '🌐', bg: '#FBEBDD', c: '#8A4B12', hint: 'Everyone on the project: client, consultants, trades' },
];
export const fileAccessInfo = (a?: string | null) => FILE_ACCESS.find((x) => x.key === a) || FILE_ACCESS[0];

export interface FileRoomFolder {
  id: string;
  projectId: number;
  path: string[];   // includes its own name
  name: string;
}

export interface FileRoomProject {
  id: number;
  name: string;
  /** ISO time the project's Drive folder was last synced. */
  syncedAt?: string | null;
}

export interface FileRoomData {
  projects: FileRoomProject[];
  categories: string[];
  files: FileRoomFile[];
  folders: FileRoomFolder[];
}

/** Colour of the little extension badge, by file type. */
export const EXT_STYLE: Record<string, { bg: string; c: string }> = {
  PDF: { bg: '#F2DFD4', c: '#8E2E0A' },
  DWG: { bg: '#D6E8E5', c: '#2F6F68' },
  XLSX: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' },
  XLS: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' },
  JPG: { bg: 'var(--amber-light)', c: '#93520F' },
  JPEG: { bg: 'var(--amber-light)', c: '#93520F' },
  PNG: { bg: 'var(--amber-light)', c: '#93520F' },
};
export const extStyle = (ext?: string) => EXT_STYLE[(ext || '').toUpperCase()] ?? { bg: 'var(--c-efede8)', c: 'var(--body)' };

export const isImage = (f: FileRoomFile) =>
  !!f.mimeType?.startsWith('image/') || ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes((f.ext || '').toUpperCase());

export const prettySize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const shortDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const pathKey = (segments: string[]) => segments.join('>');

/** Files sitting directly in this folder — not in one of its subfolders. */
export const filesIn = (files: FileRoomFile[], projectId: number, folder: string[]) =>
  files.filter((f) => Number(f.projectId) === projectId && pathKey(f.folderPath ?? []) === pathKey(folder));

/** Everything at or below a folder, used for the counts on tree rows. */
export const filesUnder = (files: FileRoomFile[], projectId: number, folder: string[]) =>
  files.filter((f) => {
    if (Number(f.projectId) !== projectId) return false;
    if (!folder.length) return true;
    const k = pathKey(f.folderPath ?? []);
    return k === pathKey(folder) || k.startsWith(pathKey(folder) + '>');
  });

/**
 * The subfolders visible inside a folder: built-in categories that actually
 * hold something, plus every folder anyone created.
 */
export function subfoldersOf(
  data: FileRoomData,
  projectId: number,
  folder: string[],
): string[] {
  const names = new Set<string>();

  if (folder.length === 0) {
    data.categories.forEach((c) => {
      if (filesUnder(data.files, projectId, [c]).length) names.add(c);
    });
  }

  // A folder is implied by any file filed deeper than here.
  data.files.forEach((f) => {
    if (Number(f.projectId) !== projectId) return;
    const p = f.folderPath ?? [];
    if (p.length <= folder.length) return;
    if (pathKey(p.slice(0, folder.length)) !== pathKey(folder)) return;
    names.add(p[folder.length]);
  });

  data.folders.forEach((f) => {
    if (Number(f.projectId) !== projectId) return;
    const p = f.path ?? [];
    if (p.length !== folder.length + 1) return;
    if (pathKey(p.slice(0, folder.length)) !== pathKey(folder)) return;
    names.add(f.name);
  });

  return [...names].sort((a, b) => a.localeCompare(b));
}
