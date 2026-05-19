'use client';
import { Dumbbell } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function TreinosPage() {
  return (
    <ComingSoon
      icon={Dumbbell}
      badge="Treinos"
      titulo="Treinos"
      subtitulo="Registre cada sessão, acompanhe frequência e construa consistência."
      accentColor="#f59e0b"
      features={[
        'Catálogo de modalidades (academia, yoga, jiu-jitsu, crossfit, corrida, ciclismo, boxe, pilates, dança)',
        'Registro rápido: data, duração, intensidade e calorias estimadas',
        'Métricas: hoje · semana · mês · ano · total — com filtro por modalidade',
        'Gráfico semanal de frequência e tempo acumulado',
        'Streak de dias treinados consecutivos',
        'Sugestões da IA quando você fica vários dias sem treinar',
      ]}
    />
  );
}
