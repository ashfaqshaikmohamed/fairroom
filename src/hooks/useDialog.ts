import { useEffect, useRef } from "react";
/** Scope keyboard focus and restore it when an overlay closes. */
export function useDialog(onClose: () => void, enabled = true) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(
        -1,
      );
    const focusable = () =>
      Array.from(
        dialog()?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        ) || [],
      ).filter((e) => e.getClientRects().length);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const xs = focusable(),
          first = xs[0],
          last = xs.at(-1);
        if (!first) return;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialog()?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog()?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [enabled]);
}
