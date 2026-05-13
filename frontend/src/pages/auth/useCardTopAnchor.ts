import { type RefObject, useLayoutEffect, useState } from "react";

type MeasureRef = RefObject<HTMLDivElement | null> | { current: HTMLDivElement | null };

const CARD_PADDING_Y = 56; // p-7 top + bottom
const FORM_MARGIN_TOP = 24; // mt-6 above form swap

/** Lock card top so sign-in is vertically centered; signup grows downward only. */
export function useCardTopAnchor(
  topBlockRef: RefObject<HTMLDivElement | null>,
  signInMeasureRef: MeasureRef,
) {
  const [top, setTop] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const measure = () => {
      const topBlock = topBlockRef.current?.offsetHeight ?? 0;
      const signInForm = signInMeasureRef.current?.scrollHeight ?? 0;
      const total = CARD_PADDING_Y + topBlock + FORM_MARGIN_TOP + signInForm;
      setTop(Math.max(16, (window.innerHeight - total) / 2));
    };

    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (topBlockRef.current) ro.observe(topBlockRef.current);
    if (signInMeasureRef.current) ro.observe(signInMeasureRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [topBlockRef, signInMeasureRef]);

  return top;
}
