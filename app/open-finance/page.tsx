'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Open Finance via POLP (proxy da Pluggy). Fluxo de REDIRECT:
//   1. lista instituições  2. usuário escolhe o banco (+ CPF opcional)
//   3. POST /conectar cria a integração → devolve url_to_authenticate
//   4. abre esse link (nova aba) → usuário autoriza o banco
//   5. webhook/"Sincronizar" importa contas, cartões, transações e investimentos.
// Teste fechado: só a allowlist enxerga (gate no back e no front).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { podeVerOpenFinance } from '@/lib/open-finance-access';
import { isAdminEmail } from '@/lib/admin';
import { api } from '@/lib/api';
import {
  Landmark, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Clock, ShieldCheck, Lock, Search, ExternalLink, X,
} from 'lucide-react';

const BRAND = '#61D17B';

type Conexao = {
  external_id: string;
  instituicao: string | null;
  status: string | null;
  ultimo_erro: string | null;
  ultima_sync: string | null;
  created_at: string;
};
type Inst = { id: number | string; name?: string; institution_name?: string; logo_url?: string; image_url?: string; primary_color?: string };

const nomeInst = (i: Inst) => i.name || i.institution_name || `Banco ${i.id}`;
const logoInst = (i: Inst) => i.logo_url || i.image_url || null;

// Status da conexão → rótulo + cor (ícone + texto, nunca só cor).
function statusMeta(s?: string | null) {
  const k = (s || '').toLowerCase();
  if (k === 'updated')          return { label: 'Conectado',   cor: '#10b981', Icon: CheckCircle2 };
  if (k === 'error' || k === 'login_error') return { label: 'Erro no login', cor: '#ef4444', Icon: AlertCircle };
  if (k === 'waiting_user_input') return { label: 'Aguardando você autorizar', cor: '#f59e0b', Icon: Clock };
  return { label: 'Sincronizando…', cor: '#f59e0b', Icon: Clock };
}

export default function OpenFinancePage() {
  const { perfil, phone } = useAuth();
  const liberado = isAdminEmail(perfil?.email) || podeVerOpenFinance(perfil?.email, phone);

  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [flash, setFlash] = useState('');
  const [sincronizando, setSincronizando] = useState('');

  // Seletor de banco
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [instSel, setInstSel] = useState<Inst | null>(null);
  const [cpf, setCpf] = useState('');
  const [conectando, setConectando] = useState(false);
  const [debugOut, setDebugOut] = useState('');

  async function diagnostico(id: string) {
    setDebugOut('Carregando…');
    try { setDebugOut(JSON.stringify(await api.openFinance.debug(id), null, 2)); }
    catch (e: any) { setDebugOut('Erro: ' + (e?.message || 'falhou')); }
  }

  const carregar = useCallback(async () => {
    try { const d = await api.openFinance.conexoes(); setConexoes(d.conexoes || []); }
    catch (e: any) { setErro(e.message || 'Não consegui carregar as conexões.'); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (liberado) carregar(); else setCarregando(false); }, [liberado, carregar]);

  async function abrirPicker() {
    setPickerOpen(true); setErro(''); setInstSel(null); setBusca('');
    if (insts.length) return;
    setInstLoading(true);
    try { const d = await api.openFinance.instituicoes(); setInsts(d.instituicoes || []); }
    catch (e: any) { setErro(e.message || 'Não consegui listar os bancos.'); }
    finally { setInstLoading(false); }
  }

  const instsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q ? insts.filter(i => nomeInst(i).toLowerCase().includes(q)) : insts;
    return base.slice(0, 80);
  }, [insts, busca]);

  async function conectar() {
    if (!instSel) return;
    setConectando(true); setErro('');
    try {
      const r = await api.openFinance.conectar({
        institution_id: instSel.id,
        cpf: cpf.replace(/\D/g, '') || undefined,
        instituicao_nome: nomeInst(instSel),
      });
      setPickerOpen(false);
      await carregar();
      if (r.urlToAuthenticate) {
        window.open(r.urlToAuthenticate, '_blank', 'noopener');
        setFlash('Abri o banco numa nova aba pra você autorizar. Depois, volte aqui e toque em Sincronizar.');
      } else {
        setFlash('Conexão iniciada! Em instantes os dados chegam — use Sincronizar se demorar.');
      }
      setTimeout(() => setFlash(''), 8000);
    } catch (e: any) {
      setErro(e.message || 'Não consegui conectar.');
    } finally { setConectando(false); }
  }

  async function sincronizar(id: string) {
    setSincronizando(id); setErro('');
    try {
      const r = await api.openFinance.sincronizar(id);
      await carregar();
      // Ainda falta você autorizar no banco? Abre a autorização em vez de "0 novas".
      if (r.pendente) {
        if (r.urlToAuthenticate) { window.open(r.urlToAuthenticate, '_blank', 'noopener'); setFlash('Falta autorizar no banco — abri a aba pra você. Depois volte e sincronize.'); }
        else setFlash('Essa conexão ainda está aguardando sua autorização no banco.');
      } else {
        const n = r.novas ?? 0;
        setFlash(r.erro ? 'Não consegui sincronizar agora. Tente em instantes.'
          : n > 0 ? `Sincronizado! ${n} nova${n === 1 ? '' : 's'} transaç${n === 1 ? 'ão' : 'ões'} importada${n === 1 ? '' : 's'}.`
          : 'Tudo sincronizado — nada novo. ✅');
      }
      setTimeout(() => setFlash(''), 7000);
    } catch (e: any) { setErro(e.message || 'Não consegui sincronizar.'); }
    finally { setSincronizando(''); }
  }

  async function autorizar(id: string) {
    setErro('');
    try {
      const r = await api.openFinance.autorizar(id);
      if (r.urlToAuthenticate) { window.open(r.urlToAuthenticate, '_blank', 'noopener'); setFlash('Abri o banco pra você autorizar. Depois volte e toque em Sincronizar.'); setTimeout(() => setFlash(''), 8000); }
      else setErro('A autorização expirou ou não está disponível. Desconecte e conecte de novo.');
    } catch (e: any) { setErro(e.message || 'Não consegui abrir a autorização.'); }
  }

  async function desconectar(id: string, nome: string | null) {
    if (!confirm(`Desconectar ${nome || 'este banco'}? O histórico já importado continua na Sora.`)) return;
    setConexoes(prev => prev.filter(c => c.external_id !== id));
    try { await api.openFinance.desconectar(id); } catch (e: any) { setErro(e.message); carregar(); }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 pb-24 space-y-6">
        {/* Hero */}
        <div className="space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
               style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
            <Landmark size={22} style={{ color: BRAND }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Open Finance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Conecte suas contas bancárias com segurança via Open Finance e deixe a Sora
            importar e atualizar seus saldos e transações automaticamente.
          </p>
        </div>

        {flash && (
          <div className="rounded-2xl border px-4 py-3 text-sm flex items-start gap-2"
               style={{ borderColor: `color-mix(in srgb, ${BRAND} 30%, transparent)`, background: `color-mix(in srgb, ${BRAND} 8%, transparent)` }}>
            <CheckCircle2 size={16} style={{ color: BRAND }} className="flex-shrink-0 mt-0.5" />
            <span className="text-foreground/90">{flash}</span>
          </div>
        )}
        {erro && (
          <div className="rounded-2xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2" role="alert">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span className="break-words">{erro}</span>
          </div>
        )}

        {!liberado ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
              <Lock size={24} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Recurso indisponível</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              O Open Finance ainda não está disponível na sua conta. Enquanto isso, você pode
              importar seu extrato em OFX nas Contas.
            </p>
            <a href="/contas-bancarias" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold text-white"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
              Ir pra Contas
            </a>
          </div>
        ) : (
          <>
            {/* Ação principal */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={abrirPicker}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg transition-all active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                <Plus size={17} /> Conectar banco
              </button>
              <button onClick={carregar} title="Atualizar lista"
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw size={15} /> Atualizar
              </button>
            </div>

            {/* Lista de conexões */}
            {carregando ? (
              <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : conexoes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-muted">
                  <Landmark size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhum banco conectado ainda</p>
                <p className="text-xs text-muted-foreground">Toque em <b className="text-foreground">Conectar banco</b> pra começar.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {conexoes.map(c => {
                  const m = statusMeta(c.status);
                  const sinc = sincronizando === c.external_id;
                  return (
                    <li key={c.external_id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--bg-muted))' }}>
                        <Landmark size={18} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.instituicao || 'Banco'}</p>
                        <p className="inline-flex items-center gap-1 text-xs" style={{ color: m.cor }}>
                          <m.Icon size={12} /> {m.label}
                          {c.ultima_sync && <span className="text-muted-foreground"> · {new Date(c.ultima_sync).toLocaleString('pt-BR')}</span>}
                        </p>
                        {c.ultimo_erro && <p className="text-[11px] text-red-500 truncate mt-0.5">{c.ultimo_erro}</p>}
                      </div>
                      {(c.status || '').toLowerCase() !== 'updated' && (
                        <button onClick={() => autorizar(c.external_id)}
                          className="h-9 px-3 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                          <ExternalLink size={13} /> Autorizar
                        </button>
                      )}
                      <button onClick={() => sincronizar(c.external_id)} disabled={sinc}
                        className="h-9 px-3 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-muted/40 inline-flex items-center gap-1.5 flex-shrink-0">
                        {sinc ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sincronizar
                      </button>
                      <button onClick={() => diagnostico(c.external_id)} title="Diagnóstico"
                        className="h-9 px-2 rounded-lg border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground flex-shrink-0">
                        diag
                      </button>
                      <button onClick={() => desconectar(c.external_id, c.instituicao)} title="Desconectar"
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex-shrink-0">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Diagnóstico (temporário) — resposta crua da Polp pra ajustar o mapeamento */}
            {debugOut && (
              <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Diagnóstico (dev)</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => navigator.clipboard?.writeText(debugOut)} className="h-8 px-2.5 rounded-lg border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground">Copiar</button>
                    <button onClick={() => setDebugOut('')} className="h-8 px-2.5 rounded-lg border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground">Fechar</button>
                  </div>
                </div>
                <pre className="text-[10px] leading-relaxed text-foreground/80 overflow-auto max-h-80 whitespace-pre-wrap break-words">{debugOut}</pre>
              </div>
            )}

            {/* Segurança */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="text-emerald-500" />
              Conexão via Open Finance regulada — você autoriza no ambiente do banco, sem senha aqui.
            </div>
          </>
        )}
      </div>

      {/* ── Seletor de banco ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">{instSel ? 'Confirmar conexão' : 'Escolha seu banco'}</h2>
              <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded-xl hover:bg-muted"><X size={18} /></button>
            </div>

            {!instSel ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={busca} onChange={e => setBusca(e.target.value)} autoFocus placeholder="Buscar banco…"
                      className="w-full h-11 pl-9 pr-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {instLoading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
                  ) : instsFiltradas.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nenhum banco encontrado.</p>
                  ) : instsFiltradas.map(i => (
                    <button key={i.id} onClick={() => setInstSel(i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 text-left transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoInst(i)
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={logoInst(i)!} alt="" className="w-full h-full object-contain" />
                          : <Landmark size={16} className="text-muted-foreground" />}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{nomeInst(i)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoInst(instSel)
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={logoInst(instSel)!} alt="" className="w-full h-full object-contain" />
                      : <Landmark size={18} className="text-muted-foreground" />}
                  </div>
                  <p className="font-semibold text-foreground">{nomeInst(instSel)}</p>
                </div>
                <div>
                  <label htmlFor="of-cpf" className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    CPF <span className="font-medium normal-case tracking-normal opacity-70">(se o banco pedir)</span>
                  </label>
                  <input id="of-cpf" value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00"
                    className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm tabular-nums focus:outline-none focus:border-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao continuar, abrimos o ambiente seguro do banco pra você autorizar o acesso. A Sora
                  nunca vê sua senha.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setInstSel(null)} className="h-11 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">Voltar</button>
                  <button onClick={conectar} disabled={conectando}
                    className="flex-1 h-11 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                    {conectando ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {conectando ? 'Iniciando…' : 'Autorizar no banco'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
