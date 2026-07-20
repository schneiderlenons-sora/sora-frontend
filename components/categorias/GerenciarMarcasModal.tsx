'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useMarcasCustom } from '@/contexts/MarcasCustomContext';
import { X, Loader2, Check, Trash2, Camera, Store, AlertCircle, Plus, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

const V = 176;   // lado do visor de recorte (px)
const OUT = 224; // lado da imagem final gerada

// Lê o arquivo e reduz pra no máx. `max`px (mantém qualidade pro zoom, corta memória).
async function lerReduzido(file: File, max = 1000): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const esc = Math.min(max / im.width, max / im.height, 1);
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * esc);
        c.height = Math.round(im.height * esc);
        const ctx = c.getContext('2d');
        if (!ctx) return rej(new Error('Canvas indisponível'));
        ctx.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      im.onerror = () => rej(new Error('Imagem inválida'));
      im.src = r.result as string;
    };
    r.onerror = () => rej(new Error('Erro ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

export default function GerenciarMarcasModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { marcas, recarregar } = useMarcasCustom();
  const [termo, setTermo]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Estado do recorte (zoom + posição)
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [nat, setNat]       = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom]     = useState(1);
  const [off, setOff]       = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag   = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const base = nat ? Math.max(V / nat.w, V / nat.h) : 1;
  const s    = base * zoom;
  const dw   = nat ? nat.w * s : V;
  const dh   = nat ? nat.h * s : V;

  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(V - dw, x)),
    y: Math.min(0, Math.max(V - dh, y)),
  });

  async function pickFile(f: File) {
    if (f.size > 8 * 1024 * 1024) { setErro('Imagem muito grande (máx. 8 MB).'); return; }
    setErro('');
    try {
      const url = await lerReduzido(f);
      const im = new Image();
      im.onload = () => {
        imgRef.current = im;
        setSrcUrl(url);
        setZoom(1);
        setNat({ w: im.naturalWidth, h: im.naturalHeight });
        const b = Math.max(V / im.naturalWidth, V / im.naturalHeight);
        const w = im.naturalWidth * b, h = im.naturalHeight * b;
        setOff({ x: (V - w) / 2, y: (V - h) / 2 }); // centraliza
      };
      im.onerror = () => setErro('Imagem inválida.');
      im.src = url;
    } catch (e: any) { setErro(e.message || 'Erro ao ler imagem.'); }
  }

  function aplicarZoom(z: number) {
    if (!nat) { setZoom(z); return; }
    const sNew = base * z;
    // mantém o ponto do centro do visor fixo ao ampliar
    const cx = (V / 2 - off.x) / s, cy = (V / 2 - off.y) / s;
    const nx = V / 2 - cx * sNew, ny = V / 2 - cy * sNew;
    const dw2 = nat.w * sNew, dh2 = nat.h * sNew;
    setZoom(z);
    setOff({ x: Math.min(0, Math.max(V - dw2, nx)), y: Math.min(0, Math.max(V - dh2, ny)) });
  }

  function onDown(e: React.PointerEvent) {
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff(clamp(drag.current.ox + (e.clientX - drag.current.px), drag.current.oy + (e.clientY - drag.current.py)));
  }
  function onUp() { drag.current = null; }

  // "Assa" o recorte visível num quadrado que preenche 100% do círculo.
  function bakear(): string {
    const c = document.createElement('canvas');
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT, OUT);
    const k = OUT / V;
    ctx.drawImage(imgRef.current!, off.x * k, off.y * k, dw * k, dh * k);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function limparCrop() { setSrcUrl(null); setNat(null); setZoom(1); setOff({ x: 0, y: 0 }); imgRef.current = null; }

  async function salvar() {
    setErro('');
    if (termo.trim().length < 2) { setErro('Digite o nome da loja (como aparece nas compras).'); return; }
    if (!srcUrl || !nat) { setErro('Escolha a logo da loja.'); return; }
    setSaving(true);
    try {
      await api.marcas.criar({ phone, termo: termo.trim(), logo_url: bakear() });
      setTermo(''); limparCrop(); recarregar();
    } catch (e: any) { setErro(e.message || 'Não deu pra salvar.'); }
    finally { setSaving(false); }
  }

  async function remover(id: string) {
    setRemovendo(id);
    try { await api.marcas.remover(id, phone); recarregar(); }
    catch (e: any) { setErro(e.message || 'Erro ao remover.'); }
    finally { setRemovendo(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
              <Store size={16} style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">Minhas marcas</h2>
              <p className="text-[11px] text-muted-foreground mt-1">Logo de loja que aparece sozinha nas compras</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">

          <p className="text-xs text-muted-foreground leading-relaxed">
            Suba a logo de uma loja e escreva o nome dela <strong className="text-foreground">como aparece nas suas compras</strong> (ex.: <em>Academia SmartFit</em>). Sempre que esse nome estiver numa transação, a Sora mostra a logo — em qualquer categoria.
          </p>

          {/* Form de adicionar */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">

            {!srcUrl ? (
              <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full h-28 rounded-2xl border-2 border-dashed border-border hover:border-primary/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                <Camera size={22} />
                <span className="text-xs font-bold">Escolher logo</span>
                <span className="text-[10px]">JPG ou PNG</span>
              </button>
            ) : (
              <div className="space-y-3">
                {/* Visor de recorte circular */}
                <div className="flex justify-center">
                  <div
                    className="relative rounded-full overflow-hidden bg-white ring-2 ring-border touch-none cursor-grab active:cursor-grabbing select-none"
                    style={{ width: V, height: V }}
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={srcUrl} alt="" draggable={false}
                         style={{ position: 'absolute', left: off.x, top: off.y, width: dw, height: dh, maxWidth: 'none' }} />
                    <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/10" />
                  </div>
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-2">
                  <ZoomOut size={15} className="text-muted-foreground flex-shrink-0" />
                  <input type="range" min={1} max={4} step={0.01} value={zoom}
                         onChange={(e) => aplicarZoom(parseFloat(e.target.value))}
                         className="flex-1 accent-primary cursor-pointer" />
                  <ZoomIn size={15} className="text-muted-foreground flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">Arraste pra posicionar · amplie pra tirar o branco.</p>
                  <button type="button" onClick={() => fileRef.current?.click()}
                          className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1">
                    <RefreshCw size={11} /> Trocar
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Nome da loja</label>
              <input value={termo} onChange={e => setTermo(e.target.value)} placeholder="Academia SmartFit" maxLength={60}
                     className="w-full h-10 rounded-xl bg-card border border-border px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>

            <button onClick={salvar} disabled={saving}
                    className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar marca
            </button>

            <input ref={fileRef} type="file" accept="image/*" hidden
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }} />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}

          {/* Lista */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {marcas.length > 0 ? `${marcas.length} marca${marcas.length === 1 ? '' : 's'}` : 'Nenhuma marca ainda'}
            </p>
            {marcas.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.logo_url} alt={m.termo} className="w-full h-full object-cover" />
                </div>
                <p className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{m.termo}</p>
                <button onClick={() => remover(m.id)} disabled={removendo === m.id}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50">
                  {removendo === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="h-10 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold inline-flex items-center gap-2">
            <Check size={14} /> Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
