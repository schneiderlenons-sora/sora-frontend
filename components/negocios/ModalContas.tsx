'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Plus, Loader2, Trash2, Pencil, Check, Wallet, Landmark, CreditCard, Coins, Link2, Unlink, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fmtCent, type ContaNegocio, type ContaBancoDisponivel, type TipoContaNegocio } from '@/lib/lancamentos';

const TIPOS: { v: TipoContaNegocio; label: string; Icon: typeof Wallet }[] = [
  { v: 'dinheiro', label: 'Dinheiro',  Icon: Coins },
  { v: 'banco',    label: 'Banco',     Icon: Landmark },
  { v: 'cartao',   label: 'Maquininha/Cartão', Icon: CreditCard },
  { v: 'outro',    label: 'Outra',     Icon: Wallet },
];
export const iconeConta = (t?: string) => (TIPOS.find(x => x.v === t)?.Icon || Wallet);

// Gerencia as CONTAS (caixas) de uma empresa: dinheiro, banco digital,
// maquininha… Cada lançamento do caixa aponta pra uma dessas. Portal pro body
// (os cards do painel usam backdrop-blur → prende o fixed). Migration 095.
export default function ModalContas({
  empresaId, cor, onClose, onChanged,
}: {
  empresaId: string;
  cor: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { phone } = useAuth();
  const [contas, setContas] = useState<ContaNegocio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Form (criar/editar)
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoContaNegocio>('dinheiro');
  const [saldoRaw, setSaldoRaw] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Contas do banco (Open Finance) que podem alimentar a empresa — migration
  // 189. `dono` = só o dono da empresa vê e liga (o backend repete a regra).
  const [bancos, setBancos] = useState<ContaBancoDisponivel[]>([]);
  const [dono, setDono] = useState(false);
  const [ligando, setLigando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => { setMounted(true); }, []);

  async function carregar() {
    if (!phone) return;
    try {
      const [cs, bs] = await Promise.all([
        api.negocios.contas.listar(phone, empresaId),
        api.negocios.contas.bancosDisponiveis(phone, empresaId).catch(() => ({ dono: false, contas: [] })),
      ]);
      setContas(cs || []);
      setBancos(bs?.contas || []);
      setDono(!!bs?.dono);
    } catch { setContas([]); }
    finally { setCarregando(false); }
  }

  // Passo B (migration 192): "esta conta é só da empresa" — padrão SIM.
  const [soEmpresa, setSoEmpresa] = useState(true);
  const [mudandoPessoal, setMudandoPessoal] = useState<string | null>(null);

  const resumoTrazido = (r: { inseridos: number; juntados: number; foraDoPessoal?: number }) => {
    const partes: string[] = [];
    if (r.inseridos) partes.push(r.inseridos === 1 ? '1 movimentação entrou no caixa' : `${r.inseridos} movimentações entraram no caixa`);
    if (r.juntados) partes.push(r.juntados === 1 ? '1 já lançada à mão foi juntada, sem duplicar' : `${r.juntados} já lançadas à mão foram juntadas, sem duplicar`);
    if (r.foraDoPessoal) partes.push(r.foraDoPessoal === 1 ? '1 saiu das suas finanças pessoais' : `${r.foraDoPessoal} saíram das suas finanças pessoais`);
    return partes.length ? partes.join(' · ') : 'Nada novo neste mês ainda — o que chegar do banco entra sozinho.';
  };

  // Um toque: cria a conta da empresa com o nome da conta do banco e liga.
  async function trazer(b: ContaBancoDisponivel) {
    setLigando(b.id); setErro(''); setAviso('');
    try {
      const { conta } = await api.negocios.contas.criar({ empresa_id: empresaId, nome: b.nome.slice(0, 40), tipo: 'banco' });
      const r = await api.negocios.contas.vincularBanco(conta.id, b.id, soEmpresa);
      setAviso(resumoTrazido(r));
      await carregar();
      onChanged?.();
    } catch (e: any) { setErro(e?.message || 'Não consegui ligar a conta do banco.'); }
    finally { setLigando(null); }
  }

  async function desvincular(c: ContaNegocio) {
    const volta = c.fora_do_pessoal !== false ? ' As movimentações dela voltam a contar nas suas finanças pessoais.' : '';
    if (!confirm(`Parar de trazer as movimentações do banco para "${c.nome}"? O que já entrou no caixa continua lá.${volta}`)) return;
    try { await api.negocios.contas.desvincularBanco(c.id); await carregar(); onChanged?.(); }
    catch (e: any) { setErro(e?.message || 'Não consegui desvincular.'); }
  }

  async function alternarPessoal(c: ContaNegocio) {
    const ativo = c.fora_do_pessoal === false;   // estava contando no pessoal → tira
    setMudandoPessoal(c.id); setErro(''); setAviso('');
    try {
      await api.negocios.contas.foraDoPessoal(c.id, ativo);
      setAviso(ativo
        ? 'As movimentações desta conta saíram das suas finanças pessoais.'
        : 'As movimentações desta conta voltaram a contar nas suas finanças pessoais.');
      await carregar();
    } catch (e: any) { setErro(e?.message || 'Não consegui mudar.'); }
    finally { setMudandoPessoal(null); }
  }

  async function atualizarDoBanco(c: ContaNegocio) {
    setLigando(c.id); setErro(''); setAviso('');
    try { const r = await api.negocios.contas.trazerDoBanco(c.id); setAviso(resumoTrazido(r)); onChanged?.(); }
    catch (e: any) { setErro(e?.message || 'Não consegui atualizar.'); }
    finally { setLigando(null); }
  }

  const fmtDia = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '');
  const idsDaEmpresa = new Set(contas.map(c => c.id));
  // Contas do banco que aparecem pra ligar: livres, ou presas a OUTRA empresa
  // (aparecem explicadas, não somem — senão a pessoa acha que o banco sumiu).
  const paraLigar = bancos.filter(b => !b.vinculada_a || !idsDaEmpresa.has(b.vinculada_a));
  useEffect(() => { carregar(); /* eslint-disable-line */ }, [phone, empresaId]);

  function limpar() { setEditId(null); setNome(''); setTipo('dinheiro'); setSaldoRaw(''); setErro(''); }
  function editar(c: ContaNegocio) {
    setEditId(c.id); setNome(c.nome); setTipo(c.tipo || 'dinheiro');
    setSaldoRaw(c.saldo_inicial ? String(c.saldo_inicial) : ''); setErro('');
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome pra conta.'); return; }
    setSalvando(true); setErro('');
    try {
      const saldo_inicial = parseInt(saldoRaw || '0', 10) || 0;
      if (editId) await api.negocios.contas.editar(editId, { nome: nome.trim(), tipo, saldo_inicial });
      else        await api.negocios.contas.criar({ empresa_id: empresaId, nome: nome.trim(), tipo, saldo_inicial });
      limpar();
      await carregar();
      onChanged?.();
    } catch (e: any) { setErro(e?.message || 'Não consegui salvar.'); }
    finally { setSalvando(false); }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta conta? Os lançamentos ligados a ela ficam sem conta.')) return;
    try { await api.negocios.contas.arquivar(id); await carregar(); onChanged?.(); } catch { /* noop */ }
  }

  if (!mounted) return null;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92dvh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-bold text-foreground">Contas do negócio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Onde o dinheiro entra e sai (dinheiro, banco, maquininha)</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Lista */}
          {carregando ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma conta ainda. Crie a primeira abaixo (ex.: Dinheiro, Nubank PJ, Maquininha).</p>
          ) : (
            <div className="space-y-2">
              {contas.map(c => {
                const Icon = iconeConta(c.tipo);
                return (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-muted/20">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{c.nome}</span>
                        {c.wallet_id && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}>
                            <Link2 size={10} aria-hidden /> Do banco
                          </span>
                        )}
                      </p>
                      {c.wallet_id ? (
                        <p className="text-[11px] text-muted-foreground">
                          {c.saldo_banco != null && <>Saldo no banco: <span className="tabular">{fmtCent(c.saldo_banco)}</span> · </>}
                          traz desde {fmtDia(c.importar_desde)}
                        </p>
                      ) : null}
                      {c.wallet_id ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {c.fora_do_pessoal === false ? 'Também conta nas suas finanças pessoais' : 'Fora das suas finanças pessoais'}
                          {dono && (
                            <>
                              {' · '}
                              <button type="button" onClick={() => alternarPessoal(c)} disabled={mudandoPessoal === c.id}
                                      className="font-semibold underline underline-offset-2 disabled:opacity-60" style={{ color: cor }}>
                                {c.fora_do_pessoal === false ? 'tirar do pessoal' : 'contar no pessoal também'}
                              </button>
                            </>
                          )}
                        </p>
                      ) : !!c.saldo_inicial && <p className="text-[11px] text-muted-foreground">Abertura: {fmtCent(c.saldo_inicial)}</p>}
                    </div>
                    {c.wallet_id && dono && (
                      <>
                        <button onClick={() => atualizarDoBanco(c)} disabled={ligando === c.id} aria-label="Trazer agora do banco" title="Trazer agora do banco"
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50">
                          <RefreshCw size={14} className={ligando === c.id ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => desvincular(c)} aria-label="Parar de trazer do banco" title="Parar de trazer do banco"
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Unlink size={14} /></button>
                      </>
                    )}
                    <button onClick={() => editar(c)} aria-label="Editar" className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Pencil size={14} /></button>
                    <button onClick={() => excluir(c.id)} aria-label="Excluir" className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {aviso && (
            <p role="status" className="text-xs rounded-xl px-3 py-2 text-foreground"
               style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
              {aviso}
            </p>
          )}

          {/* Trazer do banco (Open Finance) — só o dono da empresa. */}
          {dono && !carregando && (
            <div className="rounded-2xl border border-border/60 p-3.5 space-y-2.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trazer do banco</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  A conta da empresa conectada pelo Open Finance alimenta o caixa sozinha. As movimentações
                  chegam como <b className="text-foreground">A classificar</b>; transferências e aplicações entram como
                  movimentação (fora do resultado). O que você já lançou à mão é juntado, sem duplicar.
                </p>
              </div>
              {paraLigar.some(b => !(b.vinculada_a ? 'x' : b.motivo)) && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={soEmpresa} onChange={e => setSoEmpresa(e.target.checked)}
                         className="w-5 h-5 mt-0.5 accent-primary flex-shrink-0" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    <span className="block text-sm font-medium text-foreground">Esta conta é só da empresa</span>
                    As movimentações dela saem das suas finanças pessoais (início, relatórios, limites e resumos
                    do WhatsApp) e contam só aqui. Desmarque se usa a mesma conta pra gastos pessoais.
                  </span>
                </label>
              )}
              {paraLigar.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {bancos.length
                    ? 'Todas as suas contas do banco já alimentam esta empresa.'
                    : <>Nenhuma conta do banco conectada ainda. <Link href="/open-finance" className="font-semibold underline" style={{ color: cor }}>Conectar pelo Open Finance</Link></>}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {paraLigar.map(b => {
                    const motivo = b.vinculada_a ? 'Já alimenta outra empresa.' : b.motivo;
                    return (
                      <div key={b.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/20">
                        <Landmark size={15} className="text-muted-foreground flex-shrink-0" aria-hidden />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{b.nome}</p>
                          {motivo && <p className="text-[11px] text-muted-foreground">{motivo}</p>}
                        </div>
                        {!motivo && (
                          <button onClick={() => trazer(b)} disabled={!!ligando}
                                  className="inline-flex items-center gap-1.5 px-3 rounded-xl text-white text-xs font-bold disabled:opacity-60 flex-shrink-0"
                                  style={{ background: cor, minHeight: 40 }}>
                            {ligando === b.id ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                            Trazer para a empresa
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Form criar/editar */}
          <div className="rounded-2xl border border-border/60 p-3.5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{editId ? 'Editar conta' : 'Nova conta'}</p>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={40}
                   placeholder="Nome (ex.: Dinheiro, Nubank PJ, Maquininha)" className="input w-full" />
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map(t => {
                const on = tipo === t.v;
                return (
                  <button key={t.v} onClick={() => setTipo(t.v)} aria-pressed={on}
                          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold border transition-colors"
                          style={{ borderColor: on ? cor : 'hsl(var(--border) / 0.6)', background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent', color: on ? cor : 'hsl(var(--foreground))' }}>
                    <t.Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Saldo de abertura (opcional)</label>
              <div className="flex items-baseline gap-1 input">
                <span className="text-sm font-bold text-muted-foreground">R$</span>
                <input inputMode="numeric" value={saldoRaw ? (parseInt(saldoRaw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                       onChange={e => setSaldoRaw(e.target.value.replace(/\D/g, ''))}
                       placeholder="0,00" className="bg-transparent border-none outline-none w-full tabular font-semibold" />
              </div>
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <div className="flex items-center gap-2">
              {editId && <button onClick={limpar} className="btn-ghost px-3 h-10 text-sm">Cancelar</button>}
              <div className="flex-1" />
              <button onClick={salvar} disabled={salvando}
                      className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                      style={{ background: cor }}>
                {salvando ? <Loader2 size={14} className="animate-spin" /> : editId ? <Check size={14} /> : <Plus size={14} />}
                {editId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
