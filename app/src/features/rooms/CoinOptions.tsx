import { TableIcon } from './TableIcon';

export type CoinSide = 'Cara' | 'Coroa';

const sides: CoinSide[] = ['Cara', 'Coroa'];

export function CoinOptions({ value, onChange, disabled = false, blocked }: { value: CoinSide | null; onChange: (side: CoinSide) => void; disabled?: boolean; blocked?: CoinSide }) {
  return <div className="coin-options" role="group" aria-label="Escolha um lado">
    {sides.map(side => <button type="button" key={side} className="coin-option" aria-pressed={value === side} disabled={disabled || blocked === side} onClick={() => onChange(side)}><span className="coin-disc"><TableIcon name={side === 'Cara' ? 'coin-sun' : 'crown'} /></span><strong>{side}</strong></button>)}
  </div>;
}
