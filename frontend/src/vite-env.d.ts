declare module '*.css';
/** Vite's "?url" import: the built asset's URL (used for the pdf.js worker). */
declare module '*?url' { const url: string; export default url; }
