'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Esta conexão não está mais coberta pelo seu plano" — aviso com PRAZO.
//
// Medido em 02/10/2026: 9 contas usando 16 conexões de Open Finance além do que
// o plano cobre. Cinco são vitalícias (franquia zero por decisão: pagou uma vez
// e cada conexão nos custa mensalidade no agregador) e quatro estão `inativo`.
//
// ⚠️ A CAUSA É ESTRUTURAL, não má-fé: a franquia só era checada ao CONECTAR.
// Cancelar a assinatura da conexão avulsa zera `of_conexoes_pagas` e cair pra
// `inativo` zera a franquia — e as conexões seguiam vivas e cobradas, sem nada
// dizer isso em lugar nenhum.
//
// A regra (decisão do dono): avisar e dar 2 dias. O corte é do JOB 1R no
// backend; a decisão de estado/prazo é de `services/excedenteConexoes` (eval +
// mutação). Esta tela só EXIBE o que o servidor já decidiu.
// ─────────────────────────────────────────────────────────────────────────────

import { AlertTriangle, Clock } from 'lucide-react';

export type Cobertura = {
  estado: 'avisando' | 'vencido';
  limite: number;
  usando: number;
  excedente: number;
  prazo: string | null;
  horasRestantes: number | null;
  /** Nomes dos bancos que sairiam, na ordem de corte. */
  aDesligar: string[];
};

/** "2 dias" / "11h" / "menos de 1h" — o prazo como a pessoa pensa nele. */
function prazoLegivel(horas: number | null): string {
  if (horas == null) return '2 dias';
  if (horas <= 0) return 'a qualquer momento';
  if (horas < 1) return 'menos de 1h';
  if (horas < 24) return `${Math.round(horas)}h`;
  const d = Math.floor(horas / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

export default function AvisoCobertura({
  cobertura, onContratar,
}: {
  cobertura: Cobertura;
  /** Rola até o card de contratar conexão avulsa (ele já existe na página). */
  onContratar?: () => void;
}) {
  const { estado, limite, excedente, horasRestantes, aDesligar } = cobertura;
  const vencido = estado === 'vencido';
  const uma = excedente === 1;

  // ⚠️ ÂMBAR enquanto há prazo, VERMELHO quando venceu. São estados diferentes:
  // "resolva isso" × "isso está acontecendo agora". Mesma cor nos dois faria o
  // primeiro aviso parecer tão grave quanto o último — e aí nenhum é lido.
  const cor = vencido
    ? { borda: 'border-red-300 dark:border-red-900/60', fundo: 'bg-red-50 dark:bg-red-950/40', texto: 'text-red-700 dark:text-red-300', icone: 'text-red-600 dark:text-red-400' }
    : { borda: 'border-amber-300 dark:border-amber-900/60', fundo: 'bg-amber-50 dark:bg-amber-950/30', texto: 'text-amber-800 dark:text-amber-200', icone: 'text-amber-600 dark:text-amber-400' };

  return (
    // ⚠️ `role="alert"`, não um aviso silencioso: a pessoa tem 2 dias pra agir e
    // leitor de tela precisa anunciar isso ao abrir a aba.
    <div role="alert" className={`rounded-2xl border ${cor.borda} ${cor.fundo} p-4 space-y-3`}>
      <div className="flex gap-3">
        {/* Ícone + rótulo, nunca cor sozinha (acessibilidade). */}
        <AlertTriangle size={18} className={`flex-shrink-0 mt-0.5 ${cor.icone}`} aria-hidden />
        <div className="space-y-2 min-w-0">
          <p className={`text-sm font-bold ${cor.texto}`}>
            {vencido
              ? (uma ? 'Uma conexão de banco vai ser desligada' : `${excedente} conexões de banco vão ser desligadas`)
              : (uma ? 'Uma conexão de banco não está mais coberta pelo seu plano'
                     : `${excedente} conexões de banco não estão mais cobertas pelo seu plano`)}
          </p>

          <p className="text-xs text-foreground/80 leading-relaxed">
            {/* ⚠️ DIZ O NÚMERO, não "você excedeu". Franquia zero é o caso mais
                comum aqui (vitalício e sem plano), e "seu plano inclui 0" é a
                única frase que explica por que o banco conectado não está
                coberto sem soar como acusação. */}
            {limite === 0
              ? 'Seu plano atual não inclui conexão automática com o banco.'
              : `Seu plano inclui ${limite} ${limite === 1 ? 'conexão' : 'conexões'}, e você tem ${cobertura.usando}.`}
            {' '}
            {vencido
              ? 'O prazo para regularizar terminou.'
              : `Você tem ${prazoLegivel(horasRestantes)} para regularizar.`}
          </p>

          {/* ⚠️ NOMEIA QUAL BANCO SAI. "Uma conexão será desligada" obriga a
              pessoa a adivinhar qual — e a escolher errado ao desconectar.
              A ordem é a mesma que o servidor vai usar. */}
          {aDesligar.length > 0 && (
            <p className="text-xs text-foreground/70">
              {uma ? 'Sairia: ' : 'Sairiam, nesta ordem: '}
              <b className="text-foreground">{aDesligar.join(', ')}</b>
            </p>
          )}

          <p className="text-xs text-foreground/70 leading-relaxed">
            Seu <b className="text-foreground">histórico já importado continua na Sora</b> de
            qualquer forma — o que para é a atualização automática.
          </p>
        </div>
      </div>

      {/* ⚠️ AS DUAS SAÍDAS JUNTAS, nunca uma escondendo a outra: contratar a
          conexão (mantém tudo como está) ou desconectar um banco (não custa
          nada). Esconder a segunda leria como cobrança forçada. */}
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <button
          type="button"
          onClick={onContratar}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #61D17B, #3FA85A)', minHeight: 44 }}
        >
          Manter conectado · R$ 6/mês
        </button>
        <a
          href="/planos"
          className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-foreground transition-all active:scale-[0.98]"
          style={{ minHeight: 44 }}
        >
          Ver planos
        </a>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock size={13} aria-hidden />
          ou desconecte um banco na lista abaixo
        </span>
      </div>
    </div>
  );
}
