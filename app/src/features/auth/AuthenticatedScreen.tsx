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
  return <>
    <h1 id="title">Boas-vindas, {user.name}.</h1>
    <p>Você está conectado como <strong>{user.login}</strong>.</p>
    <DeckLibrary library={decks} />
    <RoomsList userId={user.id} decks={decks} />
    {error && <p role="alert" className="error">{error}</p>}
    <button className="secondary" onClick={() => void onLogout()} disabled={busy}>
      {busy ? 'Saindo…' : 'Sair'}
    </button>
  </>;
}
