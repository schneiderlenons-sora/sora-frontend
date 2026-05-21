'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Check, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const BRAND = '#61ce70';

const REGIMES = [
  { v: 'mei',              label: 'MEI',                desc: 'Microempreendedor — DAS fixo mensal', aliq: 0 },
  { v: 'simples',          label: 'Simples Nacional',   desc: 'Anexo III (serviços) ou V — alíquota progressiva', aliq: 6 },
  { v: 'lucro_presumido',  label: 'Lucro Presumido',    desc: 'IRPJ + CSLL + PIS + Cofins (~11.33%)', aliq: 11.33 },
  { v: 'lucro_real',       label: 'Lucro Real',         desc: 'Sobre lucro líquido — calcule manualmente', aliq: 15 },
  { v: 'pf',               label: 'Pessoa Física',      desc: 'Carnê-leão / IR mensal', aliq: 27.5 },
];

export default function ModalConfigTributaria({ onClose }: { onClose: () => void }) {
  const { phone } = useAuth();
  const [cfg, setCfg] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!phone) return;
    api.negocios.config.get(phone).then(setCfg).catch(() => setCfg({}));
  }, [phone]);

  function set<K extends string>(k: K, v: any) {
    setCfg((c: any) => ({ ...c, [k]: v }));
  }

  async function salvar() {
    if (!phone) return;
    setSalvando(true);
    try {
      await api.negocios.config.salvar({
        phone,
        regime_tributario: cfg.regime_tributario,
        aliquota_simples: parseFloat(cfg.aliquota_simples) || 0,
        reservar_imposto: !!cfg.reservar_imposto,
        pct_reserva_imposto: parseFloat(cfg.pct_reserva_imposto) || 0,
        ai_insights_ativo: cfg.ai_insights_ativo ?? true,
      });
      setSalvo(true);
      setTimeout(() => { setSalvo(false); onClose(); }, 900);
    } catch (e: any) { alert(e.message); }
    finally { setSalvando(false); }
  }

  if (!cfg) return null;

  const regimeAtual = REGIMES.find(r => r.v === cfg.regime_tributario) || REGIMES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground tracking-tight">Configuração tributária</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Usado pra calcular imposto reservado no DRE.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* Regime tributário */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Regime tributário</p>
            <div className="space-y-1.5">
              {REGIMES.map(r => {
                const ativo = cfg.regime_tributario === r.v;
                return (
                  <button key={r.v}
                          onClick={() => { set('regime_tributario', r.v); if (r.aliq > 0) set('aliquota_simples', r.aliq); }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                            ativo ? 'border-foreground/30 bg-foreground/[0.03]' : 'border-border hover:border-foreground/20'
                          }`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">{r.label}</p>
                      {ativo && <Check size={14} style={{ color: BRAND }} />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alíquota */}
          {regimeAtual.v !== 'mei' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alíquota efetiva (%)</label>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  value={cfg.aliquota_simples ?? 0}
                  onChange={e => set('aliquota_simples', e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl bg-card border border-border text-sm font-mono tabular-nums text-foreground focus:outline-none focus:border-foreground/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                <Info size={10} className="mt-0.5 flex-shrink-0" />
                Use a alíquota efetiva do seu DAS atual. No Simples Anexo III é entre 6% e 33%.
              </p>
            </div>
          )}

          {/* Reservar imposto automaticamente */}
          <div className="rounded-xl bg-muted/30 border border-border p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-bold text-foreground">Reservar imposto automaticamente</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Subtrai o % da receita líquida no DRE como provisão.</p>
              </div>
              <input
                type="checkbox"
                checked={!!cfg.reservar_imposto}
                onChange={e => set('reservar_imposto', e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-current"
                style={{ accentColor: BRAND }}
              />
            </label>
          </div>

          {/* IA insights toggle */}
          <div className="rounded-xl bg-muted/30 border border-border p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-bold text-foreground">Insights da IA</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">A Sora analisa seus dados e gera alertas/sugestões automaticamente.</p>
              </div>
              <input
                type="checkbox"
                checked={cfg.ai_insights_ativo ?? true}
                onChange={e => set('ai_insights_ativo', e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: BRAND }}
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-muted/20 flex items-center gap-2">
          <button onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
            Cancelar
          </button>
          <button onClick={salvar}
                  disabled={salvando}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
            {salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando…</>
              : salvo ? <><Check size={14} /> Salvo!</>
              : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
