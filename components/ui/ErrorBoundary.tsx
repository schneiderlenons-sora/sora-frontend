'use client';

import { Component, type ReactNode } from 'react';

// Error boundary genérico e reutilizável. Isola um trecho da UI: se ele
// crashar, mostra o `fallback` no lugar — sem derrubar a página inteira.
// Usado, por ex., para o gráfico Recharts da página de cartões, que pode
// disparar React #284 em certas condições de layout.
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary] componente isolado falhou:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
