// =============================================================================
// A cor da barra inferior — FONTE ÚNICA.
//
// ⚠️ ESTE ARQUIVO EXISTE PORQUE A COR ESTAVA EM TRÊS LUGARES E ELES DIVERGIRAM.
//
// A faixa do home-indicator (a "área de segurança" embaixo da barra) não é
// pintada pela barra: quem a pinta é o `themeColor` do `app/layout.tsx` — que
// o iOS usa no PWA — e o gradiente de fundo do `DashboardLayout`. Enquanto a
// barra era `bg-card` os três coincidiam por acaso; quando ela virou
// branca/preta, os outros dois ficaram pra trás e apareceu um degrau de cor
// logo abaixo dela.
//
// Agora os três leem daqui. Mudar a cor da barra é mudar uma linha, e a faixa
// acompanha sozinha.
//
// ⚠️ A ÁREA EM SI NÃO TEM COMO SUMIR: o iOS a reserva pro home indicator, e o
// app já usa `viewport-fit: cover` (então o conteúdo JÁ vai até a borda). O que
// dá pra fazer — e é o que se faz aqui — é pintá-la da MESMA cor da barra, pra
// ela deixar de existir aos olhos: a barra simplesmente encosta na borda.
// =============================================================================

export const NAV_CORES = {
  light: {
    /** Superfície da barra E da faixa de segurança abaixo dela. */
    superficie: '#FFFFFF',
    /** Ícone/rótulo inativo. Anda SEMPRE junto da superfície — barra branca
     *  com ícone branco é conteúdo invisível (`color-accessible-pairs`). */
    item: 'rgba(17, 24, 39, 0.55)',
    /** Fio no topo: numa barra branca sobre página off-white, é o que separa
     *  as duas superfícies. */
    fio: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0) 1.5px)',
    sombraMais: '0 10px 24px -8px hsl(var(--primary) / 0.55), 0 3px 8px -3px rgba(0,0,0,0.22)',
  },
  black: {
    superficie: '#000000',
    item: 'rgba(255, 255, 255, 0.55)',
    fio: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0) 1.5px)',
    sombraMais: '0 10px 24px -8px hsl(var(--primary) / 0.6), 0 3px 8px -3px rgba(0,0,0,0.5)',
  },
} as const;

/** Tema → paleta. Antes de montar (SSR) não há tema resolvido: cai no claro. */
export function navPaleta(theme: string | undefined, montado: boolean) {
  return NAV_CORES[montado && theme === 'black' ? 'black' : 'light'];
}
