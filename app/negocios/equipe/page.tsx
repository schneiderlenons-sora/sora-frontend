'use client';

// =============================================================================
// Equipe — o que a equipe custa de verdade.
//
// Antes a tela mostrava só a soma dos salários. Salário não é o custo da
// pessoa: falta a comissão (que em loja e serviço pesa muito) e faltam as
// provisões de quem é CLT (FGTS, 13º, férias — perto de 30% em cima).
//
// A separação que a tela precisa deixar clara:
//   A PAGAR   = o que sai do caixa agora (salário + comissão devida)
//   CUSTO     = o que a pessoa custa no mês (a pagar + provisão)
// São números diferentes e confundi-los é o que faz o dono achar que cabe no
// orçamento contratar mais um.
//
// Encargos são ESTIMATIVA gerencial, com aviso — não é folha oficial.
// =============================================================================

import { useMemo, useState } from 'react';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import ModalFuncionario from '@/components/negocios/ModalFuncionario';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { corEmpresa } from '@/lib/empresas';
import { fmtCent } from '@/lib/lancamentos';
import {
  iniciais, labelDiaPagamento, labelVinculo,
  type EquipeItem, type Funcionario, type ResumoEquipe,
} from '@/lib/funcionarios';
import {
  Plus, Users, Check, Loader2, CheckCircle2, Pencil, CalendarClock,
  Percent, ShieldAlert, ChevronRight,
} from 'lucide-react';

const mesSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

export default function EquipePage() {
  const { empresa, carregando, phone, temNegocios } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [modalFunc, setModalFunc] = useState<'novo' | Funcionario | null>(null);
  const [pagando, setPagando]     = useState<string | null>(null);
  const [aberto, setAberto]       = useState<string | null>(null);
  const [toast, setToast]         = useState('');
  const mes = mesSP();

  const { data, mutate, isLoading } = useApi(
    (phone && empresa && temNegocios) ? `neg:equipe:${empresa.id}:${mes}` : null,
    () => api.negocios.funcionarios.equipe(phone, empresa!.id, mes),
  );
  const resumo = (data ?? null) as ResumoEquipe | null;
  const equipe: EquipeItem[] = useMemo(() => resumo?.equipe ?? [], [resumo]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 4000); };

  async function pagarSalario(f: EquipeItem) {
    if (pagando) return;
    if (!confirm(`Registrar o pagamento de ${fmtCent(f.salario)} para ${f.nome}?`)) return;
    setPagando(f.id);
    try {
      await api.negocios.funcionarios.pagar(f.id);
      await mutate();
      flash(`✓ Salário de ${f.nome} registrado no caixa.`);
    } catch (e: any) { alert(e?.message || 'Não consegui registrar o pagamento.'); }
    finally { setPagando(null); }
  }

  async function pagarComissao(f: EquipeItem) {
    if (pagando) return;
    if (!confirm(`Pagar ${fmtCent(f.comissao_aberta)} de comissão para ${f.nome}?\n\nAs vendas ficam marcadas como pagas — não entram de novo no mês que vem.`)) return;
    setPagando(f.id);
    try {
      await api.negocios.funcionarios.pagarComissao(f.id);
      await mutate();
      flash(`✓ Comissão de ${f.nome} registrada no caixa.`);
    } catch (e: any) { alert(e?.message || 'Não consegui registrar a comissão.'); }
    finally { setPagando(null); }
  }

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">A Equipe faz parte do plano Platinum.</p>;
  }
  if (carregando || isLoading) return <SectionSkeleton />;
  if (!empresa) {
    return <p className="max-w-md mx-auto pt-16 text-center text-sm text-muted-foreground">
      Cadastre uma empresa em Negócios primeiro.
    </p>;
  }

  const temEncargos = (resumo?.encargos_estimados || 0) > 0;
  const aPagar = equipe.reduce((s, f) => s + (f.a_pagar || 0), 0);

  return (
    <div className="pb-24 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa.nome}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Quem trabalha com você e quanto custa</p>
        </div>
        <button onClick={() => setModalFunc('novo')}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
                style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Funcionário
        </button>
      </header>

      {/* HERO — o que sai do caixa × o que custa */}
      <section className="relative overflow-hidden rounded-3xl border border-border/40 p-6"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(circle at top right, ${cor}20 0%, transparent 70%)` }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
               style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
            <Users size={12} style={{ color: cor }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: cor }}>
              A pagar este mês
            </span>
          </div>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular leading-none text-foreground">
            {fmtCent(aPagar)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {equipe.length === 0 ? 'Nenhuma pessoa cadastrada'
              : `${equipe.length} ${equipe.length === 1 ? 'pessoa' : 'pessoas'} · ${fmtCent(resumo?.folha_salarios || 0)} de salário`}
            {(resumo?.comissoes_abertas || 0) > 0 && ` + ${fmtCent(resumo!.comissoes_abertas)} de comissão`}
          </p>

          {/* Custo ≠ pagamento. A distinção que muda decisão de contratação. */}
          {temEncargos && (
            <div className="mt-4 pt-4 border-t border-border/40 flex items-baseline gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Custo real com provisões:</span>
              <span className="text-lg font-bold tabular text-foreground">{fmtCent(resumo!.custo_total)}</span>
              <span className="text-[11px] text-muted-foreground">
                (+{fmtCent(resumo!.encargos_estimados)} de FGTS, 13º e férias que você guarda hoje pra pagar depois)
              </span>
            </div>
          )}
        </div>
      </section>

      {equipe.length === 0 ? (
        <div className="rounded-3xl border border-border/40 px-5 py-14 text-center"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
               style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
            <Users size={20} style={{ color: cor }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Sua equipe começa aqui</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
            Cadastre quem trabalha com você. Com o dia do pagamento, a Sora te lembra
            na Agenda antes de vencer; com o percentual de comissão, ela calcula sozinha
            a cada venda.
          </p>
          <button onClick={() => setModalFunc('novo')}
                  className="inline-flex items-center gap-2 px-5 h-11 mt-5 rounded-2xl text-white text-sm font-bold"
                  style={{ background: cor, minHeight: 44 }}>
            <Plus size={16} /> Cadastrar funcionário
          </button>
        </div>
      ) : (
        <section className="rounded-3xl border border-border/40 overflow-hidden divide-y divide-border/40"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          {equipe.map((f, i) => {
            const expandido = aberto === f.id;
            return (
              <div key={f.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 min-h-[72px]">
                  <span className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: f.foto_url ? 'transparent' : `color-mix(in srgb, ${cor} 16%, transparent)` }}>
                    {f.foto_url
                      ? <img src={f.foto_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold" style={{ color: cor }}>{iniciais(f.nome)}</span>}
                  </span>

                  <button onClick={() => setAberto(expandido ? null : f.id)}
                          aria-expanded={expandido}
                          className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-foreground truncate">{f.nome}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {f.cargo ? `${f.cargo} · ` : ''}{labelVinculo(f.vinculo)}
                      {f.dia_pagamento ? ` · ${labelDiaPagamento(f.dia_pagamento)}` : ''}
                      {(f.comissao_pct || 0) > 0 && ` · ${f.comissao_pct}% de comissão`}
                    </span>
                    {/* Estado em texto + ícone, nunca só cor */}
                    <span className="flex items-center gap-2 mt-1 flex-wrap">
                      {f.salario_pago && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-500">
                          <CheckCircle2 size={10} /> salário pago
                        </span>
                      )}
                      {f.comissao_aberta > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: '#b45309' }}>
                          <Percent size={10} /> {fmtCent(f.comissao_aberta)} de comissão a pagar
                        </span>
                      )}
                    </span>
                  </button>

                  <span className="text-right flex-shrink-0 hidden sm:block">
                    <span className="block text-sm font-bold tabular text-foreground">{fmtCent(f.a_pagar)}</span>
                    {f.custo_total > f.a_pagar && (
                      <span className="block text-[10px] text-muted-foreground tabular">
                        custa {fmtCent(f.custo_total)}
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {f.salario_pago ? (
                      <span className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-bold text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/40">
                        <CheckCircle2 size={14} /> <span className="hidden sm:inline">Pago</span>
                      </span>
                    ) : (
                      <button onClick={() => pagarSalario(f)} disabled={pagando === f.id}
                              aria-label={`Registrar pagamento de ${f.nome}`}
                              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                              style={{ background: '#16a34a', minHeight: 44 }}>
                        {pagando === f.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        <span className="hidden sm:inline">Pagar</span>
                      </button>
                    )}
                    <button onClick={() => setModalFunc(f)} aria-label={`Editar ${f.nome}`}
                            className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors">
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div className="px-4 sm:px-5 pb-4 -mt-1 space-y-2.5">
                    <div className="rounded-2xl bg-muted/40 p-3.5 space-y-1.5">
                      <Linha label="Salário" valor={f.salario} />
                      {f.comissao_mes > 0 && (
                        <Linha label={`Comissão do mês · ${f.vendas_mes} ${f.vendas_mes === 1 ? 'venda' : 'vendas'}`}
                               valor={f.comissao_mes} />
                      )}
                      {(f.detalhe || []).map(d => (
                        <Linha key={d.chave} label={d.label} valor={d.valor} suave />
                      ))}
                      <div className="pt-1.5 mt-1.5 border-t border-border/50">
                        <Linha label="Custo total no mês" valor={f.custo_total} forte />
                      </div>
                    </div>

                    {f.comissao_aberta > 0 && (
                      <button onClick={() => pagarComissao(f)} disabled={pagando === f.id}
                              className="w-full h-11 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                              style={{ background: cor, minHeight: 44 }}>
                        {pagando === f.id ? <Loader2 size={15} className="animate-spin" /> : <Percent size={15} />}
                        Pagar {fmtCent(f.comissao_aberta)} de comissão
                      </button>
                    )}

                    {f.encargos && (
                      <p className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                        <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
                        Estimativa gerencial pra você saber o custo — <b className="text-foreground">não é a folha
                        oficial</b>. Não considera sindicato, insalubridade, vale-transporte nem o seu regime
                        tributário. Confirme com seu contador antes de usar em rescisão ou guia.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {equipe.some(f => !f.dia_pagamento) && equipe.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <CalendarClock size={14} className="flex-shrink-0 mt-0.5" />
          Informe o <strong className="font-semibold">dia do pagamento</strong> de cada pessoa
          pra a Sora lembrar você na Agenda (e no resumo da manhã) antes de vencer.
        </p>
      )}

      {equipe.length > 0 && equipe.every(f => !(f.comissao_pct || 0)) && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <ChevronRight size={14} className="flex-shrink-0 mt-0.5" />
          Se alguém ganha comissão, coloque o percentual no cadastro: a Sora calcula
          sozinha a cada venda e mostra aqui quanto você já deve.
        </p>
      )}

      {modalFunc && empresa && (
        <ModalFuncionario
          empresaId={empresa.id} cor={cor}
          funcionario={modalFunc === 'novo' ? null : modalFunc}
          onClose={() => setModalFunc(null)}
          onSalvo={() => mutate()}
          onArquivado={() => mutate()}
        />
      )}

      {toast && (
        <div role="status" aria-live="polite"
             className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-semibold shadow-2xl"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Linha({ label, valor, suave, forte }: {
  label: string; valor: number; suave?: boolean; forte?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-xs ${suave ? 'text-muted-foreground' : 'text-foreground'} ${forte ? 'font-bold' : ''} truncate`}>
        {label}
      </span>
      <span className={`text-xs tabular flex-shrink-0 ${forte ? 'font-bold text-foreground text-sm' : 'font-semibold text-foreground'}`}>
        {fmtCent(valor)}
      </span>
    </div>
  );
}
