import type { FormEvent } from 'react';
import type { AuthState } from './useAuth';
import './auth.css';

export function LoginScreen({ auth }: { auth: AuthState }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void auth.signIn();
  }

  return <div className="login-screen">
    <div className="login-symbol" aria-hidden="true">♧</div>
    <h1 id="title">Toda boa partida<br />começa entre amigos.</h1>
    <p>Entre com a conta recebida do responsável para acessar o mtg4fun.</p>
    <form aria-busy={auth.busy} onSubmit={submit}>
      <label htmlFor="login">Login</label>
      <input
        id="login"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={64}
        value={auth.login}
        onChange={event => auth.setLogin(event.target.value)}
        disabled={auth.busy}
      />
      <label htmlFor="password">Senha</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={auth.password}
        onChange={event => auth.setPassword(event.target.value)}
        disabled={auth.busy}
      />
      {auth.error && <p role="alert" className="error">{auth.error}</p>}
      <button disabled={auth.busy}>{auth.busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
    {auth.error.startsWith('Não foi possível conectar') &&
      <button className="secondary" onClick={() => void auth.restore()}>
        Tentar conectar novamente
      </button>}
    <p className="invitation">
      Acesso apenas para convidados. Precisa de uma conta? Fale com o responsável pelo servidor.
    </p>
  </div>;
}
