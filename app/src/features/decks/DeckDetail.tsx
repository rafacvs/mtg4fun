import { useState, type ReactNode } from 'react';
import { useCardInspection } from './useCardInspection';
import type { useDecks } from './useDecks';
import { DeckSummary } from './DeckSummary';
import { deckApi, type Deck } from './deckApi';
import { GROUP_LABELS, GROUP_ORDER } from './deckDisplay';
import { useModalDialog } from './useModalDialog';
import './decks.css';

type Props = { deck: Deck; library: ReturnType<typeof useDecks>; actions?: ReactNode };

export function DeckDetail({ deck: chosen, library, actions }: Props) {
  const inspection = useCardInspection();
  const [curveOpen, setCurveOpen] = useState(false);
  const curveDialog = useModalDialog(curveOpen);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const cardCount = chosen.cards.reduce((sum, card) => sum + card.quantity, 0);

  return <><article className="deck-detail">
    <div className="deck-detail-header">
      <div className="deck-hero-title">{chosen.commander && <img className="deck-commander-image" src={deckApi.imageURL(chosen.commander)} alt={`Comandante ${chosen.commander}`} />}<div><p className="eyebrow">DECK SELECIONADO</p><h3>{chosen.name}</h3><p>{cardCount} cartas · {chosen.cards.length} nomes</p></div></div>
      <div className="deck-detail-actions">{actions}<button type="button" className="secondary" onClick={() => setCurveOpen(true)}>Ver curva de mana</button></div>
    </div>
    <div className="deck-columns">
      <section className="deck-preview" aria-label="Preview de carta">
        {inspection.card ? <>
          <div className="preview-top"><span className="eyebrow">CARTA EM FOCO</span><button type="button" className="text-button" onClick={inspection.close}>Fechar consulta</button></div>
          <h4>{inspection.card.name}</h4>
          <p className="card-text">{inspection.card.text || 'O catálogo não informa texto para esta carta.'}</p>
          {!inspection.imageFailed && <img src={inspection.imageURL} alt={`Imagem ampliada de ${inspection.card.name}`} onError={inspection.reportImageFailure} />}
          {inspection.imageFailed && <p role="status">A imagem não está disponível agora. O texto da carta continua acessível.</p>}
        </> : <><span className="eyebrow">PREVIEW</span><h4>Conheça cada carta.</h4><p>Selecione uma carta na lista para ver o texto e a imagem aqui.</p></>}
      </section>
      <section className="deck-card-list" aria-label={`Cartas de ${chosen.name}`}>
        <div className="card-list-heading"><h4>Lista de cartas</h4><span>{chosen.cards.length} nomes</span></div>
        <div className="deck-filters" aria-label="Filtrar cartas por tipo">
          <button type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>Tudo {cardCount}</button>
          {GROUP_ORDER.filter(key => chosen.groups[key].length > 0).map(key => <button type="button" key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{GROUP_LABELS[key]} {chosen.groups[key].reduce((sum, card) => sum + card.quantity, 0)}</button>)}
        </div>
        <div className="deck-card-search">
          <label htmlFor="deck-card-search">Buscar carta</label>
          <input id="deck-card-search" value={query} onChange={event => setQuery(event.target.value)} />
          {chosen.commander ? <button type="button" className="text-button" disabled={library.busy} onClick={() => void library.setCommander(chosen.id, '')}>Limpar comandante</button> : null}
        </div>
        <div className="deck-groups">{GROUP_ORDER.map(key => {
          const cards = chosen.groups[key].filter(card => card.name.toLowerCase().includes(query.trim().toLowerCase()));
          if (cards.length === 0 || (group !== 'all' && group !== key)) return null;
          return <section key={key} aria-label={GROUP_LABELS[key]}>
            <h4>{GROUP_LABELS[key]}</h4>
            <ul>{cards.map(deckCard => <li key={deckCard.name}>
              <span className="card-line">
                <span className="card-quantity">{deckCard.quantity} × </span>{deckCard.available ? <img className="deck-card-thumb" src={deckApi.imageURL(deckCard.name)} alt="" loading="lazy" /> : <span aria-hidden="true" />}
                <button type="button" className="card-link" aria-label={`Consultar ${deckCard.name}`} aria-pressed={inspection.card?.name === deckCard.name} onClick={() => inspection.inspect(deckCard)}>{deckCard.name}</button>
              </span>
              {key !== 'commander' ? <button type="button" className="text-button" disabled={library.busy} aria-label={`Marcar comandante ${deckCard.name}`} onClick={() => void library.setCommander(chosen.id, deckCard.name)}>Marcar comandante</button> : null}
              {!deckCard.available && <strong>Indisponível no catálogo atual</strong>}
            </li>)}</ul>
          </section>;
        })}</div>
      </section>
    </div>
  </article>
  <dialog ref={curveDialog} className="mana-curve-dialog" aria-labelledby="mana-curve-title" onCancel={event => { event.preventDefault(); setCurveOpen(false); }} onClose={() => setCurveOpen(false)} onClick={event => { if (event.target === event.currentTarget) setCurveOpen(false); }}>
    <div className="mana-curve-header"><div><p className="eyebrow">ANÁLISE DO DECK</p><h3 id="mana-curve-title">Curva de mana — {chosen.name}</h3></div><button type="button" className="secondary" aria-label="Fechar curva de mana" onClick={() => setCurveOpen(false)}>Fechar</button></div>
    <DeckSummary deck={chosen} />
  </dialog></>;
}
