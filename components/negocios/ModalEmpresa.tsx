'use client';

import { useRef, useState } from 'react';
import { X, Check, Loader2, AlertCircle, Camera, Trash2, Store, Laptop, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  CORES_EMPRESA, COR_PADRAO, TIPOS_EMPRESA,
  type Empresa, type TipoEmpresa,
} from '@/lib/empresas';
import EmpresaAvatar from './EmpresaAvatar';

const ICONE_TIPO: Record<string, any> = { Store, Laptop, Building2 };

// Canvas do recorte: V = tamanho do quadro na tela, OUT = resolução salva.
const V = 200;
const OUT = 256;

export default function ModalEmpresa({
  empresa, onClose, onSalvo,
}: {
  empresa?: Empresa | null;      // ausente = criar
  onClose: () => void;
  onSalvo: (e: Empresa) => void;
}) {
  const editando = !!empresa?.id;

  const [nome, setNome] = useState(empresa?.nome || '');
  const [tipo, setTipo] = useState<TipoEmpresa>(empresa?.tipo || 'fisico');
  const [cor,  setCor]  = useState(empresa?.cor || COR_PADRAO);
  const [cnpj, setCnpj] = useState(empresa?.cnpj || '');
  const [logo, setLogo] = useState<string | null>(empresa?.logo_url || null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // ── Recorte da logo (mesmo padrão das marcas: arrasta + zoom + canvas) ──
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const escala = nat ? (V / Math.min(nat.w, nat.h)) * zoom : 1;
  const dw = nat ? nat.w * escala : 0;
  const dh = nat ? nat.h * escala : 0;

  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(V - dw, x)),
    y: Math.min(0, Math.max(V - dh, y)),
  });

  function escolherArquivo(file?: File | null) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setNat({ w: img.naturalWidth, h: img.naturalHeight });
        setZoom(1);
        setOff({ x: 0, y: 0 });
        setSrcUrl(String(r.result));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  }

  function onDown(e: React.PointerEvent) {
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff(clamp(drag.current.ox + (e.clientX - drag.current.px), drag.current.oy + (e.clientY - drag.current.py)));
  }
  const onUp = () => { drag.current = null; };

  /** "Assa" o recorte visível numa imagem quadrada. */
  function bakear(): string | null {
    if (!imgRef.current || !nat) return null;
    const c = document.createElement('canvas');
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT, OUT);
    const k = OUT / V;
    ctx.drawImage(imgRef.current, off.x * k, off.y * k, dw * k, dh * k);
    return c.toDataURL('image/jpeg', 0.85);
  }

  async function salvar() {
    if (salvando) return;
    setErro('');
    if (nome.trim().length < 2) { setErro('Dê um nome pra sua empresa.'); return; }

    setSalvando(true);
    try {
      const logoFinal = srcUrl ? bakear() : logo;
      const body = { nome: nome.trim(), tipo, cor, cnpj: cnpj.trim() || undefined, logo_url: logoFinal || undefined };
      const r = editando
        ? await api.negocios.empresas.editar(empresa!.id, body)
        : await api.negocios.empresas.criar(body);
      onSalvo(r.empresa);
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const previa: Empresa = { id: 'previa', nome: nome || 'Sua empresa', tipo, cor, logo_url: srcUrl ? null : logo };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">
            {editando ? 'Editar empresa' : 'Nova empresa'}
          </h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Identidade: prévia + logo */}
          <div className="flex items-center gap-4">
            <EmpresaAvatar empresa={previa} tamanho="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{nome || 'Sua empresa'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {logo || srcUrl ? 'Logo definida' : 'Sem logo — usamos as iniciais'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <label className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold cursor-pointer transition-colors">
                  <Camera size={14} /> {logo || srcUrl ? 'Trocar' : 'Enviar logo'}
                  <input type="file" accept="image/*" className="hidden"
                         onChange={e => escolherArquivo(e.target.files?.[0])} />
                </label>
                {(logo || srcUrl) && (
                  <button
                    onClick={() => { setLogo(null); setSrcUrl(null); setNat(null); imgRef.current = null; }}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    <Trash2 size={14} /> Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recorte (só quando acabou de escolher um arquivo) */}
          {srcUrl && nat && (
            <div className="rounded-2xl border border-border/60 p-4 bg-muted/20">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Enquadre a logo
              </p>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative overflow-hidden rounded-2xl bg-white cursor-grab active:cursor-grabbing touch-none"
                  style={{ width: V, height: V }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcUrl} alt="Prévia da logo" draggable={false}
                       style={{ position: 'absolute', left: off.x, top: off.y, width: dw, height: dh, maxWidth: 'none' }} />
                </div>
                <label className="w-full">
                  <span className="sr-only">Zoom da logo</span>
                  <input type="range" min={1} max={3} step={0.01} value={zoom}
                         onChange={e => {
                           const z = parseFloat(e.target.value);
                           setZoom(z);
                           setTimeout(() => setOff(o => clamp(o.x, o.y)), 0);
                         }}
                         className="w-full accent-primary" />
                </label>
                <p className="text-[11px] text-muted-foreground text-center">
                  Arraste pra posicionar · use o controle pra aproximar
                </p>
              </div>
            </div>
          )}

          {/* Nome */}
          <div>
            <label htmlFor="emp-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Nome da empresa
            </label>
            <input id="emp-nome" value={nome} onChange={e => setNome(e.target.value)}
                   className="input w-full" placeholder="Ex.: Padaria do Zé" autoComplete="organization" />
          </div>

          {/* Tipo — define o que a aba mostra */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Tipo de negócio
            </span>
            <div className="space-y-2">
              {TIPOS_EMPRESA.map(t => {
                const Icon = ICONE_TIPO[t.icone] || Store;
                const on = tipo === t.v;
                return (
                  <button key={t.v} onClick={() => setTipo(t.v)}
                          aria-pressed={on}
                          className="w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors"
                          style={{
                            borderColor: on ? cor : 'hsl(var(--border) / 0.6)',
                            background: on ? `color-mix(in srgb, ${cor} 10%, transparent)` : 'transparent',
                          }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: on ? `color-mix(in srgb, ${cor} 18%, transparent)` : 'hsl(var(--foreground) / 0.05)' }}>
                      <Icon size={17} style={{ color: on ? cor : 'hsl(var(--muted-foreground))' }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground">{t.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                    </span>
                    {on && <Check size={16} style={{ color: cor }} className="flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cor de destaque */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Cor de destaque
            </span>
            <div className="flex flex-wrap gap-2">
              {CORES_EMPRESA.map(c => {
                const on = cor === c;
                return (
                  <button key={c} onClick={() => setCor(c)}
                          aria-label={`Cor ${c}`} aria-pressed={on}
                          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform active:scale-95"
                          style={{ background: c, outline: on ? `2px solid hsl(var(--foreground))` : 'none', outlineOffset: 2 }}>
                    {on && <Check size={16} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              A aba usa essa cor quando a empresa está ativa — ajuda a saber onde você está.
            </p>
          </div>

          {/* CNPJ (opcional) */}
          <div>
            <label htmlFor="emp-cnpj" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              CNPJ <span className="normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <input id="emp-cnpj" value={cnpj} onChange={e => setCnpj(e.target.value)}
                   inputMode="numeric" className="input w-full tabular" placeholder="00.000.000/0000-00" />
          </div>

          {erro && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={() => !salvando && onClose()} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity"
                  style={{ background: cor }}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {editando ? 'Salvar' : 'Criar empresa'}
          </button>
        </div>
      </div>
    </div>
  );
}
