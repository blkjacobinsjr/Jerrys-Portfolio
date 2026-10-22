/**
 * The WebGL gate, adapted from CarterOgunsola/odyn-astro-starter: decorative WebGL only
 * runs where it is cheap and wanted. Everything behind it has a static fallback.
 * `?gl=off` forces the fallback (handy for screenshots and support).
 */
export interface GlEnv {
  search: string;
  reducedMotion: boolean;
  saveData?: boolean;
  deviceMemory?: number;
  probe: () => boolean;
}

export function glAllowed({ search, reducedMotion, saveData, deviceMemory, probe }: GlEnv): boolean {
  if (new URLSearchParams(search).get('gl') === 'off') return false;
  if (reducedMotion || saveData) return false;
  if (deviceMemory !== undefined && deviceMemory < 2) return false;
  return probe();
}

/** Can this browser create a WebGL2 context? The probe context is released straight away. */
export function probeWebGL2(doc: Document = document): boolean {
  try {
    const gl = doc.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function canUseGL(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return glAllowed({
    search: location.search,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
    probe: () => probeWebGL2(),
  });
}
