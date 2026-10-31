import { useEffect, useState } from 'react';
import { api } from '../api';

/** The company's merge fields (Oct 31), from Settings -> Branding; read once per visit. */
let once: Promise<Record<string, string>> | null = null;
export function loadCompanyTokens(): Promise<Record<string, string>> {
  once ??= api.settings.get().then((s) => {
    const v = (k: string) => String(s?.[`brand.${k}`] || '').trim();
    const out: Record<string, string> = {
      companyName: v('companyName'), companyPhone: v('phone'), companyEmail: v('email'), companyAddress: v('address'), companyWebsite: v('website'),
    };
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  }).catch(() => ({}));
  return once;
}

export function useCompanyTokens(): Record<string, string> {
  const [t, setT] = useState<Record<string, string>>({});
  useEffect(() => { let live = true; void loadCompanyTokens().then((v) => { if (live) setT(v); }); return () => { live = false; }; }, []);
  return t;
}
