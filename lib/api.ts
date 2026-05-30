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
    /** Dispara mensagem de boas-vindas no WhatsApp (idempotente por user_id). */
    welcome: (body: { user_id: string; phone: string; nome?: string; force?: boolean }) =>
      req<{ enviado: boolean; motivo?: string }>('/api/user/welcome', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
    deletar: (id: string, phone?: string) =>
      req(`/api/transacoes/${id}${phone ? `?phone=${phone}` : ''}`, { method: 'DELETE' }),
    anteciparCartao: (body: { phone: string; ids: string[]; conta_nome: string }) =>
      req<{ ok: boolean; debitado: number; conta?: string }>('/api/transacoes/antecipar-cartao', { method: 'POST', body: JSON.stringify(body) }),
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

  // ── RECORRÊNCIAS (gastos/receitas fixas) ─────────────────────
  recorrencias: {
    listar: (phone: string) =>
      req<any[]>(`/api/recorrencias/${phone}`),
    criar: (body: { phone: string; tipo: 'Gasto' | 'Recebimento'; descricao: string; valor: number; dia_vencimento: number; carteira?: string; categoria?: string }) =>
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
      listar: (phone: string, params?: { dias?: number; incluir_arquivados?: boolean }) => {
        const q = new URLSearchParams();
        if (params?.dias) q.set('dias', String(params.dias));
        if (params?.incluir_arquivados) q.set('incluir_arquivados', 'true');
        const qs = q.toString();
        return req<{ habitos: any[]; registros: any[] }>(`/api/grow/habitos/${phone}${qs ? `?${qs}` : ''}`);
      },
      criar: (body: { phone: string; nome: string; descricao?: string; icone?: string; cor?: string; frequencia?: string; dias_semana?: number[]; horario_lembrete?: string | null; motivo?: string; tipo?: 'construir'|'eliminar'; ordem?: number }) =>
        req<any>('/api/grow/habitos', { method: 'POST', body: JSON.stringify(body) }),
      editar: (id: string, body: any) =>
        req<any>(`/api/grow/habitos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      deletar: (id: string, phone: string) =>
        req(`/api/grow/habitos/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
      toggle: (id: string, body: { phone: string; data?: string }) =>
        req<any>(`/api/grow/habitos/${id}/toggle`, { method: 'POST', body: JSON.stringify(body) }),
      reordenar: (phone: string, ordens: Array<{ id: string; ordem: number }>) =>
        req<{ ok: boolean }>(`/api/grow/habitos/reordenar`, { method: 'POST', body: JSON.stringify({ phone, ordens }) }),
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
      registros:   (phone: string, dias?: number) =>
        req<any[]>(`/api/saude/treino-registros/${phone}${dias ? `?dias=${dias}` : ''}`),
      registrar:   (body: any) => req<any>('/api/saude/treino-registros', { method: 'POST', body: JSON.stringify(body) }),
      deletarReg:  (id: string, phone: string) =>
        req(`/api/saude/treino-registros/${id}`, { method: 'DELETE', body: JSON.stringify({ phone }) }),
    },

    checkups: {
      listar: (phone: string, dias?: number) => req<any[]>(`/api/saude/checkups/${phone}${dias ? `?dias=${dias}` : ''}`),
      salvar: (body: any) => req<any>('/api/saude/checkups', { method: 'POST', body: JSON.stringify(body) }),
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
      tomar:   (id: string, body: { phone: string; datetime_planejado?: string }) =>
        req<any>(`/api/saude/medicamentos/${id}/tomar`, { method: 'POST', body: JSON.stringify(body) }),
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

    sintomas: {
      listar: (phone: string, dias?: number) =>
        req<any[]>(`/api/saude/sintomas/${phone}${dias ? `?dias=${dias}` : ''}`),
      criar:  (body: any) => req<any>('/api/saude/sintomas', { method: 'POST', body: JSON.stringify(body) }),
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

  // ── NEGÓCIOS (CFO de bolso — DRE, integrações, custos, IA) ────
  negocios: {
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
    dre: {
      get: (phone: string, periodo?: string) =>
        req<any>(`/api/negocios/dre/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
      detalhado: (phone: string, periodo?: string) =>
        req<any>(`/api/negocios/dre-detalhado/${phone}${periodo ? `?periodo=${periodo}` : ''}`),
      recalcular: (body: { phone: string; periodo?: string }) =>
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