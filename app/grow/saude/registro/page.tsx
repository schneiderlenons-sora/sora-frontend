'use client';
import { ClipboardCheck } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function RegistroPage() {
  return (
    <ComingSoon
      icon={ClipboardCheck}
      badge="Registro"
      titulo="Check-ups & Perfil"
      subtitulo="Confirmação diária do que importa e configuração do seu perfil de saúde."
      accentColor="#06b6d4"
      features={[
        'Check-up diário: água OK, atividade física, dieta mantida, sono, meditação',
        'Registro rápido de peso com gráfico de evolução',
        'Configuração do perfil: altura, sexo, data de nascimento, nível de atividade',
        'Definição de objetivo (emagrecer / manter / ganhar massa / definição)',
        'Condições crônicas e alergias (visível pra IA em sugestões)',
        'Progresso de check-ups por semana, mês e ano com filtros',
        'Registro de sintomas (dores, enxaqueca, etc) — cruzamento com humor e alimentação',
      ]}
    />
  );
}
