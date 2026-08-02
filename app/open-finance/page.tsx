'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Open Finance via POLP (proxy da Pluggy). Fluxo de REDIRECT:
//   1. lista instituições  2. usuário escolhe o banco (+ CPF opcional)
//   3. POST /conectar cria a integração → devolve url_to_authenticate
//   4. abre esse link (nova aba) → usuário autoriza o banco
//   5. webhook/"Sincronizar" importa contas, cartões, transações e investimentos.
// Teste fechado: só a allowlist enxerga (gate no back e no front).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { podeVerOpenFinance } from '@/lib/open-finance-access';
import { limiteConexoesOf, PLANO_LABEL, PRECO_CONEXAO_EXTRA } from '@/lib/plans';
import { isAdminEmail } from '@/lib/admin';
import { api } from '@/lib/api';
import {
  Landmark, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Clock, ShieldCheck, Search, ExternalLink, X,
  Wrench, FileUp, Sparkles, ArrowRight,
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

// Data curta pro card. O toLocaleString cheio ("16/07/2026, 16:50:41") é longo
// demais pro mobile e empurrava a linha de status pra cima dos botões.
function quando(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)}h`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function OpenFinancePage() {
  const { perfil, phone, plano, loading: carregandoPerfil } = useAuth();
  // ⚠️ O acesso depende do PLANO, que chega junto com o perfil. Enquanto ele não
  // carrega não dá pra decidir — sem isto, quem TEM acesso via a tela de "só na
  // assinatura" piscar antes do conteúdo.
  const liberado = isAdminEmail(perfil?.email) || podeVerOpenFinance(perfil?.email, phone, perfil);
  const indefinido = carregandoPerfil || (!perfil && !liberado);
  // Conexões são limitadas por plano (≠ contas, que no Premium são ilimitadas).
  // Franquia do plano + conexões contratadas à parte (R$6/mês cada). O vitalício
  // não tem franquia, então o limite dele é só o que ele paga.
  const limiteConexoes = limiteConexoesOf(plano, {
    vitalicio: perfil?.vitalicio,
    conexoesPagas: perfil?.of_conexoes_pagas,
  });

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
  // URL de autorização do banco — mostrada como LINK (window.open é bloqueado no
  // PWA / fora do clique direto). `authId` = modal aberto esperando a URL nascer.
  const [authUrl, setAuthUrl] = useState('');
  const [authNome, setAuthNome] = useState('');
  const [authId, setAuthId] = useState('');
  const [authLento, setAuthLento] = useState(false);
  const [authTry, setAuthTry] = useState(0);
  const fecharAuth = () => { setAuthUrl(''); setAuthId(''); setAuthLento(false); };

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

  // Bancos: uma requisição só, compartilhada entre o prefetch e o clique.
  const instsReq = useRef<Promise<unknown> | null>(null);
  const carregarInsts = useCallback((mostrarErro: boolean) => {
    if (instsReq.current) return;
    setInstLoading(true);
    instsReq.current = api.openFinance.instituicoes()
      .then((d: any) => {
        const lista = d.instituicoes || [];
        setInsts(lista);
        // Lista vazia (a Polp engole erro e devolve []) não vira cache — senão
        // o seletor ficaria preso em "Nenhum banco encontrado" pra sempre.
        if (!lista.length) instsReq.current = null;
      })
      .catch((e: any) => {
        instsReq.current = null; // deixa tentar de novo no próximo clique
        if (mostrarErro) setErro(e?.message || 'Não consegui listar os bancos.');
      })
      .finally(() => setInstLoading(false));
  }, []);

  // Carrega conexões E já pré-carrega os bancos ao abrir a página: quando o
  // usuário toca em "Conectar banco" a lista costuma estar pronta (era o
  // "demora pra aparecer os bancos"). O prefetch é silencioso.
  useEffect(() => {
    if (indefinido) return;            // perfil ainda chegando: segura o skeleton
    if (!liberado) { setCarregando(false); return; }
    carregar();
    carregarInsts(false);
  }, [indefinido, liberado, carregar, carregarInsts]);

  // A URL de autorização nasce um instante DEPOIS do create. Em vez de segurar a
  // resposta do /conectar (eram ~7s), o modal abre na hora e a URL entra aqui.
  useEffect(() => {
    if (!authId || authUrl) return;
    let vivo = true;
    let tentativas = 0;
    const tick = async () => {
      if (!vivo) return;
      try {
        const r = await api.openFinance.autorizar(authId);
        if (!vivo) return;
        if (r.urlToAuthenticate) { setAuthUrl(r.urlToAuthenticate); return; }
        const s = (r.status || '').toString().toUpperCase();
        // Status "já autorizado": UPDATED no trilho Pluggy (v1) e AUTHORISED no
        // Celcoin (v2) — os dois provedores convivem.
        if (s === 'UPDATED' || s === 'AUTHORISED') {
          setAuthId(''); setFlash('Esse banco já está autorizado — toque em Sincronizar.'); return;
        }
        if (s === 'LOGIN_ERROR' || s === 'REJECTED') {
          setAuthId(''); setErro('O banco recusou a autorização. Conecte de novo.'); return;
        }
        if (s === 'EXPIRED') {
          setAuthId(''); setErro('O consentimento expirou. Conecte de novo.'); return;
        }
      } catch { /* rede instável: segue tentando */ }
      if (!vivo) return;
      if (++tentativas >= 20) { setAuthLento(true); return; }
      setTimeout(tick, 700);
    };
    const t = setTimeout(tick, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [authId, authUrl, authTry]);

  // Já no limite do plano? Avisa aqui em vez de deixar o usuário escolher o
  // banco, digitar CPF e só então tomar 403 do backend.
  const noLimite = conexoes.length >= limiteConexoes;

  function abrirPicker() {
    if (noLimite) {
      setErro(
        `Seu plano ${PLANO_LABEL[plano] || ''} permite ${limiteConexoes} ${limiteConexoes === 1 ? 'conexão' : 'conexões'} de banco. ` +
        'Desconecte um banco pra trocar, ou faça upgrade pra conectar mais.',
      );
      return;
    }
    setPickerOpen(true); setErro(''); setInstSel(null); setBusca('');
    if (!insts.length) carregarInsts(true);
  }

  const instsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q ? insts.filter(i => nomeInst(i).toLowerCase().includes(q)) : insts;
    return base.slice(0, 80);
  }, [insts, busca]);

  async function conectar() {
    if (!instSel) return;
    const nome = nomeInst(instSel);
    setConectando(true); setErro('');
    try {
      const r = await api.openFinance.conectar({
        institution_id: instSel.id,
        cpf: cpf.replace(/\D/g, '') || undefined,
        instituicao_nome: nome,
      });
      // Abre o modal JÁ: se a URL veio no create, mostra o botão; senão o
      // polling preenche em ~1s. Recarregar a lista não bloqueia o modal.
      setPickerOpen(false);
      setAuthNome(nome); setAuthLento(false);
      if (r.urlToAuthenticate) setAuthUrl(r.urlToAuthenticate);
      else if (r.externalId) setAuthId(String(r.externalId));
      else {
        setFlash('Conexão iniciada! Em instantes os dados chegam — use Sincronizar se demorar.');
        setTimeout(() => setFlash(''), 8000);
      }
      carregar();
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
        if (r.urlToAuthenticate) { setAuthUrl(r.urlToAuthenticate); setAuthNome('seu banco'); }
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

  // Abre o modal na hora; quem busca a URL é o polling (feedback imediato em vez
  // de o botão ficar "morto" esperando a resposta).
  function autorizar(id: string, nome: string | null) {
    setErro(''); setAuthUrl(''); setAuthLento(false);
    setAuthNome(nome || 'seu banco'); setAuthId(id);
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

        {indefinido ? (
          /* Perfil a caminho: skeleton do card, pra não piscar "sem acesso". */
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4 animate-pulse" aria-busy="true">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-muted flex-shrink-0" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
          </div>
        ) : !liberado ? (
          /* Sem acesso. O recurso NÃO está mais "em atualização" — está aberto,
             mas só pra assinatura (Básico 1 conexão, Premium 3). O vitalício
             fica de fora porque cada conexão custa mensalidade no agregador.
             Duas mensagens diferentes: quem paga uma vez × quem não assina. */
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div aria-hidden className="absolute -top-16 -right-12 w-52 h-52 rounded-full opacity-20 pointer-events-none"
                 style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />

            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${BRAND} 16%, transparent)` }}>
                  <ShieldCheck size={22} style={{ color: BRAND }} />
                </span>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                        style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)`, color: BRAND }}>
                    <Sparkles size={11} /> Novidade
                  </span>
                  <h2 className="text-xl font-bold text-foreground tracking-tight mt-1.5">
                    {perfil?.vitalicio ? 'Recurso dos planos por assinatura' : 'Conecte seu banco à Sora'}
                  </h2>
                </div>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed [&_b]:text-foreground [&_b]:font-semibold">
                <p>
                  O Open Finance traz <b>saldo, transações, fatura do cartão e investimentos</b> direto
                  do seu banco, sem digitar nada — com autorização pelo app do próprio banco e
                  <b> leitura apenas</b> (a Sora não movimenta dinheiro).
                </p>
                {perfil?.vitalicio ? (
                  <p>
                    Seu acesso vitalício <b>não tem mensalidade</b> — e é justamente por isso que a
                    conexão fica de fora dele: cada banco conectado tem um custo que se repete todo
                    mês pra nós, no sistema que faz a ponte com o seu banco.
                    Se quiser usar, dá pra contratar <b>por banco conectado</b>, sem mexer no resto
                    do seu plano.
                  </p>
                ) : (
                  <p>
                    Está no <b>Básico</b> (1 banco conectado) e no <b>Premium</b> (até 3 bancos).
                    Criar contas na mão continua ilimitado no Premium — o limite é só da conexão automática.
                  </p>
                )}
              </div>

              {perfil?.vitalicio ? (
                <ContratarConexao />
              ) : (
                <a href="/planos"
                   className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-white text-sm font-bold shadow-lg transition-all active:scale-[0.99]"
                   style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                  Ver planos <ArrowRight size={16} />
                </a>
              )}

              {/* Recomendação OFX */}
              <div className="rounded-2xl border border-border bg-muted/40 p-4 flex items-start gap-3">
                <FileUp size={18} style={{ color: BRAND }} className="flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground">Quer importar tudo agora?</p>
                  <p>
                    Enquanto a nova conexão não chega, você consegue trazer{' '}
                    <b className="text-foreground font-semibold">todas as suas transações de uma vez</b> pela
                    importação <b className="text-foreground font-semibold">OFX</b> nas Contas — é rápido e traz
                    seu extrato completo. 😉
                  </p>
                </div>
              </div>

              <a href="/contas-bancarias"
                 className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-white text-sm font-bold shadow-lg transition-all active:scale-[0.99]"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                <FileUp size={17} /> Importar via OFX <ArrowRight size={16} />
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Quantas conexões o plano permite — o usuário precisa saber ANTES
                de escolher o banco. Só conexão é limitada; conta manual, não. */}
            {!carregando && limiteConexoes > 0 && (
              <p className="text-xs text-muted-foreground">
                <b className="text-foreground tabular">{conexoes.length}</b> de{' '}
                <b className="text-foreground tabular">{limiteConexoes}</b>{' '}
                {limiteConexoes === 1 ? 'conexão' : 'conexões'} do plano {PLANO_LABEL[plano]}
                {noLimite && (plano === 'basico'
                  // Básico tem pra onde subir; no Premium o caminho é a conexão
                  // avulsa (+R$5/mês), que ainda não está à venda — então aqui
                  // a gente avisa em vez de mandar pra uma página sem saída.
                  ? <> · <a href="/planos" className="font-semibold underline underline-offset-2" style={{ color: BRAND }}>
                      fazer upgrade
                    </a></>
                  : <> · conexões extras a R$ {PRECO_CONEXAO_EXTRA}/mês em breve</>
                )}
              </p>
            )}

            {/* Ação principal */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={abrirPicker} aria-disabled={noLimite}
                className={`flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg transition-all active:scale-[0.99] ${noLimite ? 'opacity-50' : ''}`}
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
              // Skeleton no formato do card: reserva o espaço (sem pulo de layout)
              // e o carregamento parece mais curto que um spinner solto.
              <ul className="space-y-2.5" aria-busy="true">
                {[0, 1].map(i => (
                  <li key={i} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
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
                    // Mobile: identificação em cima, ações numa linha própria — antes era
                    // tudo num flex só e os 4 botões (flex-shrink-0) esmagavam o texto,
                    // que vazava por baixo deles. Desktop (sm+) segue inline.
                    <li key={c.external_id} className="rounded-2xl border border-border bg-card p-4 sm:flex sm:items-center sm:gap-3">
                      <div className="flex items-start gap-3 sm:flex-1 sm:min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--bg-muted))' }}>
                          <Landmark size={18} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.instituicao || 'Banco'}</p>
                          {/* flex-wrap: status e data quebram a linha em vez de vazar */}
                          <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap" style={{ color: m.cor }}>
                              <m.Icon size={12} /> {m.label}
                            </span>
                            {c.ultima_sync && <span className="text-muted-foreground whitespace-nowrap">· {quando(c.ultima_sync)}</span>}
                          </div>
                          {c.ultimo_erro && <p className="text-[11px] text-red-500 line-clamp-2 mt-0.5">{c.ultimo_erro}</p>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0 sm:flex-nowrap sm:flex-shrink-0">
                        {(c.status || '').toLowerCase() !== 'updated' && (
                          <button onClick={() => autorizar(c.external_id, c.instituicao)}
                            className="flex-1 min-w-[6.5rem] sm:flex-none h-11 px-3 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                            style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                            <ExternalLink size={13} /> Autorizar
                          </button>
                        )}
                        <button onClick={() => sincronizar(c.external_id)} disabled={sinc}
                          className="flex-1 min-w-[6.5rem] sm:flex-none h-11 px-3 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.98] transition-transform"
                          style={{ minHeight: 44 }}>
                          {sinc ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sincronizar
                        </button>
                        <button onClick={() => diagnostico(c.external_id)} title="Diagnóstico" aria-label="Diagnóstico"
                          className="h-11 w-11 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground flex-shrink-0"
                          style={{ minHeight: 44 }}>
                          diag
                        </button>
                        <button onClick={() => desconectar(c.external_id, c.instituicao)} title="Desconectar" aria-label="Desconectar banco"
                          className="h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                          style={{ minHeight: 44 }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
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

      {/* ── Autorizar no banco (link direto — window.open é bloqueado no PWA) ── */}
      {(authUrl || authId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={fecharAuth}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl p-6 text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto" style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
              <ShieldCheck size={26} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Autorize no {authNome}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Toque abaixo pra abrir o ambiente seguro do banco e autorizar o compartilhamento.
                Precisa estar <b className="text-foreground">logado no banco</b>. Depois, volte aqui e toque em <b className="text-foreground">Sincronizar</b>.
              </p>
            </div>

            {authUrl ? (
              <a href={authUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg animate-[slide-up_300ms_ease-out_both]"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                <ExternalLink size={17} /> Abrir {authNome}
              </a>
            ) : authLento ? (
              // O link não veio: em vez de spinner infinito, dá saída.
              <div className="space-y-3" role="alert">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  O banco está demorando pra devolver o link seguro.
                </p>
                <button onClick={() => { setAuthLento(false); setAuthTry(t => t + 1); }}
                  className="w-full h-12 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-muted/40"
                  style={{ minHeight: 44 }}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 h-12 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground"
                   style={{ minHeight: 44 }} aria-live="polite">
                <Loader2 size={16} className="animate-spin" /> Preparando o link seguro…
              </div>
            )}

            <button onClick={fecharAuth} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
        </div>
      )}

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
                <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
                  {instLoading && !insts.length ? (
                    [0, 1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                        <div className="w-9 h-9 rounded-lg bg-muted flex-shrink-0" />
                        <div className="h-3.5 rounded bg-muted" style={{ width: `${45 + ((i * 13) % 35)}%` }} />
                      </div>
                    ))
                  ) : instsFiltradas.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nenhum banco encontrado.</p>
                  ) : instsFiltradas.map(i => (
                    <button key={i.id} onClick={() => setInstSel(i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 active:bg-muted/70 text-left transition-colors"
                      style={{ minHeight: 44 }}>
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoInst(i)
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={logoInst(i)!} alt="" width={36} height={36} loading="lazy" decoding="async" className="w-full h-full object-contain" />
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

// ─────────────────────────────────────────────────────────────────────────────
// Contratar conexão avulsa — o caminho do VITALÍCIO.
//
// Ele não tem franquia (pagou uma vez; a conexão custa todo mês). Aqui ele
// assina por banco conectado, numa assinatura separada da do plano.
//
// O anual aparece porque a taxa do cartão come ~12% de uma cobrança de R$ 6 —
// no anual cai pra ~1%. Quem escolher mensal não perde nada; quem escolher
// anual paga menos e a gente recebe melhor.
// ─────────────────────────────────────────────────────────────────────────────
function ContratarConexao() {
  const [intervalo, setIntervalo] = useState<'mensal' | 'anual'>('mensal');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function contratar() {
    if (enviando) return;
    setEnviando(true); setErro('');
    try {
      const r = await fetch('/api/stripe/conexao-of', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: 1, intervalo }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.url) { window.location.href = d.url; return; }
      // Já assinava e só mudou a quantidade — recarrega pra tela liberar.
      if (d?.ok) { window.location.reload(); return; }
      setErro(d?.erro || 'Não consegui abrir o pagamento. Tente de novo.');
    } catch {
      setErro('Não consegui abrir o pagamento. Tente de novo.');
    } finally { setEnviando(false); }
  }

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como pagar">
        {([
          { v: 'mensal' as const, titulo: 'R$ 6/mês', sub: 'por banco conectado' },
          { v: 'anual'  as const, titulo: 'R$ 60/ano', sub: 'dois meses de graça' },
        ]).map((o) => {
          const on = intervalo === o.v;
          return (
            <button key={o.v} onClick={() => setIntervalo(o.v)} role="radio" aria-checked={on}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                minHeight: 44,
                border: `1px solid ${on ? BRAND : 'hsl(var(--border))'}`,
                background: on ? `color-mix(in srgb, ${BRAND} 10%, transparent)` : 'transparent',
              }}>
              <span className="block text-sm font-bold text-foreground">{o.titulo}</span>
              <span className="block text-[11px] text-muted-foreground">{o.sub}</span>
            </button>
          );
        })}
      </div>

      <button onClick={contratar} disabled={enviando}
        className="w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-white text-sm font-bold shadow-lg disabled:opacity-60 transition-all active:scale-[0.99]"
        style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />}
        {enviando ? 'Abrindo…' : 'Conectar meu banco'}
      </button>

      {erro && <p role="alert" className="text-xs text-red-500">{erro}</p>}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Cobrado por banco conectado. Dá pra cancelar quando quiser — o banco fica
        conectado até o fim do período que você já pagou. Seu acesso vitalício ao
        resto da Sora continua igual, sem mensalidade.
      </p>
    </div>
  );
}
