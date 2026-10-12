import type { Card } from './roomsApi';

export type CardStateChange = (kind: 'set_tapped' | 'set_face_down' | 'reveal_cards' | 'set_face', card: Card, value: boolean | number) => void;

export function CardStateControls({ card, viewerId, disabled, onChange }: { card: Card; viewerId: number; disabled: boolean; onChange: CardStateChange }) {
  if (card.controllerId !== viewerId) return null;
  return <section className="card-state-controls" aria-label="Estados da carta">
    {card.zone === 'battlefield' && <button disabled={disabled} onClick={() => onChange('set_tapped', card, !card.tapped)}>{card.tapped ? 'Desvirar' : 'Virar'}</button>}
    <button disabled={disabled} onClick={() => onChange('set_face_down', card, !card.faceDown)}>{card.faceDown ? 'Colocar face para cima' : 'Colocar face para baixo'}</button>
    <button disabled={disabled} onClick={() => onChange('reveal_cards', card, !card.revealed)}>{card.revealed ? 'Ocultar revelação' : 'Revelar para todos'}</button>
    {Boolean(card.faces && card.faces.length > 1) && <label>Face da carta<select disabled={disabled} value={card.faceIndex ?? 0} onChange={event => onChange('set_face', card, Number(event.target.value))}>{card.faces!.map((face, index) => <option key={face} value={index}>{face}</option>)}</select></label>}
    {card.faceDown && <p>Face para baixo · a face escolhida permanece.</p>}
    {card.revealed && <p>Revelada até ocultar explicitamente, mesmo ao mover.</p>}
  </section>;
}
