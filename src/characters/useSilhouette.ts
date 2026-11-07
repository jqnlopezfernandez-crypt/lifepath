import { useEffect, useState } from 'react';
import { analyzeImage, type Silhouette } from './silhouette';

export function useSilhouette(src: string | undefined): Silhouette | null {
  const [sil, setSil] = useState<Silhouette | null>(null);
  useEffect(() => {
    let alive = true;
    setSil(null);
    if (src) analyzeImage(src).then((s) => { if (alive) setSil(s); });
    return () => { alive = false; };
  }, [src]);
  return sil;
}
