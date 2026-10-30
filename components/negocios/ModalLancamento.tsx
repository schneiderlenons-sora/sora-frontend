'use client';

import { useEffect, useState } from 'react';
import { X, Check, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight, Trash2, Plus, Layers, Landmark, Repeat } from 'lucide-react';
import { useConfirmar } from '@/contexts/ConfirmContext';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ModalContas, { iconeConta } from '@/components/negocios/ModalContas';
import {
  categoriasDe, FORMAS_PAGAMENTO, fmtCent, doBanco, CAT_A_CLASSIFICAR, REPETICOES, rotuloRepeticao,
  type Lancamento, type TipoLancamento, type ContaNegocio, type CentroCusto, type Repeticao,
} from '@/lib/lancamentos';

// Lançamento do caixa. Os campos de CONTA A PAGAR (vencimento) só aparecem
// quando o usuário desmarca "já foi pago" — divulgação progressiva (§8), pra
// não sobrecarregar o caso comum, que é a venda do balcão já liquidada.

const hoje = () => new Date().toISOString().slice(0, 10);

export default function ModalLancamento({
  empresaId, cor, tipoInicial = 'entrada', lancamento, onClose, onSalvo, onExcluido,
}: {
  empresaId: string;
  cor: string;
  tipoInicial?: TipoLancamento;
  lancamento?: Lancamento | null;   // ausente = criar
  onClose: () => void;
  onSalvo: () => void;
  onExcluido?: () => void;
}) {
  const editando = !!lancamento?.id;
  // ⚠️ VEIO DO BANCO (conta vinculada, migration 189): valor, data, sentido,
  // situação e conta são do BANCO — o backend ignora mudanças neles e o próximo
  // sync os reescreveria. Aqui eles aparecem só pra leitura, com o porquê
  // (`read-only-distinction`: campo travado sem explicação lê como defeito).
  const travado = !!lancamento && doBanco(lancamento);
  const { phone } = useAuth();

  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo || tipoInicial);
  // Valor em CENTAVOS, digitado como número inteiro (igual ao modal de transação).
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : '');
  const [descricao, setDescricao] = useState(lancamento?.descricao || '');
  // 'a_classificar' é a marca do banco, não uma escolha: abre sem seleção.
  const [categoria, setCategoria] = useState(lancamento?.categoria === CAT_A_CLASSIFICAR ? '' : (lancamento?.categoria || ''));
  const [data, setData] = useState(lancamento?.data || hoje());
  const [forma, setForma] = useState(lancamento?.forma_pagamento || 'dinheiro');
  const [contraparte, setContraparte] = useState(lancamento?.contraparte || '');
  const [pago, setPago] = useState((lancamento?.status || 'pago') === 'pago');
  const [vencimento, setVencimento] = useState(lancamento?.vencimento || hoje());

  // Conta que se repete (migration 192). Na criação: escolher a repetição. Na
  // edição de uma ocorrência: aplicar às próximas ou parar de repetir.
  const [repetir, setRepetir] = useState<Repeticao | ''>('');
  const [repetirAte, setRepetirAte] = useState('');
  const daSerie = editando && !!lancamento?.serie_id;
  const [aplicarSerie, setAplicarSerie] = useState(false);
  // "Aprende" (migration 192): no que veio do banco, a categoria escolhida vale
  // pros próximos parecidos. Ligado por padrão — decisão do dono ("neutra +
  // aprende"); a pessoa desmarca quando é um caso isolado.
  const [aprender, setAprender] = useState(true);
  const confirmar = useConfirmar();

  // Conta do negócio (caixa) — migration 095.
  const [contas, setContas] = useState<ContaNegocio[]>([]);
  const [contaId, setContaId] = useState<string | null>(lancamento?.conta_id || null);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [centroId, setCentroId] = useState<string | null>((lancamento as any)?.centro_custo_id || null);
  const [gerenciarContas, setGerenciarContas] = useState(false);

  // Categoria própria (texto livre além da lista fixa).
  const catInicial = lancamento?.categoria === CAT_A_CLASSIFICAR ? '' : (lancamento?.categoria || '');
  const catNaLista = (t: TipoLancamento, v: string) => categoriasDe(t).some(c => c.v === v);
  const [catCustom, setCatCustom] = useState(catInicial && !catNaLista(tipo, catInicial) ? catInicial : '');
  const [mostraCustom, setMostraCustom] = useState(!!(catInicial && !catNaLista(tipo, catInicial)));

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const ehEntrada = tipo === 'entrada';
  const corTipo = ehEntrada ? '#16a34a' : '#ef4444';
  const cats = categoriasDe(tipo);

  // Carrega as contas da empresa (pra o seletor de conta).
  async function carregarContas() {
    if (!phone) return;
    try { setContas((await api.negocios.contas.listar(phone, empresaId)) || []); } catch { /* noop */ }
  }
  useEffect(() => { carregarContas(); /* eslint-disable-line */ }, [phone, empresaId]);

  // Centros de custo (migration 105). Best-effort: quem não usa o recurso não
  // vê o campo, em vez de um seletor vazio ocupando espaço no formulário.
  useEffect(() => {
    if (!phone) return;
    let vivo = true;
    api.negocios.centrosCusto.listar(phone, empresaId)
      .then(cs => { if (vivo) setCentros(cs || []); })
      .catch(() => { /* migration pendente → campo some */ });
    return () => { vivo = false; };
  }, [phone, empresaId]);

  const valorCent = parseInt(valor || '0', 10) || 0;

  async function salvar() {
    if (salvando) return;
    setErro('');
    if (valorCent <= 0) { setErro('Informe um valor maior que zero.'); return; }
    if (!descricao.trim()) { setErro('Descreva o lançamento (ex.: "Venda balcão").'); return; }

    setSalvando(true);
    try {
      const catFinal = mostraCustom ? catCustom.trim() : categoria;
      const body: any = {
        empresa_id: empresaId,
        tipo,
        // Do banco e ainda sem escolha: continua "a classificar" (não vira "sem categoria").
        categoria: catFinal || (travado ? CAT_A_CLASSIFICAR : null),
        descricao: descricao.trim(),
        valor: valorCent,
        data,
        status: pago ? 'pago' : 'pendente',
        vencimento: pago ? null : vencimento,
        forma_pagamento: forma || null,
        contraparte: contraparte.trim() || null,
        conta_id: contaId,
        centro_custo_id: centroId,
      };
      if (!editando && repetir) {
        body.recorrencia = repetir;
        body.serie_ate = repetirAte || null;
      }
      if (daSerie && aplicarSerie) body.aplicar_serie = true;
      if (travado && aprender && catFinal) body.aprender = true;
      if (editando) await api.negocios.lancamentos.editar(lancamento!.id, body);
      else await api.negocios.lancamentos.criar(body);
      onSalvo();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function pararRepeticao() {
    if (!daSerie || salvando) return;
    const ok = await confirmar({
      titulo: 'Parar de repetir?',
      mensagem: 'As próximas em aberto desta conta são apagadas. Esta e as que já foram pagas continuam.',
      confirmar: 'Parar de repetir',
    });
    if (!ok) return;
    setSalvando(true); setErro('');
    try {
      await api.negocios.lancamentos.pararSerie(lancamento!.id);
      onSalvo();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui parar a repetição.');
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!editando || salvando) return;
    if (travado) return;   // backend recusa: voltaria no próximo sync
    if (!confirm('Excluir este lançamento?')) return;
    setSalvando(true);
    try {
      await api.negocios.lancamentos.deletar(lancamento!.id);
      onExcluido?.();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui excluir.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">
            {editando ? 'Editar lançamento' : ehEntrada ? 'Nova entrada' : 'Nova saída'}
          </h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {travado && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <Landmark size={12} aria-hidden /> Veio do banco
              </p>
              <p className="text-3xl font-bold tabular mt-2" style={{ color: corTipo }}>
                {ehEntrada ? '+' : '−'}{fmtCent(valorCent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.split('-').reverse().join('/')} · {pago ? (ehEntrada ? 'recebido' : 'pago') : 'em aberto'}
              </p>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                Valor, data e situação seguem o banco. Aqui você classifica: categoria, descrição e {ehEntrada ? 'cliente' : 'fornecedor'}.
              </p>
            </div>
          )}

          {!travado && (<>
          {/* Tipo — ícone + rótulo (nunca só cor) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {([
              { v: 'entrada', l: 'Entrada', Icon: ArrowUpRight,   c: '#16a34a' },
              { v: 'saida',   l: 'Saída',   Icon: ArrowDownRight, c: '#ef4444' },
            ] as const).map(o => {
              const on = tipo === o.v;
              return (
                <button key={o.v} onClick={() => { setTipo(o.v); setCategoria(''); setMostraCustom(false); setCatCustom(''); }}
                        aria-pressed={on}
                        className={`h-11 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                          on ? 'bg-card shadow-sm' : 'text-muted-foreground'
                        }`}
                        style={on ? { color: o.c } : undefined}>
                  <o.Icon size={15} /> {o.l}
                </button>
              );
            })}
          </div>

          {/* Valor — protagonista */}
          <div>
            <label htmlFor="lanc-valor" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Valor
            </label>
            <div className="relative">
              <input
                id="lanc-valor" inputMode="numeric" value={valor}
                onChange={e => setValor(e.target.value.replace(/\D/g, ''))}
                placeholder="0,00"
                className="w-full h-16 rounded-2xl bg-muted/40 border border-border/60 px-4 text-3xl font-bold tabular text-center outline-none focus:border-primary transition-colors"
                style={{ color: corTipo }}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: corTipo }}>
                {ehEntrada ? '+' : '−'}
              </span>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-1.5 tabular">{fmtCent(valorCent)}</p>
          </div>
          </>)}

          {/* Descrição */}
          <div>
            <label htmlFor="lanc-desc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Descrição
            </label>
            <input id="lanc-desc" value={descricao} onChange={e => setDescricao(e.target.value)}
                   className="input w-full" placeholder={ehEntrada ? 'Ex.: Venda no balcão' : 'Ex.: Compra de farinha'} />
          </div>

          {/* Categoria (lista fixa + "Outra" pra categoria própria) */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Categoria</span>
            <div className="flex flex-wrap gap-2">
              {cats.map(c => {
                const on = !mostraCustom && categoria === c.v;
                return (
                  <button key={c.v} onClick={() => { setMostraCustom(false); setCategoria(on ? '' : c.v); }}
                          aria-pressed={on}
                          className="h-11 px-3.5 rounded-xl text-xs font-semibold border transition-colors"
                          style={{
                            borderColor: on ? cor : 'hsl(var(--border) / 0.6)',
                            background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                            color: on ? cor : 'hsl(var(--foreground))',
                          }}>
                    {c.label}
                  </button>
                );
              })}
              {/* Outra → categoria própria */}
              <button onClick={() => { setMostraCustom(true); setCategoria(''); }} aria-pressed={mostraCustom}
                      className="h-11 px-3.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1"
                      style={{
                        borderColor: mostraCustom ? cor : 'hsl(var(--border) / 0.6)',
                        background: mostraCustom ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                        color: mostraCustom ? cor : 'hsl(var(--foreground))',
                      }}>
                <Plus size={13} /> Outra
              </button>
            </div>
            {mostraCustom && (
              <input value={catCustom} onChange={e => setCatCustom(e.target.value)} maxLength={30}
                     placeholder="Sua categoria (ex.: Delivery, Fiado)" className="input w-full mt-2" autoFocus />
            )}
          </div>

          {/* Aprende: só no que veio do banco, onde a mesma descrição volta todo mês. */}
          {travado && (
            <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-border/60 p-3.5">
              <input type="checkbox" checked={aprender} onChange={e => setAprender(e.target.checked)}
                     className="w-5 h-5 mt-0.5 accent-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                <span className="block text-sm font-medium text-foreground">Classificar assim os próximos parecidos</span>
                Os que chegarem do banco com esta descrição já entram nesta categoria.
                Descrição sem nome (só &quot;Pix recebido&quot;) não é aprendida.
              </span>
            </label>
          )}

          {/* Conta (caixa) — pra onde entra / de onde sai */}
          {!travado && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {ehEntrada ? 'Entra na conta' : 'Sai da conta'}
              </span>
              <button onClick={() => setGerenciarContas(true)} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: cor }}>
                <Plus size={12} /> Gerenciar
              </button>
            </div>
            {contas.length === 0 ? (
              <button onClick={() => setGerenciarContas(true)}
                      className="w-full h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2">
                <Plus size={15} /> Criar uma conta (Dinheiro, Banco, Maquininha…)
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contas.map(c => {
                  const on = contaId === c.id;
                  const Icon = iconeConta(c.tipo);
                  return (
                    <button key={c.id} onClick={() => setContaId(on ? null : c.id)} aria-pressed={on}
                            className="h-11 px-3.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5"
                            style={{
                              borderColor: on ? cor : 'hsl(var(--border) / 0.6)',
                              background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                              color: on ? cor : 'hsl(var(--foreground))',
                            }}>
                      <Icon size={13} /> {c.nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Centro de custo — só aparece pra quem já criou algum (migration
              105). Seletor vazio num formulário longo é ruído puro. */}
          {centros.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Centro de custo <span className="font-normal normal-case tracking-normal">(opcional)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {centros.map(cc => {
                  const on = centroId === cc.id;
                  const tom = cc.cor || cor;
                  return (
                    <button key={cc.id} onClick={() => setCentroId(on ? null : cc.id)} aria-pressed={on}
                            className="h-11 px-3.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5"
                            style={{
                              borderColor: on ? tom : 'hsl(var(--border) / 0.6)',
                              background: on ? `color-mix(in srgb, ${tom} 12%, transparent)` : 'transparent',
                              color: on ? tom : 'hsl(var(--foreground))',
                              minHeight: 44,
                            }}>
                      <Layers size={13} /> {cc.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data + forma */}
          {!travado && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lanc-data" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
              <input id="lanc-data" type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label htmlFor="lanc-forma" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Pagamento</label>
              <select id="lanc-forma" value={forma} onChange={e => setForma(e.target.value)} className="input w-full">
                {FORMAS_PAGAMENTO.map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
              </select>
            </div>
          </div>
          )}

          {/* Contraparte */}
          <div>
            <label htmlFor="lanc-cp" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              {ehEntrada ? 'Cliente' : 'Fornecedor'} <span className="normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <input id="lanc-cp" value={contraparte} onChange={e => setContraparte(e.target.value)} className="input w-full" />
          </div>

          {/* Já foi pago? — desmarcar vira CONTA A PAGAR */}
          {!travado && (
          <div className="rounded-2xl border border-border/60 p-3.5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {ehEntrada ? 'Já recebi' : 'Já paguei'}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {pago ? 'Entra no caixa do dia' : 'Fica como conta em aberto, com vencimento'}
                </span>
              </span>
              <input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)}
                     className="w-6 h-6 accent-primary flex-shrink-0" />
            </label>

            {!pago && (
              <div className="mt-3 pt-3 border-t border-border/60">
                <label htmlFor="lanc-venc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Vencimento
                </label>
                <input id="lanc-venc" type="date" value={vencimento}
                       onChange={e => setVencimento(e.target.value)} className="input w-full" />
              </div>
            )}
          </div>
          )}

          {/* ── SE REPETE? (só ao criar) ─────────────────────────────────── */}
          {!editando && !travado && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Repeat size={12} aria-hidden /> Repetir
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Repetir">
                {([{ v: '', label: 'Não repete' }, ...REPETICOES] as const).map(o => {
                  const on = repetir === o.v;
                  return (
                    <button key={o.v || 'nao'} type="button" role="radio" aria-checked={on}
                            onClick={() => setRepetir(o.v as Repeticao | '')}
                            className="h-11 px-2 rounded-xl text-xs font-semibold border transition-colors"
                            style={{
                              borderColor: on ? cor : 'hsl(var(--border) / 0.6)',
                              background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                              color: on ? cor : 'hsl(var(--foreground))',
                            }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {repetir && (
                <div className="mt-3 space-y-2">
                  <label htmlFor="lanc-ate" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block">
                    Até quando <span className="normal-case tracking-normal font-medium">(deixe vazio se não tem fim)</span>
                  </label>
                  <input id="lanc-ate" type="date" value={repetirAte} min={pago ? data : vencimento}
                         onChange={e => setRepetirAte(e.target.value)} className="input w-full" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pago ? 'Esta entra como já paga; as próximas ficam em aberto. ' : ''}
                    A Sora cria as próximas {ehEntrada ? 'a receber' : 'a pagar'} e vai completando com o tempo.
                    Quando o banco trouxer o pagamento com o mesmo valor, ela dá baixa sozinha.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Ocorrência de uma conta que se repete (edição) ─────────────── */}
          {daSerie && (
            <div className="rounded-2xl border border-border/60 p-3.5 space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Repeat size={14} style={{ color: cor }} aria-hidden />
                Repete {rotuloRepeticao(lancamento?.recorrencia) || ''}
                {lancamento?.serie_ate ? ` até ${lancamento.serie_ate.split('-').reverse().join('/')}` : ''}
                {lancamento?.recorrente === false ? ' (parada)' : ''}
              </p>
              {lancamento?.recorrente !== false && (
                <>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={aplicarSerie} onChange={e => setAplicarSerie(e.target.checked)}
                           className="w-5 h-5 mt-0.5 accent-primary flex-shrink-0" />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      <span className="block text-sm font-medium text-foreground">Aplicar também às próximas em aberto</span>
                      Pra um reajuste de valor, por exemplo. As já pagas não mudam.
                    </span>
                  </label>
                  <button type="button" onClick={pararRepeticao} disabled={salvando}
                          className="w-full h-11 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          style={{ border: '1px solid hsl(var(--border) / 0.6)' }}>
                    Parar de repetir
                  </button>
                </>
              )}
            </div>
          )}

          {/* Do banco não se apaga (voltaria no próximo sync): o caminho é classificar. */}
          {travado && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Não é da empresa? Classifique como <b className="text-foreground">Movimentação entre contas</b>:
              ele sai do resultado e continua no saldo da conta.
            </p>
          )}

          {erro && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          {editando && !travado && (
            <button onClick={excluir} disabled={salvando} aria-label="Excluir lançamento"
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => !salvando && onClose()} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity"
                  style={{ background: corTipo }}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
          </button>
        </div>
      </div>

      {gerenciarContas && (
        <ModalContas empresaId={empresaId} cor={cor}
          onClose={() => setGerenciarContas(false)}
          onChanged={carregarContas} />
      )}
    </div>
  );
}
