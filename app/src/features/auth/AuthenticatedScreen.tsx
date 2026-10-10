import { useEffect, useState, type MouseEvent } from 'react';
import { DeckLibrary } from '../decks/DeckLibrary';
import type { User } from './sessionApi';
import './auth.css';
import { RoomsList } from '../rooms/RoomsList';
import { useDecks } from '../decks/useDecks';

type Props = {
  user: User;
  busy: boolean;
  error: string;
  onLogout: () => Promise<void>;
};

export function AuthenticatedScreen({ user, busy, error, onLogout }: Props) {
  const decks = useDecks();
  const [screen, setScreen] = useState<'salas' | 'decks'>(() => window.location.hash === '#/decks' ? 'decks' : 'salas');

  useEffect(() => {
    const sync = () => setScreen(window.location.hash === '#/decks' ? 'decks' : 'salas');
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, next: 'salas' | 'decks') {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', next === 'decks' ? '/#/decks' : '/#/salas');
    setScreen(next);
    window.scrollTo(0, 0);
  }

  return <div className="authenticated">
    <header className="app-header">
      <div className="app-heading">
        <p className="eyebrow">SEU ESPAÇO DE JOGO</p>
        <h1 id="title">{screen === 'salas' ? 'Lobby' : 'Meus decks'}</h1>
        <p>{screen === 'salas' ? 'Encontre sua mesa e entre na partida.' : 'Sua coleção, pronta para a próxima partida.'}</p>
      </div>
      <div className="account-actions"><span title={`Conectado como ${user.login}`}>{user.name}</span><button type="button" className="text-button" onClick={() => void onLogout()} disabled={busy}>{busy ? 'Saindo…' : 'Sair'}</button></div>
    </header>
    <nav className="app-nav" aria-label="Navegação principal">
      <a href="/#/salas" aria-current={screen === 'salas' ? 'page' : undefined} onClick={event => navigate(event, 'salas')}>Salas</a>
      <a href="/#/decks" aria-current={screen === 'decks' ? 'page' : undefined} onClick={event => navigate(event, 'decks')}>Meus decks</a>
    </nav>
    {screen === 'salas' ? <>
      {decks.decks.length === 0 && !decks.loading && <div className="lobby-hint">Antes de confirmar sua entrada em uma partida, <a href="/#/decks" onClick={event => navigate(event, 'decks')}>importe um deck</a>.</div>}
      <RoomsList userId={user.id} decks={decks} />
    </> : <DeckLibrary library={decks} />}
    {error && <p role="alert" className="error">{error}</p>}
  </div>;
}
