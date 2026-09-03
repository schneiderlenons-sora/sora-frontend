'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Megaphone, Check, X, Loader2, AtSign, MessageCircle,
  Clock, AlertTriangle, ExternalLink,
} from 'lucide-react';

// =============================================================================
// Painel de candidaturas a afiliado (aba do /admin).
//
// ⚠️ ELE TAMBÉM MOSTRA AS INDICAÇÕES QUE FICARAM SEM CRÉDITO. Quando o crédito
// no Stripe falha, a rota de usar código mantém a indicação como 'pendente' em
// vez de apagá-la — e sem um lugar que mostre isso, o usuário ficaria sem o mês
// prometido e ninguém saberia. Este é esse lugar.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ABAS = [
  ['pendente', 'Em análise'],
  ['aprovado', 'Aprovados'],
  ['recusado', 'Recusados'],
  ['todas',    'Todas'],
] as const;

export default function AfiliadosPainel() {
  const [status, setStatus] = useState<typeof ABAS[number][0]>('pendente');
  const { data, isLoading, mutate } = useSWR(`/api/admin/afiliados?status=${status}`, fetcher);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [nota, setNota] = useState<Record<string, string>>({});

  async function decidir(id: string, novo: 'aprovado' | 'recusado') {
    setSalvando(id);
    try {
      await fetch('/api/admin/afiliados', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: novo, observacao: nota[id] || null }),
      });
      mutate();
    } finally { setSalvando(null); }
  }

  const pendentesSemCredito = data?.indicacoesPendentes || [];

  return (
    <div className="space-y-3">
      {/* ⚠️ Alerta ANTES da fila: dinheiro que não chegou é mais urgente que
          uma candidatura esperando análise. */}
      {pendentesSemCredito.length > 0 && (
        <div className="rounded-2xl border p-4"
             style={{ borderColor: 'rgba(234,88,12,.35)', background: 'rgba(234,88,12,.07)' }}>
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <AlertTriangle size={15} className="text-orange-500" />
            {pendentesSemCredito.length} indicação(ões) sem o mês creditado
          </p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
            O convite foi aceito mas o crédito no Stripe não entrou. Lance o crédito à mão no
            cliente e marque a linha como creditada no banco.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {pendentesSemCredito.map((i: any) => (
              <div key={i.id} className="text-[12px] text-muted-foreground">
                <strong className="text-foreground">{i.indicador?.name || i.indicador?.email}</strong>
                {' '}indicou {i.indicado?.name || i.indicado?.email}
                {' · '}{new Date(i.criado_em).toLocaleDateString('pt-BR')}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 overflow-x-auto">
        {ABAS.map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)}
            className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              status === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
            {data?.contagem?.[id] > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {data.contagem[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted/40" />)}
        </div>
      ) : (data?.candidaturas || []).length === 0 ? (
        <div className="rounded-2xl border border-border/60 p-8 text-center">
          <Megaphone size={22} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma candidatura {status === 'todas' ? '' : `com status "${status}"`}.</p>
        </div>
      ) : (
        data.candidaturas.map((c: any) => (
          <div key={c.id} className="rounded-2xl border border-border/60 p-4 space-y-3 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{c.nome || 'Sem nome'}</p>
                <p className="text-[12px] text-muted-foreground truncate">{c.email}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex-shrink-0"
                    style={{
                      background: c.status === 'aprovado' ? `color-mix(in srgb, ${BRAND} 15%, transparent)` : 'hsl(var(--muted))',
                      color: c.status === 'aprovado' ? BRAND : 'hsl(var(--muted-foreground))',
                    }}>
                {c.status}
              </span>
            </div>

            {/* Os canais são LINKS: analisar perfil é o trabalho aqui, e
                copiar @ na mão a cada candidatura é atrito puro. */}
            <div className="flex flex-wrap gap-2 text-[12px]">
              {c.whatsapp && (
                <a href={`https://wa.me/55${c.whatsapp}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-foreground hover:opacity-80">
                  <MessageCircle size={13} /> {c.whatsapp} <ExternalLink size={11} className="opacity-50" />
                </a>
              )}
              {c.instagram && (
                <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-foreground hover:opacity-80">
                  <AtSign size={13} /> @{c.instagram} <ExternalLink size={11} className="opacity-50" />
                </a>
              )}
              {c.tiktok && (
                <a href={`https://tiktok.com/@${c.tiktok}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-foreground hover:opacity-80">
                  TikTok @{c.tiktok} <ExternalLink size={11} className="opacity-50" />
                </a>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground">
                <Clock size={13} /> {new Date(c.criado_em).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {c.como_divulgar && (
              <p className="text-[13px] text-muted-foreground leading-relaxed p-3 rounded-xl bg-muted/30">
                {c.como_divulgar}
              </p>
            )}

            {c.status === 'pendente' ? (
              <>
                <input
                  value={nota[c.id] ?? ''} onChange={(e) => setNota((n) => ({ ...n, [c.id]: e.target.value }))}
                  placeholder="Observação (o candidato vê isto)"
                  className="input w-full text-sm" style={{ minHeight: 40 }} />
                <div className="flex items-center gap-2">
                  <button onClick={() => decidir(c.id, 'recusado')} disabled={salvando === c.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                    style={{ minHeight: 42 }}>
                    <X size={14} /> Recusar
                  </button>
                  <button onClick={() => decidir(c.id, 'aprovado')} disabled={salvando === c.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: BRAND, minHeight: 42 }}>
                    {salvando === c.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                  </button>
                </div>
              </>
            ) : c.observacao ? (
              <p className="text-[12px] text-muted-foreground">
                <strong className="text-foreground">Observação:</strong> {c.observacao}
              </p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
