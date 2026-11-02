import { useEffect, useRef, useState } from 'react';
import { playmatsApi, type PlaymatLibrary, type PlaymatSettings } from './playmatsApi';

export function usePlaymats() {
  const [library, setLibrary] = useState<PlaymatLibrary | null>(null);
  const [draft, setDraft] = useState<PlaymatSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    playmatsApi.list().then(data => { if (active) { setLibrary(data); setDraft(data.settings); } }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return {
    library, draft, busy, error, notice,
    change: (changes: Partial<PlaymatSettings>) => { setDraft(current => current && { ...current, ...changes }); setNotice(''); },
    upload: (file: File) => perform(async () => {
      if (file.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error('Envie JPG, PNG ou WEBP de até 10 MB.');
      const image = await playmatsApi.upload(file);
      setLibrary(current => current && { ...current, images: [image, ...current.images] });
      setDraft(current => current && { ...current, random: false, imageId: image.id });
      setNotice('Imagem enviada. Salve para usar na próxima partida.');
    }),
    save: () => perform(async () => {
      if (!draft) return;
      await playmatsApi.save(draft);
      setLibrary(current => current && { ...current, settings: draft });
      setNotice('Playmat salvo para as próximas partidas.');
    }),
    remove: (id: number) => perform(async () => {
      await playmatsApi.remove(id);
      setLibrary(current => current && { ...current, images: current.images.filter(image => image.id !== id) });
      setDraft(current => current && (current.imageId === id ? { ...current, imageId: 0, random: true } : current));
      setNotice('Imagem removida da biblioteca. Partidas existentes mantêm seu fundo.');
    }),
  };
}
