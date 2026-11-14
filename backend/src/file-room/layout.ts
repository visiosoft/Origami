/** Where the File Room keeps everything inside the connected account's Drive. */
export const FILE_ROOM_ROOT = 'Origami File Room';

/**
 * The standard folders when Settings has none of its own (Batch 6, until the
 * office sends its layout): base drawing sets and saved markups under the
 * drawings, and task and FOR RECORD photos under the photos.
 */
export const MARKUPS_PATH = ['Drawings & Plans', 'Markups'];
export const TASK_PHOTOS_PATH = ['Photos', 'Tasks'];
export const RECORD_PHOTOS_PATH = ['Photos', 'FOR RECORD'];
export const DEFAULT_FOLDER_TEMPLATE = ['Drawings & Plans/Base sets', MARKUPS_PATH.join('/'), TASK_PHOTOS_PATH.join('/'), RECORD_PHOTOS_PATH.join('/')].join('\n');

/** Photos go in the File Room; other attachments stay where they were. */
export const isPhoto = (f: { mimetype?: string; originalname?: string }) => /^image\//i.test(String(f.mimetype || '')) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(String(f.originalname || ''));

/** Where a project's task photos (or FOR RECORD photos) go in Drive (Batch 6). */
export const photoPlace = (projectName: string, forRecord: boolean) => ({ root: FILE_ROOM_ROOT, path: [projectName, ...(forRecord ? RECORD_PHOTOS_PATH : TASK_PHOTOS_PATH)] });
