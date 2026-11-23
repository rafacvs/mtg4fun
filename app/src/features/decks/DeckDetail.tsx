import { useState, type ReactNode } from 'react';
import { useCardInspection } from './useCardInspection';
import type { useDecks } from './useDecks';
import { DeckSummary } from './DeckSummary';
import { deckApi, type Deck } from './deckApi';
import { GROUP_LABELS, GROUP_ORDER } from './deckDisplay';
import { useModalDialog } from './useModalDialog';
import './decks.css';

type Props = { deck: Deck; library: ReturnType<typeof useDecks>; actions?: ReactNode; onEdit?: () => void };

export function DeckDetail({ deck: chosen, library, actions, onEdit }: Props) {
  const inspection = useCardInspection();
  const [curveOpen, setCurveOpen] = useState(false);
  const curveDialog = useModalDialog(curveOpen);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [cmc, setCmc] = useState('');
  const text = query.trim().toLowerCase();
  const visibleNames = new Set(chosen.cards.filter(card =>
    (!text || card.name.toLowerCase().includes(text) || card.text.toLowerCase().includes(text)) &&
    (!type || card.mainType === type) &&
    (!color || (color === 'C' ? !card.colorIdentity : color === 'M' ? (card.colorIdentity?.length ?? 0) > 1 : card.colorIdentity?.includes(color))) &&
    (!cmc || (cmc === '12+' ? card.cmc >= 12 : card.cmc === Number(cmc)))
  ).map(card => card.name));
  const featured = inspection.card ?? chosen.cards.find(card => card.available && card.name === chosen.commander) ?? chosen.cards.find(card => card.available);
  const cardCount = chosen.cards.reduce((sum, card) => sum + card.quantity, 0);

  return <><article className="deck-detail">
    <div className="deck-detail-header">
      <div className="deck-hero-title">{chosen.commander && <img className="deck-commander-image" src={deckApi.imageURL(chosen.commander)} alt={`Comandante ${chosen.commander}`} />}<div><p className="eyebrow">DECK SELECIONADO</p><h3>{chosen.name}</h3><p>{cardCount} cartas · {chosen.cards.length} nomes</p></div></div>
      <div className="deck-detail-actions">{actions}<button type="button" className="secondary" onClick={() => setCurveOpen(true)}>Ver curva de mana</button></div>
    </div>
    {chosen.cards.some(card => !card.available) && <div className="editor-pending detail-pending"><div><strong>Cartas precisam de atenção</strong><span>{chosen.cards.filter(card => !card.available).map(card => `${card.quantity}× ${card.name}`).join(' · ')} — nome não encontrado no catálogo.</span></div>{onEdit && <button type="button" onClick={onEdit}>Corrigir no editor</button>}</div>}
    <div className="deck-columns">
      <section className="deck-preview" aria-label="Preview de carta">
        {featured ? <>
          <div className="preview-top"><span className="eyebrow">{inspection.card ? 'CARTA EM FOCO' : chosen.commander === featured.name ? 'COMANDANTE' : 'UMA CARTA DO DECK'}</span>{inspection.card && <button type="button" className="text-button" onClick={inspection.close}>Fechar consulta</button>}</div>
          <h4>{featured.name}</h4>
          {!inspection.imageFailed && <img key={featured.name} src={deckApi.imageURL(featured.name)} alt={`Imagem ampliada de ${featured.name}`} loading="lazy" decoding="async" onError={inspection.reportImageFailure} />}
          {inspection.imageFailed && <p role="status">A imagem não está disponível agora. O texto da carta continua acessível.</p>}
          <p className="card-text">{featured.text || 'O catálogo não informa texto para esta carta.'}</p>
        </> : <><span className="eyebrow">SEU DECK</span><h4>Comece sua coleção.</h4><p>Adicione cartas para vê-las aqui.</p></>}

      </section>
      <section className="deck-card-list" aria-label={`Cartas de ${chosen.name}`}>
        <div className="card-list-heading"><h4>Lista de cartas</h4><span>{chosen.cards.length} nomes</span></div>
        <div className="deck-filters" aria-label="Filtrar cartas por tipo">
          <button type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>Tudo {cardCount}</button>
          {GROUP_ORDER.filter(key => chosen.groups[key].length > 0).map(key => <button type="button" key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{GROUP_LABELS[key]} {chosen.groups[key].reduce((sum, card) => sum + card.quantity, 0)}</button>)}
        </div>
        <div className="deck-card-search">
          <label htmlFor="deck-card-search">Buscar carta</label>
          <input id="deck-card-search" placeholder="Nome ou texto da carta" value={query} onChange={event => setQuery(event.target.value)} />
          {chosen.commander ? <button type="button" className="text-button" disabled={library.busy} onClick={() => void library.setCommander(chosen.id, '')}>Limpar comandante</button> : null}
        </div>
        <details className="deck-editor-filters" aria-label="Filtrar cartas do deck"><summary>Mais filtros</summary>
          <div role="group" aria-label="Filtrar cartas do deck por tipo"><button type="button" aria-pressed={!type} onClick={() => setType('')}>Todos os tipos</button>{[['Creature','Criaturas'],['Land','Terrenos'],['Artifact','Artefatos'],['Enchantment','Encantamentos'],['Instant','Instantâneas'],['Sorcery','Feitiços'],['Planeswalker','Planeswalkers'],['Battle','Batalhas']].map(([value,label]) => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(type === value ? '' : value)}>{label}</button>)}</div>
          <div role="group" aria-label="Filtrar cartas do deck por cor"><button type="button" aria-pressed={!color} onClick={() => setColor('')}>Todas as cores</button>{[['W','Branco'],['U','Azul'],['B','Preto'],['R','Vermelho'],['G','Verde'],['M','Multicor'],['C','Incolor']].map(([value,label]) => <button key={value} type="button" aria-pressed={color === value} onClick={() => setColor(color === value ? '' : value)}>{label}</button>)}</div>
          <label>Valor de mana<select aria-label="Filtrar cartas do deck por valor de mana" value={cmc} onChange={event => setCmc(event.target.value)}><option value="">Qualquer valor</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{index}</option>)}<option value="12+">12+</option></select></label>
        </details>
        <div className="deck-groups">{GROUP_ORDER.map(key => {
          const cards = chosen.groups[key].filter(card => visibleNames.has(card.name));
          if (cards.length === 0 || (group !== 'all' && group !== key)) return null;
          return <section key={key} aria-label={GROUP_LABELS[key]}>
            <h4>{GROUP_LABELS[key]}</h4>
            <ul>{cards.map(deckCard => <li key={deckCard.name}>
              <span className="card-line">
                <span className="card-quantity">{deckCard.quantity} × </span>{deckCard.available ? <img className="deck-card-thumb" src={deckApi.imageURL(deckCard.name)} alt="" loading="lazy" /> : <span aria-hidden="true" />}
                <button type="button" className="card-link" aria-label={`Consultar ${deckCard.name}`} aria-pressed={inspection.card?.name === deckCard.name} onClick={() => inspection.inspect(deckCard)}>{deckCard.name}</button>
              </span>
              {key !== 'commander' && deckCard.available ? <button type="button" className="text-button" disabled={library.busy} aria-label={`Marcar comandante ${deckCard.name}`} onClick={() => void library.setCommander(chosen.id, deckCard.name)}>Marcar comandante</button> : null}
              {!deckCard.available && <strong>Nome não encontrado no catálogo</strong>}
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
