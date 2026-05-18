'use client';

import { useRef, useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Check, Flag, Upload, Camera, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

const ICONES = ['🎯','🏠','🚗','✈️','💍','🎓','💼','👶','🐶','💻','📚','🛒','🎮','💎','🎁','🪙'];
const CORES  = [
  { hex: '#61D17B', label: 'Verde'    },
  { hex: '#3b82f6', label: 'Azul'     },
  { hex: '#8b5cf6', label: 'Roxo'     },
  { hex: '#ec4899', label: 'Rosa'     },
  { hex: '#ef4444', label: 'Vermelho' },
  { hex: '#f59e0b', label: 'Amarelo'  },
  { hex: '#06b6d4', label: 'Ciano'    },
  { hex: '#22c55e', label: 'Esmeralda'},
];

// Redimensiona imagem pra dataURL ~800px (banner do card)
async function redimensionar(file: File, max = 1200, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const escala = Math.min(max / img.width, max / img.height, 1);
        c.width  = Math.round(img.width  * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponível'));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = r.result as string;
    };
    r.onerror = () => reject(new Error('Erro ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

interface Props {
  phone: string;
  edicao?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaMetaModal({ phone, edicao, onClose, onSuccess }: Props) {
  const ediMode = !!edicao;

  const [titulo,        setTitulo]        = useState(edicao?.titulo || '');
  const [descricao,     setDescricao]     = useState(edicao?.descricao || '');
  const [valorObjRaw,   setValorObjRaw]   = useState(
    edicao?.valor_objetivo ? String(Math.round(edicao.valor_objetivo * 100)) : ''
  );
  const [valorAtualRaw, setValorAtualRaw] = useState(
    edicao?.valor_atual ? String(Math.round(edicao.valor_atual * 100)) : ''
  );
  const [dataAlvo,      setDataAlvo]      = useState(edicao?.data_alvo || '');
  const [imagem,        setImagem]        = useState<string | null>(edicao?.imagem_url || null);
  const [cor,           setCor]           = useState(edicao?.cor || '#61D17B');
  const [icone,         setIcone]         = useState(edicao?.icone || '🎯');

  const [uploading, setUploading] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [erro,      setErro]      = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function fmtBR(raw: string) {
    if (!raw) return '0,00';
    return (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { setErro('Imagem muito grande (máx. 8 MB).'); return; }
    setUploading(true);
    try {
      const url = await redimensionar(file);
      setImagem(url);
    } catch (e: any) {
      setErro(e.message || 'Erro ao processar imagem.');
    } finally {
      setUploading(false);
    }
  }

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Dê um nome pra meta.'); return; }
    if (!valorObjRaw || valorObjRaw === '0') { setErro('Informe o valor objetivo.'); return; }
    setLoading(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        valor_objetivo: parseInt(valorObjRaw, 10) / 100,
        valor_atual:    parseInt(valorAtualRaw || '0', 10) / 100,
        data_alvo:      dataAlvo || null,
        imagem_url:     imagem || null,
        cor, icone,
      };
      if (ediMode) {
        await api.metas.editar(edicao.id, { ...payload, phone });
      } else {
        await api.metas.criar({ phone, ...payload });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar meta.');
    } finally {
      setLoading(false);
    }
  }

  const corPreview = cor;
  const valorObjPreview = parseFloat(valorObjRaw || '0') / 100;
  const valorAtualPreview = parseFloat(valorAtualRaw || '0') / 100;
  const pctPreview = valorObjPreview > 0 ? Math.min((valorAtualPreview / valorObjPreview) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all"
              style={{ background: `${corPreview}22`, color: corPreview }}
            >
              {icone}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ediMode ? 'Editar meta' : 'Nova meta'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                Defina um objetivo financeiro com prazo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Banner de foto */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Imagem da meta
            </label>
            <div className="relative rounded-2xl overflow-hidden border border-border group" style={{ aspectRatio: '16/7' }}>
              {imagem ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm hover:bg-card transition-colors"
                      title="Trocar"
                    >
                      <Camera size={13} className="text-foreground" />
                    </button>
                    <button
                      onClick={() => setImagem(null)}
                      className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground"
                >
                  {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  <span className="text-xs font-semibold">
                    {uploading ? 'Enviando...' : 'Adicionar imagem (opcional)'}
                  </span>
                  <span className="text-[10px]">JPG / PNG até 8MB · 16:7</span>
                </button>
              )}
              <input
                ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Nome da meta *
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder='Ex: "Casa dos Sonhos", "Viagem Suíça"'
              className="input"
              autoFocus
              maxLength={50}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Descrição <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Pra te lembrar por que essa meta importa"
              className="input"
              maxLength={120}
            />
          </div>

          {/* Valor objetivo + atual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Meta *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <input
                  inputMode="numeric"
                  value={fmtBR(valorObjRaw)}
                  onChange={e => setValorObjRaw(e.target.value.replace(/\D/g, ''))}
                  className="input pl-9 tabular text-right font-bold"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Já tenho
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <input
                  inputMode="numeric"
                  value={fmtBR(valorAtualRaw)}
                  onChange={e => setValorAtualRaw(e.target.value.replace(/\D/g, ''))}
                  className="input pl-9 tabular text-right"
                />
              </div>
            </div>
          </div>

          {/* Preview de progresso */}
          {valorObjPreview > 0 && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Progresso inicial</span>
                <span className="font-bold tabular" style={{ color: corPreview }}>{pctPreview.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width: `${pctPreview}%`, background: `linear-gradient(90deg, ${corPreview}, ${corPreview}aa)` }} />
              </div>
            </div>
          )}

          {/* Data alvo */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Quando você quer conquistar?
            </label>
            <input
              type="date"
              value={dataAlvo}
              onChange={e => setDataAlvo(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </div>

          {/* Ícone */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Ícone
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-muted/30 border border-border">
              {ICONES.map(e => (
                <button key={e} onClick={() => setIcone(e)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${
                    icone === e ? 'bg-primary/15 ring-2 ring-primary/40 scale-110' : 'hover:bg-card'
                  }`}>{e}</button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Cor da meta
            </label>
            <div className="flex flex-wrap gap-2">
              {CORES.map(c => (
                <button key={c.hex} onClick={() => setCor(c.hex)} title={c.label}
                  className={`relative w-9 h-9 rounded-full transition-all ${
                    cor === c.hex ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: c.hex, ...(cor === c.hex ? { '--tw-ring-color': c.hex } : {}) } as any}>
                  {cor === c.hex && <Check size={14} className="text-white absolute inset-0 m-auto" />}
                </button>
              ))}
            </div>
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ediMode ? 'Salvar alterações' : 'Criar meta'}
          </button>
        </div>
      </div>
    </div>
  );
}
