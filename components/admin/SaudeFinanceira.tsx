'use client';

// =============================================================================
// SAÚDE FINANCEIRA — o diagnóstico diário da base no /admin.
//
// Backend: services/diagnosticoFinanceiro.js (verificações puras, eval próprio)
// + JOB 1S às 04:30 SP. Aqui só se LÊ o último retrato e se dispara uma
// varredura nova — ela leva ~5 min, então roda em segundo plano e a tela
// acompanha com polling até terminar.
//
// Ordem de leitura pensada pra quem abre de manhã: o que é NOVO desde a última
// varredura vem primeiro; depois as verificações, erro antes de atenção antes
// de sinal. Gravidade sempre com ÍCONE + RÓTULO, nunca só cor.
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertOctagon, AlertTriangle, Radar, CheckCircle2, RefreshCw, ChevronDown, Sparkles, Loader2, Stethoscope,
} from 'lucide-react';
import { useDinheiro } from '@/lib/moeda-base';

type Gravidade = 'erro' | 'atencao' | 'sinal';
type Achado = { grupo_id: string; valor: number; detalhe: string; email?: string | null; check?: string; gravidade?: Gravidade };
type Check = { id: string; titulo: string; gravidade: Gravidade; explica: string; total: number; contas: number; valor: number; amostra: Achado[] };
type Retrato = {
  geradoEm: string; checks: Check[]; resumo: { erros: number; atencoes: number; sinais: number };
  novidades: Achado[]; escopo?: { transacoes: number; cartoes: number; cartoesAvaliados?: number; desde: string };
};
type Resposta = { retrato: Retrato | null; rodando: { desde: string; origem: string } | null; erro?: string };

const GRAV: Record<Gravidade, { rotulo: string; plural: string; Icon: typeof AlertOctagon; cls: string; chip: string }> = {
  erro:    { rotulo: 'Erro',    plural: 'Erros',    Icon: AlertOctagon,  cls: 'text-red-600 dark:text-red-400',     chip: 'bg-red-500/12 text-red-700 dark:text-red-300' },
  atencao: { rotulo: 'Atenção', plural: 'Atenção', Icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500/12 text-amber-800 dark:text-amber-300' },
  sinal:   { rotulo: 'Sinal',   plural: 'Sinais',   Icon: Radar,         cls: 'text-sky-600 dark:text-sky-400',     chip: 'bg-sky-500/12 text-sky-800 dark:text-sky-300' },
};

function haQuanto(iso?: string) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export default function SaudeFinanceira() {
  const fmt = useDinheiro();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/diagnostico-financeiro', { cache: 'no-store' });
      const j: Resposta = await r.json();
      if (!r.ok) throw new Error(j?.erro || `Erro ${r.status}`);
      setDados(j); setErro('');
      return j;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar o diagnóstico.');
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  // Enquanto a varredura roda, relê a cada 20s até ela terminar.
  const acompanhar = useCallback(async () => {
    const j = await carregar();
    if (j?.rodando) timer.current = setTimeout(acompanhar, 20000);
  }, [carregar]);

  useEffect(() => {
    acompanhar();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [acompanhar]);

  async function rodarAgora() {
    setErro('');
    try {
      const r = await fetch('/api/admin/diagnostico-financeiro', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || `Erro ${r.status}`);
      setDados((d) => (d ? { ...d, rodando: j.rodando } : d));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(acompanhar, 20000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui iniciar a varredura.');
    }
  }

  const retrato = dados?.retrato;
  const rodando = dados?.rodando;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + ação */}
      <div className="card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.14)' }}>
            <Stethoscope size={18} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground">Saúde financeira da base</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {retrato
                ? <>Última varredura {haQuanto(retrato.geradoEm)}{retrato.escopo ? ` · ${retrato.escopo.transacoes.toLocaleString('pt-BR')} lançamentos · ${retrato.escopo.cartoesAvaliados ?? retrato.escopo.cartoes} cartões` : ''} · roda sozinha todo dia às 04:30</>
                : 'Roda sozinha todo dia às 04:30 e acha o erro antes do cliente.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={rodarAgora}
          disabled={!!rodando}
          className="btn-primary min-h-[44px] px-4 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70 w-full sm:w-auto"
        >
          {rodando
            ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Varrendo… {haQuanto(rodando.desde)}</>
            : <><RefreshCw size={15} aria-hidden="true" /> Rodar agora</>}
        </button>
      </div>

      {rodando && (
        <p role="status" className="text-xs text-muted-foreground px-1">
          A varredura leva cerca de 5 minutos. Esta tela atualiza sozinha quando terminar.
        </p>
      )}
      {erro && <p role="alert" className="text-sm text-red-600 dark:text-red-400 px-1">{erro}</p>}

      {carregando && !dados && (
        <div className="card rounded-2xl p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando…
        </div>
      )}

      {!carregando && !retrato && !erro && (
        <div className="card rounded-2xl p-8 text-center">
          <p className="font-semibold text-foreground">Nenhuma varredura salva ainda</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Toque em “Rodar agora”. Para guardar o histórico e mostrar o que é novo a cada dia, a migration 186 precisa ter rodado no Supabase.
          </p>
        </div>
      )}

      {retrato && (
        <>
          {/* Resumo por gravidade */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {(['erro', 'atencao', 'sinal'] as Gravidade[]).map((g) => {
              const n = g === 'erro' ? retrato.resumo.erros : g === 'atencao' ? retrato.resumo.atencoes : retrato.resumo.sinais;
              const { plural, Icon, cls } = GRAV[g];
              return (
                <div key={g} className="card rounded-2xl p-3 sm:p-4">
                  <p className={`text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${cls}`}>
                    <Icon size={12} aria-hidden="true" /> {plural}
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{n}</p>
                </div>
              );
            })}
          </div>

          {/* Novidades */}
          {retrato.novidades?.length > 0 && (
            <section className="card rounded-2xl p-4 sm:p-5" style={{ boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.35)' }}>
              <h3 className="font-semibold text-foreground inline-flex items-center gap-2">
                <Sparkles size={15} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
                Novo desde a varredura anterior
                <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-muted text-foreground">{retrato.novidades.length}</span>
              </h3>
              <ul className="mt-2 divide-y divide-border/50">
                {retrato.novidades.slice(0, 15).map((a, i) => (
                  <LinhaAchado key={i} a={a} fmt={fmt} gravidade={a.gravidade} />
                ))}
              </ul>
            </section>
          )}

          {/* Verificações */}
          <div className="space-y-2">
            {retrato.checks.map((c) => {
              const { rotulo, Icon, cls, chip } = GRAV[c.gravidade];
              const exp = aberto === c.id;
              const zerado = c.total === 0;
              return (
                <section key={c.id} className="card rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => !zerado && setAberto(exp ? null : c.id)}
                    aria-expanded={exp}
                    disabled={zerado}
                    className="w-full min-h-[60px] px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${zerado ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : chip}`}>
                      {zerado ? <CheckCircle2 size={11} aria-hidden="true" /> : <Icon size={11} aria-hidden="true" />} {zerado ? 'OK' : rotulo}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{c.titulo}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {zerado ? 'Nenhum caso' : `${c.total} caso(s) em ${c.contas} conta(s) · ${fmt(c.valor)}`}
                      </span>
                    </span>
                    {!zerado && (
                      <ChevronDown size={16} className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 ${exp ? 'rotate-180' : ''}`} aria-hidden="true" />
                    )}
                  </button>
                  {exp && (
                    <div className="px-4 pb-4 border-t border-border/50">
                      <p className={`text-xs mt-3 leading-relaxed ${cls}`}>{c.explica}</p>
                      <ul className="mt-2 divide-y divide-border/50">
                        {c.amostra.map((a, i) => <LinhaAchado key={i} a={a} fmt={fmt} />)}
                      </ul>
                      {c.total > c.amostra.length && (
                        <p className="text-[11px] text-muted-foreground mt-2">Mostrando {c.amostra.length} de {c.total}.</p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LinhaAchado({ a, fmt, gravidade }: { a: Achado; fmt: (v: number) => string; gravidade?: Gravidade }) {
  const g = gravidade ? GRAV[gravidade] : null;
  return (
    <li className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate">
          {g && <g.Icon size={11} className={`inline -mt-0.5 mr-1 ${g.cls}`} aria-label={g.rotulo} />}
          {a.email || `grupo ${a.grupo_id.slice(0, 8)}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 break-words">{a.detalhe}</p>
      </div>
      <span className="text-xs font-bold tabular-nums text-foreground sm:text-right flex-shrink-0">{fmt(a.valor)}</span>
    </li>
  );
}
