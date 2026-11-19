'use client';

import { Zap } from 'lucide-react';

const OF_COR = '#6366f1';

/**
 * Passos 6 e 7 de quem escolheu "Conectar meu banco" no passo 5.
 *
 * ⚠️ Antes esses passos mostravam "Adicione contas primeiro · volte ao passo
 * anterior e adicione" — o passo anterior tinha acabado de dizer "você não
 * precisa cadastrar nada aqui" e escondido o formulário. A pessoa lia como
 * travada (relato de nov/2026), embora o Continuar sempre funcionasse.
 * Aqui o passo diz o que acontece e quando, no mesmo visual do passo 5.
 */
export default function DepoisDoBanco({ oque, exemplos }: { oque: string; exemplos: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 animate-fade-in"
         style={{ border: `1px solid color-mix(in srgb, ${OF_COR} 30%, transparent) !important`,
                  background: `color-mix(in srgb, ${OF_COR} 6%, transparent)` }}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${OF_COR} 14%, transparent)` }}>
          <Zap size={17} style={{ color: OF_COR }} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-foreground leading-snug">
            {oque} ficam pra depois de conectar o banco
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Para cadastrar, é preciso ter uma conta, e as do seu banco ainda não chegaram.
            Não precisa voltar: toque em <strong className="text-foreground">Continuar</strong>.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Depois de conectar, você cadastra {exemplos} na aba <strong className="text-foreground">Previstos</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
