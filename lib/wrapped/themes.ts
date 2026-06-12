// ─────────────────────────────────────────────────────────────────────────
// Sora Wrapped — sistema de temas (duotone vibrante, estilo Spotify Wrapped).
// Cada slide pega um tema: gradiente saturado + cor de texto + acento + blobs.
// Pensado pra ser ousado e "postável" — não corporativo.
// ─────────────────────────────────────────────────────────────────────────

export type WrappedTheme = {
  id: string;
  gradient: string;   // fundo principal do slide
  fg: string;         // cor do texto (alto contraste)
  dim: string;        // texto secundário
  accent: string;     // destaques / números
  blobs: [string, string, string]; // manchas orgânicas que derivam
  dark: boolean;      // true = fundo escuro (texto claro)
};

const t = (o: WrappedTheme) => o;

export const THEMES: Record<string, WrappedTheme> = {
  // Verde Sora — assinatura
  sora: t({
    id: 'sora',
    gradient: 'linear-gradient(155deg, #03110a 0%, #0a5e33 48%, #61D17B 105%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.62)', accent: '#a7f3c0',
    blobs: ['#61D17B', '#0a5e33', '#16a34a'], dark: true,
  }),
  // Violeta → magenta
  violet: t({
    id: 'violet',
    gradient: 'linear-gradient(155deg, #160726 0%, #6d28d9 52%, #d946ef 110%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.6)', accent: '#f0abfc',
    blobs: ['#a855f7', '#6d28d9', '#d946ef'], dark: true,
  }),
  // Sunset coral → âmbar
  sunset: t({
    id: 'sunset',
    gradient: 'linear-gradient(155deg, #240611 0%, #e11d48 46%, #fb923c 112%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.62)', accent: '#fed7aa',
    blobs: ['#fb7185', '#e11d48', '#fb923c'], dark: true,
  }),
  // Cyber ciano
  cyber: t({
    id: 'cyber',
    gradient: 'linear-gradient(155deg, #04111c 0%, #0e7490 50%, #22d3ee 112%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.6)', accent: '#a5f3fc',
    blobs: ['#22d3ee', '#0e7490', '#38bdf8'], dark: true,
  }),
  // Deep sea — tie-in da baleia
  ocean: t({
    id: 'ocean',
    gradient: 'linear-gradient(155deg, #020a14 0%, #0c4a6e 50%, #38bdf8 115%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.6)', accent: '#bae6fd',
    blobs: ['#38bdf8', '#0c4a6e', '#0ea5e9'], dark: true,
  }),
  // Magma vermelho → laranja
  magma: t({
    id: 'magma',
    gradient: 'linear-gradient(155deg, #190404 0%, #b91c1c 48%, #f59e0b 115%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.62)', accent: '#fde68a',
    blobs: ['#ef4444', '#b91c1c', '#f59e0b'], dark: true,
  }),
  // Cotton candy rosa
  cotton: t({
    id: 'cotton',
    gradient: 'linear-gradient(155deg, #230617 0%, #db2777 50%, #fb7185 115%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.62)', accent: '#fecdd3',
    blobs: ['#f472b6', '#db2777', '#fb7185'], dark: true,
  }),
  // Acid lime — fundo CLARO (texto escuro)
  acid: t({
    id: 'acid',
    gradient: 'linear-gradient(155deg, #ecfccb 0%, #a3e635 46%, #22c55e 120%)',
    fg: '#0a2e16', dim: 'rgba(10,46,22,0.6)', accent: '#14532d',
    blobs: ['#bef264', '#22c55e', '#84cc16'], dark: false,
  }),
  // Ink — capa / final (quase preto com neon)
  ink: t({
    id: 'ink',
    gradient: 'radial-gradient(120% 90% at 50% 0%, #10231a 0%, #060a08 55%, #000000 100%)',
    fg: '#ffffff', dim: 'rgba(255,255,255,0.55)', accent: '#61D17B',
    blobs: ['#61D17B', '#0a5e33', '#22d3ee'], dark: true,
  }),
};

export const themeList = Object.values(THEMES);

// ─── Modelo de slide ────────────────────────────────────────────────────
export type SlideBase = { theme: WrappedTheme; kicker?: string };

export type Slide =
  | (SlideBase & { tipo: 'cover'; titulo: string; sub: string; selo: string; emoji?: string })
  | (SlideBase & { tipo: 'numero'; label: string; valor: number; prefixo?: string; sufixo?: string; sub?: string; delta?: number | null; emoji?: string })
  | (SlideBase & { tipo: 'frase'; antes?: string; destaque: string; depois?: string; sub?: string; emoji?: string })
  | (SlideBase & { tipo: 'ranking'; label: string; itens: { nome: string; valorTexto: string; pct: number; cor?: string; emoji?: string }[] })
  | (SlideBase & { tipo: 'persona'; label: string; nome: string; sub: string; emoji: string })
  | (SlideBase & { tipo: 'streak'; label: string; valor: number; sufixo: string; sub: string })
  | (SlideBase & { tipo: 'final'; titulo: string; sub: string; handle: string; resumo: { label: string; valor: string }[] });

export type WrappedDeck = {
  marca: string;        // "Sora · Finance" | "Sora · Grow"
  periodoLabel: string; // "Maio 2026" | "2026"
  accent: string;       // cor da marca (verde Sora etc.)
  slides: Slide[];
};
