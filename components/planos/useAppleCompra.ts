'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { produtoApple, PRODUTOS_APPLE, type PlanoApple, type IntervaloApple } from '@/lib/apple-billing';
import {
  compraAppleDisponivel, produtosApple, comprarApple, restaurarApple, direitosApple, gerenciarApple, mensagemErroApple,
} from '@/lib/apple-compras';
import type { DetalheItem } from '@/lib/digital-goods';
import type { AvisoCompra } from './usePlayCompra';

// ─────────────────────────────────────────────────────────────────────────────
// A COMPRA PELA APPLE — fonte única das telas que vendem dentro do app de
// iPhone (a grade de /planos e o paywall da aba bloqueada). Irmão do
// `usePlayCompra`, com a MESMA forma de retorno: o paywall troca um pelo outro.
//
// Fluxo: janela de pagamento da Apple → /api/apple/verificar confere o
// comprovante com a Apple e libera o plano.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusApple = {
  ativa: boolean;
  produto?: string;
  plano?: PlanoApple;
  intervalo?: IntervaloApple;
  estado?: string;
  expiraEm?: string;
  autoRenova?: boolean;
  proximoProduto?: string | null;
  indisponivel?: boolean;
};

const fetcherJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { ativa: false }));

export function useStatusApple(ligado = true) {
  return useSWR<StatusApple>(ligado ? '/api/apple/status' : null, fetcherJson, { revalidateOnFocus: true });
}

async function confirmarNoServidor(jws: string[]) {
  const r = await fetch('/api/apple/verificar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jws }),
  });
  const j = await r.json().catch(() => ({})) as { resultados?: { ok: boolean; motivo?: string }[]; erro?: string };
  return { http: r.status, resultados: j.resultados || [], erro: j.erro };
}

// ⚠️ Na Apple a compra NÃO é devolvida sozinha (diferente da Play): quando a
// Sora não a aplica, a pessoa precisa pedir o reembolso à Apple — e o texto diz
// onde, sem rodeio.
const REEMBOLSO = 'Para pedir o reembolso, acesse reportaproblem.apple.com.';
const MOTIVO: Record<string, string> = {
  outra_conta: 'Esta assinatura da App Store já está ligada a outra conta. Entre com a conta que fez a assinatura.',
  ja_tem_plano: `Sua conta já tem um plano ativo, então esta compra não foi aplicada. ${REEMBOLSO}`,
  produto_desconhecido: `Este plano não está disponível no momento. ${REEMBOLSO}`,
};

/** Produto da Apple no mesmo formato que o da Play, pra o `precoTexto` servir aos dois. */
function comoDetalhe(p: { id: string; valor: number; moeda: string; periodo?: string }): DetalheItem {
  return { itemId: p.id, title: p.id, price: { value: String(p.valor), currency: p.moeda || 'BRL' }, subscriptionPeriod: p.periodo };
}

/**
 * @param ligado false = não toca na App Store (fora do app ou app sem o plugin).
 */
export function useAppleCompra(ligado = true) {
  const { user, recarregar } = useAuth();
  const { data: status, mutate } = useStatusApple(ligado);
  // null = ainda descobrindo; false = sem o plugin (app antigo) ou navegador.
  const [disponivel, setDisponivel] = useState<boolean | null>(ligado ? null : false);
  const [precos, setPrecos] = useState<Record<string, DetalheItem>>({});
  const [comprando, setComprando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoCompra | null>(null);
  const [erroPreco, setErroPreco] = useState<string | null>(null);
  const [motivoIndisponivel, setMotivoIndisponivel] = useState('');

  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    (async () => {
      const ok = compraAppleDisponivel();
      if (!vivo) return;
      setDisponivel(ok);
      if (!ok) { setMotivoIndisponivel('compra da App Store indisponível nesta versão do app'); return; }
      try {
        const lista = await produtosApple(Object.keys(PRODUTOS_APPLE));
        if (!vivo) return;
        setPrecos(Object.fromEntries(lista.map((p) => [p.id, comoDetalhe(p)])));
        if (!lista.length) setErroPreco('a App Store não devolveu nenhum plano');
      } catch (e) {
        if (vivo) setErroPreco(mensagemErroApple(e));
      }
    })();
    return () => { vivo = false; };
  }, [ligado]);

  async function enviar(jws: string[], vazio: string) {
    if (!jws.length) { setAviso({ tipo: 'erro', texto: vazio }); return false; }
    const r = await confirmarNoServidor(jws);
    if (r.resultados.some((x) => x.ok)) {
      await Promise.all([recarregar(), mutate()]);
      setAviso({ tipo: 'ok', texto: 'Pronto! Sua assinatura está ativa.' });
      return true;
    }
    setAviso({ tipo: 'erro', texto: MOTIVO[r.resultados[0]?.motivo || ''] || r.erro || 'Ainda não conseguimos confirmar. Tente de novo em alguns minutos.' });
    return false;
  }

  /** "Já assinei e o plano não apareceu": relê sem pedir senha. */
  async function confirmarPendente() {
    setAviso(null);
    return enviar((await direitosApple()).map((d) => d.jws), 'Não encontramos nenhuma assinatura ativa neste Apple ID.');
  }

  /** "Restaurar compras" — exigência da Apple: pode pedir a senha do Apple ID. */
  async function restaurar() {
    setAviso(null);
    try {
      return await enviar((await restaurarApple()).map((d) => d.jws), 'Não encontramos nenhuma assinatura ativa neste Apple ID.');
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErroApple(e) });
      return false;
    }
  }

  async function gerenciar() {
    try { await gerenciarApple(); } catch (e) { setAviso({ tipo: 'erro', texto: mensagemErroApple(e) }); }
    mutate();
  }

  /** Devolve true quando o plano foi liberado. */
  async function assinar(plano: PlanoApple, ciclo: IntervaloApple): Promise<boolean> {
    const id = produtoApple(plano, ciclo);
    if (!user?.id) { setAviso({ tipo: 'erro', texto: 'Entre na sua conta para assinar.' }); return false; }
    setAviso(null);
    setComprando(id);
    try {
      let compra;
      try {
        compra = await comprarApple(id, user.id);
      } catch (e) {
        setAviso({ tipo: 'erro', texto: mensagemErroApple(e) });
        return false;
      }
      if (compra.status === 'cancelada') return false;
      if (compra.status === 'pendente') {
        // Compra por Solicitação (Compartilhamento Familiar) ou verificação do
        // banco: a Apple conclui depois e a Sora fica sabendo pelo aviso dela.
        setAviso({ tipo: 'pendente', texto: 'A compra está aguardando aprovação. Assim que a Apple concluir, o plano é liberado sozinho.' });
        return false;
      }
      if (compra.status !== 'sucesso') {
        setAviso({ tipo: 'erro', texto: 'A App Store não confirmou a compra. Se aparecer a cobrança, toque em "Restaurar compras".' });
        return false;
      }
      const r = await confirmarNoServidor([compra.jws]).catch(() => null);
      const res = r?.resultados[0];
      if (res?.ok) {
        await Promise.all([recarregar(), mutate()]);
        setAviso({ tipo: 'ok', texto: 'Assinatura ativa! Já pode usar tudo do seu plano novo.' });
        return true;
      }
      if (res?.motivo && MOTIVO[res.motivo]) {
        setAviso({ tipo: 'erro', texto: MOTIVO[res.motivo] });
      } else {
        // ⚠️ O pagamento FOI feito. Dizer "deu erro" faria a pessoa pagar de
        // novo; o aviso da Apple e a próxima abertura do app resolvem sozinhos.
        setAviso({
          tipo: 'pendente',
          texto: 'O pagamento foi feito na App Store, mas ainda não conseguimos liberar o plano. Não pague de novo: a liberação acontece sozinha nos próximos minutos — ou toque em "Confirmar compra".',
        });
      }
      return false;
    } finally {
      setComprando(null);
    }
  }

  return { status, disponivel, precos, erroPreco, motivoIndisponivel, comprando, aviso, setAviso, assinar, confirmarPendente, restaurar, gerenciar };
}
