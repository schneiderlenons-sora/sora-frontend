'use client';

// "Trazer movimentações a partir de [data]", por banco conectado (migration
// 202 no backend; regra em sora-backend/src/services/importarDesde.js).
//
// Pedido de cliente (nov/2026): a conexão trouxe meses que ela não quer
// acompanhar, e o botão Atualizar podia trazer meses que nunca tinham vindo.
// Aqui a pessoa escolhe a data: nenhuma atualização traz nada de antes dela, e
// as movimentações DO BANCO que já vieram podem sair junto (o digitado fica).
//
// ⚠️ Modal por portal: o card do banco fica dentro de blocos com
// backdrop-blur, que prenderiam um `fixed` (ver CLAUDE.md, "Modal/overlay").

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';

const BRAND = '#61D17B';

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** AAAA-MM-DD de calendário de verdade (o servidor confere de novo). */
function dataValida(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const dataBR = (iso: string) => iso.split('-').reverse().join('/');

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export default function ImportarDesdeModal({
  externalId, banco, atual, onClose, onSalvo,
}: {
  externalId: string;
  banco: string;
  atual: string | null;
  onClose: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const hoje = hojeSP();
  const [data, setData] = useState(atual || '');
  const [prev, setPrev] = useState<{ data: string; n: number | null } | null>(null);
  const [apagar, setApagar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [montado, setMontado] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMontado(true), 0); return () => clearTimeout(t); }, []);

  const valida = dataValida(data) && data <= hoje;

  // Quantas do banco ficariam de fora (prévia, só leitura). Espera a pessoa
  // parar de mexer na data, e só a resposta da data ATUAL vale.
  useEffect(() => {
    if (!valida) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.openFinance.anteriores(externalId, data);
        if (vivo) setPrev({ data, n: r.quantidade });
      } catch {
        if (vivo) setPrev({ data, n: null });
      }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [data, valida, externalId]);

  const contando = valida && prev?.data !== data;
  const n = valida && prev?.data === data ? prev.n : null;
  const vaiApagar = apagar && (n ?? 0) > 0;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, salvando]);

  async function salvar(desde: string | null) {
    setErro(''); setSalvando(true);
    try {
      const r = await api.openFinance.importarDesde(externalId, desde, desde ? vaiApagar : false);
      if (!desde) {
        onSalvo(`${banco}: a Sora volta a trazer todo o histórico que o banco enviar, a partir da próxima atualização.`);
      } else {
        const partes = [`${banco}: movimentações a partir de ${dataBR(desde)}.`];
        if (r.apagadas > 0) partes.push(`${r.apagadas} ${plural(r.apagadas, 'movimentação anterior foi apagada', 'movimentações anteriores foram apagadas')}.`);
        onSalvo(partes.join(' '));
      }
      onClose();
    } catch (e) {
      setErro((e instanceof Error && e.message) || 'Não consegui salvar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={() => !salvando && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog" aria-modal="true" aria-labelledby="importar-desde-titulo"
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${BRAND} 15%, transparent)` }}>
              <CalendarClock size={18} style={{ color: BRAND }} aria-hidden />
            </div>
            <h2 id="importar-desde-titulo" className="text-base font-bold text-foreground truncate">
              Movimentações do {banco}
            </h2>
          </div>
          <button onClick={onClose} disabled={salvando} aria-label="Fechar"
                  className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Escolha a partir de quando a Sora traz as movimentações deste banco. Nada de antes dessa data entra nas
            próximas atualizações.
          </p>

          <label className="block">
            <span className="text-xs font-semibold text-foreground">Trazer a partir de</span>
            <input
              type="date" value={data} max={hoje}
              onChange={(e) => { setData(e.target.value); setErro(''); }}
              className="mt-1.5 w-full h-12 px-3 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </label>
          {data && !valida && (
            <p className="text-xs text-red-500" role="alert">
              {dataValida(data) ? 'A data não pode ser depois de hoje.' : 'Escolha uma data válida.'}
            </p>
          )}

          {valida && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3.5" aria-live="polite">
              {contando ? (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> Contando as movimentações de antes de {dataBR(data)}…
                </p>
              ) : n === null ? (
                <p className="text-xs text-muted-foreground">
                  Não consegui contar agora. Ao salvar, nada de antes de {dataBR(data)} entra nas próximas atualizações.
                </p>
              ) : n === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma movimentação deste banco antes de {dataBR(data)} na Sora.
                </p>
              ) : (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={apagar} onChange={(e) => setApagar(e.target.checked)}
                         className="mt-0.5 w-5 h-5 flex-shrink-0 accent-[#61D17B]" />
                  <span className="text-sm text-foreground leading-snug">
                    Apagar {plural(n, 'a movimentação', `as ${n} movimentações`)} deste banco de antes de {dataBR(data)}
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {apagar ? 'Não dá pra desfazer.' : `${plural(n, 'Ela continua', 'Elas continuam')} na Sora; só as novas deixam de entrar.`}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Lançamentos que você digitou não são apagados, e o saldo das contas não muda: ele vem do banco.
          </p>

          {erro && <p className="text-xs text-red-500" role="alert">{erro}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
            {atual ? (
              <button onClick={() => salvar(null)} disabled={salvando}
                      className="h-11 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
                Voltar a trazer tudo
              </button>
            ) : <span className="hidden sm:block" />}
            <button
              onClick={() => salvar(data)} disabled={salvando || !valida || contando}
              className="h-12 px-5 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
              style={{ background: vaiApagar ? '#DC2626' : `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
            >
              {salvando && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {vaiApagar ? `Salvar e apagar ${n}` : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
