'use client';

// =============================================================================
// "Em que moeda você controla seu dinheiro?" — passo 1 do onboarding (Fase 6
// do plano da moeda base, docs/PLANO-MOEDA-BASE.md).
//
// ⚠️ A MOEDA É DO GRUPO e fica TRAVADA quando ele já tem dinheiro lançado
// (decisão do dono: trocar depois exigiria converter todo o histórico). Travada,
// a tela EXPLICA — nunca um seletor cinza, que lê como "quebrou" (regra
// `read-only-distinction` da skill ui-ux-pro-max). Mesma escolha do step 5
// ("conectar o banco" × "cadastrar à mão").
//
// ⚠️ SALVA NO TOQUE, sem depender do "Continuar": é o que faz o saldo do passo
// 5 já sair com o símbolo certo. Otimista, e volta ao anterior se o servidor
// recusar (409 = alguém lançou dinheiro no meio do caminho).
//
// Se a leitura falhar, o bloco não aparece: o onboarding segue em real, o
// mesmo de antes desta tela existir. Travar o cadastro por causa da moeda
// seria um estrago maior do que não oferecer a escolha.
// =============================================================================

import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useMoedaOnboarding } from '../MoedaOnboarding';

type Info = Awaited<ReturnType<typeof api.grupos.moedaBase>>;

const EXEMPLO: Record<string, string> = {
  BRL: 'Pra quem vive e recebe no Brasil',
  USD: 'Pra quem mora nos EUA ou recebe em dólar',
  NOK: 'Pra quem mora na Noruega',
};

export default function EscolhaMoeda() {
  const { moeda, setMoeda } = useMoedaOnboarding();
  const [info, setInfo] = useState<Info | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api.grupos.moedaBase()
      .then((r) => { if (vivo) { setInfo(r); setMoeda(r.moeda); } })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [setMoeda]);

  if (falhou) return null;

  // Esqueleto do MESMO tamanho do conteúdo: bloco de altura errada = salto.
  if (!info) {
    return (
      <div className="mt-8 max-w-md mx-auto" aria-hidden>
        <div className="h-3 w-48 rounded bg-muted/60 mb-3" />
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-[60px] rounded-2xl bg-muted/40" />)}
        </div>
      </div>
    );
  }

  const atual = info.opcoes.find((o) => o.codigo === (moeda || info.moeda)) || info.opcoes[0];

  if (info.travada) {
    return (
      <div className="mt-8 max-w-md mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Moeda do seu dinheiro
        </p>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border">
          <span className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {atual.simbolo}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {atual.nome}
              <Lock size={13} className="text-muted-foreground" aria-hidden />
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{info.explicacao}</p>
          </div>
        </div>
      </div>
    );
  }

  async function escolher(codigo: string) {
    if (salvando || codigo === atual.codigo) return;
    const anterior = atual.codigo;
    setErro(null);
    setMoeda(codigo);
    setSalvando(true);
    try {
      await api.grupos.definirMoedaBase(codigo);
    } catch (e) {
      setMoeda(anterior);
      const corpo = (e as { body?: { explicacao?: string } } | null)?.body;
      setErro(corpo?.explicacao || 'Não deu pra trocar a moeda agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <fieldset className="mt-8 max-w-md mx-auto">
      <legend className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Em que moeda você controla seu dinheiro?
      </legend>
      <div role="radiogroup" aria-label="Moeda do seu dinheiro" className="grid gap-2">
        {info.opcoes.map((o) => {
          const ativa = o.codigo === atual.codigo;
          return (
            <button
              key={o.codigo}
              type="button"
              role="radio"
              aria-checked={ativa}
              disabled={salvando && !ativa}
              onClick={() => escolher(o.codigo)}
              className={`flex items-center gap-3 min-h-[60px] px-4 py-3 rounded-2xl text-left transition-all
                          active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                          ${ativa ? 'bg-primary/10 border border-primary' : 'bg-card border border-border hover:border-primary/50'}`}
            >
              <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                                ${ativa ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {o.simbolo}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{o.nome}</span>
                <span className="block text-xs text-muted-foreground">{EXEMPLO[o.codigo] || o.codigo}</span>
              </span>
              {ativa && <Check size={18} className="shrink-0 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
      {erro ? (
        <p role="alert" className="text-xs text-red-500 mt-2 leading-relaxed">{erro}</p>
      ) : (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Todos os valores da Sora aparecem nessa moeda. Ela fica fixa depois do primeiro lançamento.
        </p>
      )}
    </fieldset>
  );
}
