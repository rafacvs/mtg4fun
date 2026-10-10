import { useEffect, useState } from 'react';
import { sessionApi, type User } from './sessionApi';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  async function restore() {
    setLoading(true);
    setError('');
    try {
      setUser(await sessionApi.current());
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void restore(); }, []);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      setUser(await sessionApi.login({ login, password }));
      setPassword('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await sessionApi.logout();
      setUser(null);
      setPassword('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível sair.');
    } finally {
      setBusy(false);
    }
  }

  return {
    user, loading, busy, error, login, password,
    setLogin, setPassword, restore, signIn, signOut,
  };
}

export type AuthState = ReturnType<typeof useAuth>;
