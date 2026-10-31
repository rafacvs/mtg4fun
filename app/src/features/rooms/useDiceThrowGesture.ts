import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";
import { powerFromHold } from "./diceThrowPower";

export function useDiceThrowGesture(throwDie: (power: number) => void) {
  const began = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [power, setPower] = useState(0);
  const reset = () => {
    began.current = null;
    clearInterval(timer.current);
    setPower(0);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  return {
    power,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        const start = performance.now();
        began.current = start;
        clearInterval(timer.current);
        timer.current = setInterval(
          () => setPower(powerFromHold(performance.now() - start)),
          50,
        );
      },
      // O toque longo não gera click no celular: o lançamento sai ao soltar.
      onPointerUp: () => {
        if (began.current === null) return;
        const held = performance.now() - began.current;
        reset();
        throwDie(powerFromHold(held));
      },
      onPointerCancel: reset,
      onPointerLeave: () => {
        if (began.current !== null) reset();
      },
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
      // detail 0 é a ativação por teclado, que não passa pelos eventos de ponteiro.
      onClick: (event: MouseEvent) => {
        if (event.detail === 0) throwDie(0);
      },
    },
  };
}
