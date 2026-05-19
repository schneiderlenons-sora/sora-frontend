const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Faz chamadas ao backend com tratamento de erro centralizado
async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': process.env.NEXT_PUBLIC_API_TOKEN || '',
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
    throw new Error(msg);
  }
  return res.json();
}

// ── USUÁRIO ──────────────────────────────────────────────────────
export const api = {
  user: {
    get: (phone: string) =>
      req<any>(`/api/user/${phone}`),
    updatePlan: (body: { phone: string; plano: string; valido_ate?: string }) =>
      req('/api/user/update-plan', { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── TRANSAÇÕES ────────────────────────────────────────────────
  transacoes: {
    listar: (phone: string, params?: { mes?: string; tipo?: string; categoria?: string; limit?: number; offset?: number; criado_por_me?: boolean; criado_por_phone?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return req<{ transacoes: any[]; total: number }>(`/api/transacoes/${phone}${q ? `?${q}` : ''}`);
    },
    resumo: (phone: string, mes?: string, opts?: { criado_por_me?: boolean }) => {
      const params = new URLSearchParams();
      if (mes) params.set('mes', mes);
      if (opts?.criado_por_me) params.set('criado_por_me', 'true');
      const q = params.toString();
      return req<any>(`/api/transacoes/${phone}/resumo${q ? `?${q}` : ''}`);
    },
    criar: (body: any) =>
      req('/api/transacoes', { method: 'POST', body: JSON.stringify(body) }),
    criarBulk: (body: { phone: string; transacoes: any[] }) =>
      req<{ inserted: number }>('/api/transacoes/bulk', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req(`/api/transacoes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/transacoes/${id}`, { method: 'DELETE' }),
  },

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────
  wallets: {
    listar: (phone: string) =>
      req<any[]>(`/api/wallets/${phone}`),
    salvar: (body: any) =>
      req('/api/wallets', { method: 'POST', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/wallets/${id}`, { method: 'DELETE' }),
  },

  // ── CATEGORIAS ────────────────────────────────────────────────
  categorias: {
    listar: (phone: string) =>
      req<any[]>(`/api/categorias/${phone}`),
    criar: (body: any) =>
      req('/api/categorias', { method: 'POST', body: JSON.stringify(body) }),
    editar: (id: string, body: any) =>
      req(`/api/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletar: (id: string) =>
      req(`/api/categorias/${id}`, { method: 'DELETE' }),
    restaurarPadrao: (phone: string) =>
      req<{ ok: boolean; total: number }>(`/api/categorias/restaurar-padrao/${phone}`, { method: 'POST' }),
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
    criar: (body: { phone: string; nome: string; emoji?: string }) =>
      req<{ ok: boolean; grupo: any }>('/api/grupos/criar', { method: 'POST', body: JSON.stringify(body) }),
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
    pagar: (id: string, body: { phone: string; valor: number; tipo?: string; data_pagamento?: string; observacao?: string; numero_parcela?: number }) =>
      req<{ divida: any; quitada: boolean }>(`/api/dividas/${id}/pagar`, { method: 'POST', body: JSON.stringify(body) }),
    quitar: (id: string, body: { phone: string; valor?: number; data_pagamento?: string; observacao?: string }) =>
      req<{ divida: any; quitada: boolean }>(`/api/dividas/${id}/quitar`, { method: 'POST', body: JSON.stringify(body) }),
    pagamentos: (id: string) =>
      req<any[]>(`/api/dividas/${id}/pagamentos`),
    toggleLembrete: (id: string, body: { phone: string; ativo: boolean }) =>
      req<any>(`/api/dividas/${id}/lembrete`, { method: 'PATCH', body: JSON.stringify(body) }),
    toggleLembretesGlobal: (phone: string, ativo: boolean) =>
      req<{ phone: string; lembretes_dividas: boolean }>(`/api/dividas/lembretes/${phone}`, { method: 'PATCH', body: JSON.stringify({ ativo }) }),
  },

  // ── GROW (segundo painel: hábitos, tarefas, humor, casa) ─────
  grow: {
    status: (phone: string) =>
      req<{ temAcesso: boolean; plano: string; planoGrow: string; painelAtivo: 'finance' | 'grow'; trial: { ativo: boolean; diasRestantes: number; inicio: string | null; fim: string | null } }>(`/api/grow/status/${phone}`),
    ativarTrial: (phone: string) =>
      req<{ ok: boolean; fim: string; diasRestantes: number }>(`/api/grow/ativar-trial/${phone}`, { method: 'POST' }),
    trocarPainel: (phone: string, painel: 'finance' | 'grow') =>
      req<{ ok: boolean; painelAtivo: 'finance' | 'grow' }>(`/api/grow/trocar-painel/${phone}`, { method: 'POST', body: JSON.stringify({ painel }) }),

    habitos: {
      listar: (phone: string) =>
        req<{ habitos: any[]; registros: any[] }>(`/api/grow/habitos/${phone}`),
      criar: (body: { phone: string; nome: string; descricao?: string; icone?: string; cor?: string; frequencia?: string; dias_semana?: number[]; horario_lembrete?: string | null }) =>
        req<any>('/api/grow/habitos', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: any) =>
        req<any>(`/api/grow/habitos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/habitos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      toggle: (id: string, body: { phone: string; data?: string }) =>
        req<any>(`/api/grow/habitos/${id}/toggle`, { method: 'POST', body: JSON.stringify(body) }),
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
    aportar: (id: string, body: { phone: string; valor: number; observacao?: string; data?: string }) =>
      req<any>(`/api/metas/${id}/aporte`, { method: 'POST', body: JSON.stringify(body) }),
    resgatar: (id: string, body: { phone: string; valor: number; observacao?: string; data?: string }) =>
      req<any>(`/api/metas/${id}/resgate`, { method: 'POST', body: JSON.stringify(body) }),
  },
};