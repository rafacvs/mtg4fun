export type PlaymatSettings = {
  random: boolean; preset: string; imageId: number;
  fit: 'cover' | 'contain' | 'stretch' | 'repeat'; zoom: number; dim: number;
};
export type PlaymatImage = { id: number; name: string };
export type PlaymatLibrary = { images: PlaymatImage[]; settings: PlaymatSettings };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api/playmats${path}`, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Não foi possível salvar seu playmat.');
  }
  return response;
}
export const playmatsApi = {
  list: async (): Promise<PlaymatLibrary> => (await request('')).json(),
  save: async (settings: PlaymatSettings): Promise<void> => { await request('/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); },
  upload: async (file: File): Promise<PlaymatImage> => {
    const body = new FormData(); body.append('file', file);
    return (await (await request('', { method: 'POST', body })).json()).image;
  },
  remove: async (id: number): Promise<void> => { await request(`/${id}`, { method: 'DELETE' }); },
};
