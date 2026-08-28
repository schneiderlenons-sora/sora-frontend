'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import ModalLancamento from '@/components/negocios/ModalLancamento';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { corEmpresa, type Empresa } from '@/lib/empresas';
import { fmtCent, labelCategoria, type Lancamento } from '@/lib/lancamentos';
import {
  ArrowLeft, Plus, Check, CalendarClock, AlertTriangle, CheckCircle2,
  Wallet, Loader2,
} from 'lucide-react';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function rotuloVenc(iso?: string | null) {
  if (!iso) return 'Sem vencimento';
  const h = hojeIso();
  if (iso === h) return 'Vence hoje';
  const d = new Date(iso + 'T12:00:00');
  const dias = Math.round((d.getTime() - new Date(h + 'T12:00:00').getTime()) / 86400000);
  if (dias === 1) return 'Vence amanhã';
  if (dias < 0) return `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''}`;
  return `Vence em ${dias} dias`;
}

export default function ContasPage() {
  const { empresa, carregando, recarregar, phone, temNegocios } = useEmpresa();
  const [modalNova, setModalNova] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data, mutate } = useApi(
    (phone && empresa) ? `neg:contas:${empresa.id}` : null,
    () => api.negocios.lancamentos.listar(phone, { empresa_id: empresa!.id, status: 'pendente' }),
  );
  const contas: Lancamento[] = Array.isArray(data) ? data.filter(l => l.tipo === 'saida') : [];
  const carregandoContas = !!empresa && data === undefined;

  const grupos = useMemo(() => {
    const h = hojeIso(), semana = emDias(7);
    const g = {
      atrasadas: [] as Lancamento[],
      hoje:      [] as Lancamento[],
      semana:    [] as Lancamento[],
      depois:    [] as Lancamento[],
    };
    for (const c of contas) {
      const v = c.vencimento;
      if (!v)            g.depois.push(c);
      else if (v < h)    g.atrasadas.push(c);
      else if (v === h)  g.hoje.push(c);
      else if (v <= semana) g.semana.push(c);
      else               g.depois.push(c);
    }
    return g;
  }, [contas]);

  const total = contas.reduce((s, c) => s + (c.valor || 0), 0);
  const totalAtrasado = grupos.atrasadas.reduce((s, c) => s + (c.valor || 0), 0);
  const cor = corEmpresa(empresa);

  // Baixa otimista: some da lista na hora, reverte no erro.
  async function darBaixa(c: Lancamento) {
    setBaixando(c.id);
    try {
      await mutate(
        async () => { await api.negocios.lancamentos.editar(c.id, { status: 'pago' }); return undefined; },
        {
          optimisticData: (cur: any) => (Array.isArray(cur) ? cur.filter((x: any) => x.id !== c.id) : cur),
          rollbackOnError: true, populateCache: false, revalidate: true,
        },
      );
    } catch (e: any) {
      alert(e?.message || 'Não consegui dar baixa.');
    } finally {
      setBaixando(null);
    }
  }

  if (!temNegocios) {
    return (
      <>
        <div className="pb-20">
          <p className="text-sm text-muted-foreground">Contas a pagar faz parte do plano Platinum.</p>
        </div>
      </>
    );
  }

  if (carregando) return <><SectionSkeleton /></>;

  if (!empresa) {
    return (
      <>
        <div className="pb-20 space-y-6">
          <Voltar />
          <div className="rounded-3xl border border-border/40 p-8 text-center" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <p className="text-sm text-muted-foreground">
              Cadastre uma empresa em <Link href="/negocios" className="font-semibold underline">Negócios</Link> primeiro.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pb-20 space-y-6">
        <Voltar />

        <header className="relative z-30 flex items-start justify-between flex-wrap gap-4 animate-fade-in">
          {/* O seletor de empresa vive na SIDEBAR (contexto de todo o
              painel). Aqui fica só o nome da tela — dois seletores na mesma
              página deixavam dúvida sobre qual valia. */}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{empresa?.nome || "Negócios"}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Contas a pagar</h1>
            <p className="text-sm text-muted-foreground mt-1">O que vence e o que já foi pago</p>
          </div>
          <button onClick={() => setModalNova(true)}
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: cor }}>
            <Plus size={16} /> Nova conta
          </button>
        </header>

        {/* HERO — total em aberto */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: `radial-gradient(circle at top right, ${cor}20 0%, transparent 70%)` }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
                 style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
              <CalendarClock size={12} style={{ color: cor }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: cor }}>
                Contas a pagar
              </span>
            </div>
            <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular leading-none text-foreground">
              {fmtCent(total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {contas.length === 0 ? 'Nada em aberto' : `${contas.length} conta${contas.length > 1 ? 's' : ''} em aberto`}
            </p>
            {totalAtrasado > 0 && (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-500 mt-3">
                <AlertTriangle size={15} />
                <span className="tabular">{fmtCent(totalAtrasado)}</span>
                <span className="font-medium">em atraso</span>
              </p>
            )}
          </div>
        </section>

        {carregandoContas ? (
          <SectionSkeleton />
        ) : contas.length === 0 ? (
          <div className="rounded-3xl border border-border/40 px-5 py-14 text-center"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
                 style={{ background: 'color-mix(in srgb, #16a34a 14%, transparent)' }}>
              <CheckCircle2 size={20} className="text-green-600 dark:text-green-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhuma conta em aberto</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Cadastre uma conta com vencimento e ela aparece aqui — e também na sua Agenda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Grupo titulo="Atrasadas"      itens={grupos.atrasadas} tom="#ef4444" Icon={AlertTriangle} onBaixa={darBaixa} baixando={baixando} />
            <Grupo titulo="Vencem hoje"    itens={grupos.hoje}      tom="#f59e0b" Icon={CalendarClock} onBaixa={darBaixa} baixando={baixando} />
            <Grupo titulo="Próximos 7 dias" itens={grupos.semana}   tom={cor}     Icon={CalendarClock} onBaixa={darBaixa} baixando={baixando} />
            <Grupo titulo="Mais pra frente" itens={grupos.depois}   tom="#64748b" Icon={Wallet}        onBaixa={darBaixa} baixando={baixando} />
          </div>
        )}
      </div>
      {modalNova && empresa && (
        <ModalLancamento
          empresaId={empresa.id} cor={cor} tipoInicial="saida"
          onClose={() => setModalNova(false)}
          onSalvo={() => mutate()}
        />
      )}
    </>
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

function Grupo({
  titulo, itens, tom, Icon, onBaixa, baixando,
}: {
  titulo: string; itens: Lancamento[]; tom: string; Icon: any;
  onBaixa: (c: Lancamento) => void; baixando: string | null;
}) {
  if (!itens.length) return null;
  const total = itens.reduce((s, c) => s + (c.valor || 0), 0);
  return (
    <section className="rounded-3xl border border-border/40 overflow-hidden" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/40">
        <span className="inline-flex items-center gap-2">
          <Icon size={14} style={{ color: tom }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tom }}>{titulo}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">({itens.length})</span>
        </span>
        <span className="text-sm font-bold tabular text-foreground">{fmtCent(total)}</span>
      </div>
      <div className="divide-y divide-border/40">
        {itens.map((c, i) => (
          <div key={c.id}
               className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[64px] animate-fade-in"
               style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground truncate">{c.descricao}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {rotuloVenc(c.vencimento)} · {labelCategoria('saida', c.categoria)}
                {c.contraparte ? ` · ${c.contraparte}` : ''}
              </span>
            </span>
            <span className="text-sm font-bold tabular text-foreground flex-shrink-0">{fmtCent(c.valor)}</span>
            <button
              onClick={() => onBaixa(c)}
              disabled={baixando === c.id}
              aria-label={`Marcar "${c.descricao}" como paga`}
              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-bold text-white flex-shrink-0 disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: '#16a34a' }}
            >
              {baixando === c.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span className="hidden sm:inline">Pagar</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
