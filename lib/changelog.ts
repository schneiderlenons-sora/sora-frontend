// =============================================================================
// Catálogo de novidades do painel — fonte única da aba "Novidades" em
// /reportar-bug. Editado à mão: ao terminar uma feature nova voltada pro
// usuário, soma uma entrada no FIM desta lista com o próximo número
// (1.1 → 1.2 → ...). Não documentar aqui fix interno/invisível — só o que a
// pessoa percebe usando o app.
// =============================================================================

export type NovidadeEntry = {
  versao: string;   // "1.1", "1.2"...
  data: string;      // 'YYYY-MM-DD'
  titulo: string;
  descricao: string;
};

// Ordem de CRIAÇÃO (mais antiga primeiro) — a tela inverte pra mostrar a mais
// recente no topo.
export const CHANGELOG: NovidadeEntry[] = [
  {
    versao: '1.1',
    data: '2026-09-16',
    titulo: 'Ocultar valores',
    descricao: 'Um botão de "olho" no dashboard e nos relatórios pra esconder os números na hora — útil quando alguém está olhando a tela.',
  },
  {
    versao: '1.2',
    data: '2026-09-17',
    titulo: 'Moeda do grupo',
    descricao: 'Agora dá pra escolher a moeda do seu grupo (real, dólar, coroa norueguesa e outras) — o painel inteiro passa a mostrar saldos, cartões e investimentos na moeda certa.',
  },
  {
    versao: '1.3',
    data: '2026-09-18',
    titulo: 'Importar planilha em Excel',
    descricao: 'Além de CSV, agora dá pra importar suas transações direto de um arquivo .xlsx.',
  },
  {
    versao: '1.4',
    data: '2026-09-18',
    titulo: 'Extrato Futuro mais completo',
    descricao: 'Dívidas e faturas de cartão entraram na projeção do Extrato Futuro, e dá pra "pular" a previsão de um mês numa conta e voltar atrás depois.',
  },
  {
    versao: '1.5',
    data: '2026-09-18',
    titulo: '"Já recebi" e "Já paguei" antes do vencimento',
    descricao: 'Dá pra confirmar um recebimento ou pagamento antes mesmo do dia de vencimento chegar, sem esperar a data virar.',
  },
  {
    versao: '1.6',
    data: '2026-09-21',
    titulo: 'Conciliação bancária de contas previstas',
    descricao: 'Quando uma conta prevista (como aluguel ou internet) é paga por um valor um pouco diferente do esperado — por causa de um reajuste, por exemplo —, a Sora agora reconhece o pagamento e sugere a baixa.',
  },
  {
    versao: '1.7',
    data: '2026-09-21',
    titulo: 'Categorias em ordem alfabética',
    descricao: 'Todos os filtros e listas de categoria do painel agora aparecem em ordem alfabética, pra achar mais rápido.',
  },
];
