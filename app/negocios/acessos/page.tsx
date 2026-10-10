'use client';

// =============================================================================
// Acessos — quem OPERA a empresa pelo app (empresa_membros, migration 173).
//
// ⚠️ NÃO é a aba "Equipe" (folha/funcionários, quem você PAGA). Aqui é quem
// entra na empresa pelo próprio WhatsApp/painel e alimenta a mesma base — o
// pedido do cliente Platinum com 6 lojas. Só o ADMIN gerencia.
//
// Cada membro precisa do PRÓPRIO Platinum pra operar (decisão do dono) — por
// isso o convite avisa isso antes de a pessoa aceitar (ver /convite-empresa).
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { corEmpresa, type PapelEmpresa, type MembroEmpresa } from '@/lib/empresas';
import { KeyRound, UserPlus, Copy, Check, Trash2, Loader2, ShieldAlert, Share2 } from 'lucide-react';

const PAPEL_LABEL: Record<PapelEmpresa, string> = {
  admin: 'Admin', operador: 'Operador', leitura: 'Leitura (contador)',
};
const PAPEL_DESC: Record<PapelEmpresa, string> = {
  admin:    'Tudo: lança, configura e convida outras pessoas.',
  operador: 'Lança, paga e dá baixa. Não convida nem renomeia a empresa.',
  leitura:  'Só vê (DRE, caixa, relatórios). É o papel do contador.',
};
const PAPEIS: PapelEmpresa[] = ['operador', 'admin', 'leitura'];

function fone(t?: string | null): string {
  const d = (t || '').replace(/\D/g, '');
  const s = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return t || '';
}

export default function AcessosPage() {
  const { temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);
  const souAdmin = empresa?.dono || empresa?.papel === 'admin';

  const { data, mutate, isLoading } = useApi(
    (temNegocios && empresa && souAdmin) ? `neg:acessos:${empresa.id}` : null,
    () => api.negocios.acessos.listar(empresa!.id),
  );
  const membros: MembroEmpresa[] = useMemo(() => data?.membros ?? [], [data]);
  const convites = useMemo(() => data?.convites ?? [], [data]);

  const [papelNovo, setPapelNovo] = useState<PapelEmpresa>('operador');
  const [gerando, setGerando]     = useState(false);
  const [linkNovo, setLinkNovo]   = useState<string | null>(null);
  const [copiado, setCopiado]     = useState<string | null>(null);
  const [erro, setErro]           = useState('');
  const [mexendo, setMexendo]     = useState<string | null>(null);

  const linkDe = (codigo: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : 'https://www.forsora.com'}/convite-empresa/${codigo}`;

  async function copiar(texto: string, chave: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(chave); setTimeout(() => setCopiado(null), 2000); } catch {}
  }

  async function gerarConvite() {
    if (!empresa) return;
    setGerando(true); setErro(''); setLinkNovo(null);
    try {
      const r = await api.negocios.acessos.convidar(empresa.id, papelNovo);
      setLinkNovo(linkDe(r.codigo));
      mutate();
    } catch (e: any) { setErro(e?.message || 'Não consegui gerar o convite.'); }
    finally { setGerando(false); }
  }

  async function trocarPapel(m: MembroEmpresa, papel: PapelEmpresa) {
    if (!empresa) return;
    setMexendo(m.user_id); setErro('');
    try { await api.negocios.acessos.trocarPapel(empresa.id, m.user_id, papel); await mutate(); }
    catch (e: any) { setErro(e?.message || 'Não consegui mudar o papel.'); }
    finally { setMexendo(null); }
  }

  async function remover(m: MembroEmpresa) {
    if (!empresa) return;
    if (!confirm(`Remover ${m.nome} desta empresa? Ela perde o acesso na hora.`)) return;
    setMexendo(m.user_id); setErro('');
    try { await api.negocios.acessos.remover(empresa.id, m.user_id); await mutate(); }
    catch (e: any) { setErro(e?.message || 'Não consegui remover.'); }
    finally { setMexendo(null); }
  }

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }
  if (carregandoEmpresa) {
    return <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }
  if (!empresa) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Cadastre uma empresa primeiro.</p>;
  }
  // ⚠️ Operador/leitura não gerenciam acessos. Mostra o porquê, não some.
  if (!souAdmin) {
    return (
      <div className="pb-20 max-w-md mx-auto text-center py-16 space-y-3">
        <ShieldAlert className="mx-auto text-muted-foreground" size={28} />
        <h1 className="text-xl font-bold text-foreground">Acessos</h1>
        <p className="text-sm text-muted-foreground">
          Só o <strong>admin</strong> de {empresa.nome} pode convidar ou remover pessoas. Peça a quem administra a empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-20 space-y-5">
      <header className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">{empresa.nome}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5 flex items-center gap-2">
          <KeyRound size={22} style={{ color: cor }} /> Acessos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Quem opera esta empresa pelo app, cada um pelo próprio WhatsApp</p>
      </header>

      {erro && <p className="text-[13px] text-red-600 dark:text-red-400">{erro}</p>}

      {/* Convidar */}
      <section className="rounded-3xl border border-border/60 p-5 space-y-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-center gap-2">
          <UserPlus size={16} style={{ color: cor }} />
          <h2 className="text-[13px] font-bold text-foreground">Convidar alguém</h2>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-muted-foreground">Entra como</label>
          <div className="grid gap-2">
            {PAPEIS.map((p) => (
              <button key={p} type="button" onClick={() => setPapelNovo(p)}
                className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  papelNovo === p ? 'border-transparent ring-2' : 'border-border hover:bg-muted/40'}`}
                style={papelNovo === p ? ({ ['--tw-ring-color']: cor, background: `${cor}14` } as any) : undefined}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">{PAPEL_LABEL[p]}</span>
                  <span className="block text-[11.5px] text-muted-foreground mt-0.5">{PAPEL_DESC[p]}</span>
                </span>
                {papelNovo === p && <Check size={16} style={{ color: cor }} className="shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={gerarConvite} disabled={gerando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 text-white text-sm font-bold shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: cor, minHeight: 48 }}>
          {gerando ? <><Loader2 size={15} className="animate-spin" /> Gerando…</> : <><UserPlus size={15} /> Gerar link de convite</>}
        </button>

        {linkNovo && (
          <div className="rounded-2xl border p-3 space-y-2.5" style={{ borderColor: `color-mix(in srgb, ${cor} 35%, transparent)`, background: `color-mix(in srgb, ${cor} 6%, transparent)` }}>
            <p className="text-[12px] text-foreground">
              Mande este link pra pessoa. Ela abre, entra na empresa e <strong>precisa do próprio plano Platinum</strong> pra operar — o convite avisa isso.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-foreground/5 px-2.5 py-2 text-[11.5px] text-foreground">{linkNovo}</code>
              <button type="button" onClick={() => copiar(linkNovo, 'novo')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white shrink-0" style={{ background: cor, minHeight: 40 }}>
                {copiado === 'novo' ? <Check size={14} /> : <Copy size={14} />} {copiado === 'novo' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button type="button" onClick={() => (navigator as any).share({ url: linkNovo, title: `Convite — ${empresa.nome}` }).catch(() => {})}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-foreground/10" style={{ minHeight: 40 }}>
                <Share2 size={13} /> Compartilhar
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">O link vale por 7 dias.</p>
          </div>
        )}
      </section>

      {/* Membros */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pessoas com acesso</h2>
        {isLoading && <div className="py-6 grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>}
        {!isLoading && membros.map((m) => (
          <div key={m.user_id} className="rounded-2xl border border-border/50 p-3.5" style={{ background: 'hsl(var(--bg-card))' }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">
                  {m.nome}
                  {m.dono && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold align-middle" style={{ background: `${cor}22`, color: cor }}>Dono</span>}
                </p>
                {m.phone && <p className="mt-0.5 text-[11.5px] text-muted-foreground tabular">{fone(m.phone)}</p>}
              </div>
              {m.dono ? (
                <span className="text-[12px] font-semibold text-muted-foreground shrink-0">{PAPEL_LABEL[m.papel]}</span>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <select value={m.papel} disabled={mexendo === m.user_id}
                    onChange={(e) => trocarPapel(m, e.target.value as PapelEmpresa)}
                    className="rounded-lg border border-border bg-transparent px-2 py-2 text-[12px] font-semibold text-foreground" style={{ minHeight: 40 }}>
                    {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                  </select>
                  <button type="button" onClick={() => remover(m)} disabled={mexendo === m.user_id}
                    aria-label={`Remover ${m.nome}`}
                    className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50">
                    {mexendo === m.user_id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Convites em aberto */}
      {convites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Convites em aberto</h2>
          {convites.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border/50 p-3 flex items-center gap-3" style={{ background: 'hsl(var(--bg-card))' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-foreground">Entra como {PAPEL_LABEL[c.papel]}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Vale até {new Date(c.expira_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <button type="button" onClick={() => copiar(linkDe(c.codigo), c.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-foreground hover:bg-foreground/10 shrink-0" style={{ minHeight: 40 }}>
                {copiado === c.id ? <Check size={14} /> : <Copy size={14} />} {copiado === c.id ? 'Copiado' : 'Copiar link'}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
