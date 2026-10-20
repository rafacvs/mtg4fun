import type { Card } from './roomsApi';
import { TableIcon } from './TableIcon';

export type CardStateChange = (kind: 'set_tapped' | 'set_face_down' | 'reveal_cards' | 'set_face', card: Card, value: boolean | number) => void;

export function CardStateControls({ card, viewerId, disabled, onChange, mode = 'all' }: { card: Card; viewerId: number; disabled: boolean; onChange: CardStateChange; mode?: 'all' | 'quick' | 'other' }) {
  if (card.controllerId !== viewerId) return null;
  return <section className="card-state-controls" aria-label="Estados da carta">
    {mode !== 'other' && card.zone === 'battlefield' && <button className="secondary" disabled={disabled} onClick={() => onChange('set_tapped', card, !card.tapped)}><TableIcon name="untap" />{card.tapped ? 'Desvirar' : 'Virar'}</button>}
    {mode !== 'quick' && <>
    <button className="secondary" disabled={disabled} onClick={() => onChange('set_face_down', card, !card.faceDown)}><TableIcon name="copy" />{card.faceDown ? 'Colocar face para cima' : 'Colocar face para baixo'}</button>
    <button className="secondary" disabled={disabled} onClick={() => onChange('reveal_cards', card, !card.revealed)}><TableIcon name="reveal" />{card.revealed ? 'Ocultar revelação' : 'Revelar para todos'}</button>
    {Boolean(card.faces && card.faces.length > 1) && <label>Face da carta<select disabled={disabled} value={card.faceIndex ?? 0} onChange={event => onChange('set_face', card, Number(event.target.value))}>{card.faces!.map((face, index) => <option key={face} value={index}>{face}</option>)}</select></label>}
    {card.faceDown && <p>Face para baixo · a face escolhida permanece.</p>}
    {card.revealed && <p>Visível para todos até ocultar ou passar o turno.</p>}
    </>}
  </section>;
}
