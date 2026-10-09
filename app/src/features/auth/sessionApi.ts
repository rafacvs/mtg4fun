export type User = {
  id: number;
  login: string;
  name: string;
};

type Credentials = { login: string; password: string };

async function requestSession(method: string, credentials?: Credentials): Promise<User | null> {
  const response = await fetch('/api/session', {
    method,
    ...(credentials ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    } : {}),
  });

  if (response.status === 204 || (method !== 'POST' && response.status === 401)) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  }
  return data.user;
}

export const sessionApi = {
  current: () => requestSession('GET'),
  login: (credentials: Credentials) => requestSession('POST', credentials),
  logout: () => requestSession('DELETE'),
};
