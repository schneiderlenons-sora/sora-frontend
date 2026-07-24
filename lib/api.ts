import { supabase } from '@/lib/supabase';
import type { Empresa } from '@/lib/empresas';
import type { Lancamento } from '@/lib/lancamentos';
import type { Funcionario } from '@/lib/funcionarios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Faz chamadas ao backend com tratamento de erro centralizado.
// Autentica com o JWT da sessão do Supabase (Authorization: Bearer) — o
// backend valida e amarra o request ao próprio usuário.
async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;

  let token: string | null = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  } catch { /* sem sessão */ }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (networkErr: any) {
    console.error('[api] Erro de rede:', { url, err: networkErr });
    throw new Error(`Falha de conexão com o servidor (${url}). Verifique se o backend está rodando.`);
  }

  if (!res.ok) {
    const raw = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* não era JSON */ }
    console.error('[api] HTTP', res.status, url, parsed ?? raw);
    const msg =
      parsed?.erro ||
      parsed?.error ||
      parsed?.message ||
      (typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 300) : null) ||
      `Erro ${res.status}`;
    // Anexa status + corpo parseado pro chamador poder tratar casos específicos
    // (ex.: 409 'conta_com_transacoes' abre o modal de mover/excluir).
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return res.json();
}

// Preferências da central de avisos (espelha /api/user/avisos no backend).
export type AvisosPrefs = {
  avisos_ativos: boolean;          // toggle mestre (kill-switch)
  resumo_semanal: boolean;
  resumo_mensal: boolean;
  habito_lembrete_ativo: boolean;  // "checkup de hábitos"
  habito_lembrete_horario: string; // 'HH:MM'
  agenda_briefing_ativo: boolean;  // briefing matinal
  agenda_briefing_horario: string; // 'HH:MM'
  lembretes_ativos: boolean;       // contas/recorrências/parcelas/fatura
  lembretes_dividas: boolean;
};

// ── USUÁRIO ──────────────────────────────────────────────────────
export const api = {
  user: {
    get: (phone: string) =>
      req<any>(`/api/user/${phone}`),
    updatePlan: (body: { phone: string; plano: string; valido_ate?: string }) =>
      req('/api/user/update-plan', { method: 'POST', body: JSON.stringify(body) }),
    /** Dispara mensagem de boas-vindas no WhatsApp (idempotente por user_id). */
    welcome: (body: { user_id: string; phone: string; nome?: string; force?: boolean }) =>
      req<{ enviado: boolean; motivo?: string }>('/api/user/welcome', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** Preferência de resumos proativos (semanal/mensal) no WhatsApp. */
    resumos: {
      get: () => req<{ semanal: boolean; mensal: boolean }>('/api/user/resumos'),
      set: (body: { semanal?: boolean; mensal?: boolean }) =>
        req<{ ok: boolean }>('/api/user/resumos', { method: 'POST', body: JSON.stringify(body) }),
    },
    /** Central de avisos — todas as preferências de notificação da Sora. */
    avisos: {
      get: () => req<AvisosPrefs>('/api/user/avisos'),
      set: (body: Partial<AvisosPrefs>) =>
        req<{ ok: boolean }>('/api/user/avisos', { method: 'POST', body: JSON.stringify(body) }),
    },
    /** Reseta os dados da conta por módulo (sem excluir a conta). */
    resetar: (body: { financas?: boolean; negocios?: boolean; grow?: boolean }) =>
      req<{ ok: boolean; resetado: Record<string, boolean> }>('/api/user/resetar', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // ── RELATAR BUG ───────────────────────────────────────────────
  bug: {
    /** Envia um relato de bug ou sugestão de melhoria (texto + imagem base64 opcional) pro suporte. */
    reportar: (body: { mensagem: string; imagem?: string; tipo?: 'problema' | 'melhoria' }) =>
      req<{ ok: boolean; id?: string }>('/api/bug', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // ── OPEN FINANCE (Pluggy) ─────────────────────────────────────
  pluggy: {
    /** Gera o connect token pro widget Pluggy Connect. itemId = reconectar. */
    connectToken: (itemId?: string) =>
      req<{ connectToken: string }>('/api/pluggy/connect-token', { method: 'POST', body: JSON.stringify({ itemId }) }),
    /** Registra a conexão criada no widget e dispara a sincronização. */
    registrarItem: (itemId: string, connectorNome?: string) =>
      req<{ ok: boolean }>('/api/pluggy/item', { method: 'POST', body: JSON.stringify({ itemId, connectorNome }) }),
    /** Lista as conexões (bancos) do grupo. */
    conexoes: () =>
      req<{ conexoes: any[] }>('/api/pluggy/connections'),
    /** Diagnóstico: cartões (final mascarado) nas transações de crédito. */
    debugCartoes: () =>
      req<{ contas: { conta: string; total: number; cartoes: { numero: string; qtd: number }[]; sem_identificacao: number }[] }>(`/api/pluggy/debug-cartoes`),
    /** Re-sincroniza uma conexão sob demanda. Retorna diagnóstico. */
    sincronizar: (itemId: string) =>
      req<{ ok: boolean; novas?: number; statusPluggy?: string; erro?: string;
            contas?: { tipo: string; nome?: string; txs?: number; novas?: number; erro?: string }[] }>(
        `/api/pluggy/connections/${itemId}/sync`, { method: 'POST' }),
    /** Desconecta um banco (mantém o histórico). */
    desconectar: (itemId: string) =>
      req<{ ok: boolean }>(`/api/pluggy/connections/${itemId}`, { method: 'DELETE' }),
  },

  // ── OPEN FINANCE (Polp) ───────────────────────────────────────
  // Fluxo de REDIRECT: lista bancos → cria integração → abre url_to_authenticate
  // → usuário autoriza → webhook/sincronizar importa.
  openFinance: {
    instituicoes: () =>
      req<{ instituicoes: any[] }>('/api/open-finance/instituicoes'),
    conectar: (body: { institution_id: number | string; cpf?: string; cnpj?: string; instituicao_nome?: string }) =>
      req<{ ok: boolean; externalId: string; status?: string; urlToAuthenticate?: string | null }>(
        '/api/open-finance/conectar', { method: 'POST', body: JSON.stringify(body) }),
    conexoes: () =>
      req<{ conexoes: any[] }>('/api/open-finance/conexoes'),
    sincronizar: (externalId: string) =>
      req<{ ok: boolean; novas?: number; erro?: string; pendente?: string; urlToAuthenticate?: string | null; contas?: any[] }>(
        `/api/open-finance/conexoes/${externalId}/sincronizar`, { method: 'POST' }),
    /** URL de autorização atual (conexão pendente de aprovação no banco). */
    autorizar: (externalId: string) =>
      req<{ urlToAuthenticate?: string | null; status?: string | null }>(
        `/api/open-finance/conexoes/${externalId}/autorizar`),
    desconectar: (externalId: string) =>
      req<{ ok: boolean }>(`/api/open-finance/conexoes/${externalId}`, { method: 'DELETE' }),
    /** Diagnóstico (temporário): resposta crua da Polp pra ajustar o mapeamento. */
    debug: (externalId: string) =>
      req<any>(`/api/open-finance/debug/${externalId}`),
  },

  // ── DASHBOARD (consolidado) ───────────────────────────────────
  // Junta resumo (mês + mês anterior), carteiras, transações recentes,
  // gastos do mês e categorias numa única chamada. O painel tem fallback
  // pras chamadas individuais caso este endpoint falhe.
  dashboard: {
    get: (phone: string, mes: string, mesAnt: string) =>
      req<any>(`/api/dashboard/${phone}?mes=${mes}&mesAnt=${mesAnt}`),
  },

  // ── TRANSAÇÕES ────────────────────────────────────────────────
  transacoes: {
    listar: (phone: string, params?: { mes?: string; tipo?: string; categoria?: string; limit?: number; offset?: number; criado_por?: string; criado_por_me?: boolean; criado_por_phone?: string; ate?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return req<{ transacoes: any[]; total: number }>(`/api/transacoes/${phone}${q ? `?${q}` : ''}`);
    },
    resumo: (phone: string, mes?: string, opts?: { criado_por_me?: boolean; criado_por?: string }) => {
      const params = new URLSearchParams();
      if (mes) params.set('mes', mes);
      if (opts?.criado_por) params.set('criado_por', opts.criado_por);
      else if (opts?.criado_por_me) params.set('criado_por_me', 'true');
      const q = params.toString();
      return req<any>(`/api/transacoes/${phone}/resumo${q ? `?${q}` : ''}`);
    },
    criar: (body: any) =>
      req('/api/transacoes', { method: 'POST', body: JSON.stringify(body) }),
    // Compra parcelada no cartão: valor_parcela × num_parcelas (uma tx por mês).
    criarParcelado: (body: {
      phone: string; categoria: string; observacao?: string; carteira_nome: string;
      valor_parcela: number; num_parcelas: number; data: string; pagas: number[];
    }) => req<{ ok: boolean; parcela_grupo: string; criadas: number }>(
      '/api/transacoes/parcelado', { method: 'POST', body: JSON.stringify(body) }),
    criarBulk: (body: { phone: string; transacoes: any[] }) =>
      req<{ inserted: number }>('/api/transacoes/bulk', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req(`/api/transacoes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    // opts.parcelas='todas' → exclui a compra parcelada inteira (todas as parcelas).
    deletar: (id: string, phone?: string, opts?: { parcelas?: 'todas' }) => {
      const qs = new URLSearchParams();
      if (phone) qs.set('phone', phone);
      if (opts?.parcelas) qs.set('parcelas', opts.parcelas);
      const q = qs.toString();
      return req(`/api/transacoes/${id}${q ? `?${q}` : ''}`, { method: 'DELETE' });
    },
    anteciparCartao: (body: { phone: string; ids: string[]; conta_nome: string }) =>
      req<{ ok: boolean; debitado: number; conta?: string }>('/api/transacoes/antecipar-cartao', { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────
  wallets: {
    listar: (phone: string) =>
      req<any[]>(`/api/wallets/${phone}`),
    salvar: (body: any) =>
      req('/api/wallets', { method: 'POST', body: JSON.stringify(body) }),
    // Exclui a conta. Se tiver transações e nenhuma ação, o backend responde
    // 409 { motivo:'conta_com_transacoes', count } pro painel perguntar.
    deletar: (id: string, opts?: { transacoes?: 'mover' | 'excluir'; destino?: string }) => {
      const qs = new URLSearchParams();
      if (opts?.transacoes) qs.set('transacoes', opts.transacoes);
      if (opts?.destino) qs.set('destino', opts.destino);
      const q = qs.toString();
      return req<{ ok: boolean; movidas?: number; excluidas?: number }>(
        `/api/wallets/${id}${q ? `?${q}` : ''}`, { method: 'DELETE' });
    },
    // Paga a fatura do cartão debitando de uma conta (cria a transação de saída)
    pagarFatura: (body: { phone: string; cartao_id: string; wallet_id: string; valor: number }) =>
      req<{ ok: boolean; debito: any }>('/api/wallets/fatura/pagar', { method: 'POST', body: JSON.stringify(body) }),
    // Transfere valor entre duas contas (ajusta saldos + grava registro)
    transferir: (body: { phone: string; origem_id: string; destino_id: string; valor: number }) =>
      req<{ ok: boolean; tx: any }>('/api/wallets/transferir', { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── CATEGORIAS ────────────────────────────────────────────────
  categorias: {
    listar: (phone: string, tipo?: 'despesa' | 'receita') =>
      req<any[]>(`/api/categorias/${phone}${tipo ? `?tipo=${tipo}` : ''}`),
    criar: (body: any) =>
      req('/api/categorias', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req(`/api/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/categorias/${id}`, { method: 'DELETE' }),
    restaurarPadrao: (phone: string) =>
      req<{ ok: boolean; total: number }>(`/api/categorias/restaurar-padrao/${phone}`, { method: 'POST' }),
  },

  // ── MARCAS PERSONALIZADAS (logo de loja custom, casa por nome) ──
  marcas: {
    listar: (phone: string) =>
      req<{ id: string; termo: string; logo_url: string }[]>(`/api/marcas/${phone}`),
    criar: (body: { phone: string; termo: string; logo_url: string }) =>
      req<{ id: string; termo: string; logo_url: string }>('/api/marcas', { method: 'POST', body: JSON.stringify(body) }),
    remover: (id: string, phone: string) =>
      req(`/api/marcas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
  },

  // ── RECORRÊNCIAS (gastos/receitas fixas) ─────────────────────
  recorrencias: {
    listar: (phone: string) =>
      req<any[]>(`/api/recorrencias/${phone}`),
    /** Gastos/receitas fixas detectados nas transações (Open Finance/OFX). */
    sugestoes: () =>
      req<{ sugestoes: { descricao: string; valor: number; dia: number; tipo: 'Gasto' | 'Recebimento'; categoria: string; ocorrencias: number; meses: number }[] }>(`/api/recorrencias/sugestoes`),
    /** Dispensa uma sugestão de gasto fixo (não volta a aparecer). */
    dispensarSugestao: (descricao: string) =>
      req<{ ok: boolean }>('/api/recorrencias/dispensar', { method: 'POST', body: JSON.stringify({ descricao }) }),
    criar: (body: { phone: string; tipo: 'Gasto' | 'Recebimento'; descricao: string; valor: number; dia_vencimento: number; carteira?: string; categoria?: string; valor_variavel?: boolean }) =>
      req<any>('/api/recorrencias', { method: 'POST', body: JSON.stringify(body) }),
    cancelar: (id: string, phone: string) =>
      req(`/api/recorrencias/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
  },

  // ── LIMITES ───────────────────────────────────────────────────
  limites: {
    listar: (phone: string, mes?: string) =>
      req<any>(`/api/limites/${phone}${mes ? `?mes=${mes}` : ''}`),
    setGeral: (body: { phone: string; valor: number; ativo?: boolean; alerta_ativo?: boolean; alerta_pct?: number }) =>
      req('/api/limites/geral', { method: 'POST', body: JSON.stringify(body) }),
    setCategoria: (body: any) =>
      req('/api/limites/categoria', { method: 'POST', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/limites/${id}`, { method: 'DELETE' }),
  },

  // ── GRUPOS ────────────────────────────────────────────────────
  grupos: {
    listar: (phone: string) =>
      req<any[]>(`/api/grupos/${phone}`),
    convidar: (phone: string, grupo_id: string) =>
      req<{ codigo: string }>('/api/grupos/convidar', { method: 'POST', body: JSON.stringify({ phone, grupo_id }) }),
    aceitar: (phone: string, codigo: string) =>
      req('/api/grupos/aceitar', { method: 'POST', body: JSON.stringify({ phone, codigo }) }),
    trocar: (phone: string, grupo_id: string) =>
      req('/api/grupos/trocar', { method: 'POST', body: JSON.stringify({ phone, grupo_id }) }),
    criar: (body: { phone: string; nome: string; emoji?: string; copiar_dados?: boolean }) =>
      req<{ ok: boolean; grupo: any }>('/api/grupos/criar', { method: 'POST', body: JSON.stringify(body) }),
    editarGrupo: (grupo_id: string, body: { nome?: string; emoji?: string }) =>
      req<{ id: string; nome: string; emoji?: string }>(`/api/grupos/${grupo_id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    sair: (grupo_id: string, phone: string) =>
      req(`/api/grupos/sair/${grupo_id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    atualizarMembro: (membro_id: string, body: { phone: string; papel: 'admin' | 'escrita' | 'leitura' }) =>
      req(`/api/grupos/membro/${membro_id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    removerMembro: (membro_id: string, phone: string) =>
      req(`/api/grupos/membro/${membro_id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    membros: (grupo_id: string) =>
      req<any[]>(`/api/grupos/${grupo_id}/membros`),
    stats: (grupo_id: string) =>
      req<any>(`/api/grupos/${grupo_id}/stats`),
  },

  // ── INVESTIMENTOS (plano Black) ───────────────────────────────
  investimentos: {
    listar: (phone: string) =>
      req<any[]>(`/api/investimentos/${phone}`),
    distribuicao: (phone: string) =>
      req<any>(`/api/investimentos/${phone}/distribuicao`),
    patrimonio: (phone: string) =>
      req<any[]>(`/api/investimentos/${phone}/patrimonio`),
    criar: (body: any) =>
      req('/api/investimentos', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req(`/api/investimentos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/investimentos/${id}`, { method: 'DELETE' }),
    buscarTicker: (q: string) =>
      req<any[]>(`/api/investimentos/buscar-ticker?q=${encodeURIComponent(q)}`),
    buscarCripto: (q: string) =>
      req<any[]>(`/api/investimentos/buscar-cripto?q=${encodeURIComponent(q)}`),
    /** Cotação atual JÁ em reais (converte USD→BRL etc.). */
    cotacao: (ticker: string, tipo: 'acao' | 'cripto') =>
      req<{ precoBRL?: number; moeda?: string; precoOriginal?: number; moedaOriginal?: string; taxa?: number; variacaoDia?: number }>(
        `/api/investimentos/cotacao?ticker=${encodeURIComponent(ticker)}&tipo=${tipo}`),
    atualizarPrecos: (phone: string) =>
      req<{ atualizados: number; total: number }>(`/api/investimentos/atualizar-precos/${phone}`, { method: 'POST' }),
    reserva: (phone: string) =>
      req<any>(`/api/investimentos/reserva/${phone}`),
    atualizarReserva: (phone: string, body: { meses_objetivo: number }) =>
      req(`/api/investimentos/reserva/${phone}`, { method: 'POST', body: JSON.stringify(body) }),

    aportes: {
      listar: (phone: string) =>
        req<any[]>(`/api/investimentos/${phone}/aportes`),
      criar: (body: any) =>
        req('/api/investimentos/aportes', { method: 'POST', body: JSON.stringify(body) }),
    },

    metas: {
      listar: (phone: string) =>
        req<any[]>(`/api/investimentos/${phone}/metas`),
      criar: (body: any) =>
        req('/api/investimentos/metas', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string) =>
        req(`/api/investimentos/metas/${id}`, { method: 'DELETE' }),
    },
  },

  // ── DÍVIDAS (empréstimos, financiamentos, crediário) ─────────
  dividas: {
    listar: (phone: string) =>
      req<{ dividas: any[]; resumo: any }>(`/api/dividas/${phone}`),
    criar: (body: { phone: string; titulo: string; tipo: string; valor_total: number; valor_parcela?: number; parcelas_total?: number; parcelas_pagas?: number; credor?: string; taxa_juros?: number; indexador?: string; dia_vencimento?: number; data_inicio?: string; observacao?: string }) =>
      req<any>('/api/dividas', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req<any>(`/api/dividas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string, phone: string) =>
      req(`/api/dividas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    pagar: (id: string, body: { phone: string; valor: number; tipo?: string; data_pagamento?: string; observacao?: string; numero_parcela?: number; wallet_id?: string | null }) =>
      req<{ divida: any; quitada: boolean; debito?: any }>(`/api/dividas/${id}/pagar`, { method: 'POST', body: JSON.stringify(body) }),
    quitar: (id: string, body: { phone: string; valor?: number; data_pagamento?: string; observacao?: string; wallet_id?: string | null }) =>
      req<{ divida: any; quitada: boolean; debito?: any }>(`/api/dividas/${id}/quitar`, { method: 'POST', body: JSON.stringify(body) }),
    pagamentos: (id: string) =>
      req<any[]>(`/api/dividas/${id}/pagamentos`),
    toggleLembrete: (id: string, body: { phone: string; ativo: boolean }) =>
      req<any>(`/api/dividas/${id}/lembrete`, { method: 'PATCH', body: JSON.stringify(body) }),
    toggleLembretesGlobal: (phone: string, ativo: boolean) =>
      req<{ phone: string; lembretes_dividas: boolean }>(`/api/dividas/lembretes/${phone}`, { method: 'PATCH', body: JSON.stringify({ ativo }) }),
  },

  // ── DADOS PESSOAIS (aba privada do Grow, com PIN) ─────
  dados: {
    pin: {
      status:    (phone: string) => req<{ definido: boolean; travadoAte: string | null }>(`/api/dados/pin/status/${phone}`),
      definir:   (body: { phone: string; pinAtual?: string; pinNovo: string }) => req<{ ok: boolean }>('/api/dados/pin/definir', { method: 'POST', body: JSON.stringify(body) }),
      verificar: (body: { phone: string; pin: string }) => req<{ ok: boolean; restantes?: number; travadoAte?: string | null }>('/api/dados/pin/verificar', { method: 'POST', body: JSON.stringify(body) }),
      remover:   (body: { phone: string; pin: string }) => req<{ ok: boolean }>('/api/dados/pin/remover', { method: 'POST', body: JSON.stringify(body) }),
      resetar:   (body: { phone: string; pinNovo: string }) => req<{ ok: boolean }>('/api/dados/pin/resetar', { method: 'POST', body: JSON.stringify(body) }),
    },
    quadros: {
      listar:  (phone: string) => req<any[]>(`/api/dados/dados_quadros/${phone}`),
      criar:   (body: any) => req<any>('/api/dados/dados_quadros', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/dados/dados_quadros/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/dados/dados_quadros/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    secoes: {
      listar:      (phone: string, quadro_id: string) => req<any[]>(`/api/dados/dados_secoes/${phone}?quadro_id=${quadro_id}`),
      listarTodas: (phone: string) => req<any[]>(`/api/dados/dados_secoes/${phone}`),
      criar:   (body: any) => req<any>('/api/dados/dados_secoes', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/dados/dados_secoes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/dados/dados_secoes/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    itens: {
      listar:  (phone: string, secao_id: string) => req<any[]>(`/api/dados/dados_itens/${phone}?secao_id=${secao_id}`),
      criar:   (body: any) => req<any>('/api/dados/dados_itens', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/dados/dados_itens/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/dados/dados_itens/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    arquivo: {
      uploadUrl:   (body: { phone: string; filename: string }) => req<{ path: string; token: string; nome: string }>('/api/dados/upload-url', { method: 'POST', body: JSON.stringify(body) }),
      downloadUrl: (body: { phone: string; path: string }) => req<{ url: string }>('/api/dados/download-url', { method: 'POST', body: JSON.stringify(body) }),
      todos:       (phone: string) => req<any[]>(`/api/dados/arquivos/${phone}`),
    },
  },

  // ── GROW (segundo painel: hábitos, tarefas, humor, casa) ─────
  grow: {
    status: (phone: string) =>
      req<{ temAcesso: boolean; plano: string; planoGrow: string; painelAtivo: 'finance' | 'grow'; trial: { ativo: boolean; diasRestantes: number; inicio: string | null; fim: string | null } }>(`/api/grow/status/${phone}`),
    ativarTrial: (phone: string) =>
      req<{ ok: boolean; fim: string; diasRestantes: number }>(`/api/grow/ativar-trial/${phone}`, { method: 'POST' }),
    trocarPainel: (phone: string, painel: 'finance' | 'grow') =>
      req<{ ok: boolean; painelAtivo: 'finance' | 'grow' }>(`/api/grow/trocar-painel/${phone}`, { method: 'POST', body: JSON.stringify({ painel }) }),

    // ── Compartilhamento por aba (Casa + Coleções), por grupo ──
    shareConfig: {
      get: (phone: string) =>
        req<{ config: { casa: boolean; viagens: boolean; midia: boolean; leituras: boolean }; totalMembros: number; isAdmin: boolean }>(`/api/grow/share-config/${phone}`),
      set: (phone: string, aba: 'casa' | 'viagens' | 'midia' | 'leituras', valor: boolean) =>
        req<{ ok: boolean; config: { casa: boolean; viagens: boolean; midia: boolean; leituras: boolean } }>('/api/grow/share-config', { method: 'POST', body: JSON.stringify({ phone, aba, valor }) }),
    },

    // ── Coleções (Viagens, Bucket list, Mídia, Leituras) ──
    viagens: {
      listar:  (phone: string) => req<any[]>(`/api/grow/viagens/${phone}`),
      criar:   (body: any) => req<any>('/api/grow/viagens', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/grow/viagens/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/grow/viagens/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    bucketList: {
      listar:  (phone: string) => req<any[]>(`/api/grow/bucket_list/${phone}`),
      criar:   (body: any) => req<any>('/api/grow/bucket_list', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/grow/bucket_list/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/grow/bucket_list/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    midia: {
      listar:  (phone: string) => req<any[]>(`/api/grow/midia/${phone}`),
      criar:   (body: any) => req<any>('/api/grow/midia', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/grow/midia/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/grow/midia/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    leituras: {
      listar:  (phone: string) => req<any[]>(`/api/grow/leituras/${phone}`),
      criar:   (body: any) => req<any>('/api/grow/leituras', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/grow/leituras/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/grow/leituras/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    // Planejamento semanal (rotina) — blocos dia × horário, sem check-in.
    // `de`/`ate` delimitam os blocos PONTUAIS (vindos da Agenda); o template
    // (que repete toda semana) vem sempre.
    rotina: {
      listar: (phone: string, params?: { de?: string; ate?: string }) => {
        const q = new URLSearchParams();
        if (params?.de)  q.set('de', params.de);
        if (params?.ate) q.set('ate', params.ate);
        const qs = q.toString();
        return req<any[]>(`/api/grow/rotina/${phone}${qs ? `?${qs}` : ''}`);
      },
      /** `dias_semana` cria o mesmo bloco em vários dias de uma vez ("colar em todos"). */
      criar: (body: { phone: string; dia_semana?: number; dias_semana?: number[]; hora: string; titulo: string; cor?: string | null; data_especifica?: string | null }) =>
        req<any[]>('/api/grow/rotina', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: { phone: string; titulo?: string; hora?: string; cor?: string | null; dia_semana?: number }) =>
        req<any>(`/api/grow/rotina/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/rotina/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    habitos: {
      listar: (phone: string, params?: { dias?: number; incluir_arquivados?: boolean }) => {
        const q = new URLSearchParams();
        if (params?.dias) q.set('dias', String(params.dias));
        if (params?.incluir_arquivados) q.set('incluir_arquivados', 'true');
        const qs = q.toString();
        return req<{ habitos: any[]; registros: any[]; lembrete?: { ativo: boolean; horario: string | null } }>(`/api/grow/habitos/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar: (body: { phone: string; nome: string; descricao?: string; icone?: string; cor?: string; frequencia?: string; dias_semana?: number[]; horario_lembrete?: string | null; motivo?: string; tipo?: 'construir'|'eliminar'; ordem?: number; treino_id?: string; treino_duracao_padrao?: number | null }) =>
        req<any>('/api/grow/habitos', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: any) =>
        req<any>(`/api/grow/habitos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/habitos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      toggle: (id: string, body: { phone: string; data?: string }) =>
        req<any>(`/api/grow/habitos/${id}/toggle`, { method: 'POST', body: JSON.stringify(body) }),
      reordenar: (phone: string, ordens: Array<{ id: string; ordem: number }>) =>
        req<{ ok: boolean }>(`/api/grow/habitos/reordenar`, { method: 'POST', body: JSON.stringify({ phone, ordens }) }),
      lembrete: (phone: string, body: { ativo: boolean; horario?: string | null }) =>
        req<{ ok: boolean; lembrete: { ativo: boolean; horario: string | null } }>(`/api/grow/habitos/lembrete`, { method: 'POST', body: JSON.stringify({ phone, ...body }) }),
    },

    tarefas: {
      listar: (phone: string, params?: { concluida?: boolean; projeto_id?: string; prioridade?: string }) => {
        const q = new URLSearchParams();
        if (params?.concluida !== undefined) q.set('concluida', String(params.concluida));
        if (params?.projeto_id) q.set('projeto_id', params.projeto_id);
        if (params?.prioridade) q.set('prioridade', params.prioridade);
        const qs = q.toString();
        return req<any[]>(`/api/grow/tarefas/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar: (body: { phone: string; titulo: string; descricao?: string; prioridade?: string; data_vencimento?: string | null; projeto_id?: string | null; tags?: string[]; status_kanban?: string }) =>
        req<any>('/api/grow/tarefas', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: any) =>
        req<any>(`/api/grow/tarefas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/tarefas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    projetos: {
      listar: (phone: string) =>
        req<any[]>(`/api/grow/projetos/${phone}`),
      criar: (body: { phone: string; nome: string; descricao?: string; cor?: string; icone?: string; data_prazo?: string | null }) =>
        req<any>('/api/grow/projetos', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/projetos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    humor: {
      listar: (phone: string, dias?: number) =>
        req<any[]>(`/api/grow/humor/${phone}?dias=${dias || 30}`),
      registrar: (body: { phone: string; humor: number; nota?: string; gratidao?: string[]; energia?: number; sono_horas?: number; data?: string }) =>
        req<any>('/api/grow/humor', { method: 'POST', body: JSON.stringify(body) }),
    },

    compras: {
      listar: (phone: string) =>
        req<{ lista_id: string; itens: any[] }>(`/api/grow/lista-compras/${phone}`),
      adicionar: (body: { phone: string; nome: string; quantidade?: string; unidade?: string; categoria?: string; preco_estimado?: number }) =>
        req<any>('/api/grow/lista-compras/item', { method: 'POST', body: JSON.stringify(body) }),
      atualizar: (id: string, body: { phone: string; comprado?: boolean; nome?: string; quantidade?: string; categoria?: string }) =>
        req<any>(`/api/grow/lista-compras/item/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/lista-compras/item/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      limpar: (phone: string) =>
        req(`/api/grow/lista-compras/limpar`, { method: 'POST', body: JSON.stringify({ phone }) }),
      enviarWhatsapp: (phone: string, destinatarios?: string[]) =>
        req<{ ok: boolean; enviados: number; destinatarios?: number }>(`/api/grow/lista-compras/enviar`, { method: 'POST', body: JSON.stringify({ phone, destinatarios }) }),
    },
    despensa: {
      listar: (phone: string) =>
        req<{ itens: any[] }>(`/api/grow/despensa/${phone}`),
      adicionar: (body: { phone: string; nome: string; categoria?: string; status?: 'tem'|'acabando'|'acabou'; quantidade_ideal?: string; unidade?: string }) =>
        req<any>('/api/grow/despensa', { method: 'POST', body: JSON.stringify(body) }),
      atualizar: (id: string, body: { phone: string; nome?: string; categoria?: string; status?: 'tem'|'acabando'|'acabou'; quantidade_ideal?: string; unidade?: string }) =>
        req<any>(`/api/grow/despensa/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/despensa/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    manutencoes: {
      listar: (phone: string) =>
        req<{ itens: any[] }>(`/api/grow/manutencoes/${phone}`),
      adicionar: (body: { phone: string; nome: string; icone?: string; frequencia_dias: number; ultima_data?: string | null; observacao?: string; lembrete_ativo?: boolean }) =>
        req<any>('/api/grow/manutencoes', { method: 'POST', body: JSON.stringify(body) }),
      atualizar: (id: string, body: { phone: string; nome?: string; icone?: string; frequencia_dias?: number; ultima_data?: string | null; observacao?: string; lembrete_ativo?: boolean }) =>
        req<any>(`/api/grow/manutencoes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      feito: (id: string, phone: string, data?: string) =>
        req<any>(`/api/grow/manutencoes/${id}/feito`, { method: 'POST', body: JSON.stringify({ phone, data }) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/manutencoes/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    receitas: {
      listar: (phone: string) =>
        req<{ itens: any[] }>(`/api/grow/receitas/${phone}`),
      adicionar: (body: { phone: string; nome: string; icone?: string; porcoes?: number | null; tempo_min?: number | null; modo_preparo?: string; ingredientes?: { nome: string; quantidade?: string; categoria?: string }[] }) =>
        req<any>('/api/grow/receitas', { method: 'POST', body: JSON.stringify(body) }),
      atualizar: (id: string, body: { phone: string; nome?: string; icone?: string; porcoes?: number | null; tempo_min?: number | null; modo_preparo?: string; ingredientes?: { nome: string; quantidade?: string; categoria?: string }[] }) =>
        req<any>(`/api/grow/receitas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      cozinhar: (id: string, phone: string) =>
        req<{ ok: boolean; receita: string; adicionados: string[]; jaTem: string[] }>(`/api/grow/receitas/${id}/cozinhar`, { method: 'POST', body: JSON.stringify({ phone }) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/receitas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
    compromissos: {
      listar: (phone: string, range?: { de?: string; ate?: string }) => {
        const qs = new URLSearchParams();
        if (range?.de)  qs.set('de', range.de);
        if (range?.ate) qs.set('ate', range.ate);
        const q = qs.toString();
        return req<{ itens: any[] }>(`/api/grow/compromissos/${phone}${q ? `?${q}` : ''}`);
      },
      adicionar: (body: { phone: string; titulo: string; descricao?: string; data: string; hora?: string | null; local?: string; categoria?: string; cor?: string; lembrete_ativo?: boolean; lembrete_antecedencia?: number }) =>
        req<any>('/api/grow/compromissos', { method: 'POST', body: JSON.stringify(body) }),
      atualizar: (id: string, body: { phone: string; titulo?: string; descricao?: string; data?: string; hora?: string | null; local?: string; categoria?: string; cor?: string; lembrete_ativo?: boolean; lembrete_antecedencia?: number }) =>
        req<any>(`/api/grow/compromissos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/compromissos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      // Fase 2 — feed unificado: compromissos + consultas + finanças + casa
      feed: (phone: string, range?: { de?: string; ate?: string }) => {
        const qs = new URLSearchParams();
        if (range?.de)  qs.set('de', range.de);
        if (range?.ate) qs.set('ate', range.ate);
        const q = qs.toString();
        return req<{ eventos: any[] }>(`/api/grow/agenda/feed/${phone}${q ? `?${q}` : ''}`);
      },
      // Fase 3 — briefing matinal (opt-in)
      briefing: {
        get: (phone: string) => req<{ ativo: boolean; horario: string }>(`/api/grow/agenda/briefing/${phone}`),
        salvar: (body: { phone: string; ativo?: boolean; horario?: string }) =>
          req<{ ok: boolean }>('/api/grow/agenda/briefing', { method: 'POST', body: JSON.stringify(body) }),
      },
    },
  },

  // ── SAÚDE & CORPO (sub-aba do Sora Grow) ─────────────────────
  saude: {
    dashboard: (phone: string) => req<any>(`/api/saude/dashboard/${phone}`),

    perfil: {
      get:    (phone: string) => req<any>(`/api/saude/perfil/${phone}`),
      salvar: (phone: string, body: any) => req<any>(`/api/saude/perfil/${phone}`, { method: 'PUT', body: JSON.stringify({ ...body, phone }) }),
    },

    pesos: {
      listar:  (phone: string, dias?: number) => req<any[]>(`/api/saude/pesos/${phone}${dias ? `?dias=${dias}` : ''}`),
      criar:   (body: { phone: string; peso_kg: number; data?: string; observacao?: string }) =>
        req<any>('/api/saude/pesos', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/saude/pesos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    agua: {
      listar:   (phone: string, dias?: number) => req<any[]>(`/api/saude/agua/${phone}${dias ? `?dias=${dias}` : ''}`),
      registrar:(body: { phone: string; ml: number; data?: string }) =>
        req<any>('/api/saude/agua', { method: 'POST', body: JSON.stringify(body) }),
      deletar:  (id: string, phone: string) =>
        req(`/api/saude/agua/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    metas: {
      get:    (phone: string) => req<any>(`/api/saude/metas/${phone}`),
      salvar: (phone: string, body: any) => req<any>(`/api/saude/metas/${phone}`, { method: 'PUT', body: JSON.stringify({ ...body, phone }) }),
    },

    refeicoes: {
      listar:  (phone: string, dias?: number) => req<any[]>(`/api/saude/refeicoes/${phone}${dias ? `?dias=${dias}` : ''}`),
      criar:   (body: any) => req<any>('/api/saude/refeicoes', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/saude/refeicoes/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    nutricao: {
      buscarAlimentos: (phone: string, q?: string) =>
        req<any[]>(`/api/saude/nutricao/alimentos?phone=${phone}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
      analisar:    (body: { phone: string; texto: string }) =>
        req<{ itens: any[] }>('/api/saude/nutricao/analisar', { method: 'POST', body: JSON.stringify(body) }),
      calcular:    (body: { phone: string; peso_kg: number; altura_cm: number; idade: number; sexo: 'M'|'F'|'outro'; nivel_atividade: string; objetivo: string; tipo_dieta?: string; salvar?: boolean }) =>
        req<any>('/api/saude/nutricao/calcular', { method: 'POST', body: JSON.stringify(body) }),
      diagnostico: (phone: string) =>
        req<{ macros_hoje: any; meta: any; diagnostico: any[] }>(`/api/saude/nutricao/diagnostico/${phone}`),
    },

    treinos: {
      catalogo:    (phone: string) => req<any[]>(`/api/saude/treinos/${phone}`),
      criar:       (body: any)     => req<any>('/api/saude/treinos', { method: 'POST', body: JSON.stringify(body) }),
      deletar:     (id: string, phone: string) =>
        req(`/api/saude/treinos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      registros:   (phone: string, dias?: number) =>
        req<any[]>(`/api/saude/treino-registros/${phone}${dias ? `?dias=${dias}` : ''}`),
      registrar:   (body: any) => req<any>('/api/saude/treino-registros', { method: 'POST', body: JSON.stringify(body) }),
      deletarReg:  (id: string, phone: string) =>
        req(`/api/saude/treino-registros/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    consultas: {
      listar:  (phone: string, status?: string) =>
        req<any[]>(`/api/saude/consultas/${phone}${status ? `?status=${status}` : ''}`),
      criar:   (body: any) => req<any>('/api/saude/consultas', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/saude/consultas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/saude/consultas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    exames: {
      listar:  (phone: string, nome?: string) =>
        req<any[]>(`/api/saude/exames/${phone}${nome ? `?nome=${encodeURIComponent(nome)}` : ''}`),
      criar:   (body: any) => req<any>('/api/saude/exames', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/saude/exames/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    medicamentos: {
      listar:  (phone: string) => req<any[]>(`/api/saude/medicamentos/${phone}`),
      criar:   (body: any) => req<any>('/api/saude/medicamentos', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/saude/medicamentos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/saude/medicamentos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      tomar:   (id: string, body: { phone: string; datetime_planejado?: string; horario?: string }) =>
        req<any>(`/api/saude/medicamentos/${id}/tomar`, { method: 'POST', body: JSON.stringify(body) }),
      desfazer: (id: string, body: { phone: string; horario?: string }) =>
        req<any>(`/api/saude/medicamentos/${id}/desfazer`, { method: 'POST', body: JSON.stringify(body) }),
      doses:   (id: string, phone: string) =>
        req<any[]>(`/api/saude/medicamentos/${id}/doses?phone=${phone}`),
    },

    medidas: {
      listar: (phone: string) => req<any[]>(`/api/saude/medidas/${phone}`),
      criar:  (body: any) => req<any>('/api/saude/medidas', { method: 'POST', body: JSON.stringify(body) }),
    },

    fotos: {
      listar: (phone: string) => req<any[]>(`/api/saude/fotos/${phone}`),
      criar:  (body: any) => req<any>('/api/saude/fotos', { method: 'POST', body: JSON.stringify(body) }),
    },


    vacinas: {
      listar: (phone: string) => req<any[]>(`/api/saude/vacinas/${phone}`),
      criar:  (body: any) => req<any>('/api/saude/vacinas', { method: 'POST', body: JSON.stringify(body) }),
    },

    ciclo: {
      listar: (phone: string) => req<any[]>(`/api/saude/ciclo/${phone}`),
      criar:  (body: any) => req<any>('/api/saude/ciclo', { method: 'POST', body: JSON.stringify(body) }),
    },
  },

  // ── ESTUDOS (sub-aba do Sora Grow) ───────────────────────────
  estudos: {
    dashboard: (phone: string) => req<any>(`/api/estudos/dashboard/${phone}`),

    cursos: {
      listar:  (phone: string, params?: { tipo?: string; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.tipo) q.set('tipo', params.tipo);
        if (params?.status) q.set('status', params.status);
        const qs = q.toString();
        return req<any[]>(`/api/estudos/cursos/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar:   (body: any) => req<any>('/api/estudos/cursos', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/estudos/cursos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/estudos/cursos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    disciplinas: {
      listar:  (phone: string, curso_id?: string) =>
        req<any[]>(`/api/estudos/disciplinas/${phone}${curso_id ? `?curso_id=${curso_id}` : ''}`),
      criar:   (body: any) => req<any>('/api/estudos/disciplinas', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/estudos/disciplinas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/estudos/disciplinas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    provas: {
      listar:  (phone: string, params?: { curso_id?: string; realizada?: boolean }) => {
        const q = new URLSearchParams();
        if (params?.curso_id) q.set('curso_id', params.curso_id);
        if (params?.realizada !== undefined) q.set('realizada', String(params.realizada));
        const qs = q.toString();
        return req<any[]>(`/api/estudos/provas/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar:   (body: any) => req<any>('/api/estudos/provas', { method: 'POST', body: JSON.stringify(body) }),
      editar:  (id: string, body: any) => req<any>(`/api/estudos/provas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/estudos/provas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    sessoes: {
      listar:  (phone: string, params?: { dias?: number; curso_id?: string; disciplina_id?: string }) => {
        const q = new URLSearchParams();
        if (params?.dias) q.set('dias', String(params.dias));
        if (params?.curso_id) q.set('curso_id', params.curso_id);
        if (params?.disciplina_id) q.set('disciplina_id', params.disciplina_id);
        const qs = q.toString();
        return req<any[]>(`/api/estudos/sessoes/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar:   (body: any) => req<any>('/api/estudos/sessoes', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/estudos/sessoes/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    metas: {
      get:    (phone: string, curso_id?: string) =>
        req<any>(`/api/estudos/metas/${phone}${curso_id ? `?curso_id=${curso_id}` : ''}`),
      salvar: (phone: string, body: any) => req<any>(`/api/estudos/metas/${phone}`, { method: 'PUT', body: JSON.stringify({ ...body, phone }) }),
    },

    anotacoes: {
      listar:  (phone: string, params?: { disciplina_id?: string; curso_id?: string }) => {
        const q = new URLSearchParams();
        if (params?.disciplina_id) q.set('disciplina_id', params.disciplina_id);
        if (params?.curso_id) q.set('curso_id', params.curso_id);
        const qs = q.toString();
        return req<any[]>(`/api/estudos/anotacoes/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar:   (body: any) => req<any>('/api/estudos/anotacoes', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) => req(`/api/estudos/anotacoes/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },
  },

  // ── BÍBLIA (seção de estudos bíblicos do Grow) ───────────────
  biblia: {
    get:          (phone: string) => req<any>(`/api/biblia/${phone}`),
    definirPlano: (plano_id: string) => req<any>('/api/biblia/plano', { method: 'POST', body: JSON.stringify({ plano_id }) }),
    registrar:    (body: { plano_id?: string | null; dia?: number | null; referencia: string; duracao_min?: number; reflexao?: string | null }) =>
      req<any>('/api/biblia/leitura', { method: 'POST', body: JSON.stringify(body) }),
    remover:      (id: string) => req(`/api/biblia/leitura/${id}`, { method: 'DELETE' }),
    // Fase 2 — oração
    oracoes: {
      listar:  (phone: string) => req<any[]>(`/api/biblia/oracoes/${phone}`),
      criar:   (pedido: string) => req<any>('/api/biblia/oracoes', { method: 'POST', body: JSON.stringify({ pedido }) }),
      alternar: (id: string, respondida: boolean) => req<any>(`/api/biblia/oracoes/${id}`, { method: 'PUT', body: JSON.stringify({ respondida }) }),
      remover: (id: string) => req(`/api/biblia/oracoes/${id}`, { method: 'DELETE' }),
    },
    // Fase 2 — memorização (repetição espaçada)
    memo: {
      listar:  (phone: string) => req<{ versos: any[]; paraRevisar: number }>(`/api/biblia/memorizacao/${phone}`),
      criar:   (body: { referencia: string; texto?: string }) => req<any>('/api/biblia/memorizacao', { method: 'POST', body: JSON.stringify(body) }),
      revisar: (id: string, acertou: boolean) => req<any>(`/api/biblia/memorizacao/${id}/revisar`, { method: 'POST', body: JSON.stringify({ acertou }) }),
      remover: (id: string) => req(`/api/biblia/memorizacao/${id}`, { method: 'DELETE' }),
    },
  },

  // ── METAS E OBJETIVOS (planejamento financeiro) ──────────────
  metas: {
    listar: (phone: string) =>
      req<any[]>(`/api/metas/${phone}`),
    criar: (body: { phone: string; titulo: string; descricao?: string; valor_objetivo: number; valor_atual?: number; data_alvo?: string | null; imagem_url?: string | null; cor?: string; icone?: string }) =>
      req<any>('/api/metas', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req<any>(`/api/metas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string, phone: string) =>
      req(`/api/metas/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    aportar: (id: string, body: { phone: string; valor: number; observacao?: string; data?: string; wallet_id?: string | null }) =>
      req<any>(`/api/metas/${id}/aporte`, { method: 'POST', body: JSON.stringify(body) }),
    resgatar: (id: string, body: { phone: string; valor: number; observacao?: string; data?: string }) =>
      req<any>(`/api/metas/${id}/resgate`, { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── SORA WRAPPED (resumos compartilháveis) ───────────────────
  wrapped: {
    financas: (phone: string, periodo?: string) =>
      req<any>(`/api/wrapped/financas/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
    grow: (phone: string, periodo?: string) =>
      req<any>(`/api/wrapped/grow/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
  },

  // ── NEGÓCIOS (CFO de bolso — DRE, integrações, custos, IA) ────
  negocios: {
    // Multi-empresa (ilimitadas no Premium). `tipo` define como a aba se
    // adapta: digital = integrações/DRE · fisico = caixa/contas/equipe.
    empresas: {
      listar: (phone: string) =>
        req<Empresa[]>(`/api/negocios/empresas/${phone}`),
      criar: (body: Partial<Empresa> & { nome: string }) =>
        req<{ ok: boolean; empresa: Empresa }>('/api/negocios/empresas', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: Partial<Empresa> & { nome: string }) =>
        req<{ ok: boolean; empresa: Empresa }>(`/api/negocios/empresas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      arquivar: (id: string) =>
        req<{ ok: boolean }>(`/api/negocios/empresas/${id}`, { method: 'DELETE' }),
    },
    // Livro caixa: entradas, saídas e contas a pagar (saída pendente).
    // `valor` SEMPRE em centavos.
    lancamentos: {
      listar: (phone: string, params: { empresa_id: string; mes?: string; status?: string }) => {
        const q = new URLSearchParams(params as any).toString();
        return req<Lancamento[]>(`/api/negocios/lancamentos/${phone}?${q}`);
      },
      criar: (body: Partial<Lancamento> & { empresa_id: string; tipo: string; descricao: string; valor: number; data: string }) =>
        req<{ ok: boolean; lancamento: Lancamento }>('/api/negocios/lancamentos', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: Partial<Lancamento>) =>
        req<{ ok: boolean; lancamento: Lancamento }>(`/api/negocios/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string) =>
        req<{ ok: boolean }>(`/api/negocios/lancamentos/${id}`, { method: 'DELETE' }),
    },
    // Quadro de pessoal + folha. `pagar` gera um lançamento de saída
    // (categoria 'folha') vinculado ao funcionário — sem estrutura paralela.
    funcionarios: {
      listar: (phone: string, empresa_id: string) =>
        req<Funcionario[]>(`/api/negocios/funcionarios/${phone}?empresa_id=${empresa_id}`),
      criar: (body: Partial<Funcionario> & { empresa_id: string; nome: string }) =>
        req<{ ok: boolean; funcionario: Funcionario }>('/api/negocios/funcionarios', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: Partial<Funcionario> & { nome: string }) =>
        req<{ ok: boolean; funcionario: Funcionario }>(`/api/negocios/funcionarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      arquivar: (id: string) =>
        req<{ ok: boolean }>(`/api/negocios/funcionarios/${id}`, { method: 'DELETE' }),
      pagar: (id: string, body?: { valor?: number; data?: string; forma_pagamento?: string; status?: string }) =>
        req<{ ok: boolean; lancamento: any }>(`/api/negocios/funcionarios/${id}/pagar`, { method: 'POST', body: JSON.stringify(body || {}) }),
    },
    integracoes: {
      listar: (phone: string) =>
        req<any[]>(`/api/negocios/integracoes/${phone}`),
      conectar: (body: { phone: string; plataforma: string; credenciais: any; apelido?: string }) =>
        req<{ ok: boolean; integracao: { id: string; webhook_secret: string } }>('/api/negocios/integracoes', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string) =>
        req(`/api/negocios/integracoes/${id}`, { method: 'DELETE' }),
      importarHistorico: (id: string) =>
        req<{ ok: boolean; job: string }>(`/api/negocios/integracoes/${id}/importar-historico`, { method: 'POST' }),
    },
    // DRE é POR EMPRESA (fase 5). Sem empresa_id o backend cai na primeira
    // ativa — compat com chamadas antigas.
    dre: {
      get: (phone: string, periodo?: string, empresaId?: string) => {
        const q = new URLSearchParams();
        if (periodo) q.set('periodo', periodo);
        if (empresaId) q.set('empresa_id', empresaId);
        const s = q.toString();
        return req<any>(`/api/negocios/dre/${phone}${s ? `?${s}` : ''}`);
      },
      detalhado: (phone: string, periodo?: string) =>
        req<any>(`/api/negocios/dre-detalhado/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
      recalcular: (body: { phone: string; periodo?: string; empresa_id?: string }) =>
        req<any>('/api/negocios/dre/recalcular', { method: 'POST', body: JSON.stringify(body) }),
    },
    eventos: {
      listar: (phone: string, params?: { limit?: number; offset?: number; tipo?: string; plataforma?: string; periodo?: string }) => {
        const q = new URLSearchParams(params as any).toString();
        return req<{ eventos: any[]; total: number }>(`/api/negocios/eventos/${phone}${q ? `?${q}` : ''}`);
      },
    },
    custos: {
      listar: (phone: string, periodo?: string) =>
        req<any[]>(`/api/negocios/custos/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
      criar: (body: { phone: string; categoria: string; descricao: string; valor: number; data?: string; fornecedor?: string; recorrente?: boolean; recorrencia?: string; observacao?: string }) =>
        req<{ ok: boolean; custo: any }>('/api/negocios/custos', { method: 'POST', body: JSON.stringify(body) }),
      deletar: (id: string) =>
        req(`/api/negocios/custos/${id}`, { method: 'DELETE' }),
    },
    config: {
      get: (phone: string) => req<any>(`/api/negocios/config/${phone}`),
      salvar: (body: { phone: string; regime_tributario?: string; aliquota_simples?: number; reservar_imposto?: boolean; pct_reserva_imposto?: number; ai_insights_ativo?: boolean; notificar_meta_lucro?: number | null }) =>
        req<any>('/api/negocios/config', { method: 'PUT', body: JSON.stringify(body) }),
    },
    insights: {
      listar: (phone: string) => req<any[]>(`/api/negocios/insights/${phone}`),
      visto: (id: string) => req(`/api/negocios/insights/${id}/visto`, { method: 'POST' }),
      dispensar: (id: string) => req(`/api/negocios/insights/${id}/dispensar`, { method: 'POST' }),
      gerar: (phone: string) => req<{ ok: boolean; gerados: number; insights: any[] }>('/api/negocios/insights/gerar', { method: 'POST', body: JSON.stringify({ phone }) }),
    },
    wrapped: {
      get: (phone: string, periodo?: string) =>
        req<any>(`/api/negocios/wrapped/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
    },
    forecast: {
      get: (phone: string) => req<any>(`/api/negocios/forecast/${phone}`),
    },
    conciliacao: {
      sugerir: (phone: string) =>
        req<any[]>(`/api/negocios/conciliacao/sugerir/${phone}`),
      conciliadas: (phone: string) =>
        req<any[]>(`/api/negocios/conciliacao/conciliadas/${phone}`),
      conciliar: (body: { phone: string; evento_id: string; transacao_id: string; match_tipo?: string }) =>
        req('/api/negocios/conciliacao', { method: 'POST', body: JSON.stringify(body) }),
      desconciliar: (id: string) =>
        req(`/api/negocios/conciliacao/${id}`, { method: 'DELETE' }),
    },
  },
};