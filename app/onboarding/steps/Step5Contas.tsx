'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Landmark, Plus, Trash2, Loader2, CreditCard, Check, X, Wallet,
  Zap, PencilLine, ShieldCheck, Sparkles, Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { podeVerOpenFinance, PRECO_CONEXAO_OF } from '@/lib/open-finance-access';
import { salvarIntencaoOF, querOpenFinance } from '@/lib/of-intent';
import AdicionarCartaoModal, { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';
import StepNav from '../components/StepNav';

const BRAND = 'hsl(var(--primary))';
const OF_COR = '#6366f1';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type TipoBanco = 'Corrente' | 'Poupança' | 'Dinheiro';
const TIPOS_BANCO: TipoBanco[] = ['Corrente', 'Poupança', 'Dinheiro'];

export default function Step5Contas() {
  const { phone, user, perfil } = useAuth();

  // Quem tem Open Finance na FRANQUIA do plano (assinatura recorrente: Básico
  // 1 conexão, Premium 3) — e o vitalício que já contratou uma avulsa.
  const temOF = podeVerOpenFinance(user?.email, phone, perfil);

  // ⚠️ O VITALÍCIO TAMBÉM PODE CONECTAR — pagando. Ele não tem franquia (não
  // paga mensalidade nenhuma, e cada conexão custa mensalidade nossa no
  // agregador), mas a conexão avulsa existe pra qualquer plano. Escondendo a
  // opção dele, o onboarding inteiro dava a entender que a Sora não conecta
  // banco — e ele cadastrava tudo à mão sem saber que havia escolha.
  //
  // A regra pra OFERECER é diferente da regra pra USAR: aqui basta poder
  // contratar. Quem decide o acesso continua sendo `temOpenFinance` (lib/plans),
  // espelhado no backend.
  const ehVitalicio = !!perfil?.vitalicio;
  const ofPago = !temOF && ehVitalicio;        // pode conectar, mas é pago
  const podeEscolherOF = temOF || ehVitalicio;

  // `null` = ainda não escolheu NESTA visita → vale o que ficou guardado (o
  // usuário pode ter voltado um passo, e reescolher do zero seria irritante).
  // Derivado em vez de `useEffect` + setState: com efeito, o primeiro render
  // saía "manual" e piscava pra "Open Finance" quando o auth chegava.
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const viaOF = escolha ?? (podeEscolherOF && querOpenFinance(user?.id));

  const [wallets, setWallets]   = useState<any[]>([]);
  const [carregando, setCarreg] = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [cartaoOpen, setCartaoOpen] = useState(false);

  function escolher(of: boolean) {
    setEscolha(of);
    salvarIntencaoOF(user?.id, of);
    if (of) { setAddOpen(false); setCartaoOpen(false); }
  }

  // form de conta bancária
  const [nome, setNome]   = useState('');
  const [tipo, setTipo]   = useState<TipoBanco>('Corrente');
  const [saldo, setSaldo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!phone) { setCarreg(false); return; }
    try { setWallets((await api.wallets.listar(phone)) || []); }
    catch { setWallets([]); }
    finally { setCarreg(false); }
  }, [phone]);
  useEffect(() => { carregar(); }, [carregar]);

  const contas  = wallets.filter((w) => w.tipo !== 'Crédito');
  const cartoes = wallets.filter((w) => w.tipo === 'Crédito');

  async function addConta() {
    if (!nome.trim() || !phone) return;
    setSalvando(true);
    try {
      await api.wallets.salvar({
        phone, nome: nome.trim(), tipo,
        saldo: parseFloat(String(saldo || '0').replace(',', '.')) || 0,
      });
      setNome(''); setSaldo(''); setTipo('Corrente'); setAddOpen(false);
      await carregar();
    } catch { /* noop */ } finally { setSalvando(false); }
  }

  async function remover(id: string) {
    setWallets((prev) => prev.filter((w) => w.id !== id)); // otimista
    try { await api.wallets.deletar(id); } catch { carregar(); }
  }

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2" style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)` }}>
          <Landmark size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Suas contas e cartões
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          {podeEscolherOF
            ? 'Você pode conectar seu banco e deixar a Sora trazer tudo sozinha, ou cadastrar à mão. Dá pra mudar de ideia depois.'
            : 'Cadastre suas contas bancárias e cartões de crédito. É com elas que a Sora organiza suas finanças.'}
        </p>
      </div>

      {/* ── COMO VOCÊ QUER COMEÇAR ─────────────────────────────────
          Só aparece pra quem realmente TEM Open Finance. Pra quem não tem,
          a tela segue exatamente como era — zero mudança. */}
      {podeEscolherOF && !carregando && (
        <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
          <OpcaoInicio
            ativa={viaOF} onClick={() => escolher(true)}
            icone={Zap} cor={OF_COR}
            titulo="Conectar meu banco"
            desc={ofPago
              ? 'A Sora traz contas, cartões e lançamentos sozinha. A conexão é cobrada à parte do seu acesso vitalício.'
              : 'A Sora traz contas, cartões e lançamentos sozinha, pelo Open Finance.'}
            // ⚠️ O selo diz o PREÇO quando é pago. Vender "Mais rápido" e só
            // revelar a cobrança na aba seguinte seria enganar no onboarding.
            selo={ofPago ? PRECO_CONEXAO_OF.mensal : 'Mais rápido'}
          />
          <OpcaoInicio
            ativa={!viaOF} onClick={() => escolher(false)}
            icone={PencilLine} cor={BRAND}
            titulo="Cadastrar à mão"
            desc="Você digita suas contas e cartões agora, sem conectar nada."
          />
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : viaOF ? (
        <PainelOpenFinance
          contas={contas.length} cartoes={cartoes.length}
          pago={ofPago}
          onTrocar={() => escolher(false)}
        />
      ) : (
        <div className="space-y-6">
          {/* ── CONTAS BANCÁRIAS ─────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Contas bancárias</h2>
              {!addOpen && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>

            {contas.map((c) => {
              const logo = bancoLogo(c.nome);
              return (
                <div key={c.id} className="group flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: logo.bg }}>
                    {logo.text}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.tipo}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">{fmt(c.saldo)}</span>
                  <button onClick={() => remover(c.id)} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${c.nome}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}

            {/* Form inline de nova conta */}
            {addOpen && (
              <div className="p-4 rounded-2xl border border-border bg-muted/20 animate-fade-in space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px] gap-2.5">
                  <input
                    autoFocus
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addConta()}
                    placeholder="Nome (ex.: Nubank)"
                    className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoBanco)} className="px-3 h-11 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                    {TIPOS_BANCO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    inputMode="decimal"
                    value={saldo}
                    onChange={(e) => setSaldo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addConta()}
                    placeholder="Saldo R$ 0,00"
                    className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm tabular-nums placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={addConta} disabled={!nome.trim() || salvando} className="inline-flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                    {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar conta
                  </button>
                  <button onClick={() => { setAddOpen(false); setNome(''); setSaldo(''); }} className="px-4 h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {contas.length === 0 && !addOpen && (
              <button onClick={() => setAddOpen(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
                <Wallet size={16} /> Adicionar conta bancária
              </button>
            )}
          </section>

          {/* ── CARTÕES DE CRÉDITO ───────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cartões de crédito</h2>
              {contas.length > 0 && (
                <button
                  onClick={() => setCartaoOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>

            {cartoes.map((c) => {
              const logo = bancoLogo(c.nome);
              return (
                <div key={c.id} className="group flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: logo.bg }}>
                    {logo.text}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Crédito{c.limite ? ` · limite ${fmt(c.limite)}` : ''}
                    </p>
                  </div>
                  <button onClick={() => remover(c.id)} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${c.nome}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}

            {contas.length === 0 ? (
              <div className="p-4 rounded-2xl border border-border bg-card/60 text-xs text-muted-foreground leading-relaxed">
                Cadastre uma conta bancária primeiro — o cartão é vinculado a uma conta.
              </div>
            ) : cartoes.length === 0 && (
              <button onClick={() => setCartaoOpen(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
                <CreditCard size={16} /> Adicionar cartão de crédito
              </button>
            )}
          </section>
        </div>
      )}

      <StepNav podeAvancar={!carregando} />

      {cartaoOpen && (
        <AdicionarCartaoModal
          phone={phone || ''}
          onClose={() => setCartaoOpen(false)}
          onSuccess={() => { setCartaoOpen(false); carregar(); }}
        />
      )}
    </>
  );
}

// ── Um dos dois caminhos de início ──────────────────────────────────────────
type IconeLucide = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

function OpcaoInicio({ ativa, onClick, icone: Icone, cor, titulo, desc, selo }: {
  ativa: boolean; onClick: () => void; icone: IconeLucide; cor: string;
  titulo: string; desc: string; selo?: string;
}) {
  return (
    <button
      type="button" onClick={onClick}
      aria-pressed={ativa}
      className="relative text-left p-4 rounded-2xl transition-all duration-200 active:scale-[0.99]"
      style={{
        minHeight: 44,
        border: `1px solid ${ativa ? cor : 'hsl(var(--border))'} !important`,
        background: ativa ? `color-mix(in srgb, ${cor} 8%, transparent)` : 'hsl(var(--bg-card))',
        boxShadow: ativa ? `0 0 0 3px color-mix(in srgb, ${cor} 18%, transparent)` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, ${cor} 13%, transparent)` }}>
          <Icone size={17} style={{ color: cor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{titulo}</p>
            {selo && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white" style={{ background: cor }}>
                {selo}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
        </div>
        {/* Ícone + rótulo: a seleção nunca é comunicada só por cor. */}
        {ativa && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold flex-shrink-0" style={{ color: cor }}>
            <Check size={13} /> Escolhido
          </span>
        )}
      </div>
    </button>
  );
}

// ── Escolheu conectar: o que acontece agora ─────────────────────────────────
//
// ⚠️ NÃO é um formulário desabilitado. Botão cinza lê como "quebrou"; o que o
// usuário precisa aqui é entender que não há nada a fazer nesta tela — e por
// quê. Por isso o bloco EXPLICA em vez de bloquear, e a volta atrás fica
// sempre visível (a escolha nunca é uma armadilha).
function PainelOpenFinance({ contas, cartoes, pago, onTrocar }: {
  contas: number; cartoes: number; pago?: boolean; onTrocar: () => void;
}) {
  const jaTem = contas + cartoes > 0;
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6"
           style={{ border: `1px solid color-mix(in srgb, ${OF_COR} 30%, transparent) !important`,
                    background: `color-mix(in srgb, ${OF_COR} 6%, transparent)` }}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-25"
             style={{ background: `radial-gradient(circle, ${OF_COR} 0%, transparent 65%)` }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles size={15} style={{ color: OF_COR }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: OF_COR }}>
              Você não precisa cadastrar nada aqui
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug">
            Suas contas e cartões vêm do banco, prontos.
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Ao conectar, a Sora cria <strong className="text-foreground">as contas e os cartões sozinha</strong>,
            com saldo, limite e as datas de fechamento e vencimento certas — e ainda traz seus últimos
            lançamentos. Cadastrar à mão agora só daria trabalho dobrado.
          </p>

          <ol className="mt-4 space-y-2.5">
            <PassoOF n={1}>Termine estes primeiros passos (falta pouco).</PassoOF>
            <PassoOF n={2}>Eu te levo direto pra aba <strong className="text-foreground">Open Finance</strong>.</PassoOF>
            <PassoOF n={3}>Você escolhe o banco e autoriza — leva menos de um minuto.</PassoOF>
          </ol>

          {/* ⚠️ A COBRANÇA APARECE AQUI, ANTES do usuário escolher — não na aba
              seguinte. O vitalício comprou "sem mensalidade"; descobrir uma
              cobrança depois de já ter optado seria uma surpresa desagradável,
              e é o motivo de a opção ter ficado escondida dele até agora. Dizer
              o preço na cara resolve melhor do que esconder. */}
          {pago && (
            <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed rounded-2xl p-3"
               style={{ border: `1px solid color-mix(in srgb, ${OF_COR} 25%, transparent) !important`,
                        background: `color-mix(in srgb, ${OF_COR} 8%, transparent)` }}>
              <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: OF_COR }} />
              <span>
                Conectar o banco custa <strong className="text-foreground">{PRECO_CONEXAO_OF.mensal}</strong> por
                banco (ou {PRECO_CONEXAO_OF.anual}) — é o que a Sora paga ao agregador todo mês pra manter
                a conexão viva. <strong className="text-foreground">Seu acesso vitalício continua sem mensalidade</strong>,
                e você escolhe se quer contratar quando chegar lá. Cancela quando quiser.
              </span>
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: OF_COR }} />
            <span>
              Conexão pelo Open Finance, regulado pelo Banco Central. A Sora só <strong className="text-foreground">lê</strong> seus
              dados — nunca movimenta dinheiro. Você desconecta quando quiser.
            </span>
          </p>
        </div>
      </div>

      {jaTem && (
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 text-[12px] leading-relaxed text-muted-foreground">
          Você já cadastrou {contas > 0 && <strong className="text-foreground">{contas} conta{contas > 1 ? 's' : ''}</strong>}
          {contas > 0 && cartoes > 0 && ' e '}
          {cartoes > 0 && <strong className="text-foreground">{cartoes} cartão{cartoes > 1 ? 'ões' : ''}</strong>}
          {' '}à mão — não apaguei nada. Se o banco trouxer os mesmos, é só apagar os repetidos depois
          (o Detetive Watson te ajuda nisso).
        </div>
      )}

      <button
        type="button" onClick={onTrocar}
        className="w-full inline-flex items-center justify-center gap-2 px-4 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
        style={{ minHeight: 52 }}
      >
        <PencilLine size={15} /> Prefiro cadastrar à mão agora
      </button>
    </div>
  );
}

function PassoOF({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 tabular"
            style={{ background: OF_COR }}>{n}</span>
      <span className="text-[12.5px] leading-relaxed text-muted-foreground">{children}</span>
    </li>
  );
}
