import * as React from "react";

export function useNativePickers(): boolean {
  const [native, setNative] = React.useState(false);

  React.useEffect(() => {
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqSmall = window.matchMedia("(max-width: 768px)");

    const update = () => setNative(mqCoarse.matches && mqSmall.matches);

    update();
    mqCoarse.addEventListener?.("change", update);
    mqSmall.addEventListener?.("change", update);

    return () => {
      mqCoarse.removeEventListener?.("change", update);
      mqSmall.removeEventListener?.("change", update);
    };
  }, []);

  return native;
}
