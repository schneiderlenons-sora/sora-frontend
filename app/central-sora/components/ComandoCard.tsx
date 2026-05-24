'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle, ChevronRight } from 'lucide-react';
import { CATEGORIAS, type Comando } from '@/lib/sora-commands';

interface Props {
  comando:          Comando;
  cor:              string;
  /** Telefone da Sora (do perfil do usuário). Se vazio, usa wa.me sem número. */
  phoneSora?:       string;
  /** Mostra um chip com o nome da categoria (útil em resultados de busca). */
  mostrarCategoria?: boolean;
}

export default function ComandoCard({ comando, cor, phoneSora, mostrarCategoria }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const cat = CATEGORIAS.find((c) => c.id === comando.categoria);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando.exemplo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // fallback silencioso
    }
  }

  // wa.me com texto pré-preenchido. Se não tem phoneSora, abre WhatsApp Web
  // sem número (usuário escolhe destino).
  const waLink = phoneSora
    ? `https://wa.me/${phoneSora}?text=${encodeURIComponent(comando.exemplo)}`
    : `https://wa.me/?text=${encodeURIComponent(comando.exemplo)}`;

  const temVariantes = comando.variantes && comando.variantes.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-foreground/20">
      {/* Topo: título + categoria opcional */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{comando.titulo}</p>
            {mostrarCategoria && cat && (
              <span
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: `${cor}1A`, color: cor }}
              >
                {cat.emoji} {cat.nome}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{comando.descricao}</p>

        {/* Exemplo principal */}
        <div
          className="rounded-xl px-3 py-2.5 border bg-muted/30 font-mono text-sm text-foreground mb-3"
          style={{ borderColor: `${cor}30` }}
        >
          <span className="opacity-50 mr-1">›</span>
          {comando.exemplo}
        </div>

        {/* Botões */}
        <div className="flex flex-wrap gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
            style={{ background: cor }}
          >
            <MessageCircle size={12} />
            Enviar pra Sora
          </a>

          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            {copiado ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>

          {temVariantes && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${expandido ? 'rotate-90' : ''}`}
              />
              {comando.variantes!.length} {comando.variantes!.length === 1 ? 'variante' : 'variantes'}
            </button>
          )}
        </div>
      </div>

      {/* Variantes (expansível) */}
      {expandido && temVariantes && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border/60 pt-3 space-y-2 bg-muted/10">
          {comando.variantes!.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-card text-xs font-mono text-foreground border border-border/60"
            >
              <span className="truncate">{v}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(v)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Copiar"
              >
                <Copy size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
