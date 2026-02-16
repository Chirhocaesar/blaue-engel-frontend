export function useNativePickers(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const small = window.matchMedia?.("(max-width: 768px)")?.matches ?? false;
  return coarse || small;
}
