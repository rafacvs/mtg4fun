export function DeckExamples() {
  return <section className="deck-examples" aria-label="Dados ilustrativos do deck">
    <p>Prévia de apresentação · estes dados são exemplos, não foram calculados para este deck e não são salvos.</p>
    <dl>
      <div><dt>Comandante · exemplo</dt><dd>Gargos, Vicious Watcher</dd></div>
      <div><dt>Cores · exemplo</dt><dd><span className="example-green" aria-hidden="true" /> Verde</dd></div>
      <div><dt>Curva · exemplo</dt><dd className="example-curve" aria-label="Curva ilustrativa"><span style={{ height: 14 }}>1</span><span style={{ height: 24 }}>2</span><span style={{ height: 32 }}>3</span><span style={{ height: 20 }}>4</span><span style={{ height: 12 }}>5+</span></dd></div>
      <div><dt>Tipos · exemplo</dt><dd>Criaturas 34 · Terrenos 37 · Outros 29</dd></div>
    </dl>
  </section>;
}
