'use client';

// Kit compartilhado das abas de coleção do Grow (Viagens, Filmes/Séries,
// Leituras). 100% theme-aware (usa --primary / --bg-card / tokens). Otimizado.
import { useState, type ReactNode } from 'react';
import { X, Loader2, Check, Trash2 } from 'lucide-react';

// ── Cor da nota (0–10) ────────────────────────────────────────────────
export const notaCor = (n: number) =>
  n >= 8 ? '#22c55e' : n >= 6 ? '#84cc16' : n >= 4 ? '#f59e0b' : '#ef4444';

// ── Gradiente determinístico p/ capa sem imagem ───────────────────────
const GRADS = [
  ['#6d28d9', '#d946ef'], ['#0e7490', '#22d3ee'], ['#b91c1c', '#f59e0b'],
  ['#0a5e33', '#61D17B'], ['#1d4ed8', '#60a5fa'], ['#be123c', '#fb7185'],
  ['#7c2d12', '#fb923c'], ['#4338ca', '#818cf8'], ['#065f46', '#34d399'],
];
export function gradDe(seed: string): string {
  let h = 0;
  for (let i = 0; i < (seed || 'x').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = GRADS[h % GRADS.length];
  return `linear-gradient(150deg, ${a} 0%, ${b} 125%)`;
}

// ── Capa (imagem ou placeholder com emoji) ────────────────────────────
export function Capa({ url, emoji, titulo, className = '' }:
  { url?: string | null; emoji: string; titulo: string; className?: string }) {
  if (url) {
    return (
      <img src={url} alt={titulo} loading="lazy" draggable={false}
        className={`w-full h-full object-cover ${className}`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    );
  }
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`} style={{ background: gradDe(titulo) }}>
      <span className="text-[44px] drop-shadow-md select-none">{emoji}</span>
    </div>
  );
}

// ── Caixa de estatística (mesmo padrão do Bem-estar) ──────────────────
export function StatBox({ icon: Icon, label, value, cor }: { icon: any; label: string; value: string; cor: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-3 sm:p-4"
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${cor} 14%, transparent) 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2"
          style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
        <p className="text-lg sm:text-xl font-bold tabular tracking-tight mt-0.5" style={{ color: cor }}>{value}</p>
      </div>
    </div>
  );
}

// ── Chips de filtro (segmented control) ───────────────────────────────
export function Filtros({ value, onChange, options }:
  { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap ${
            value === o.value ? 'bg-primary text-white shadow-sm shadow-primary/25' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Segmented dentro de formulário (com emoji opcional) ───────────────
export function Segmented({ value, onChange, options }:
  { value: string; onChange: (v: string) => void; options: { value: string; label: string; emoji?: string }[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0,1fr))` }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-2 py-2 rounded-xl text-[12px] font-bold transition-all border ${
            value === o.value ? 'bg-primary/10 dark:bg-primary/15 border-primary text-foreground ring-1 ring-primary' : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60'
          }`}>
          {o.emoji && <span className="mr-1">{o.emoji}</span>}{o.label}
        </button>
      ))}
    </div>
  );
}

// ── Nota 0–10 (slider com cor viva) ───────────────────────────────────
export function NotaInput({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sua nota</span>
        {value == null ? (
          <button type="button" onClick={() => onChange(7)} className="text-xs font-bold text-primary">avaliar</button>
        ) : (
          <span className="text-lg font-black tabular" style={{ color: notaCor(v) }}>{v.toFixed(1).replace('.0', '')}<span className="text-xs text-muted-foreground font-bold">/10</span></span>
        )}
      </div>
      <input type="range" min={0} max={10} step={0.5} value={v}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: notaCor(v), background: `linear-gradient(to right, ${notaCor(v)} ${v * 10}%, hsl(var(--muted)) ${v * 10}%)` }} />
    </div>
  );
}

export function NotaBadge({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-black tabular shadow-sm"
      style={{ background: notaCor(nota), color: '#fff' }}>
      {Number(nota).toFixed(1).replace('.0', '')}
    </span>
  );
}

// ── Campo de formulário (label + conteúdo) ────────────────────────────
export function Campo({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}{hint && <span className="text-muted-foreground/60 normal-case font-normal lowercase"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ── Shell de modal (header/scroll/footer fixos) ───────────────────────
export function ModalShell({ titulo, onClose, onSubmit, loading, onDelete, children, submitLabel = 'Salvar', erro }:
  { titulo: string; onClose: () => void; onSubmit: () => void; loading?: boolean; onDelete?: () => void; children: ReactNode; submitLabel?: string; erro?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground truncate">{titulo}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          {children}
          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
          {onDelete ? (
            <button onClick={onDelete} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={17} /></button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button onClick={onSubmit} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Erro de carregamento (com retry) ──────────────────────────────────
export function ErroCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card rounded-3xl py-14 flex flex-col items-center text-center px-6 animate-fade-in">
      <div className="text-4xl mb-3">😕</div>
      <p className="text-base font-bold text-foreground">Não consegui carregar agora</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
        Pode ser instabilidade momentânea. Se acabou de atualizar, dá só um instante e tenta de novo.
      </p>
      <button onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all">
        Tentar de novo
      </button>
    </div>
  );
}

// ── Estado vazio padrão ───────────────────────────────────────────────
export function Vazio({ emoji, titulo, sub }: { emoji: string; titulo: string; sub: string }) {
  return (
    <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
      <div className="text-5xl mb-4">{emoji}</div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{sub}</p>
    </div>
  );
}
