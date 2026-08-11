import { useEffect, useState } from 'react';

/** Tracks viewport width so components can adapt layout for mobile. */
export function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}
