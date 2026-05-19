'use client';
import { Apple } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function NutricaoPage() {
  return (
    <ComingSoon
      icon={Apple}
      badge="Nutrição"
      titulo="Nutrição"
      subtitulo="Calculadora de macros, banco de alimentos e diário nutricional inteligente."
      accentColor="#10b981"
      features={[
        'Calculadora nutricional: idade, peso, altura, sexo, atividade e objetivo → metas diárias automáticas',
        'Parser inteligente de refeição: "duas conchas de arroz, peito de frango grelhado" → macros detalhados',
        'Banco com ~500 alimentos brasileiros + Open Food Facts (industrializados) + IA fallback',
        'Histórico de calorias e macros por dia, semana e mês',
        'Diagnóstico em tempo real: "proteína baixa hoje — que tal um ovo?"',
        'Histórico de refeições agrupado por tipo (café, almoço, jantar, lanche)',
        'Foto do prato → IA identifica os alimentos automaticamente (em estudo)',
      ]}
    />
  );
}
