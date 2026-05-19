'use client';
import { Ruler } from 'lucide-react';
import ComingSoon from '@/components/saude/ComingSoon';

export default function CorpoPage() {
  return (
    <ComingSoon
      icon={Ruler}
      badge="Corpo"
      titulo="Medidas & Composição"
      subtitulo="Cintura, quadril, braço, % gordura, % músculo — e fotos de progresso."
      accentColor="#a78bfa"
      features={[
        'Registro de medidas (cintura, quadril, braço, perna, peito, pescoço) com histórico',
        'Bioimpedância: % gordura e % músculo manualmente registrados',
        'Gráfico de evolução por medida ao longo do tempo',
        'Galeria de fotos de progresso (frente, lado, costas) com comparação antes/depois',
        'Cálculo automático de relação cintura/quadril (RCQ)',
        'Linha do tempo cinematográfica com swipe entre fotos',
        'Privacidade total: fotos visíveis apenas pelo dono da conta',
      ]}
    />
  );
}
