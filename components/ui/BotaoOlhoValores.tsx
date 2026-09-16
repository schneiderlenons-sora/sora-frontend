'use client';

// =============================================================================
// O olho que esconde os valores — um só componente pras 8 telas do painel.
//
// Antes cada tela desenhava o próprio botão. Eram quase iguais (btn-ghost +
// Eye/EyeOff), mas divergiam no tamanho do ícone (15 × 16) e — o que importa —
// TRÊS delas não tinham `aria-label`: botão só de ícone sem nome acessível é
// um controle mudo pra leitor de tela.
//
// ⚠️ O ÍCONE MOSTRA O ESTADO, NÃO A AÇÃO — e é fácil inverter sem perceber.
// Olho CORTADO = os valores estão escondidos. Olho ABERTO = estão à vista.
// (A outra leitura, "o ícone mostra o que o clique faz", é a dos campos de
// senha e foi como isto nasceu — errado. Quem olha a tela quer saber em que
// estado ela está; o que o clique faz vem no `title`.)
//
// ⚠️ `aria-pressed` é o que faz a semântica ser de INTERRUPTOR, não de ação.
// Sem ele o leitor de tela anuncia "botão Ocultar valores" e não diz em que
// estado a tela está — a pessoa não tem como saber se já está escondido.
//
// ⚠️ 44px de alvo no mobile (regra do projeto e do HIG). No desktop ele volta
// ao tamanho compacto pra não destoar dos vizinhos no cabeçalho.
// =============================================================================

import { Eye, EyeOff } from 'lucide-react';
import { useValores } from '@/lib/valores-ocultos';

export default function BotaoOlhoValores({ className = '', tamanho = 16 }: {
  className?: string;
  tamanho?: number;
}) {
  const { ocultos, alternar } = useValores();

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={ocultos}
      // ⚠️ RÓTULO FIXO, estado no `aria-pressed`. Rótulo que troca junto
      // ("Mostrar valores" quando está escondido) codifica o estado DUAS vezes
      // e as duas se contradizem no leitor de tela: "Mostrar valores,
      // pressionado" não diz se está à vista ou não.
      aria-label="Ocultar valores"
      // O title é DICA DE AÇÃO — é o que a pessoa ganha ao clicar.
      title={ocultos ? 'Mostrar valores' : 'Ocultar valores'}
      className={`btn-ghost w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-2 text-sm ${className}`}
    >
      {ocultos ? <EyeOff size={tamanho} /> : <Eye size={tamanho} />}
    </button>
  );
}
