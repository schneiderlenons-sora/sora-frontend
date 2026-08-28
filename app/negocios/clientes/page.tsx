'use client';

// =============================================================================
// Clientes — não uma agenda, mas "quanto cada um vale".
//
// A lista mostra contato; a ficha mostra o que ele já rendeu (total gasto,
// lucro gerado, ticket médio, última compra e o que está em aberto). É a
// diferença entre uma lista de nomes e uma ferramenta de decisão: com isso o
// dono sabe quem merece desconto e quem já está devendo há tempo demais.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalCliente from '@/components/negocios/ModalCliente';
import FichaCliente from '@/components/negocios/FichaCliente';
import { corEmpresa } from '@/lib/empresas';
import { type ClienteNegocio } from '@/lib/lancamentos';
import { Users, Plus, Search, MessageCircle, ChevronRight } from 'lucide-react';

/** Telefone BR legível: 5532999167475 → (32) 99916-7475 */
function fone(t?: string | null): string {
  const d = (t || '').replace(/\D/g, '');
  const s = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return t || '';
}

export default function ClientesPage() {
  const { phone, temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [busca, setBusca]       = useState('');
  const [editando, setEditando] = useState<ClienteNegocio | null | undefined>(undefined);
  const [fichaId, setFichaId]   = useState<string | null>(null);

  const { data, mutate, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `neg:clientes:${empresa.id}` : null,
    () => api.negocios.clientes.listar(phone, empresa!.id),
  );
  const clientes: ClienteNegocio[] = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q.replace(/\D/g, '')));
  }, [clientes, busca]);

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }

  return (
    <div className="pb-20 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Quem compra com você e quanto já rendeu</p>
        </div>
        <button onClick={() => setEditando(null)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
          style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Novo cliente
        </button>
      </header>

      {clientes.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
                 placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente"
                 className="input w-full pl-10" style={{ minHeight: 44 }} />
        </div>
      )}

      {(carregandoEmpresa || isLoading) ? (
        <Esqueleto />
      ) : clientes.length === 0 ? (
        <Vazio cor={cor} onCriar={() => setEditando(null)} />
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Nenhum cliente encontrado para &ldquo;{busca}&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map(c => (
            <li key={c.id} className="rounded-2xl border border-border bg-card flex items-center">
              <button onClick={() => setFichaId(c.id)}
                className="flex-1 min-w-0 flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/20 rounded-l-2xl"
                style={{ minHeight: 44 }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}>
                  {c.nome.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{c.nome}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {c.telefone ? fone(c.telefone) : c.email || 'sem contato'}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
              </button>

              {/* Falar com o cliente sem sair da tela — o canal que ele responde */}
              {c.telefone && (
                <a href={`https://wa.me/${c.telefone.length <= 11 ? `55${c.telefone}` : c.telefone}`}
                   target="_blank" rel="noreferrer"
                   aria-label={`Conversar com ${c.nome} no WhatsApp`}
                   className="w-12 h-12 mr-1 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                   style={{ minWidth: 44, minHeight: 44 }}>
                  <MessageCircle size={17} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando !== undefined && empresa && (
        <ModalCliente
          empresaId={empresa.id} cor={cor} cliente={editando}
          onClose={() => setEditando(undefined)}
          onSalvo={() => { setEditando(undefined); mutate(); }}
        />
      )}

      {fichaId && (
        <FichaCliente
          clienteId={fichaId} cor={cor}
          onClose={() => setFichaId(null)}
          onEditar={(c) => { setFichaId(null); setEditando(c); }}
        />
      )}
    </div>
  );
}

function Vazio({ cor, onCriar }: { cor: string; onCriar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Users size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Nenhum cliente cadastrado</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        Cadastre quem compra a prazo ou volta sempre. Com o telefone, a Sora
        consegue <b className="text-foreground">cobrar por você</b> quando a conta vencer.
      </p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Cadastrar cliente
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <ul className="space-y-2 animate-pulse" aria-busy="true">
      {[0, 1, 2, 3].map(i => (
        <li key={i} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded bg-muted" style={{ width: `${55 - i * 5}%` }} />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
