import { AppLayout } from './components/AppLayout';
import { AuthenticatedScreen } from './features/auth/AuthenticatedScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { useAuth } from './features/auth/useAuth';

export function App() {
  const auth = useAuth();

  return <AppLayout wide={Boolean(auth.user)}>
    {auth.loading ? <h1 id="title" role="status">Conectando…</h1> : auth.user ?
      <AuthenticatedScreen
        user={auth.user}
        busy={auth.busy}
        error={auth.error}
        onLogout={auth.signOut}
      /> : <LoginScreen auth={auth} />}
  </AppLayout>;
}
