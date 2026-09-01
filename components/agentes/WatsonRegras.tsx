'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Regra } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import RegraForm from './RegraForm';
import {
  Wand2, Plus, Loader2, Trash2, EyeOff, AlertCircle, CheckCircle2, Lightbulb,
} from 'lucide-react';

// =============================================================================
// Regras — dentro do card do Detetive Watson.
//
// Três blocos, nesta ordem:
//   1. O WATSON PROPÕE  — descrições que se repetem e estão em "Outros".
//      Medido na base: 69 delas (118x "compra elo debito vista", 71x "ott
//      grafica"). ⚠️ Ele SÓ PROPÕE: aceitar abre o formulário já preenchido, e
//      a regra continua sendo decisão do usuário. Agente que reescreve dado
//      sozinho é agente que o usuário desliga.
//   2. NOVA REGRA       — o formulário completo (RegraForm).
//   3. REGRAS ATIVAS    — o que está valendo, com quantos lançamentos alcança.
//
// ⚠️ O motor por trás disto roda desde a migration 104 no sync do Open Finance,
// no import de OFX e no WhatsApp. Até set/2026 ele estava QUEBRADO (upsert
// incompatível com o índice de expressão, erro 42P10 engolido por um catch
// best-effort) e a base inteira tinha ZERO regras.
// =============================================================================

const COR = '#6366f1';   // a mesma do Watson no catálogo

type Sugestao = { termo: string; exemplo: string; n: number; total: number; ultima: string };

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function WatsonRegras({ phone }: { phone: string }) {
  // ⚠️ As categorias sao buscadas AQUI, e nao passadas pelo drawer: este bloco
  // so monta quando o card do Watson abre, entao a leitura acontece uma vez por
  // abertura em vez de em toda renderizacao da pagina de agentes (a cota de
  // egress do Supabase e apertada).
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [regras, setRegras]       = useState<Regra[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]           = useState('');
  const [flash, setFlash]         = useState('');
  const [removendo, setRemovendo] = useState<string | null>(null);

  // Formulário: fechado, aberto vazio, ou aberto com uma sugestão dentro.
  const [form, setForm] = useState<{ descricao: string } | null>(null);

  const recarregar = useCallback(async () => {
    const [r, s] = await Promise.allSettled([
      api.regras.listar(phone),
      api.regras.sugestoes(phone),
    ]);
    if (r.status === 'fulfilled') setRegras(r.value || []);
    if (s.status === 'fulfilled') setSugestoes(s.value?.sugestoes || []);
  }, [phone]);

  // ⚠️ setState só DEPOIS do await (react-hooks/set-state-in-effect) e `vivo`
  // pra não escrever em componente desmontado — fechar o drawer antes da
  // resposta é o caso comum.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [r, s, c] = await Promise.allSettled([
          api.regras.listar(phone),
          api.regras.sugestoes(phone),
          api.categorias.listar(phone),
        ]);
        if (!vivo) return;
        if (r.status === 'fulfilled') setRegras(r.value || []);
        if (s.status === 'fulfilled') setSugestoes(s.value?.sugestoes || []);
        if (c.status === 'fulfilled') {
          const lista = (c.value || []) as { id?: string; nome?: string }[];
          setCategorias(lista
            .filter((x) => x?.nome)
            .map((x) => ({ id: String(x.id ?? x.nome), nome: String(x.nome) })));
        }
        if (r.status === 'rejected') setErro('Não consegui carregar suas regras.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [phone]);

  async function apagar(r: Regra) {
    // ⚠️ A confirmação diz o que NÃO acontece: apagar não desfaz o que a regra
    // já aplicou. Deixar isso implícito faria a pessoa esperar o histórico
    // voltar sozinho.
    const oQueFez = r.tipo === 'ignorar'
      ? `Os ${r.lancamentos} lançamentos ocultados VOLTAM a contar.`
      : `Os ${r.lancamentos} lançamentos que ela já ajustou CONTINUAM como estão.`;
    if (!confirm(`Apagar a regra "${r.termo}"?\n\n${oQueFez}`)) return;

    setRemovendo(r.id); setErro('');
    try {
      await api.regras.remover(r.id, phone);
      setRegras((l) => l.filter((x) => x.id !== r.id));
      await recarregar();   // a sugestão pode voltar a fazer sentido
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui apagar.');
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Regras
        </h3>
        {!form && (
          <button type="button" onClick={() => setForm({ descricao: '' })}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold text-white"
            style={{ background: COR, minHeight: 40 }}>
            <Plus size={13} /> Nova
          </button>
        )}
      </div>

      {flash && (
        <p role="status" aria-live="polite"
           className="rounded-xl border p-2.5 text-[12px] font-semibold"
           style={{ borderColor: 'color-mix(in srgb, #22c55e 35%, transparent)',
                    background: 'color-mix(in srgb, #22c55e 8%, transparent)' }}>
          {flash}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-[12px] text-red-500 flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {erro}
        </p>
      )}

      {/* ── Formulário ───────────────────────────────────────────────────── */}
      {form && (
        <div className="rounded-2xl border border-border/50 p-3.5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <RegraForm
            phone={phone}
            categorias={categorias}
            descricaoInicial={form.descricao}
            onCancelar={() => setForm(null)}
            onPronto={async ({ atualizadas }) => {
              setForm(null);
              setFlash(atualizadas > 0
                ? `Regra criada — ${atualizadas} ${atualizadas === 1 ? 'lançamento ajustado' : 'lançamentos ajustados'}.`
                : 'Regra criada. Ela vale pros próximos lançamentos.');
              setTimeout(() => setFlash(''), 6000);
              await recarregar();
            }}
          />
        </div>
      )}

      {/* ── 1. O Watson propõe ───────────────────────────────────────────── */}
      {!form && sugestoes.length > 0 && (
        <div className="rounded-2xl border p-3.5 space-y-2.5"
             style={{ borderColor: `color-mix(in srgb, ${COR} 30%, transparent)`,
                      background: `color-mix(in srgb, ${COR} 5%, transparent)` }}>
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="mt-0.5 flex-shrink-0" style={{ color: COR }} />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Reparei num padrão.</span> Estes nomes
              se repetem e continuam sem categoria. Quer ensinar de uma vez?
            </p>
          </div>
          {sugestoes.slice(0, 5).map((s) => (
            <div key={s.termo}
                 className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-2.5"
                 style={{ background: 'hsl(var(--bg-card))' }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">{s.exemplo}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {s.n}× · {brl(s.total)}
                </p>
              </div>
              <button type="button"
                onClick={() => setForm({ descricao: s.exemplo })}
                className="flex-shrink-0 rounded-xl px-3 text-[12px] font-bold text-white"
                style={{ background: COR, minHeight: 40 }}>
                Criar regra
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. Regras ativas ─────────────────────────────────────────────── */}
      {carregando ? (
        <div className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
      ) : regras.length === 0 && !form ? (
        <div className="rounded-2xl border border-border/50 p-5 text-center">
          <Wand2 size={20} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-[13px] font-semibold text-foreground">Nenhuma regra ainda</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Crie regras pra categorizar automaticamente lançamentos com a mesma descrição, agora e
            nos próximos que chegarem do banco.
          </p>
          <button type="button" onClick={() => setForm({ descricao: '' })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 text-[12px] font-bold text-white"
            style={{ background: COR, minHeight: 44 }}>
            <Plus size={13} /> Criar primeira regra
          </button>
        </div>
      ) : regras.length > 0 ? (
        <ul className="space-y-2">
          {regras.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border/50 p-3"
                style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground break-words">{r.termo}</p>

                  {/* Status: ÍCONE + PALAVRA, nunca cor sozinha. */}
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    {r.tipo === 'ignorar' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                        <EyeOff size={11} />
                        {r.ignorar_escopo === 'fluxo' ? 'não conta em despesa/receita' : 'não conta em nada'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold" style={{ color: COR }}>
                        <CheckCircle2 size={11} />
                        {r.categoria ? nomeCategoria(r.categoria) : 'só renomeia'}
                      </span>
                    )}
                    <span>· {r.modo_match === 'exato' ? 'texto exato' : 'contém'}</span>
                    <span className="tabular-nums">
                      · {r.lancamentos} {r.lancamentos === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </p>

                  {r.renomear_para && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.renomear_para && <>renomeia pra <b className="text-foreground">{r.renomear_para}</b></>}
                    </p>
                  )}
                </div>

                <button type="button" onClick={() => apagar(r)} disabled={removendo === r.id}
                  aria-label={`Apagar a regra ${r.termo}`}
                  className="flex-shrink-0 grid place-items-center rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-60"
                  style={{ width: 44, height: 44 }}>
                  {removendo === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
