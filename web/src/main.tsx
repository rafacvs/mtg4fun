import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type User = { id: number; login: string; name: string };

async function session(method = 'GET', credentials?: { login: string; password: string }): Promise<User | null> {
  const response = await fetch('/api/session', {
    method,
    ...(credentials ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) } : {}),
  });
  if (response.status === 204 || (method !== 'POST' && response.status === 401)) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data.user;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  async function restore() {
    setLoading(true); setError('');
    try { setUser(await session()); }
    catch { setError('Não foi possível conectar ao servidor. Tente novamente.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void restore(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { setUser(await session('POST', { login, password })); setPassword(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await session('DELETE'); setUser(null); setPassword(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível sair.'); }
    finally { setBusy(false); }
  }

  return <main>
    <div className="brand"><span className="mark" aria-hidden="true">✦</span> mtg<span>4</span>fun</div>
    <section className="panel" aria-labelledby="title">
      <p className="eyebrow">MAGIC · ENTRE AMIGOS</p>
      {loading ? <h1 id="title" role="status">Conectando…</h1> : user ? <>
        <h1 id="title">Boas-vindas, {user.name}.</h1>
        <p>Você está conectado como <strong>{user.login}</strong>.</p>
        <div className="notice">Seu lugar entre amigos está garantido. Salas e decks estarão disponíveis em uma próxima entrega.</div>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="secondary" onClick={() => void logout()} disabled={busy}>{busy ? 'Saindo…' : 'Sair'}</button>
      </> : <>
        <h1 id="title">Toda boa partida<br/>começa entre amigos.</h1>
        <p>Entre com a conta recebida do responsável para acessar o mtg4fun.</p>
        <form onSubmit={submit}>
          <label htmlFor="login">Login</label>
          <input id="login" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={login} onChange={e => setLogin(e.target.value)} disabled={busy}/>
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
          {error && <p role="alert" className="error">{error}</p>}
          <button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        {error.startsWith('Não foi possível conectar') && <button className="secondary" onClick={() => void restore()}>Tentar conectar novamente</button>}
        <p className="invitation">Acesso apenas para convidados. Precisa de uma conta? Fale com o responsável pelo servidor.</p>
      </>}
    </section>
    <footer>Uma mesa virtual. A mesma amizade.</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
