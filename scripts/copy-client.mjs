// Copies the built frontend SPA into the backend so a single Node process
// (backend/dist/main.js) can serve both the static app and the /api routes.
import { cpSync, existsSync, rmSync } from 'fs';

const src = 'frontend/dist';
const dest = 'backend/client';

if (!existsSync(src)) {
  console.error(`[copy-client] frontend build not found at "${src}". Run the frontend build first.`);
  process.exit(1);
}
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-client] copied ${src} -> ${dest}`);
