import type { User } from './sessionApi';
import './auth.css';

type Props = {
  user: User;
  busy: boolean;
  error: string;
  onLogout: () => Promise<void>;
};

export function AuthenticatedScreen({ user, busy, error, onLogout }: Props) {
  return <>
    <h1 id="title">Boas-vindas, {user.name}.</h1>
    <p>Você está conectado como <strong>{user.login}</strong>.</p>
    <div className="notice">
      Seu lugar entre amigos está garantido. Salas e decks estarão disponíveis em uma próxima entrega.
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="secondary" onClick={() => void onLogout()} disabled={busy}>
      {busy ? 'Saindo…' : 'Sair'}
    </button>
  </>;
}
