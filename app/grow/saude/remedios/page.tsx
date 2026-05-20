'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalMedicamento from '@/components/saude/ModalMedicamento';
import {
  Pill, Sparkles, Loader2, Plus, Clock, Check, Pencil, AlertTriangle,
  Package, BellOff, Bell, History, ChevronRight,
} from 'lucide-react';

const COR_REM = '#ef4444';

const DIAS_LABEL: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom' };

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtDataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

// JS getDay() retorna 0=domingo, 7-dia padrão BR é 1=seg...7=dom
function diaSemanaHoje() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function minutosEntreAgoraEHorario(horario: string) {
  const [h, m] = horario.split(':').map(Number);
  const agora = new Date();
  const alvo  = new Date(agora);
  alvo.setHours(h, m, 0, 0);
  return Math.round((alvo.getTime() - agora.getTime()) / 60000);
}

export default function RemediosPage() {
  const { phone } = useAuth();
  const [meds, setMeds]   = useState<any[]>([]);
  const [doses, setDoses] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [edMed, setEdMed] = useState<any | null>(null);
  const [tomando, setTomando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const r = await api.saude.medicamentos.listar(phone);
      const ativos = (r || []).filter((m: any) => m.ativo !== false);
      setMeds(ativos);
      // Doses de cada medicamento (paralelo)
      const dosesMap: Record<string, any[]> = {};
      await Promise.all(ativos.map(async (m: any) => {
        try { dosesMap[m.id] = await api.saude.medicamentos.doses(m.id, phone); }
        catch { dosesMap[m.id] = []; }
      }));
      setDoses(dosesMap);
    } catch (e) { console.warn('[remedios]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  async function tomarDose(med: any) {
    if (!phone) return;
    setTomando(med.id);
    try {
      await api.saude.medicamentos.tomar(med.id, { phone });
      carregar();
    } catch (e: any) { alert(e.message); }
    finally { setTimeout(() => setTomando(null), 350); }
  }

  // Próximas doses de HOJE (todas as meds + horários dentro do dia atual)
  const proximasHoje = useMemo(() => {
    const diaHoje = diaSemanaHoje();
    const arr: { med: any; horario: string; min: number; tomado: boolean }[] = [];
    meds.forEach(m => {
      if (m.lembrete_ativo === false) return;
      if (!m.dias_semana?.includes(diaHoje)) return;
      const dosesHoje = (doses[m.id] || []).filter(d => {
        const dDose = d.datetime_tomado ? new Date(d.datetime_tomado) : null;
        return dDose && dDose.toDateString() === new Date().toDateString();
      });
      (m.horarios || []).forEach((h: string) => {
        const min = minutosEntreAgoraEHorario(h.slice(0, 5));
        const tomado = dosesHoje.length > 0; // simples: se já tomou hoje, marca
        arr.push({ med: m, horario: h.slice(0, 5), min, tomado });
      });
    });
    return arr.sort((a, b) => Math.abs(a.min) - Math.abs(b.min));
  }, [meds, doses]);

  const todasDoses = useMemo(() => {
    const arr: any[] = [];
    Object.entries(doses).forEach(([medId, ds]) => {
      const med = meds.find(m => m.id === medId);
      ds.forEach(d => arr.push({ ...d, med }));
    });
    return arr.sort((a, b) => (b.datetime_tomado || b.created_at).localeCompare(a.datetime_tomado || a.created_at));
  }, [doses, meds]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const estoqueBaixo = meds.filter(m => m.estoque_atual != null && m.estoque_atual <= (m.estoque_alerta || 5));

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${COR_REM}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_REM}1A` }}>
              <Sparkles size={11} style={{ color: COR_REM }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_REM }}>Medicamentos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Remédios</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
              {meds.length > 0
                ? <>Você tem <strong className="text-foreground">{meds.length} medicamento{meds.length > 1 ? 's' : ''}</strong> cadastrado{meds.length > 1 ? 's' : ''}. Lembretes via WhatsApp nos horários configurados.</>
                : <>Cadastre seus medicamentos e a Sora te lembra na hora certa pelo WhatsApp.</>}
            </p>
          </div>
          <button onClick={() => { setEdMed(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
            <Plus size={14} /> Novo medicamento
          </button>
        </div>
      </div>

      {/* Alerta de estoque baixo */}
      {estoqueBaixo.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 backdrop-blur-xl p-4 animate-fade-in bg-amber-50/40 dark:bg-amber-950/20"
             style={{ animationDelay: '60ms' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">⚠️ Estoque baixo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {estoqueBaixo.map(m => `${m.nome} (${m.estoque_atual})`).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {meds.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 p-10 sm:p-12 bg-violet-50/30 dark:bg-violet-950/10 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-rose-100 dark:bg-rose-950/40">
            <Pill size={28} className="text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum medicamento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Cadastre cada medicamento com nome, dosagem, horários e estoque. A Sora envia o lembrete no WhatsApp no horário certo.
          </p>
          <button onClick={() => { setEdMed(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <Plus size={13} /> Cadastrar primeiro
          </button>
        </div>
      ) : (
        <>
          {/* PRÓXIMAS DOSES HOJE */}
          {proximasHoje.length > 0 && (
            <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '120ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hoje</p>
                  <p className="text-base font-bold text-foreground">{proximasHoje.length} dose{proximasHoje.length === 1 ? '' : 's'} programada{proximasHoje.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {proximasHoje.map(({ med, horario, min, tomado }, i) => {
                  const proximo = !tomado && min >= -30 && min <= 60;
                  const passou = !tomado && min < -30;
                  return (
                    <div key={i} className={`rounded-xl p-3 border ${
                      tomado ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60' :
                      proximo ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 ring-1 ring-rose-300/40' :
                      passou ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60' :
                      'bg-muted/20 border-border/40'
                    }`}>
                      <div className="flex items-center gap-1 mb-1">
                        <Clock size={11} className={proximo ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'} />
                        <span className="text-xs font-bold tabular text-foreground">{horario}</span>
                        {proximo && <span className="text-[9px] font-bold uppercase tracking-wider ml-auto text-rose-600 dark:text-rose-400">{min < 0 ? 'agora' : `em ${min}min`}</span>}
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{med.nome}</p>
                      {med.dosagem && <p className="text-[10px] text-muted-foreground truncate">{med.dosagem}</p>}
                      {!tomado && (
                        <button onClick={() => tomarDose(med)} disabled={tomando === med.id}
                                className="w-full mt-2 px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50">
                          {tomando === med.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          Tomar
                        </button>
                      )}
                      {tomado && (
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center mt-1.5">✓ Tomado</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LISTA DE MEDICAMENTOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '180ms' }}>
            {meds.map(m => (
              <CardMedicamento key={m.id} med={m} doses={doses[m.id] || []} onEdit={() => { setEdMed(m); setModalOpen(true); }} onTomar={() => tomarDose(m)} tomando={tomando === m.id} />
            ))}
          </div>

          {/* HISTÓRICO RECENTE */}
          {todasDoses.length > 0 && (
            <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
              <div className="flex items-center gap-2 mb-4">
                <History size={14} className="text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Histórico de doses</p>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {todasDoses.slice(0, 20).map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100 dark:bg-emerald-950/40">
                      <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{d.med?.nome || 'Medicamento'} {d.med?.dosagem || ''}</p>
                      <p className="text-[10px] text-muted-foreground tabular">{fmtDataHora(d.datetime_tomado || d.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && phone && (
        <ModalMedicamento phone={phone} medicamento={edMed} onClose={() => { setModalOpen(false); setEdMed(null); }} onSuccess={() => { carregar(); setModalOpen(false); setEdMed(null); }} />
      )}
    </div>
  );
}

// ─── CARD DE MEDICAMENTO ─────────────────────────────────────────
function CardMedicamento({ med, doses, onEdit, onTomar, tomando }: any) {
  const estoqueBaixo = med.estoque_atual != null && med.estoque_atual <= (med.estoque_alerta || 5);
  const dosesHoje = (doses || []).filter((d: any) => {
    const dDose = d.datetime_tomado ? new Date(d.datetime_tomado) : null;
    return dDose && dDose.toDateString() === new Date().toDateString();
  });

  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5 hover:border-violet-300 dark:hover:border-violet-800 transition-all"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-100 dark:bg-rose-950/40">
            <Pill size={18} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{med.nome} {med.dosagem && <span className="text-xs text-muted-foreground font-medium">· {med.dosagem}</span>}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(med.horarios || []).map((h: string) => (
                <span key={h} className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                  {h.slice(0, 5)}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {med.dias_semana?.length === 7 ? 'Todos os dias' : (med.dias_semana || []).map((d: number) => DIAS_LABEL[d]).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {med.lembrete_ativo === false
            ? <BellOff size={13} className="text-muted-foreground" />
            : <Bell size={13} className="text-rose-500" />}
          <button onClick={onEdit} className="p-1 rounded hover:bg-muted">
            <Pencil size={11} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {med.estoque_atual != null && (
        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg mb-3 ${
          estoqueBaixo ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60' : 'bg-muted/30 border border-border/40'
        }`}>
          <Package size={12} className={estoqueBaixo ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'} />
          <span className="text-[11px] font-bold tabular text-foreground">{med.estoque_atual} comprimidos</span>
          {estoqueBaixo && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ml-auto">acabando</span>}
        </div>
      )}

      <button onClick={onTomar} disabled={tomando}
              className="w-full px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
        {tomando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Tomei agora {dosesHoje.length > 0 && <span className="text-violet-200 text-[10px]">· {dosesHoje.length}× hoje</span>}
      </button>
    </div>
  );
}
