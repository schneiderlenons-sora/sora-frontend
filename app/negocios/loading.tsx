// Skeleton do painel Negócios.
//
// Vale pra QUALQUER rota do segmento: enquanto o Next resolve a próxima tela, o
// usuário vê a estrutura no lugar certo em vez de um vazio. Como o shell
// (sidebar + seletor de empresa) vive no layout, ele nem pisca — só esta área
// troca, e é por isso que a navegação parece instantânea mesmo quando os dados
// ainda estão vindo.
//
// As alturas espelham o conteúdo real: header, faixa de números e lista. Blocos
// do tamanho errado causam salto de layout quando o conteúdo chega (CLS).

export default function LoadingNegocios() {
  return (
    <div className="max-w-7xl mx-auto pb-28 animate-pulse" aria-busy="true" aria-label="Carregando">
      {/* Cabeçalho da tela */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-7 w-52 rounded-lg bg-muted" />
        </div>
        <div className="h-11 w-32 rounded-2xl bg-muted hidden sm:block" />
      </div>

      {/* Faixa de indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-6 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
        <div className="h-4 w-40 rounded bg-muted" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded bg-muted" style={{ width: `${70 - i * 8}%` }} />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
            <div className="h-4 w-16 rounded bg-muted flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
