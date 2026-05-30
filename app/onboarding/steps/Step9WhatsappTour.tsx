'use client';

import { MessageCircle, Mic, Camera, FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

const CANAIS = [
  { icon: MessageCircle, titulo: 'Texto',  desc: '"Gastei 50 no mercado"',           cor: BRAND     },
  { icon: Mic,           titulo: 'Áudio',  desc: 'Grave falando seu gasto',           cor: '#3b82f6' },
  { icon: Camera,        titulo: 'Foto',   desc: 'Tire foto do cupom ou nota',        cor: '#f59e0b' },
  { icon: FileText,      titulo: 'PDF',    desc: 'Envie boletos e notas fiscais',     cor: '#8b5cf6' },
];

export default function Step9WhatsappTour() {
  const { perfil } = useAuth();
  const temPhone = !!perfil?.phone;

  return (
    <>
      {/* Hero celebrativo */}
      <div className="text-center space-y-5 mb-10">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full animate-ping opacity-30"
               style={{ background: BRAND }} />
          <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-glow"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
            <CheckCircle2 size={36} className="text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
            Tudo pronto! 🎉
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md mx-auto">
            {temPhone
              ? 'Seu WhatsApp já está conectado. Agora é só registrar tudo de qualquer lugar — texto, áudio, foto ou PDF.'
              : 'Pra fechar com chave de ouro, conecte o WhatsApp e comece a registrar tudo de qualquer lugar.'}
          </p>
        </div>
      </div>

      {/* WhatsApp vinculado no cadastro — apenas confirma o status */}
      <div className="mb-6 p-5 rounded-2xl border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
               style={{ background: BRAND }}>
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">WhatsApp vinculado ✓</p>
            {temPhone && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{perfil?.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Como usar */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Como você pode enviar
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {CANAIS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.titulo} className="p-4 rounded-2xl border border-border bg-card">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                   style={{ background: `${c.cor}1A` }}>
                <Icon size={16} style={{ color: c.cor }} />
              </div>
              <p className="text-sm font-bold text-foreground">{c.titulo}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{c.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Highlight final */}
      <div className="p-5 rounded-2xl border border-primary/20"
           style={{ background: `linear-gradient(135deg, ${BRAND}10, transparent)` }}>
        <div className="flex items-start gap-3">
          <Sparkles size={18} style={{ color: BRAND }} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">A IA entende sozinha</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Nossa IA interpreta texto, áudio e imagem automaticamente — você só precisa enviar
              do jeito mais cômodo pra você.
            </p>
          </div>
        </div>
      </div>

      <StepNav podeAvancar={true} textoContinuar="Entrar no painel" semPular />
    </>
  );
}
