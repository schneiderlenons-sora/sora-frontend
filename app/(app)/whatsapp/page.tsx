'use client';

// ─────────────────────────────────────────────────────────────────────────────
// A ABA QUE DIZ ONDE FICA O WHATSAPP DA SORA.
//
// POR QUE EXISTE (02/10/2026). Dois clientes no mesmo dia: "o site fala que
// posso fazer coisas pelo WhatsApp. Mas cadê esse WhatsApp? Qual o número?".
//
// ⚠️ NÃO ERA FALHA DAS BOAS-VINDAS — a conta de quem relatou recebeu a
// mensagem 7 minutos depois do cadastro. O buraco é que o painel INTEIRO nunca
// dizia o número em lugar nenhum: quem apagou a conversa, trocou de aparelho
// ou simplesmente não achou o chat ficava sem saída.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle, Copy, Check, ExternalLink, BookOpen, Mic, Camera, ChevronRight,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { useAuth } from '@/contexts/AuthContext';
import { SORA_WHATSAPP_EXIBICAO, linkSora } from '@/lib/sora-whatsapp';

const BRAND = '#61D17B';

/** O que a pessoa manda primeiro. Curto e sem jargão. */
const EXEMPLOS = [
  { texto: 'gastei 50 no mercado', dica: 'Um gasto. A Sora categoriza e põe na conta certa.' },
  { texto: 'quanto gastei esse mês?', dica: 'Uma pergunta. Ela responde na hora.' },
  { texto: 'recebi 3000 de salário', dica: 'Uma entrada.' },
  { texto: 'minha agenda', dica: 'Seus compromissos dos próximos 30 dias.' },
];

export default function WhatsappPage() {
  const { perfil } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const vinculado = !!perfil?.phone;

  async function copiarNumero() {
    try {
      await navigator.clipboard.writeText(SORA_WHATSAPP_EXIBICAO.replace(/\s/g, ''));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* sem clipboard: o número está escrito na tela de qualquer jeito */ }
  }

  return (
    <div className="space-y-5">
      <GrowHero
        badge="WhatsApp"
        titulo="A Sora no seu WhatsApp"
        subtitulo="Mande um gasto, uma pergunta ou um áudio. Ela responde na hora."
      />

      {/* ── O BOTÃO ─────────────────────────────────────────────────────────
          É o motivo da aba existir, então vem antes de qualquer explicação. */}
      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5 animate-[slide-up_500ms_ease-out_both]"
           style={{
             background: 'hsl(var(--bg-card) / 0.5)',
             backgroundImage: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)`,
           }}>
        <a
          href={linkSora('Oi, Sora!')}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-xl inline-flex items-center justify-center gap-2
                     text-white text-sm font-bold shadow-lg transition-transform active:scale-[0.99]"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
        >
          <MessageCircle size={18} /> Abrir conversa com a Sora
        </a>

        {/* ⚠️ O NÚMERO ESCRITO, não só o botão. Em computador o link abre o
            WhatsApp Web, que nem todo mundo usa; e quem vai salvar o contato
            na agenda precisa dos dígitos. Era justamente o que faltava. */}
        <button
          type="button"
          onClick={copiarNumero}
          className="w-full mt-2 h-11 rounded-xl border border-border inline-flex items-center
                     justify-center gap-2 text-sm font-semibold text-foreground hover:bg-muted/40
                     transition-colors"
        >
          {copiado ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          <span className="tabular">{SORA_WHATSAPP_EXIBICAO}</span>
          <span className="text-muted-foreground font-normal">
            {copiado ? '· copiado' : '· copiar'}
          </span>
        </button>

        {!vinculado && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            Seu número ainda não está vinculado. A Sora só reconhece quem já
            cadastrou o WhatsApp —{' '}
            <Link href="/configuracoes" className="font-semibold underline">vincule nas configurações</Link>{' '}
            antes de mandar a primeira mensagem.
          </p>
        )}
      </div>

      {/* ── COMO USAR ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5 animate-[slide-up_500ms_ease-out_both]"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '60ms' }}>
        <p className="text-sm font-bold text-foreground">Como falar com ela</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Escreva como você falaria com uma pessoa. Não existe formato certo.
        </p>

        <ul className="mt-4 space-y-2">
          {EXEMPLOS.map((e, i) => (
            <li key={e.texto}
                className="animate-[slide-up_400ms_ease-out_both]"
                style={{ animationDelay: `${80 + i * 40}ms` }}>
              <a
                href={linkSora(e.texto)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60
                           px-3.5 py-3 hover:border-foreground/20 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">“</span>{e.texto}<span className="text-muted-foreground">”</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{e.dica}</p>
                </div>
                <ChevronRight size={15} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-4 border-t border-border/60 grid gap-2.5">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Mic size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
            <span><strong className="text-foreground">Áudio funciona.</strong> Fale o gasto em vez de digitar — ela entende.</span>
          </p>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Camera size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
            <span><strong className="text-foreground">Foto também.</strong> Mande a nota fiscal e ela lança sozinha.</span>
          </p>
        </div>
      </div>

      {/* ── TODOS OS COMANDOS ───────────────────────────────────────────── */}
      <Link
        href="/central-sora"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border/40
                   backdrop-blur-xl p-5 hover:border-foreground/20 transition-colors group
                   animate-[slide-up_500ms_ease-out_both]"
        style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '120ms' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)`, color: BRAND }}>
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Tudo que ela entende</p>
            <p className="text-xs text-muted-foreground">A lista completa de comandos, por assunto.</p>
          </div>
        </div>
        <ExternalLink size={15} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </Link>
    </div>
  );
}
