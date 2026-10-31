import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  createDiceEngine,
  type DiceEngine,
  type EngineOptions,
  type TableConfig,
  type TossOptions,
} from "./diceEngine";

export interface DiceTableHandle {
  /** joga um d20 na mesa; devolve o id do dado */
  toss: (o: TossOptions) => string;
  /** limpa a mesa */
  clear: () => void;
}

export interface DiceTableProps extends Omit<EngineOptions, "table"> {
  /** geometria do feltro, em px relativos ao canvas */
  table: TableConfig;
  className?: string;
  style?: CSSProperties;
}

/**
 * Camada de dados 3D. Fica por cima do desenho da mesa (position:absolute,
 * inset:0) e não captura clique. Quem joga o dado é o componente pai, via ref:
 *
 *   const dice = useRef<DiceTableHandle>(null);
 *   dice.current?.toss({ color: '#6CB4F5', label: 'rafa', fromAngle: 0, onLand: (v) => ... });
 */
export const DiceTable = forwardRef<DiceTableHandle, DiceTableProps>(
  function DiceTable({ table, className, style, ...options }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<DiceEngine | null>(null);

    // cria o motor uma vez (as opções além de `table` são lidas na montagem)
    useEffect(() => {
      const engine = createDiceEngine(canvasRef.current, { ...options, table });
      engineRef.current = engine;
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // mesa mudou de tamanho/posição (layout responsivo)
    useEffect(() => {
      engineRef.current?.setTable(table);
    }, [table.cx, table.cy, table.radius, table.tilt, table.dieRadius]);

    useImperativeHandle(
      ref,
      () => ({
        toss: (o) => engineRef.current?.toss(o) ?? "",
        clear: () => engineRef.current?.clear(),
      }),
      [],
    );

    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          ...style,
        }}
      />
    );
  },
);
