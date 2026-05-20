'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalPerfilSaude from '@/components/saude/ModalPerfilSaude';
import ModalSintoma from '@/components/saude/ModalSintoma';
import {
  ClipboardCheck, Sparkles, Loader2, User, Scale, Droplets, Dumbbell,
  Salad, Moon, Brain, Activity as ActivityIcon, Plus, Check, X, Pencil, Trash2,
} from 'lucide-react';

const BRAND = '#7c3aed';
const COR_REG = '#06b6d4';

const ITENS_CHECKUP = [
  { k: 'agua_bateu',       l: 'Bati a meta de água',   icon: Droplets, cor: '#06b6d4' },
  { k: 'atividade_fisica', l: 'Fiz atividade física',  icon: Dumbbell, cor: '#f59e0b' },
  { k: 'dieta_ok',         l: 'Mantive minha dieta',   icon: Salad,    cor: '#10b981' },
  { k: 'sono_ok',          l: 'Dormi bem',             icon: Moon,     cor: '#6366f1' },
  { k: 'meditacao',        l: 'Meditei / mindfulness', icon: Brain,    cor: '#a78bfa' },
];

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export default function RegistroPage() {
  const { phone } = useAuth();
  const [perfil, setPerfil]     = useState<any>(null);
  const [checkupHoje, setCh]    = useState<any>(null);
  const [checkupsAll, setAll]   = useState<any[]>([]);
  const [sintomas, setSintomas] = useState<any[]>([]);
  const [pesoHoje, setPesoHoje] = useState('');
  const [pesoLoading, setPesoLoading] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [modalPerfil, setModalPerfil] = useState(false);
  const [modalSintoma, setModalSintoma] = useState(false);

  const hojeStr = new Date().toISOString().slice(0, 10);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [p, cks, sin] = await Promise.all([
        api.saude.perfil.get(phone).catch(() => null),
        api.saude.checkups.listar(phone, 60),
        api.saude.sintomas.listar(phone, 30),
      ]);
      setPerfil(p || null);
      setAll(cks || []);
      setCh((cks || []).find((c: any) => c.data === hojeStr) || null);
      setSintomas(sin || []);
    } catch (e) { console.warn('[registro]', e); }
    finally { setLoading(false); }
  }, [phone, hojeStr]);

  useEffect(() => { carregar(); }, [carregar]);

  async function toggleCheckup(k: string) {
    if (!phone) return;
    const novo = { ...(checkupHoje || {}), [k]: !checkupHoje?.[k] };
    setCh(novo);
    try {
      const r = await api.saude.checkups.salvar({ phone, data: hojeStr, ...novo });
      setCh(r);
      carregar();
    } catch (e: any) { alert(e.message); carregar(); }
  }

  async function salvarPeso() {
    if (!phone || !pesoHoje) return;
    const v = parseFloat(pesoHoje.replace(',', '.'));
    if (!v || v <= 0) { alert('Peso inválido.'); return; }
    setPesoLoading(true);
    try {
      await api.saude.pesos.criar({ phone, peso_kg: v, data: hojeStr });
      setPesoHoje('');
      carregar();
    } catch (e: any) { alert(e.message); }
    finally { setPesoLoading(false); }
  }

  // Grid heatmap 60 dias
  const heatmap = useMemo(() => {
    const map: Record<string, any> = {};
    checkupsAll.forEach(c => { map[c.data] = c; });
    const dias: { data: string; check?: any }[] = [];
    for (let i = 59; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      dias.push({ data: iso, check: map[iso] });
    }
    return dias;
  }, [checkupsAll]);

  function contagemCheck(c: any) {
    if (!c) return 0;
    return ITENS_CHECKUP.filter(i => c[i.k]).length;
  }

  // Idade calculada
  const idade = useMemo(() => {
    if (!perfil?.data_nascimento) return null;
    const nasc = new Date(perfil.data_nascimento);
    return Math.floor((Date.now() - nasc.getTime()) / (365.25 * 86400000));
  }, [perfil]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const totalHoje  = contagemCheck(checkupHoje);
  const semCheckHoje = !checkupHoje || totalHoje === 0;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${COR_REG}1F 0%, transparent 55%)` }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_REG}1A` }}>
            <Sparkles size={11} style={{ color: COR_REG }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_REG }}>Registro</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Check-ups & Perfil</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
            Marque o que cumpriu hoje e veja sua consistência ao longo do tempo.
          </p>
        </div>
      </div>

      {/* CHECK-UP DE HOJE */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '60ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Check-up de hoje</p>
            <p className="text-base font-bold text-foreground tabular">
              <span style={{ color: COR_REG }}>{totalHoje}</span>/{ITENS_CHECKUP.length} concluídos
            </p>
          </div>
          {totalHoje === ITENS_CHECKUP.length && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              <Check size={9} /> dia perfeito
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ITENS_CHECKUP.map(({ k, l, icon: Icon, cor }) => {
            const ativo = checkupHoje?.[k] || false;
            return (
              <button key={k} onClick={() => toggleCheckup(k)}
                className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  ativo
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                    : 'bg-muted/30 border-border/40 hover:border-violet-300 dark:hover:border-violet-800'
                }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  ativo ? 'bg-emerald-600 scale-110 shadow-md' : 'bg-card border-2 border-muted-foreground/30'
                }`}>
                  {ativo && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <Icon size={14} style={{ color: ativo ? '#10b981' : cor }} />
                <span className={`text-sm font-semibold flex-1 text-left ${ativo ? 'text-emerald-700 dark:text-emerald-300 line-through' : 'text-foreground'}`}>
                  {l}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PESO DE HOJE + PERFIL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>

        {/* Peso */}
        <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Peso de hoje</p>
              <p className="text-base font-bold text-foreground">Registrar agora</p>
            </div>
            <Scale size={20} className="text-violet-500" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                value={pesoHoje}
                onChange={e => setPesoHoje(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="ex: 75,2"
                className="input pr-10 text-base tabular font-bold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">kg</span>
            </div>
            <button onClick={salvarPeso} disabled={pesoLoading || !pesoHoje}
                    className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {pesoLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">A evolução de peso aparece no Dashboard.</p>
        </div>

        {/* Perfil */}
        <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Perfil de saúde</p>
              <p className="text-base font-bold text-foreground">{perfil?.altura_cm ? 'Configurado' : 'Sem configuração'}</p>
            </div>
            <button onClick={() => setModalPerfil(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-[11px] font-bold hover:bg-violet-200 dark:hover:bg-violet-900/60">
              <Pencil size={11} /> {perfil?.altura_cm ? 'Editar' : 'Configurar'}
            </button>
          </div>
          {perfil?.altura_cm ? (
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Mini label="Altura"   value={`${perfil.altura_cm} cm`} />
              <Mini label="Sexo"     value={perfil.sexo === 'M' ? 'Masc' : perfil.sexo === 'F' ? 'Fem' : 'Outro'} />
              <Mini label="Idade"    value={idade ? `${idade} anos` : '—'} />
              <Mini label="Objetivo" value={perfil.objetivo} cap />
              <Mini label="Atividade" value={perfil.nivel_atividade} cap />
              <Mini label="Meta peso" value={perfil.meta_peso_kg ? `${perfil.meta_peso_kg} kg` : '—'} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sem perfil configurado, IMC e cálculos nutricionais ficam indisponíveis.
            </p>
          )}
        </div>
      </div>

      {/* HEATMAP 60 DIAS */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '180ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consistência</p>
            <p className="text-base font-bold text-foreground">Últimos 60 dias</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>0</span>
            <div className="flex items-center gap-0.5">
              {[0,1,2,3,4,5].map(n => (
                <div key={n} className="w-3 h-3 rounded-sm" style={{ background: n === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + n * 0.16})` }} />
              ))}
            </div>
            <span>5</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {heatmap.map(({ data, check }, i) => {
            const n = contagemCheck(check);
            const bg = n === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + n * 0.16})`;
            return (
              <div key={i} title={`${fmtData(data)} · ${n}/5`}
                   className="w-4 h-4 rounded-sm transition-transform hover:scale-125 hover:ring-1 hover:ring-violet-500"
                   style={{ background: bg }} />
            );
          })}
        </div>
      </div>

      {/* SINTOMAS */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sintomas</p>
            <p className="text-base font-bold text-foreground">Últimos 30 dias</p>
          </div>
          <button onClick={() => setModalSintoma(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-[11px] font-bold hover:bg-rose-200 dark:hover:bg-rose-900/60">
            <Plus size={11} /> Registrar
          </button>
        </div>

        {sintomas.length === 0 ? (
          <div className="rounded-2xl py-8 text-center bg-muted/20 border border-dashed border-border/60">
            <ActivityIcon size={18} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum sintoma registrado recentemente.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Registrar sintomas ajuda a IA a notar padrões com alimentação e humor.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {sintomas.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-rose-100 dark:bg-rose-950/40">
                  <ActivityIcon size={13} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{s.nome}</p>
                  <p className="text-[10px] text-muted-foreground tabular">
                    {fmtData(s.data)}{s.hora ? ` · ${s.hora.slice(0, 5)}` : ''}
                    {s.intensidade && ` · intensidade ${s.intensidade}/5`}
                  </p>
                  {s.observacao && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">"{s.observacao}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalPerfil && phone && (
        <ModalPerfilSaude phone={phone} perfil={perfil} onClose={() => setModalPerfil(false)} onSuccess={() => { carregar(); setModalPerfil(false); }} />
      )}
      {modalSintoma && phone && (
        <ModalSintoma phone={phone} onClose={() => setModalSintoma(false)} onSuccess={() => { carregar(); setModalSintoma(false); }} />
      )}
    </div>
  );
}

function Mini({ label, value, cap }: any) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xs font-bold text-foreground mt-0.5 ${cap ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}
