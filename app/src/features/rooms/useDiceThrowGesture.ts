import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";

export function useDiceThrowGesture(throwDie: (fallOff: boolean) => void) {
  const began = useRef<number | null>(null);
  const elapsed = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [charged, setCharged] = useState(false);
  const reset = () => {
    began.current = null;
    elapsed.current = 0;
    clearTimeout(timer.current);
    setCharged(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    charged,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        began.current = performance.now();
        elapsed.current = 0;
        timer.current = setTimeout(() => setCharged(true), 3000);
      },
      onPointerUp: () => {
        elapsed.current =
          began.current === null ? 0 : performance.now() - began.current;
        clearTimeout(timer.current);
        setCharged(false);
      },
      onPointerCancel: reset,
      onPointerLeave: () => {
        if (began.current !== null) reset();
      },
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
      onClick: () => {
        const fallOff = elapsed.current >= 3000;
        reset();
        throwDie(fallOff);
      },
    },
  };
}
