import { useRef, useState } from 'react';
import { PlaymatPreview } from './PlaymatPreview';
import { presets } from './playmatStyle';
import { usePlaymats } from './usePlaymats';
import './playmats.css';

const ratios = ['16:9', '21:9', '16:10', '4:3', 'Celular'];
const fits = [['cover', 'Cobrir'], ['contain', 'Conter'], ['stretch', 'Esticar'], ['repeat', 'Repetir']] as const;

export function PlaymatLibrary({ name }: { name: string }) {
  const model = usePlaymats();
  const input = useRef<HTMLInputElement>(null);
  const [ratio, setRatio] = useState('16:9');
  const [dragging, setDragging] = useState(false);
  const { draft, busy } = model;
  const choose = () => input.current?.click();
  return <div className="playmats-screen">
    <header className="playmats-hero"><div><h1>Meus playmats</h1><p>Personalize o fundo da sua mesa. Sem imagem escolhida, sorteamos um cenário a cada partida.</p></div><button type="button" disabled={busy || !draft} onClick={choose}>+ Enviar imagem</button></header>
    <input ref={input} className="playmat-file-input" type="file" aria-label="Enviar imagem do playmat" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void model.upload(file); event.target.value = ''; }} />
    {model.error && <p className="error" role="alert">{model.error}</p>}
    {!draft ? <p role="status">Carregando playmats…</p> : <div className="playmats-columns">
      <section className="playmats-library" aria-labelledby="playmats-library-title"><p className="eyebrow">Biblioteca</p><h2 id="playmats-library-title">Seus playmats</h2>
        <button type="button" className={`playmat-drop ${dragging ? 'is-dragging' : ''}`} disabled={busy} onClick={choose} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file && !busy) void model.upload(file); }}><strong>Arraste uma imagem aqui</strong><span>ou clique para escolher · JPG,<br /> PNG, WEBP · até 10 MB</span></button>
        <button type="button" role="switch" aria-checked={draft.random} className="playmat-random" disabled={busy} onClick={() => model.change({ random: !draft.random })}><span aria-hidden="true">🎲</span><span><strong>Aleatório</strong><small>Um cenário novo a cada partida</small></span><span className="playmat-toggle" /></button>
        <div className="playmat-thumbnails">{presets.map(preset => <button type="button" key={preset.id} aria-pressed={!draft.random && !draft.imageId && draft.preset === preset.id} disabled={busy} onClick={() => model.change({ random: false, imageId: 0, preset: preset.id })}><img src={preset.image} alt="" /><span>{preset.name}</span></button>)}</div>
        {!!model.library?.images.length && <div className="playmat-uploads"><h3>Suas imagens</h3>{model.library.images.map(image => <div className="playmat-upload" key={image.id}><button type="button" disabled={busy} aria-pressed={!draft.random && draft.imageId === image.id} onClick={() => model.change({ random: false, imageId: image.id })}><img src={`/api/playmats/${image.id}/image`} alt="" /><span>{image.name}</span></button><button type="button" className="text-button" aria-label={`Excluir ${image.name}`} disabled={busy} onClick={() => { if (window.confirm(`Excluir ${image.name} da biblioteca?`)) void model.remove(image.id); }}>Excluir</button></div>)}</div>}
      </section>
      <section className="playmats-editor" aria-labelledby="playmats-preview-title"><p className="eyebrow">Pré-visualização</p><h2 id="playmats-preview-title">Como ficará na mesa</h2>
        <div className="playmat-pills" role="group" aria-label="Proporção da prévia">{ratios.map(value => <button type="button" key={value} aria-pressed={value === ratio} onClick={() => setRatio(value)}>{value}</button>)}</div>
        <PlaymatPreview settings={draft.random ? { ...draft, imageId: 0, preset: 'forest' } : draft} ratio={ratio} name={name} />
        <p className="playmat-caption">{draft.random ? 'Modo aleatório ativo: este é um exemplo do sorteio.' : 'Prévia do seu playmat. Os ajustes se adaptam ao tamanho do campo.'}</p>
        <div className="playmat-adjustments"><div><span>Ajuste</span><div className="playmat-pills" role="group" aria-label="Ajuste da imagem">{fits.map(([value, label]) => <button type="button" key={value} disabled={busy} aria-pressed={value === draft.fit} onClick={() => model.change({ fit: value })}>{label}</button>)}</div></div>
          <label>Zoom <output>{draft.zoom}%</output><input aria-label="Zoom" type="range" min="100" max="200" value={draft.zoom} disabled={busy} onChange={event => model.change({ zoom: Number(event.target.value) })} /></label>
          <label>Escurecer <output>{draft.dim}%</output><input aria-label="Escurecer" type="range" min="0" max="100" value={draft.dim} disabled={busy} onChange={event => model.change({ dim: Number(event.target.value) })} /></label>
        </div>
        <div className="playmat-save"><p>Todos veem seu playmat. Alterações valem para a próxima partida.</p><button type="button" disabled={busy} onClick={() => void model.save()}>{busy ? 'Salvando…' : 'Salvar playmat'}</button></div>
        <p className="playmat-feedback" role="status" aria-label="Status do playmat">{model.notice}</p>
      </section>
    </div>}
  </div>;
}
