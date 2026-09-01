'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { X, Loader2, Trash2, Wand2, AlertCircle, Check } from 'lucide-react';

// =============================================================================
// "Minhas regras" — a tela do motor que já existia.
//
// O motor (migration 104 + services/regrasCategoria) roda desde sempre no sync
// do Open Finance, no import de OFX e no WhatsApp. O que faltava era ENXERGAR:
// a regra só nascia por um toggle desligado por padrão dentro do modal de
// edição de transação, e a base inteira tinha ZERO regras — enquanto 69
// descrições se repetiam 3+ vezes paradas em "Outros".
//
// ⚠️ ESTA TELA NÃO CRIA REGRA, de propósito. Criar continua sendo consequência
// de corrigir uma transação, que é onde a pessoa tem o contexto. Um formulário
// de "criar do zero" exigiria que ela adivinhasse qual pedaço da descrição casa
// — e é exatamente esse formulário que fica vazio. Aqui ela VÊ, TROCA e APAGA.
//
// Regras de UI aplicadas (skill ui-ux-pro-max):
//  · confirmação antes de apagar (§8 confirmation-dialogs);
//  · botão desabilitado com spinner durante a chamada (§2 loading-buttons);
//  · empty state explicando COMO criar a primeira (§8 empty-states) — sem isso
//    a tela vazia seria um beco sem saída, que é o estado de hoje;
//  · números em tabular-nums (§6) e toque ≥44pt.
// =============================================================================

type Regra = {
  id: string; termo: string; categoria: string;
  created_at: string; updated_at: string;
  lancamentos: number; fora: number;
};

export default function GerenciarRegrasModal({
  phone, categorias, onClose, onMudou,
}: {
  phone: string;
  /** Categorias do grupo — vêm da página, que já as carregou. Buscar de novo
   *  aqui seria egress à toa (cota apertada no Supabase). */
  categorias: { id: string; nome: string }[];
  onClose: () => void;
  /** A página recarrega os totais: trocar a categoria de uma regra muda o que
   *  a próxima importação faz, e apagar muda a lista. */
  onMudou?: () => void;
}) {
  const [regras, setRegras]   = useState<Regra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]       = useState('');
  const [salvando, setSalvando]   = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [okId, setOkId]       = useState<string | null>(null);

  // Recarrega depois de uma ação (trocar/apagar). Chamado de handler, nunca de
  // efeito — por isso pode mexer no estado à vontade.
  const carregar = useCallback(async () => {
    try {
      setRegras(await api.regras.listar(phone));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar suas regras.');
    }
  }, [phone]);

  // ⚠️ A primeira busca é um efeito SEPARADO, e todo `setState` dele acontece
  // DEPOIS de um await. Chamar `carregar()` direto aqui dispararia setState
  // síncrono dentro do efeito (react-hooks/set-state-in-effect) e uma cascata
  // de renders. O `vivo` também evita escrever estado em componente já
  // desmontado — fechar o modal antes da resposta chegar é o caso comum.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await api.regras.listar(phone);
        if (vivo) setRegras(r);
      } catch (e: unknown) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui carregar suas regras.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [phone]);

  async function trocar(r: Regra, categoria: string) {
    if (!categoria || categoria === r.categoria) return;
    setSalvando(r.id); setErro('');
    try {
      await api.regras.editar(r.id, categoria, phone);
      setOkId(r.id);
      setTimeout(() => setOkId(null), 2000);
      await carregar();
      onMudou?.();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setSalvando(null);
    }
  }

  async function apagar(r: Regra) {
    // ⚠️ A confirmação diz o que NÃO acontece. Apagar a regra não desfaz o que
    // ela já categorizou — e deixar isso implícito faria a pessoa esperar que
    // o histórico voltasse sozinho.
    const ok = confirm(
      `Apagar a regra "${r.termo}"?\n\n`
      + `Os ${r.lancamentos} lançamentos que ela já categorizou CONTINUAM como estão.\n`
      + 'O que muda é daqui pra frente: novos lançamentos com esse nome voltam a ser '
      + 'categorizados automaticamente pela Sora.',
    );
    if (!ok) return;

    setRemovendo(r.id); setErro('');
    try {
      await api.regras.remover(r.id, phone);
      setRegras((l) => l.filter((x) => x.id !== r.id));
      onMudou?.();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui apagar.');
    } finally {
      setRemovendo(null);
    }
  }

  // ⚠️ Guarda de SSR pro portal (CLAUDE.md): `document` não existe no servidor.
  // Aqui é uma checagem de RENDER, não um `mounted` em efeito — o modal só é
  // montado depois de um clique (o pai o mantém desmontado até lá), então não
  // há risco de hydration mismatch e não é preciso pagar um render extra.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
              <Wand2 size={16} style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">Minhas regras</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                O que a Sora aprendeu com as suas correções
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar"
                  className="p-2 rounded-xl hover:bg-muted" style={{ minHeight: 44, minWidth: 44 }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {erro && (
            <p role="alert" className="text-[12px] text-red-500 flex items-start gap-1.5">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
          )}

          {carregando ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : regras.length === 0 ? (
            /* ⚠️ O empty state ENSINA a criar. Sem isso a tela vazia é um beco
               sem saída — e era literalmente o estado de todos os usuários,
               porque o caminho de criação está escondido num toggle. */
            <div className="rounded-2xl border border-border/60 p-6 text-center">
              <Wand2 size={22} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Nenhuma regra ainda</p>
              <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
                Regra é o que a Sora aprende quando você corrige uma categoria. Abra qualquer
                lançamento em <b className="text-foreground">Transações</b>, troque a categoria e
                marque <b className="text-foreground">&quot;aplicar a todos deste estabelecimento&quot;</b>.
                A partir daí, todo lançamento com esse nome já entra certo — inclusive os que
                vierem do banco.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando a descrição de um lançamento casar com o texto da regra, ele vai pra
                categoria escolhida — nos que já existem e nos próximos que chegarem do banco.
              </p>

              <ul className="space-y-2">
                {regras.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-border/60 p-3.5"
                      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground break-words">
                          {r.termo}
                        </p>
                        {/* O número é o que dá sentido à linha: "ott grafica →
                            Casa" não diz nada; com "71 lançamentos", diz. */}
                        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {r.lancamentos === 0
                            ? 'nenhum lançamento com esse nome ainda'
                            : `${r.lancamentos} ${r.lancamentos === 1 ? 'lançamento' : 'lançamentos'}`}
                          {r.fora > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {' '}· {r.fora} fora da categoria
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => apagar(r)}
                        disabled={removendo === r.id}
                        aria-label={`Apagar a regra ${r.termo}`}
                        className="flex-shrink-0 grid place-items-center rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-60"
                        style={{ width: 44, height: 44 }}
                      >
                        {removendo === r.id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <label htmlFor={`cat-${r.id}`} className="sr-only">
                        Categoria da regra {r.termo}
                      </label>
                      <select
                        id={`cat-${r.id}`}
                        value={r.categoria}
                        disabled={salvando === r.id}
                        onChange={(e) => trocar(r, e.target.value)}
                        className="input py-2 text-[13px] font-semibold flex-1 min-w-0"
                        style={{ minHeight: 44 }}
                      >
                        {/* A categoria atual entra na lista mesmo se não existir
                            mais entre as do grupo — senão o <select> mostraria
                            outra coisa e a pessoa salvaria uma troca que não
                            pediu só por abrir a tela. */}
                        {!categorias.some((c) => c.nome === r.categoria) && (
                          <option value={r.categoria}>{nomeCategoria(r.categoria)} (removida)</option>
                        )}
                        {categorias.map((c) => (
                          <option key={c.id} value={c.nome}>{nomeCategoria(c.nome)}</option>
                        ))}
                      </select>
                      {salvando === r.id && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
                      {okId === r.id && <Check size={15} className="text-green-500" />}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Apagar uma regra não desfaz o que ela já categorizou — os lançamentos ficam
                como estão. Muda só daqui pra frente.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
