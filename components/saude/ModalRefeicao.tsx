'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  X, Loader2, Check, Sparkles, AlertCircle, Trash2, Plus,
  Sun, UtensilsCrossed, Coffee, Moon as MoonIcon, Cookie,
} from 'lucide-react';

const TIPOS = [
  { v: 'cafe',    l: 'Café',    icon: Coffee },
  { v: 'almoco',  l: 'Almoço',  icon: UtensilsCrossed },
  { v: 'lanche',  l: 'Lanche',  icon: Cookie },
  { v: 'jantar',  l: 'Jantar',  icon: Sun },
  { v: 'ceia',    l: 'Ceia',    icon: MoonIcon },
];

const EXEMPLOS = [
  '2 conchas de arroz, 1 concha de feijão e 1 bife médio',
  '3 ovos mexidos com 1 fatia de pão integral e 1 banana',
  '1 filé de frango grelhado com salada e batata doce',
];

interface Props {
  phone:    string;
  onClose:   () => void;
  onSuccess: () => void;
}

export default function ModalRefeicao({ phone, onClose, onSuccess }: Props) {
  const [tipo, setTipo] = useState('almoco');
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function analisar() {
    setErro('');
    if (!texto.trim()) { setErro('Descreva sua refeição.'); return; }
    setAnalisando(true);
    try {
      const r = await api.saude.nutricao.analisar({ phone, texto: texto.trim() });
      if (!r.itens?.length) { setErro('Não consegui identificar os alimentos. Tente reescrever.'); return; }
      setItens(r.itens);
    } catch (e: any) { setErro(e.message); }
    finally { setAnalisando(false); }
  }

  function removerItem(i: number) {
    setItens(prev => prev.filter((_, idx) => idx !== i));
  }

  function editarQuantidade(i: number, novaQtd: string) {
    const v = parseFloat(novaQtd) || 0;
    setItens(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const fator = item.quantidade_g > 0 ? v / item.quantidade_g : 1;
      return {
        ...item,
        quantidade_g:   v,
        calorias:       +(item.calorias * fator).toFixed(1),
        proteinas_g:    +(item.proteinas_g * fator).toFixed(1),
        carboidratos_g: +(item.carboidratos_g * fator).toFixed(1),
        gorduras_g:     +(item.gorduras_g * fator).toFixed(1),
      };
    }));
  }

  async function salvar() {
    setErro('');
    if (!itens.length) { setErro('Adicione pelo menos um item.'); return; }
    setSalvando(true);
    try {
      await api.saude.refeicoes.criar({ phone, tipo, itens });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setSalvando(false); }
  }

  const total = itens.reduce((acc, i) => ({
    calorias:       acc.calorias       + (i.calorias || 0),
    proteinas_g:    acc.proteinas_g    + (i.proteinas_g || 0),
    carboidratos_g: acc.carboidratos_g + (i.carboidratos_g || 0),
    gorduras_g:     acc.gorduras_g     + (i.gorduras_g || 0),
  }), { calorias: 0, proteinas_g: 0, carboidratos_g: 0, gorduras_g: 0 });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">Nova refeição</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Descreva em texto, a IA cuida do resto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tipo de refeição */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Tipo</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIPOS.map(t => {
                const Icon = t.icon;
                const ativo = tipo === t.v;
                return (
                  <button key={t.v} onClick={() => setTipo(t.v)} type="button"
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      ativo
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500'
                        : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                    }`}>
                    <Icon size={14} className={ativo ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'} />
                    <span className="text-[10px] font-bold text-foreground">{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Texto + analisar */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">O que você comeu?</label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={3}
              placeholder={`Ex: "${EXEMPLOS[0]}"`}
              className="input resize-none"
              maxLength={500}
            />
            <button
              onClick={analisar}
              disabled={analisando || !texto.trim()}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition-all"
            >
              {analisando ? <><Loader2 size={14} className="animate-spin" /> Analisando com IA...</> : <><Sparkles size={14} /> Analisar com IA</>}
            </button>
          </div>

          {/* Itens detectados */}
          {itens.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {itens.length} item{itens.length === 1 ? '' : 's'} detectado{itens.length === 1 ? '' : 's'}
              </p>
              <div className="space-y-1.5">
                {itens.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular">
                        {Math.round(item.calorias)} kcal · {Math.round(item.proteinas_g)}p · {Math.round(item.carboidratos_g)}c · {Math.round(item.gorduras_g)}g
                        {item.porcao_descr && <> · {item.porcao_descr}</>}
                      </p>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantidade_g}
                      onChange={e => editarQuantidade(i, e.target.value.replace(/[^\d]/g, ''))}
                      className="w-14 text-xs font-bold text-center bg-card border border-border/60 rounded-lg py-1 tabular focus:border-violet-500 outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground">g</span>
                    <button onClick={() => removerItem(i)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40">
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400 mb-1">Total da refeição</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold text-foreground tabular tracking-tight">{Math.round(total.calorias)}</span>
                    <span className="text-xs text-muted-foreground ml-1">kcal</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-xs">
                    <span><strong className="text-pink-600 dark:text-pink-400 tabular">{Math.round(total.proteinas_g)}g</strong> proteína</span>
                    <span><strong className="text-amber-600 dark:text-amber-400 tabular">{Math.round(total.carboidratos_g)}g</strong> carbo</span>
                    <span><strong className="text-emerald-600 dark:text-emerald-400 tabular">{Math.round(total.gorduras_g)}g</strong> gordura</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !itens.length}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar refeição
          </button>
        </div>
      </div>
    </div>
  );
}
