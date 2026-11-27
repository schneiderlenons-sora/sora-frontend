'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { BotaoCopiar, Totais, NOME_TIPO, diaBR, reais, linkDoAfiliado, situacao } from '@/components/afiliados/comum';

// Afiliados já aprovados: quanto pagar a cada um. O Pix é feito fora da Sora;
// "Marcar como pago" só registra — e o servidor confere as cobranças antes.

export default function AfiliadosAtivos({ afiliados, onMudou }: { afiliados: any[]; onMudou: () => Promise<unknown> | void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  async function agir(a: any, acao: string, extra: Record<string, unknown> = {}) {
    setOcupado(`${a.id}:${acao}`); setErro((e) => ({ ...e, [a.id]: '' }));
    try {
      const r = await fetch('/api/admin/afiliados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, afiliado_id: a.id, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro((e) => ({ ...e, [a.id]: j.erro || 'Não consegui agora.' }));
      await onMudou();
    } catch {
      setErro((e) => ({ ...e, [a.id]: 'Falha de conexão. Tente de novo.' }));
    } finally { setOcupado(null); setConfirmando(null); }
  }

  if (!afiliados.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">Afiliados ({afiliados.length})</h3>
      {afiliados.map((a) => {
        const devido = a.resumo?.aReceber || 0;
        const rodando = (acao: string) => ocupado === `${a.id}:${acao}`;
        return (
          <article key={a.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{a.dono?.name || a.dono?.email || 'Sem nome'}</p>
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{a.codigo}</span>, {a.desconto_pct}% de desconto, {a.clientes} {a.clientes === 1 ? 'cliente' : 'clientes'}{a.ativo ? '' : ', pausado'}
                </p>
              </div>
              <BotaoCopiar texto={linkDoAfiliado(a.codigo)} rotulo="Link" />
            </div>

            {a.resumo
              ? <Totais resumo={a.resumo} />
              : <p className="text-sm text-red-600 dark:text-red-400">Não consegui ler as comissões.</p>}

            {erro[a.id] && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">{erro[a.id]}</p>}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => agir(a, 'sincronizar')} disabled={!!ocupado}
                className="inline-flex items-center justify-center gap-1.5 px-3 h-11 rounded-xl border border-border text-xs font-bold text-foreground disabled:opacity-50">
                {rodando('sincronizar') ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar comissões
              </button>
              {devido > 0 && confirmando !== a.id && (
                <button type="button" onClick={() => setConfirmando(a.id)} disabled={!!ocupado}
                  className="inline-flex items-center justify-center px-3 h-11 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: 'hsl(var(--primary))' }}>
                  Marcar {reais(devido)} como pago
                </button>
              )}
              <button type="button" onClick={() => agir(a, a.ativo ? 'desativar' : 'ativar')} disabled={!!ocupado}
                className="inline-flex items-center justify-center px-3 h-11 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50 ml-auto">
                {a.ativo ? 'Pausar código' : 'Reativar código'}
              </button>
            </div>

            {confirmando === a.id && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5">
                <p className="text-sm text-foreground">Já fez o Pix de <strong>{reais(devido)}</strong>? Isso não pode ser desfeito pela tela.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => agir(a, 'pagar', { total_centavos: devido })} disabled={!!ocupado}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                    style={{ background: 'hsl(var(--primary))' }}>
                    {rodando('pagar') && <Loader2 size={14} className="animate-spin" />} Sim, já paguei
                  </button>
                  <button type="button" onClick={() => setConfirmando(null)} disabled={!!ocupado}
                    className="flex-1 h-11 rounded-xl border border-border text-xs font-bold text-foreground">Cancelar</button>
                </div>
              </div>
            )}

            {a.linhas?.length > 0 && (
              <>
                <button type="button" onClick={() => setAberto(aberto === a.id ? null : a.id)} aria-expanded={aberto === a.id}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground min-h-11">
                  <ChevronDown size={14} className={`transition-transform ${aberto === a.id ? 'rotate-180' : ''}`} />
                  {a.linhas.length} {a.linhas.length === 1 ? 'lançamento' : 'lançamentos'}
                </button>
                {aberto === a.id && (
                  <ul className="divide-y divide-border/60 border-t border-border/60">
                    {a.linhas.map((l: any) => {
                      const s = situacao(l);
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                          <p className="text-[12px] text-muted-foreground min-w-0">
                            {diaBR(l.pago_em)} {l.ajuste_n > 0 ? 'Ajuste' : `${NOME_TIPO[l.tipo]} (${l.pct}% de ${reais(l.base_centavos)})`}{' '}
                            <span className={s.cor}>{s.texto}</span>
                          </p>
                          <p className="text-[12px] font-bold text-foreground tabular-nums flex-shrink-0">{reais(l.valor_centavos)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
