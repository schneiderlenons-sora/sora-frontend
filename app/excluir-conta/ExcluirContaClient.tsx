'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Check, Clock, ShieldCheck, Mail, LogIn, Loader2, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Página pública de exclusão de conta (exigência da Play Store).
//
// ⚠️ O PEDIDO VAI PELO MESMO CANAL DO "RELATAR UM PROBLEMA" (POST /api/bug):
// grava em `bug_reports`, cai no WhatsApp do suporte e aparece no /admin — onde
// o botão de apagar conta faz o serviço completo (revoga os bancos na Polp,
// cancela o Stripe, apaga tudo). Sem migration e sem tela nova pro dono.
//
// ⚠️ A EXCLUSÃO NÃO É IMEDIATA, DE PROPÓSITO. Grupo compartilhado criado pela
// pessoa é apagado junto PARA OS OUTROS MEMBROS também, e uma conta apagada não
// tem volta. Um humano confere antes. O prazo dito aqui (15 dias, o da LGPD)
// é compromisso do dono — não encurtar o texto sem combinar com ele.
//
// ⚠️ Antes desta página o botão de Configurações dizia "Solicitação
// registrada" e NÃO REGISTRAVA NADA. Hoje ele traz a pessoa pra cá.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_SUPORTE = 'contato@forsora.com';
const CHAVE_PEDIDO = (uid: string) => `sora-exclusao-pedida:${uid}`;

type Pedido = { em: string; protocolo: string | null };

function lerPedido(uid: string): Pedido | null {
  try {
    const raw = localStorage.getItem(CHAVE_PEDIDO(uid));
    return raw ? (JSON.parse(raw) as Pedido) : null;
  } catch { return null; }
}

export default function ExcluirContaClient() {
  const { user, loading } = useAuth();

  return (
    <main className="min-h-dvh bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <Link href={user ? '/configuracoes' : '/'} className="inline-flex items-center min-h-11 text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
          ← {user ? 'Voltar ao painel' : 'Voltar ao site'}
        </Link>

        <div className="flex items-center gap-3 mt-6 mb-2">
          <img src="/sora-icon.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl" />
          <span className="text-sm font-semibold text-zinc-500 dark:text-white/50">Sora · forsora.com</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Excluir sua conta da Sora</h1>
        <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-white/75 max-w-2xl">
          Aqui você pede a exclusão da sua conta da <strong className="text-zinc-900 dark:text-white">Sora</strong> — o app
          de organização financeira e de rotina (site forsora.com e app Sora na Google Play) — e de todos os dados ligados a ela.
          Não precisa ter o app instalado.
        </p>
        <p className="text-sm text-zinc-500 dark:text-white/50 mt-3">Última atualização: 19/10/2026 · Conforme a LGPD (Lei 13.709/2018)</p>

        {/* ── Como pedir ─────────────────────────────────────────────── */}
        <section className="mt-10" aria-labelledby="como-pedir">
          <h2 id="como-pedir" className="text-lg font-bold mb-4">Como pedir</h2>
          <div className="grid gap-4">
            <CardPedido user={user} loading={loading} />

            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-zinc-600 dark:text-white/70" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">Não consegue entrar na conta?</h3>
                  <p className="text-sm text-zinc-600 dark:text-white/65 mt-1 leading-relaxed">
                    Escreva para <strong className="text-zinc-900 dark:text-white">{EMAIL_SUPORTE}</strong> a partir do
                    e-mail cadastrado na Sora, com o assunto “Exclusão de conta”. Se não tiver mais acesso a esse e-mail,
                    diga o número de WhatsApp ligado à conta — vamos confirmar que a conta é sua antes de apagar.
                  </p>
                  <a
                    href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent('Exclusão de conta')}&body=${encodeURIComponent('Quero excluir minha conta da Sora e todos os meus dados.\n\nE-mail cadastrado: \nWhatsApp ligado à conta (opcional): ')}`}
                    className="inline-flex items-center gap-2 min-h-11 mt-3 px-4 rounded-xl text-sm font-semibold border border-zinc-300 dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Mail size={15} aria-hidden /> Escrever e-mail
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Prazo ──────────────────────────────────────────────────── */}
        <section className="mt-10" aria-labelledby="prazo">
          <h2 id="prazo" className="text-lg font-bold mb-2 flex items-center gap-2">
            <Clock size={18} aria-hidden /> Prazo
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
            A exclusão é feita em até <strong className="text-zinc-900 dark:text-white">15 dias</strong> depois do pedido, e
            avisamos por e-mail quando terminar. Se você tem uma assinatura ativa, ela é cancelada junto — nenhuma cobrança
            nova acontece depois da exclusão. A exclusão é <strong className="text-zinc-900 dark:text-white">permanente</strong>:
            depois dela não dá pra recuperar a conta nem os dados.
          </p>
        </section>

        {/* ── O que é apagado ────────────────────────────────────────── */}
        <section className="mt-10" aria-labelledby="apagado">
          <h2 id="apagado" className="text-lg font-bold mb-3 flex items-center gap-2">
            <Trash2 size={18} aria-hidden /> O que é apagado
          </h2>
          <ul className="space-y-2.5 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
            <Item>Seu login (e-mail e senha) e seu perfil: nome, número de WhatsApp e foto.</Item>
            <Item>Tudo o que você registrou nas finanças: transações, contas, cartões, faturas, categorias, limites, metas, dívidas, investimentos e contas fixas.</Item>
            <Item>Os dados do Sora Grow (hábitos, tarefas, agenda, saúde, estudos, casa, viagens, filmes e leituras) e os arquivos guardados no Drive.</Item>
            <Item>Os dados da aba Negócios: empresas, vendas, clientes, produtos, caixa e equipe.</Item>
            <Item>As conexões com seus bancos pelo Open Finance são desligadas, e os dados que vieram delas são apagados.</Item>
            <Item>
              Grupos compartilhados que <strong className="text-zinc-900 dark:text-white">você criou</strong> são apagados
              também para os outros membros. Se quiser que eles continuem, avise-os antes de pedir a exclusão.
            </Item>
          </ul>
        </section>

        {/* ── O que fica ─────────────────────────────────────────────── */}
        <section className="mt-10" aria-labelledby="guardado">
          <h2 id="guardado" className="text-lg font-bold mb-3 flex items-center gap-2">
            <ShieldCheck size={18} aria-hidden /> O que pode ficar guardado, e por quanto tempo
          </h2>
          <ul className="space-y-2.5 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
            <Item>
              <strong className="text-zinc-900 dark:text-white">Registros de pagamento</strong> (data, valor e plano
              contratado): por até 5 anos, para cumprir obrigações fiscais e legais. Os dados do seu cartão nunca ficam com a
              Sora — eles estão com o processador de pagamento (Stripe ou Mercado Pago).
            </Item>
            <Item>
              <strong className="text-zinc-900 dark:text-white">O próprio pedido de exclusão</strong> e as conversas com o
              suporte: por até 5 anos, como comprovante de que o pedido foi atendido (LGPD, art. 16).
            </Item>
            <Item>
              <strong className="text-zinc-900 dark:text-white">Conversa no WhatsApp:</strong> o histórico da conversa com a
              Sora fica no seu celular, no seu aplicativo do WhatsApp. Se quiser, apague a conversa por lá.
            </Item>
          </ul>
        </section>

        {/* ── Antes de pedir ─────────────────────────────────────────── */}
        <section className="mt-10 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 p-5" aria-labelledby="antes">
          <h2 id="antes" className="text-base font-bold mb-2 flex items-center gap-2">
            <Download size={17} aria-hidden /> Antes de pedir
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-white/65">
            Se quiser guardar uma cópia, exporte suas transações em <strong className="text-zinc-900 dark:text-white">Configurações → Privacidade e Dados</strong>.
            Se o que você quer é só recomeçar do zero, a mesma tela tem <strong className="text-zinc-900 dark:text-white">“Resetar minha conta”</strong>, que limpa os dados e mantém a conta.
          </p>
        </section>

        <p className="text-sm text-zinc-500 dark:text-white/50 mt-10 leading-relaxed">
          Mais detalhes na nossa{' '}
          <Link href="/privacidade" className="font-semibold underline" style={{ color: 'hsl(var(--primary))' }}>Política de Privacidade</Link>.
          Dúvidas: {EMAIL_SUPORTE}.
        </p>
      </div>
    </main>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-[9px] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-zinc-400 dark:bg-white/40" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

// ── O card que faz o pedido ──────────────────────────────────────────────────
function CardPedido({ user, loading }: { user: { id: string; email?: string } | null; loading: boolean }) {
  const [entendi, setEntendi] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [digitou, setDigitou] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pedido, setPedido] = useState<Pedido | null>(null);

  // Mostra o pedido já feito neste aparelho — sem isso, voltar à página
  // convidaria a mandar outro igual.
  useEffect(() => { if (user) setPedido(lerPedido(user.id)); }, [user]);

  const casa = 'rounded-2xl border p-5';

  if (loading) {
    return <div className={`${casa} border-zinc-200 dark:border-white/10 h-40 animate-pulse bg-zinc-50 dark:bg-white/[0.03]`} aria-busy="true" aria-label="Carregando" />;
  }

  if (!user) {
    return (
      <div className={`${casa} border-zinc-200 dark:border-white/10`}>
        <h3 className="font-semibold">Pela sua conta (mais rápido)</h3>
        <p className="text-sm text-zinc-600 dark:text-white/65 mt-1 leading-relaxed">
          Entre com o e-mail e a senha da Sora. Você volta direto para esta página e confirma o pedido em um passo.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
          <Link
            href="/login?next=/excluir-conta"
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl text-sm font-bold active:scale-[0.98] transition"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-fg))' }}
          >
            <LogIn size={16} aria-hidden /> Entrar para pedir a exclusão
          </Link>
          <Link href="/recuperar-senha" className="inline-flex items-center min-h-11 text-sm font-semibold underline text-zinc-600 dark:text-white/65">
            Esqueci a senha
          </Link>
        </div>
      </div>
    );
  }

  if (pedido) {
    return (
      <div className={`${casa} border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20`} role="status">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <Check size={18} className="text-emerald-700 dark:text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">Pedido recebido</h3>
            <p className="text-sm text-zinc-700 dark:text-white/75 mt-1 leading-relaxed">
              Pedido feito em {new Date(pedido.em).toLocaleDateString('pt-BR')}
              {pedido.protocolo && <> · protocolo <span className="font-mono">{pedido.protocolo}</span></>}.
              A conta <strong>{user.email}</strong> será excluída em até 15 dias, e você recebe um e-mail quando terminar.
              Até lá ela continua funcionando normalmente.
            </p>
            <p className="text-xs text-zinc-500 dark:text-white/50 mt-2">
              Mudou de ideia? Escreva para {EMAIL_SUPORTE} antes da exclusão.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pode = entendi && digitou.trim().toUpperCase() === 'EXCLUIR' && !enviando;

  async function enviar() {
    if (!pode || !user) return;
    setEnviando(true);
    setErro('');
    try {
      const mensagem = [
        '🗑️ PEDIDO DE EXCLUSÃO DE CONTA (página /excluir-conta)',
        `Conta: ${user.email || user.id}`,
        `Motivo: ${motivo.trim() || 'não informado'}`,
        'Prazo prometido ao cliente: até 15 dias. Use o botão de apagar conta no /admin (revoga os bancos e cancela o Stripe).',
      ].join('\n');
      const r = await api.bug.reportar({ mensagem, tipo: 'problema' });
      const novo: Pedido = { em: new Date().toISOString(), protocolo: r.id ? r.id.slice(0, 8) : null };
      try { localStorage.setItem(CHAVE_PEDIDO(user.id), JSON.stringify(novo)); } catch { /* storage bloqueado */ }
      setPedido(novo);
    } catch (e: unknown) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`${casa} border-red-200 dark:border-red-900/60`}>
      <h3 className="font-semibold">Pela sua conta (mais rápido)</h3>
      <p className="text-sm text-zinc-600 dark:text-white/65 mt-1 leading-relaxed">
        Você está na conta <strong className="text-zinc-900 dark:text-white break-all">{user.email}</strong>.
      </p>

      <label className="flex items-start gap-3 mt-4 cursor-pointer min-h-11">
        <input
          type="checkbox"
          checked={entendi}
          onChange={e => setEntendi(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-red-600 flex-shrink-0"
        />
        <span className="text-sm leading-relaxed">
          Entendo que a exclusão é <strong>permanente</strong> e apaga todos os meus dados, inclusive grupos compartilhados que eu criei.
        </span>
      </label>

      <label htmlFor="motivo-exclusao" className="block text-sm font-semibold mt-4 mb-1.5">
        Quer contar por que está saindo? <span className="font-normal text-zinc-500 dark:text-white/50">(opcional)</span>
      </label>
      <textarea
        id="motivo-exclusao"
        value={motivo}
        onChange={e => setMotivo(e.target.value.slice(0, 500))}
        rows={2}
        className="w-full rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-red-500/40"
      />

      <label htmlFor="confirma-exclusao" className="block text-sm font-semibold mt-4 mb-1.5">
        Para confirmar, digite <span className="font-mono text-red-600 dark:text-red-400">EXCLUIR</span>
      </label>
      <input
        id="confirma-exclusao"
        value={digitou}
        onChange={e => setDigitou(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        className="w-full sm:w-64 min-h-11 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 text-base font-mono outline-none focus:ring-2 focus:ring-red-500/40"
      />

      {erro && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden />
          <span>
            Não conseguimos enviar o pedido agora ({erro}). Tente de novo em instantes ou escreva para {EMAIL_SUPORTE}.
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={!pode}
        className="mt-5 inline-flex items-center justify-center gap-2 min-h-11 w-full sm:w-auto px-5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
        {enviando ? 'Enviando…' : 'Pedir a exclusão da minha conta'}
      </button>
    </div>
  );
}
