// Can this device run the real-time 3D? Shared by the home page and the catalogue pages.
//
// iPhones and iPads report a low core count (Safari caps navigator.hardwareConcurrency at 4 or less, even on the
// fastest chips), so the core-count rule must not apply to them, or 3D would be off on every iPhone. They render
// at "low" quality anyway (no shadows, lower pixel ratio). 3D stays off with reduced motion, without WebGL2, on
// devices with 2 GB of memory or less, and with ?no3d.

export const isAppleTouch = () => /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports itself as a Mac

export const fewCores = () => !isAppleTouch() && Boolean(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
export const lowMemory = () => Boolean(navigator.deviceMemory) && navigator.deviceMemory <= 2;

export function canRun3D({ reducedMotion }) {
  const q = new URLSearchParams(location.search);
  if (reducedMotion || q.has('no3d') || lowMemory()) return false;
  if (fewCores() && !q.has('force3d')) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
