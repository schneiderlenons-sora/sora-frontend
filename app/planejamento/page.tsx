// A tela de planejamento anual virou uma aba dentro de Relatórios, onde ela se
// preenche sozinha a partir do histórico. Esta rota vira um redirecionamento
// em vez de sumir: link salvo, aba antiga aberta e histórico do navegador
// continuam funcionando, e ninguém cai numa versão manual pior que a atual.
//
// O que a pessoa tinha digitado aqui NÃO se perde: a aba nova lê a mesma chave
// de localStorage e importa os 12 meses como ajustes manuais na primeira vez
// que abre (ver `RelatoriosClient`).
import { redirect } from 'next/navigation';

export default function PlanejamentoRedirect() {
  redirect('/relatorios');
}
