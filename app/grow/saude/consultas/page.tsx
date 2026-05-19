'use client';
import { CalendarHeart } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function ConsultasPage() {
  return (
    <ComingSoon
      icon={CalendarHeart}
      badge="Consultas"
      titulo="Consultas & Exames"
      subtitulo="Agenda médica, histórico e evolução de exames laboratoriais."
      accentColor="#ec4899"
      features={[
        'Agenda de consultas futuras (médico, dentista, nutricionista, psicólogo)',
        'Lembrete automático no WhatsApp 24h antes da consulta',
        'Histórico de consultas passadas com anotações e prescrições',
        'Registro de exames laboratoriais (glicemia, colesterol, hemoglobina, vitamina D, etc)',
        'Gráfico de evolução por exame ao longo do tempo',
        'Faixas de referência destacadas (verde = ok, vermelho = fora)',
        'Lembrete inteligente de retorno: "seu retorno com a cardiologista é em 3 meses"',
        'Calendário vacinal com lembretes de próximas doses',
      ]}
    />
  );
}
