import type { ReactNode } from 'react';
import './AppLayout.css';

export function AppLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={wide ? 'app-layout app-layout-wide' : 'app-layout'}>
    <div className="brand">
      <span className="mark" aria-hidden="true">✦</span> mtg<span>4</span>fun
    </div>
    <section className="panel" aria-labelledby="title">
      {!wide && <p className="eyebrow">MAGIC · ENTRE AMIGOS</p>}
      {children}
    </section>
    <footer>Uma mesa virtual. A mesma amizade.</footer>
  </main>;
}
