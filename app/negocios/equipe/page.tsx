'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import SeletorEmpresa from '@/components/negocios/SeletorEmpresa';
import ModalEmpresa from '@/components/negocios/ModalEmpresa';
import ModalFuncionario from '@/components/negocios/ModalFuncionario';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { corEmpresa, type Empresa } from '@/lib/empresas';
import { fmtCent, type Lancamento } from '@/lib/lancamentos';
import { iniciais, labelDiaPagamento, labelVinculo, type Funcionario } from '@/lib/funcionarios';
import {
  ArrowLeft, Plus, Users, Check, Loader2, CheckCircle2, Pencil, CalendarClock,
} from 'lucide-react';

const mesAtual = () => new Date().toISOString().slice(0, 7);

export default function EquipePage() {
  const { empresas, empresa, trocar, carregando, recarregar, phone, isPremium } = useEmpresaAtiva();
  const [modalEmpresa, setModalEmpresa] = useState<'nova' | Empresa | null>(null);
  const [modalFunc, setModalFunc] = useState<'novo' | Funcionario | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const mes = mesAtual();

  const { data: funcData, mutate: mFunc } = useApi(
    (phone && empresa) ? `neg:func:${empresa.id}` : null,
    () => api.negocios.funcionarios.listar(phone, empresa!.id),
  );
  const funcionarios: Funcionario[] = Array.isArray(funcData) ? funcData : [];

  // Lançamentos do mês → descobre quem JÁ foi pago (não pede endpoint novo).
  const { data: lancData, mutate: mLanc } = useApi(
    (phone && empresa) ? `neg:lanc:${empresa.id}:${mes}` : null,
    () => api.negocios.lancamentos.listar(phone, { empresa_id: empresa!.id, mes }),
  );
  const pagosNoMes = useMemo(() => {
    const s = new Set<string>();
    for (const l of (Array.isArray(lancData) ? lancData : []) as Lancamento[]) {
      const fid = (l as any).funcionario_id;
      if (fid && l.categoria === 'folha') s.add(fid);
    }
    return s;
  }, [lancData]);

  const carregandoLista = !!empresa && funcData === undefined;
  const folha = funcionarios.reduce((s, f) => s + (f.salario || 0), 0);
  const pagoTotal = funcionarios.filter(f => pagosNoMes.has(f.id)).reduce((s, f) => s + (f.salario || 0), 0);
  const cor = corEmpresa(empresa);

  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 4000); }

  async function pagar(f: Funcionario) {
    if (pagando) return;
    if (!confirm(`Registrar o pagamento de ${fmtCent(f.salario)} para ${f.nome}?`)) return;
    setPagando(f.id);
    try {
      await api.negocios.funcionarios.pagar(f.id);
      await mLanc();               // atualiza quem já foi pago
      flash(`✓ Pagamento de ${f.nome} registrado no caixa.`);
    } catch (e: any) {
      alert(e?.message || 'Não consegui registrar o pagamento.');
    } finally {
      setPagando(null);
    }
  }

  if (!isPremium) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-20">
          <p className="text-sm text-muted-foreground">A Equipe faz parte do plano Premium.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (carregando) return <DashboardLayout><SectionSkeleton /></DashboardLayout>;

  if (!empresa) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-20 space-y-6">
          <Voltar />
          <div className="rounded-3xl border border-border/40 p-8 text-center" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <p className="text-sm text-muted-foreground">
              Cadastre uma empresa em <Link href="/negocios" className="font-semibold underline">Negócios</Link> primeiro.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <Voltar />

        <header className="flex items-start justify-between flex-wrap gap-4 animate-fade-in">
          <SeletorEmpresa
            empresas={empresas} ativa={empresa} onTrocar={trocar}
            onNova={() => setModalEmpresa('nova')} onGerenciar={() => setModalEmpresa(empresa)}
          />
          <button onClick={() => setModalFunc('novo')}
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: cor }}>
            <Plus size={16} /> Funcionário
          </button>
        </header>

        {/* HERO — folha do mês */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: `radial-gradient(circle at top right, ${cor}20 0%, transparent 70%)` }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
                 style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
              <Users size={12} style={{ color: cor }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: cor }}>
                Folha do mês
              </span>
            </div>
            <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular leading-none text-foreground">
              {fmtCent(folha)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {funcionarios.length === 0
                ? 'Nenhum funcionário cadastrado'
                : `${funcionarios.length} ${funcionarios.length === 1 ? 'pessoa' : 'pessoas'} na equipe`}
            </p>
            {pagoTotal > 0 && (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-500 mt-3">
                <CheckCircle2 size={15} />
                <span className="tabular">{fmtCent(pagoTotal)}</span>
                <span className="font-medium">já pago este mês</span>
              </p>
            )}
          </div>
        </section>

        {/* LISTA */}
        {carregandoLista ? (
          <SectionSkeleton />
        ) : funcionarios.length === 0 ? (
          <div className="rounded-3xl border border-border/40 px-5 py-14 text-center"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
                 style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
              <Users size={20} style={{ color: cor }} />
            </div>
            <p className="text-sm font-semibold text-foreground">Sua equipe começa aqui</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Cadastre quem trabalha com você. Se informar o dia do pagamento, a Sora
              te lembra na Agenda antes de vencer.
            </p>
            <button onClick={() => setModalFunc('novo')}
                    className="inline-flex items-center gap-2 px-5 h-11 mt-5 rounded-2xl text-white text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: cor }}>
              <Plus size={16} /> Cadastrar funcionário
            </button>
          </div>
        ) : (
          <section className="rounded-3xl border border-border/40 overflow-hidden divide-y divide-border/40"
                   style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            {funcionarios.map((f, i) => {
              const pago = pagosNoMes.has(f.id);
              return (
                <div key={f.id}
                     className="flex items-center gap-3 px-4 sm:px-5 py-3.5 min-h-[72px] animate-fade-in"
                     style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                  {/* Avatar */}
                  <span className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: f.foto_url ? 'transparent' : `color-mix(in srgb, ${cor} 16%, transparent)` }}>
                    {f.foto_url
                      ? <img src={f.foto_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold" style={{ color: cor }}>{iniciais(f.nome)}</span>}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">{f.nome}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {f.cargo ? `${f.cargo} · ` : ''}{labelVinculo(f.vinculo)}
                      {f.dia_pagamento ? ` · ${labelDiaPagamento(f.dia_pagamento)}` : ''}
                    </span>
                  </span>

                  <span className="text-right flex-shrink-0 hidden sm:block">
                    <span className="block text-sm font-bold tabular text-foreground">{fmtCent(f.salario)}</span>
                    {pago && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-500">
                        <CheckCircle2 size={10} /> Pago
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {pago ? (
                      <span className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-bold text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/40">
                        <CheckCircle2 size={14} /> <span className="hidden sm:inline">Pago</span>
                      </span>
                    ) : (
                      <button onClick={() => pagar(f)} disabled={pagando === f.id}
                              aria-label={`Registrar pagamento de ${f.nome}`}
                              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-bold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                              style={{ background: '#16a34a' }}>
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
              );
            })}
          </section>
        )}

        {funcionarios.some(f => !f.dia_pagamento) && funcionarios.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground px-1">
            <CalendarClock size={14} className="flex-shrink-0 mt-0.5" />
            Informe o <strong className="font-semibold">dia do pagamento</strong> de cada pessoa
            pra a Sora lembrar você na Agenda (e no resumo da manhã) antes de vencer.
          </p>
        )}
      </div>

      {modalEmpresa && (
        <ModalEmpresa empresa={modalEmpresa === 'nova' ? null : modalEmpresa}
                      onClose={() => setModalEmpresa(null)}
                      onSalvo={(e) => { recarregar(); trocar(e); }} />
      )}
      {modalFunc && empresa && (
        <ModalFuncionario
          empresaId={empresa.id} cor={cor}
          funcionario={modalFunc === 'novo' ? null : modalFunc}
          onClose={() => setModalFunc(null)}
          onSalvo={() => mFunc()}
          onArquivado={() => mFunc()}
        />
      )}

      {toast && (
        <div role="status" aria-live="polite"
             className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-semibold shadow-2xl animate-fade-in"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

function Voltar() {
  return (
    <Link href="/negocios"
          className="inline-flex items-center gap-1.5 h-11 -ml-2 px-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft size={16} /> Negócios
    </Link>
  );
}
