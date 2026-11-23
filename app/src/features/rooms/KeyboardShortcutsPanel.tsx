import { useEffect, useMemo, useState } from 'react';
import { PanelHeader, TablePanel } from './TablePanel';
import { isValidShortcut, normalizeShortcut, saveShortcutBindings, shortcutDefaults, type ShortcutBindings } from './libraryGesture';

const labels: Record<keyof typeof shortcutDefaults, string> = {
  draw: 'Comprar uma carta', untap: 'Desvirar todas', turn: 'Passar turno', previousTurn: 'Voltar turno',
  library: 'Abrir/fechar grimório', actions: 'Ações do jogo', token: 'Criar ficha', life: 'Vida e marcadores',
  emoji: 'Reagir com emoji', help: 'Ajuda e atalhos', hand: 'Mover seleção para mão', tap: 'Virar/desvirar seleção',
  inspect: 'Inspecionar carta focada', destinations: 'Destinos da seleção', nextPlayer: 'Observar próximo jogador',
  previousPlayer: 'Observar jogador anterior', ownField: 'Voltar ao meu campo', overview: 'Visão geral',
  graveyard: 'Abrir/fechar cemitério', exile: 'Abrir/fechar exílio', chat: 'Chat', cycleZone: 'Alternar mão/campo',
};

export function KeyboardShortcutsPanel({ open, bindings, onChange, onClose }: {
  open: boolean; bindings: ShortcutBindings; onChange: (value: ShortcutBindings) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Partial<ShortcutBindings>>({});
  useEffect(() => { setDrafts({}); }, [bindings]);
  const visible = useMemo(() => (Object.keys(labels) as (keyof typeof labels)[]).filter(key => labels[key].toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) || bindings[key].toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [query, bindings]);
  const update = (key: keyof ShortcutBindings, value: string) => {
    const normalized = normalizeShortcut(value);
    if (!isValidShortcut(value)) { setError('Use uma letra, número, Espaço, Shift+N ou Shift+Espaço. Tab, Escape, Enter e outras combinações são reservados.'); return; }
    if (Object.entries(bindings).some(([name, current]) => name !== key && normalizeShortcut(current) === normalized)) { setError('Esse atalho já está atribuído a outra ação.'); return; }
    const next = { ...bindings, [key]: value.trim() };
    onChange(next); saveShortcutBindings(next); setError('');
  };
  return <TablePanel open={open} wide label="Ajuda e atalhos" onClose={onClose} className="keyboard-shortcuts-panel">
    <PanelHeader title="Ajuda e atalhos" subtitle="Atalhos desta mesa" onClose={onClose} closeLabel="Fechar atalhos" />
    <p className="shortcut-intro">Encontre uma ação e personalize sua tecla. As alterações ficam salvas neste navegador.</p>
    <label className="shortcut-search">Buscar ação<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: grimório, turno…" /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="shortcut-list" role="list" aria-label="Atalhos configuráveis">
      {visible.map(key => <label className="shortcut-row" role="listitem" key={key}><span>{labels[key]}</span><input aria-label={`Atalho: ${labels[key]}`} value={drafts[key] ?? bindings[key]} onChange={event => setDrafts(current => ({ ...current, [key]: event.target.value }))} onBlur={event => update(key, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
      {!visible.length && <p role="status">Nenhum atalho encontrado.</p>}
    </div>
    <button type="button" className="secondary shortcut-reset" onClick={() => { const defaults = { ...shortcutDefaults }; onChange(defaults); saveShortcutBindings(defaults); setError(''); }}>Restaurar padrões</button>
  </TablePanel>;
}
