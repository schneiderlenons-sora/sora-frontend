'use client';

// Categorias do negócio: criar, dar ícone, renomear, juntar e tirar da lista.
// Pedido de cliente (nov/2026): "não tem como colocar mais categorias… queria
// também colocar um ícone, gosto de tudo bem organizado".
//
// - As PADRÃO aparecem só pra referência (não mudam).
// - As PRÓPRIAS incluem as que já foram digitadas no "Outra" de algum
//   lançamento — elas aparecem aqui pra ganhar ícone, nome certo ou serem
//   juntadas ("CONVENIENCIA" + "COVENIENCIA").
// - Renomear/juntar/remover levam os lançamentos junto (no servidor) e só
//   aparecem pra quem administra a empresa; quem só lança cria e põe ícone.
//
// ⚠️ Portal pro body (os cards do painel usam backdrop-blur e prendem o fixed)
// e z-[90], acima do formulário (z-[80]). Por isso as confirmações são
// INLINE: o diálogo global do app fica em z-[80] e abriria atrás deste modal.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Check, ChevronLeft, Trash2, ArrowUpRight, ArrowDownRight, EyeOff, Merge } from 'lucide-react';
import { api } from '@/lib/api';
import { categoriasDe, type TipoLancamento } from '@/lib/lancamentos';
import { NOME_MAX_CATEGORIA, type CategoriaPropria } from '@/lib/categorias-negocio';
import { useCategoriasNegocio } from '@/lib/useCategoriasNegocio';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { podeNaEmpresa } from '@/lib/empresas';
import IconeCategoria, { ICONES_CATEGORIA, ROTULO_ICONE } from '@/components/negocios/IconeCategoria';

type Natureza = 'fixa' | 'variavel' | null;
type Edicao = { atual: CategoriaPropria | null; nome: string; icone: string | null; natureza: Natureza };
type Remocao = { acao: 'mover' | 'ocultar'; para: string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default function ModalCategoriasNegocio({
  empresaId, cor, tipoInicial = 'saida', onClose, onChanged,
}: {
  empresaId: string;
  cor: string;
  tipoInicial?: TipoLancamento;
  onClose: () => void;
  /** Algo mudou (nomes de lançamentos inclusive): a tela de trás recarrega.
   *  Com `mudanca`, a categoria `de` passou a se chamar `para` — o formulário
   *  aberto atrás precisa trocar, senão salvaria o nome velho de volta. */
  onChanged?: (mudanca?: { tipo: TipoLancamento; de: string; para: string }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { empresa } = useEmpresa();
  const admin = podeNaEmpresa(empresa, 'admin');
  const { proprias, semMigration, carregando, erro: erroLista, recarregar } = useCategoriasNegocio(empresaId);

  const [tipo, setTipo] = useState<TipoLancamento>(tipoInicial);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [remocao, setRemocao] = useState<Remocao | null>(null);
  const [juntarCom, setJuntarCom] = useState<string | null>(null);   // 409 do renomear
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const minhas = useMemo(
    () => proprias.filter(c => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [proprias, tipo],
  );
  const padrao = categoriasDe(tipo).filter(c => c.v !== 'movimentacao' && c.v !== 'uso_pessoal');

  function abrir(atual: CategoriaPropria | null) {
    setErro(''); setAviso(''); setRemocao(null); setJuntarCom(null);
    setEdicao({ atual, nome: atual?.nome || '', icone: atual?.icone || null, natureza: atual?.natureza || null });
  }
  function fechar() { setEdicao(null); setRemocao(null); setJuntarCom(null); setErro(''); }

  async function depois(msg: string, mudanca?: { de: string; para: string }) {
    await recarregar();
    onChanged?.(mudanca ? { tipo, ...mudanca } : undefined);
    setEdicao(null); setRemocao(null); setJuntarCom(null);
    setAviso(msg);
  }

  async function salvar(juntar = false) {
    if (!edicao || salvando) return;
    const nome = edicao.nome.replace(/\s+/g, ' ').trim();
    if (!nome) { setErro('Dê um nome à categoria.'); return; }
    setSalvando(true); setErro('');
    try {
      const atual = edicao.atual;
      let nomeFinal = nome;
      let msg = atual ? 'Categoria atualizada.' : 'Categoria criada.';
      let mudanca: { de: string; para: string } | undefined;
      // Nome mudou (inclusive só a grafia): renomeia antes — leva os lançamentos.
      if (atual && nome !== atual.nome) {
        try {
          const r = await api.negocios.categorias.renomear({ empresa_id: empresaId, tipo, de: atual.nome, para: nome, juntar });
          nomeFinal = r.nome;
          mudanca = { de: atual.nome, para: r.nome };
          msg = r.juntou
            ? `Juntada com "${r.nome}"${r.lancamentos ? ` · ${plural(r.lancamentos, 'lançamento passou', 'lançamentos passaram')} para ela` : ''}.`
            : `Renomeada${r.lancamentos ? ` · ${plural(r.lancamentos, 'lançamento acompanhou', 'lançamentos acompanharam')}` : ''}.`;
        } catch (e: any) {
          if (e?.status === 409 && e?.body?.existente) { setJuntarCom(e.body.existente); setSalvando(false); return; }
          throw e;
        }
      }
      // Ícone e natureza moram na categoria guardada (precisa da tabela).
      const mudouExtra = !atual || edicao.icone !== atual.icone || edicao.natureza !== atual.natureza;
      if (mudouExtra && !(juntar && atual)) {
        if (semMigration) {
          if (!atual) throw new Error('As categorias personalizadas ainda estão sendo liberadas. Tente de novo em alguns minutos.');
        } else {
          await api.negocios.categorias.salvar({
            empresa_id: empresaId, tipo, nome: nomeFinal, icone: edicao.icone,
            ...(tipo === 'saida' ? { natureza: edicao.natureza } : {}),
          });
        }
      }
      await depois(msg, mudanca);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    const atual = edicao?.atual;
    if (!atual || salvando) return;
    setSalvando(true); setErro('');
    try {
      if (!atual.usos) {
        await api.negocios.categorias.remover({ empresa_id: empresaId, tipo, nome: atual.nome });
        await depois(`"${atual.nome}" foi apagada.`);
      } else if (remocao?.acao === 'mover') {
        if (!remocao.para) { setErro('Escolha para qual categoria mover.'); setSalvando(false); return; }
        const r = await api.negocios.categorias.remover({ empresa_id: empresaId, tipo, nome: atual.nome, acao: 'mover', para: remocao.para });
        await depois(`"${atual.nome}" foi apagada · ${plural(r.lancamentos || 0, 'lançamento mudou', 'lançamentos mudaram')} de categoria.`,
          { de: atual.nome, para: remocao.para });
      } else {
        await api.negocios.categorias.remover({ empresa_id: empresaId, tipo, nome: atual.nome, acao: 'ocultar' });
        await depois(`"${atual.nome}" saiu da lista. Os lançamentos continuam com ela.`);
      }
    } catch (e: any) {
      setErro(e?.message || 'Não consegui remover.');
    } finally {
      setSalvando(false);
    }
  }

  async function voltarParaLista(c: CategoriaPropria) {
    setSalvando(true); setErro('');
    try {
      await api.negocios.categorias.salvar({ empresa_id: empresaId, tipo, nome: c.nome });
      await depois(`"${c.nome}" voltou para a lista.`);
    } catch (e: any) { setErro(e?.message || 'Não consegui.'); }
    finally { setSalvando(false); }
  }

  if (!mounted) return null;

  const destinos = [
    ...padrao.map(c => ({ v: c.v, label: c.label })),
    ...minhas.filter(c => edicao?.atual && c.chave !== edicao.atual.chave && !c.oculta).map(c => ({ v: c.nome, label: c.nome })),
  ];
  const nomeMudou = !!edicao?.atual && edicao.nome.trim() !== edicao.atual.nome;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92dvh] overflow-y-auto"
           onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cat-neg-titulo">

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          {edicao ? (
            <button onClick={fechar} disabled={salvando}
                    className="-ml-2 h-11 pr-2 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ChevronLeft size={18} /> Categorias
            </button>
          ) : (
            <div>
              <h2 id="cat-neg-titulo" className="text-base font-bold text-foreground">Categorias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Crie as suas e escolha um ícone para cada uma</p>
            </div>
          )}
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {!edicao ? (
          <div className="p-5 space-y-5">
            {/* Saída × Entrada — ícone + rótulo, nunca só cor */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
              {([
                { v: 'saida', l: 'Saídas', Icon: ArrowDownRight, c: '#ef4444' },
                { v: 'entrada', l: 'Entradas', Icon: ArrowUpRight, c: '#16a34a' },
              ] as const).map(o => {
                const on = tipo === o.v;
                return (
                  <button key={o.v} onClick={() => { setTipo(o.v); setAviso(''); }} aria-pressed={on}
                          className={`h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all ${on ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
                          style={on ? { color: o.c } : undefined}>
                    <o.Icon size={15} /> {o.l}
                  </button>
                );
              })}
            </div>

            {aviso && (
              <p role="status" className="text-xs rounded-xl px-3 py-2.5 flex items-start gap-2"
                 style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)`, color: 'hsl(var(--foreground))' }}>
                <Check size={14} className="mt-px flex-shrink-0" style={{ color: cor }} /> {aviso}
              </p>
            )}
            {(erro || erroLista) && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {erro || 'Não consegui carregar as categorias. Feche e abra de novo.'}
              </p>
            )}

            {/* As da empresa */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-foreground">Suas categorias</h3>
                <button onClick={() => abrir(null)}
                        className="h-9 px-3 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1"
                        style={{ background: cor }}>
                  <Plus size={14} /> Nova
                </button>
              </div>
              {carregando ? (
                <div className="space-y-2" aria-busy="true">
                  {[0, 1].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : minhas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma categoria de {tipo === 'saida' ? 'saída' : 'entrada'} sua ainda
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Crie uma com o nome e o ícone que fizerem sentido pro seu negócio
                    {tipo === 'saida' ? ' (ex.: Sistema, Embalagens, Combustível).' : ' (ex.: Delivery, Aluguel recebido).'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {minhas.map(c => (
                    <li key={c.chave}>
                      <div className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-border/60 ${c.oculta ? 'bg-muted/10' : 'bg-muted/20'}`}>
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={c.oculta ? { background: 'hsl(var(--muted))' } : { background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
                          <IconeCategoria nome={c.icone} size={17}
                                          style={{ color: c.oculta ? 'hsl(var(--muted-foreground))' : cor }} />
                        </span>
                        <button onClick={() => abrir(c)} className="flex-1 min-w-0 text-left min-h-[44px]"
                                aria-label={`Editar ${c.nome}`}>
                          <span className={`block text-sm font-semibold truncate ${c.oculta ? 'text-muted-foreground' : 'text-foreground'}`}>{c.nome}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {c.usos ? plural(c.usos, 'lançamento', 'lançamentos') : 'sem lançamentos'}
                            {tipo === 'saida' && c.natureza === 'fixa' ? ' · despesa fixa' : ''}
                            {!c.icone && !c.oculta ? ' · sem ícone' : ''}
                          </span>
                        </button>
                        {c.oculta ? (
                          <button onClick={() => voltarParaLista(c)} disabled={salvando || semMigration}
                                  className="h-9 px-2.5 rounded-lg text-[11px] font-bold border border-border/60 text-foreground inline-flex items-center gap-1 disabled:opacity-50">
                            <EyeOff size={12} aria-hidden /> Fora da lista · mostrar
                          </button>
                        ) : (
                          <button onClick={() => abrir(c)} className="h-9 px-2.5 rounded-lg text-[11px] font-bold"
                                  style={{ color: cor }}>
                            Editar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Padrão — só referência */}
            <section>
              <h3 className="text-sm font-bold text-foreground">Padrão</h3>
              <p className="text-[11px] text-muted-foreground mb-2">Vêm com o Sora Negócios e não mudam.</p>
              <div className="flex flex-wrap gap-1.5">
                {padrao.map(c => (
                  <span key={c.v} className="h-8 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 bg-muted/50 text-muted-foreground">
                    <IconeCategoria nome={c.icone} size={12} /> {c.label}
                  </span>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <h2 id="cat-neg-titulo" className="text-base font-bold text-foreground">
              {edicao.atual ? 'Editar categoria' : `Nova categoria de ${tipo === 'saida' ? 'saída' : 'entrada'}`}
            </h2>

            {/* Prévia: como vai aparecer no formulário */}
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
                <IconeCategoria nome={edicao.icone} size={22} style={{ color: cor }} />
              </span>
              <div className="flex-1 min-w-0">
                <label htmlFor="cat-neg-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Nome</label>
                <input id="cat-neg-nome" value={edicao.nome} maxLength={NOME_MAX_CATEGORIA} autoFocus={!edicao.atual}
                       readOnly={!!edicao.atual && !admin}
                       onChange={e => { setJuntarCom(null); setEdicao({ ...edicao, nome: e.target.value }); }}
                       placeholder={tipo === 'saida' ? 'Ex.: Sistema, Embalagens' : 'Ex.: Delivery'}
                       className="input w-full" />
              </div>
            </div>
            {!!edicao.atual && !admin && (
              <p className="text-[11px] text-muted-foreground -mt-3">Só quem administra a empresa muda o nome ou remove uma categoria.</p>
            )}
            {!!edicao.atual && nomeMudou && !juntarCom && edicao.atual.usos > 0 && (
              <p className="text-[11px] text-muted-foreground -mt-3">
                {plural(edicao.atual.usos, 'lançamento', 'lançamentos')} {edicao.atual.usos === 1 ? 'passa' : 'passam'} a usar o nome novo.
              </p>
            )}

            {/* Já existe uma com esse nome: juntar é opção, nunca automático */}
            {juntarCom && (
              <div className="rounded-2xl border p-3.5 space-y-2.5"
                   style={{ borderColor: `color-mix(in srgb, ${cor} 40%, transparent)`, background: `color-mix(in srgb, ${cor} 7%, transparent)` }}>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Merge size={15} style={{ color: cor }} aria-hidden /> Já existe &quot;{juntarCom}&quot;
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Juntar as duas? {edicao.atual?.usos ? `${plural(edicao.atual.usos, 'lançamento', 'lançamentos')} de "${edicao.atual.nome}" ${edicao.atual.usos === 1 ? 'passa' : 'passam'} para "${juntarCom}", e "${edicao.atual.nome}" deixa de existir.` : `"${edicao.atual?.nome}" deixa de existir.`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => salvar(true)} disabled={salvando}
                          className="h-10 px-3.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                          style={{ background: cor }}>
                    {salvando ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />} Juntar
                  </button>
                  <button onClick={() => setJuntarCom(null)} disabled={salvando}
                          className="h-10 px-3.5 rounded-xl bg-muted text-foreground text-xs font-semibold">Escolher outro nome</button>
                </div>
              </div>
            )}

            {semMigration && (
              <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-3 py-2.5 leading-relaxed">
                {edicao.atual
                  ? 'Os ícones ainda estão sendo liberados. Por enquanto dá pra renomear e juntar categorias.'
                  : 'As categorias personalizadas ainda estão sendo liberadas. Por enquanto, use "Outra" ao lançar: o nome que você digitar aparece aqui depois.'}
              </p>
            )}

            {/* Ícone */}
            {!semMigration && (
            <fieldset>
              <legend className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Ícone</legend>
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {ICONES_CATEGORIA.map(n => {
                  const on = edicao.icone === n;
                  return (
                    <button key={n} type="button" onClick={() => setEdicao({ ...edicao, icone: on ? null : n })}
                            aria-pressed={on} aria-label={ROTULO_ICONE[n]} title={ROTULO_ICONE[n]}
                            className="aspect-square min-h-[40px] rounded-xl flex items-center justify-center border transition-colors"
                            style={{
                              borderColor: on ? cor : 'transparent',
                              background: on ? `color-mix(in srgb, ${cor} 14%, transparent)` : 'hsl(var(--muted) / 0.5)',
                              color: on ? cor : 'hsl(var(--foreground))',
                            }}>
                      <IconeCategoria nome={n} size={17} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            )}

            {/* Natureza (só saída) — é o que entra no ponto de equilíbrio do DRE */}
            {tipo === 'saida' && !semMigration && (
              <fieldset>
                <legend className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">No DRE, é uma despesa</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'fixa', l: 'Fixa', d: 'Existe todo mês, vendendo ou não (aluguel, sistema)' },
                    { v: 'variavel', l: 'Variável', d: 'Sobe e desce com as vendas (embalagem, frete)' },
                  ] as const).map(o => {
                    const on = (edicao.natureza || 'variavel') === o.v;
                    return (
                      <button key={o.v} type="button" onClick={() => setEdicao({ ...edicao, natureza: o.v })} aria-pressed={on}
                              className="text-left rounded-xl border p-3 transition-colors"
                              style={{ borderColor: on ? cor : 'hsl(var(--border) / 0.6)', background: on ? `color-mix(in srgb, ${cor} 8%, transparent)` : 'transparent' }}>
                        <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: on ? cor : 'hsl(var(--foreground))' }}>
                          {on && <Check size={13} aria-hidden />} {o.l}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{o.d}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {erro && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{erro}</p>}

            {!juntarCom && (
              <button onClick={() => salvar(false)} disabled={salvando || (semMigration && !edicao.atual) || (semMigration && !nomeMudou)}
                      className="w-full h-12 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: cor }}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {edicao.atual ? 'Salvar' : 'Criar categoria'}
              </button>
            )}

            {/* Remover — só quem administra; com lançamentos, a pessoa escolhe o destino deles */}
            {edicao.atual && admin && !juntarCom && (
              <div className="pt-1 border-t border-border/60">
                {!remocao ? (
                  <button onClick={() => edicao.atual!.usos ? setRemocao({ acao: 'mover', para: '' }) : setRemocao({ acao: 'ocultar', para: '' })}
                          disabled={salvando}
                          className="mt-3 h-11 px-1 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                    <Trash2 size={15} /> Remover categoria
                  </button>
                ) : !edicao.atual.usos ? (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-sm text-foreground">Apagar &quot;{edicao.atual.nome}&quot;? Nenhum lançamento usa esta categoria.</p>
                    <div className="flex gap-2">
                      <button onClick={remover} disabled={salvando}
                              className="h-10 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
                        {salvando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Apagar
                      </button>
                      <button onClick={() => setRemocao(null)} className="h-10 px-3.5 rounded-xl bg-muted text-foreground text-xs font-semibold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-foreground">
                      {plural(edicao.atual.usos, 'lançamento usa', 'lançamentos usam')} &quot;{edicao.atual.nome}&quot;. O que fazer com {edicao.atual.usos === 1 ? 'ele' : 'eles'}?
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border/60 p-3">
                      <input type="radio" name="remocao" checked={remocao.acao === 'mover'}
                             onChange={() => setRemocao({ acao: 'mover', para: remocao.para })}
                             className="mt-1 w-4 h-4 accent-primary" />
                      <span className="flex-1 text-xs text-muted-foreground">
                        <span className="block text-sm font-medium text-foreground">Mover para outra categoria</span>
                        <select value={remocao.para} disabled={remocao.acao !== 'mover'}
                                onChange={e => setRemocao({ acao: 'mover', para: e.target.value })}
                                aria-label="Categoria de destino"
                                className="mt-1.5 w-full h-10 px-2.5 rounded-lg bg-background border border-border/60 text-[13px] text-foreground disabled:opacity-50">
                          <option value="">Escolha…</option>
                          {destinos.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                        </select>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border/60 p-3">
                      <input type="radio" name="remocao" checked={remocao.acao === 'ocultar'} disabled={semMigration}
                             onChange={() => setRemocao({ acao: 'ocultar', para: '' })}
                             className="mt-1 w-4 h-4 accent-primary" />
                      <span className="text-xs text-muted-foreground">
                        <span className="block text-sm font-medium text-foreground">Só tirar da lista</span>
                        Os lançamentos continuam com &quot;{edicao.atual.nome}&quot;; ela só deixa de aparecer pra escolher.
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={remover} disabled={salvando || (remocao.acao === 'mover' && !remocao.para)}
                              className="h-10 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
                        {salvando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        {remocao.acao === 'mover' ? 'Mover e apagar' : 'Tirar da lista'}
                      </button>
                      <button onClick={() => setRemocao(null)} className="h-10 px-3.5 rounded-xl bg-muted text-foreground text-xs font-semibold">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ), document.body);
}

