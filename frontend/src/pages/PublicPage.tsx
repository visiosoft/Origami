import { useEffect } from 'react';

/**
 * The public pages (home, privacy policy, terms) are plain HTML files in
 * /public, served as complete documents so they read without JavaScript --
 * Google's app verification checks them that way. A link inside the app that
 * lands on one of their routes just loads that file.
 */
export function PublicPage({ file }: { file: 'home' | 'privacy' | 'terms' }) {
  useEffect(() => { window.location.replace(`/${file}.html`); }, [file]);
  return null;
}
