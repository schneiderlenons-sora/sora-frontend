'use client';
import { Pill } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function RemediosPage() {
  return (
    <ComingSoon
      icon={Pill}
      badge="Remédios"
      titulo="Medicamentos"
      subtitulo="Lembretes pontuais, controle de estoque e histórico de doses."
      accentColor="#ef4444"
      features={[
        'Cadastro: nome, dosagem, horários, dias da semana, estoque inicial',
        'Lembrete no WhatsApp no horário exato: "💊 Hora de tomar Losartana 50mg"',
        'Confirmação via WhatsApp: "tomei" → Sora marca a dose e abate do estoque',
        'Alerta de estoque baixo: "Faltam 3 comprimidos — hora de comprar"',
        'Histórico completo de doses tomadas / atrasadas / puladas',
        'Receitas médicas com data de validade e alerta de renovação',
        'Visão semanal: aderência ao tratamento em %',
        'Suporte a múltiplos horários por dia (manhã / tarde / noite)',
      ]}
    />
  );
}
