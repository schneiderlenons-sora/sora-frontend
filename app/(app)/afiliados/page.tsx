'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Megaphone, Loader2, CheckCircle2, Clock, XCircle, ArrowLeft } from 'lucide-react';

// =============================================================================
// Seja afiliado.
//
// ⚠️ A ENTRADA É POR ANÁLISE, e a tela diz isso ANTES do formulário. É promessa
// de produto: quem envia precisa saber que não é automático, senão fica
// esperando um acesso que só chega depois de alguém olhar. Quem aprova é o
// /admin — esta tela só registra.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const VANTAGENS = [
  { destaque: '30%',      texto: 'da primeira cobrança de cada assinante que você trouxer' },
  { destaque: '15%',      texto: 'de cada renovação, por até 2 anos de assinatura' },
  { destaque: 'Desconto', texto: 'quem usa o seu código paga menos, então você tem o que oferecer' },
];

export default function AfiliadosPage() {
  const { data, isLoading, mutate } = useSWR('/api/afiliados', fetcher);
  const [form, setForm] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-2 space-y-4 animate-pulse">
        <div className="h-32 rounded-3xl bg-muted/40" />
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/40" />)}
      </div>
    );
  }

  const cand = data?.candidatura;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-2 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <span className="grid place-items-center w-11 h-11 rounded-2xl flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
          <Megaphone size={20} style={{ color: BRAND }} />
        </span>
        <h1 className="text-2xl font-black text-foreground leading-tight">Seja afiliado</h1>
      </div>

      {/* Já tem candidatura → mostra o ESTADO dela, não o formulário de novo. */}
      {cand && !form ? (
        <EstadoCandidatura cand={cand} onNova={() => setForm(true)} />
      ) : form ? (
        <Formulario
          nome={data?.nome} email={data?.email}
          onCancelar={() => setForm(false)}
          onEnviado={() => { setForm(false); mutate(); }}
        />
      ) : (
        <>
          <div className="rounded-3xl border border-border/60 p-6" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <h2 className="text-xl font-black text-foreground leading-tight">Indique a Sora. Receba por isso.</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Se você fala de dinheiro pra quem te acompanha, essa indicação pode virar receita.
              A entrada é por análise de perfil, não é automática.
            </p>
          </div>

          {VANTAGENS.map((v) => (
            <div key={v.destaque}
                 className="rounded-2xl border border-border/60 p-4 flex items-center gap-4"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <span className="text-2xl font-black flex-shrink-0" style={{ color: BRAND }}>{v.destaque}</span>
              <span className="text-sm text-muted-foreground leading-snug">{v.texto}</span>
            </div>
          ))}

          <button onClick={() => setForm(true)}
            className="w-full rounded-2xl text-white text-base font-bold active:scale-[0.98] transition-transform"
            style={{ background: BRAND, minHeight: 56 }}>
            Quero me candidatar
          </button>
        </>
      )}
    </div>
  );
}

function EstadoCandidatura({ cand, onNova }: { cand: any; onNova: () => void }) {
  const mapa = {
    pendente: { Icone: Clock,        cor: 'hsl(var(--muted-foreground))', titulo: 'Candidatura em análise',
                texto: 'Recebemos seus dados. Vamos olhar seu perfil e te retornar — normalmente em alguns dias.' },
    aprovado: { Icone: CheckCircle2, cor: BRAND,                          titulo: 'Você foi aprovado 🎉',
                texto: 'Bem-vindo ao programa. Entramos em contato pelo WhatsApp que você informou com seu código e o material.' },
    recusado: { Icone: XCircle,      cor: 'hsl(var(--muted-foreground))', titulo: 'Não foi dessa vez',
                texto: 'Seu perfil não se encaixou no programa agora. Isso pode mudar — dá pra se candidatar de novo mais pra frente.' },
  }[cand.status as 'pendente' | 'aprovado' | 'recusado'];

  return (
    <div className="rounded-3xl border border-border/60 p-6 text-center" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <span className="grid place-items-center w-14 h-14 rounded-2xl mx-auto mb-4"
            style={{ background: `color-mix(in srgb, ${mapa.cor} 13%, transparent)` }}>
        <mapa.Icone size={24} style={{ color: mapa.cor }} />
      </span>
      <h2 className="text-lg font-bold text-foreground">{mapa.titulo}</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{mapa.texto}</p>
      {/* Observação do admin só aparece quando existe — e é o retorno mais útil
          que a pessoa pode receber, então vem em destaque. */}
      {cand.observacao && (
        <p className="text-sm text-foreground mt-4 p-3 rounded-2xl bg-muted/40 border border-border/60 leading-relaxed">
          {cand.observacao}
        </p>
      )}
      {cand.status === 'recusado' && (
        <button onClick={onNova} className="mt-5 text-sm font-bold" style={{ color: BRAND }}>
          Candidatar-se de novo
        </button>
      )}
    </div>
  );
}

function Formulario({ nome, email, onCancelar, onEnviado }: {
  nome?: string; email?: string; onCancelar: () => void; onEnviado: () => void;
}) {
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [como, setComo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // Máscara BR, mesmo padrão do WhatsappInput do app.
  const mascara = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const podeEnviar = whatsapp.replace(/\D/g, '').length >= 10 && instagram.trim().length > 1;

  async function enviar() {
    setEnviando(true); setErro('');
    try {
      const r = await fetch('/api/afiliados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, instagram, tiktok, como_divulgar: como }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não consegui enviar.');
      onEnviado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar.');
    } finally { setEnviando(false); }
  }

  return (
    <div className="space-y-4">
      <button onClick={onCancelar} className="flex items-center gap-1.5 text-sm text-muted-foreground" style={{ minHeight: 44 }}>
        <ArrowLeft size={15} /> Voltar
      </button>

      <div className="rounded-3xl border border-border/60 p-5" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <h2 className="text-lg font-bold text-foreground">Sua candidatura</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Vamos usar <strong className="text-foreground">{nome || 'seu nome'}</strong> e{' '}
          <strong className="text-foreground">{email || 'seu e-mail'}</strong> da sua conta.
          Preencha o resto pra gente analisar seu perfil.
        </p>
      </div>

      <Campo label="WhatsApp" obrigatorio>
        <input value={whatsapp} onChange={(e) => setWhatsapp(mascara(e.target.value))}
          placeholder="(00) 00000-0000" inputMode="tel" className="input w-full" style={{ minHeight: 48 }} />
      </Campo>

      <Campo label="Instagram" obrigatorio>
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
          placeholder="@seuperfil" autoCapitalize="none" spellCheck={false}
          className="input w-full" style={{ minHeight: 48 }} />
      </Campo>

      <Campo label="TikTok" opcional>
        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)}
          placeholder="@seuperfil" autoCapitalize="none" spellCheck={false}
          className="input w-full" style={{ minHeight: 48 }} />
      </Campo>

      <Campo label="Como pretende divulgar?" opcional>
        <textarea value={como} onChange={(e) => setComo(e.target.value)} rows={4}
          placeholder="Stories, vídeos, review no feed…" className="input w-full resize-none" />
      </Campo>

      <p className="text-[12px] text-muted-foreground leading-relaxed px-1">
        Ao enviar, você aceita as regras do programa: 30% da primeira cobrança e 15% das renovações,
        sobre o valor repassado pela loja.
      </p>

      {erro && <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug px-1">{erro}</p>}

      <button onClick={enviar} disabled={!podeEnviar || enviando}
        className="w-full flex items-center justify-center gap-2 rounded-2xl text-white text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        style={{ background: BRAND, minHeight: 56 }}>
        {enviando ? <><Loader2 size={17} className="animate-spin" /> Enviando…</> : 'Enviar candidatura'}
      </button>
    </div>
  );
}

// Rótulo VISÍVEL (nunca só placeholder) e obrigatoriedade explícita — regras
// `input-labels` e `required-indicators` da ui-ux-pro-max.
function Campo({ label, obrigatorio, opcional, children }: {
  label: string; obrigatorio?: boolean; opcional?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}{obrigatorio && <span className="text-red-500"> *</span>}
        {opcional && <span className="font-medium normal-case tracking-normal"> (opcional)</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
