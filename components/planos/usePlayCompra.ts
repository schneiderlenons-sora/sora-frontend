'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { produtoPlay, modoDeTroca, PRODUTOS_PLAY, type PlanoPlay, type IntervaloPlay } from '@/lib/play-billing';
import { servicoPlay, detalhesPlay, comprarPlay, comprasDoAparelho, type DetalheItem } from '@/lib/digital-goods';

// ─────────────────────────────────────────────────────────────────────────────
// A COMPRA PELA GOOGLE PLAY — fonte única das telas que vendem dentro do app
// (a grade de /planos e o paywall da aba bloqueada).
//
// ⚠️ Era inline no PlanosPlay. Duas telas vendendo com duas cópias do fluxo
// divergiriam no detalhe que mais importa: o que dizer quando o pagamento saiu
// e a liberação não voltou (dizer "deu erro" ali faz a pessoa pagar de novo).
// ─────────────────────────────────────────────────────────────────────────────

export type StatusPlay = {
  ativa: boolean;
  produto?: string;
  plano?: PlanoPlay;
  intervalo?: IntervaloPlay;
  estado?: string;
  expiraEm?: string;
  autoRenova?: boolean;
  purchaseToken?: string;
  indisponivel?: boolean;
};

export type AvisoCompra = { tipo: 'ok' | 'erro' | 'pendente'; texto: string };

const fetcherJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { ativa: false }));

export function useStatusPlay(ligado = true) {
  return useSWR<StatusPlay>(ligado ? '/api/play/status' : null, fetcherJson, { revalidateOnFocus: true });
}

async function confirmarNoServidor(tokens: string[]) {
  const r = await fetch('/api/play/verificar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tokens }),
  });
  const j = await r.json().catch(() => ({})) as { resultados?: { ok: boolean; motivo?: string }[]; erro?: string };
  return { http: r.status, resultados: j.resultados || [], erro: j.erro };
}

const MOTIVO: Record<string, string> = {
  outra_conta: 'Esta compra da Google Play já está ligada a outra conta da Sora. Entre com a conta que fez a assinatura.',
  ja_tem_plano: 'Sua conta já tem um plano ativo, então esta compra não foi aplicada. O Google devolve o valor automaticamente em até 3 dias.',
  produto_desconhecido: 'Este plano não está disponível no momento. O Google devolve o valor automaticamente em até 3 dias.',
};

/**
 * @param ligado false = não toca na API do Google (fora do app nativo).
 */
export function usePlayCompra(ligado = true) {
  const { recarregar } = useAuth();
  const { data: status, mutate } = useStatusPlay(ligado);
  // null = ainda descobrindo; false = app sem cobrança (versão antiga) ou navegador.
  const [disponivel, setDisponivel] = useState<boolean | null>(ligado ? null : false);
  const [precos, setPrecos] = useState<Record<string, DetalheItem>>({});
  const [comprando, setComprando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoCompra | null>(null);

  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    (async () => {
      const s = await servicoPlay();
      if (!vivo) return;
      setDisponivel(!!s);
      if (!s) return;
      try {
        const d = await detalhesPlay(Object.keys(PRODUTOS_PLAY));
        if (vivo) setPrecos(d);
      } catch { /* sem preço, a tela mostra "indisponível" */ }
    })();
    return () => { vivo = false; };
  }, [ligado]);

  async function confirmarPendente() {
    setAviso(null);
    const tokens = await comprasDoAparelho();
    if (!tokens.length) { setAviso({ tipo: 'erro', texto: 'Não encontramos nenhuma compra neste aparelho.' }); return false; }
    const r = await confirmarNoServidor(tokens);
    if (r.resultados.some((x) => x.ok)) {
      await Promise.all([recarregar(), mutate()]);
      setAviso({ tipo: 'ok', texto: 'Pronto! Sua assinatura está ativa.' });
      return true;
    }
    setAviso({ tipo: 'erro', texto: MOTIVO[r.resultados[0]?.motivo || ''] || 'Ainda não conseguimos confirmar. Tente de novo em alguns minutos.' });
    return false;
  }

  /** Devolve true quando o plano foi liberado. */
  async function assinar(plano: PlanoPlay, ciclo: IntervaloPlay): Promise<boolean> {
    const sku = produtoPlay(plano, ciclo);
    setAviso(null);
    setComprando(sku);
    try {
      const troca = status?.ativa && status.produto && status.purchaseToken && status.plano && status.produto !== sku
        ? { oldSku: status.produto, purchaseToken: status.purchaseToken, replacementMode: modoDeTroca(status.plano, plano) }
        : undefined;
      const compra = await comprarPlay(sku, troca);
      if (!compra.ok) {
        if (!compra.cancelada) setAviso({ tipo: 'erro', texto: compra.erro || 'Não foi possível abrir o pagamento.' });
        return false;
      }
      const r = await confirmarNoServidor([compra.purchaseToken]).catch(() => null);
      const res = r?.resultados[0];
      await compra.concluir(!!res?.ok);
      if (res?.ok) {
        await Promise.all([recarregar(), mutate()]);
        setAviso({
          tipo: 'ok',
          texto: troca && troca.replacementMode === 'deferred'
            ? 'Troca agendada! O novo plano começa na próxima renovação — até lá você continua no atual.'
            : 'Assinatura ativa! Já pode usar tudo do seu plano novo.',
        });
        return true;
      }
      if (res?.motivo && MOTIVO[res.motivo]) {
        setAviso({ tipo: 'erro', texto: MOTIVO[res.motivo] });
      } else {
        // ⚠️ O pagamento PODE ter sido feito. Dizer "deu erro" faria a pessoa
        // pagar de novo; a restauração na próxima abertura resolve sozinha.
        setAviso({
          tipo: 'pendente',
          texto: 'O pagamento foi enviado ao Google, mas ainda não conseguimos liberar o plano. Não pague de novo: a Sora confirma sozinha nos próximos minutos — ou toque em "Confirmar compra".',
        });
      }
      return false;
    } finally {
      setComprando(null);
    }
  }

  return { status, disponivel, precos, comprando, aviso, setAviso, assinar, confirmarPendente };
}

/** "R$ 19,90" a partir do preço que o Google devolveu. */
export function precoTexto(d: DetalheItem | undefined, divisor = 1): string | null {
  if (!d) return null;
  const v = Number(d.price.value);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: d.price.currency }).format(v / divisor);
  } catch { return `${d.price.currency} ${(v / divisor).toFixed(2)}`; }
}
