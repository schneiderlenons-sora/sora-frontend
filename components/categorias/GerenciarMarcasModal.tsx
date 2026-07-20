'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useMarcasCustom } from '@/contexts/MarcasCustomContext';
import { X, Loader2, Check, Trash2, Camera, Store, AlertCircle, Plus } from 'lucide-react';

// Redimensiona pra PNG (~200px) preservando transparência — logo de loja.
async function redimensionarPNG(file: File, max = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const escala = Math.min(max / img.width, max / img.height, 1);
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponível'));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = r.result as string;
    };
    r.onerror = () => reject(new Error('Erro ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

export default function GerenciarMarcasModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { marcas, recarregar } = useMarcasCustom();
  const [termo, setTermo]       = useState('');
  const [logo, setLogo]         = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (f.size > 8 * 1024 * 1024) { setErro('Imagem muito grande (máx. 8 MB).'); return; }
    setErro(''); setUploading(true);
    try { setLogo(await redimensionarPNG(f)); }
    catch (e: any) { setErro(e.message || 'Erro ao processar imagem.'); }
    finally { setUploading(false); }
  }

  async function salvar() {
    setErro('');
    if (termo.trim().length < 2) { setErro('Digite o nome da loja (como aparece nas compras).'); return; }
    if (!logo) { setErro('Escolha a logo da loja.'); return; }
    setSaving(true);
    try {
      await api.marcas.criar({ phone, termo: termo.trim(), logo_url: logo });
      setTermo(''); setLogo(null); recarregar();
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

          {/* Explicação */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Suba a logo de uma loja e escreva o nome dela <strong className="text-foreground">como aparece nas suas compras</strong> (ex.: <em>Padaria do Zé</em>). Sempre que esse nome estiver numa transação, a Sora mostra a logo — em qualquer categoria, igual às marcas famosas.
          </p>

          {/* Form de adicionar */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-border flex-shrink-0 bg-white flex items-center justify-center">
                {logo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="w-[86%] h-[86%] object-contain" />
                    <button type="button" onClick={() => setLogo(null)} title="Remover"
                            className="absolute top-0.5 right-0.5 p-1 rounded-lg bg-black/50 hover:bg-red-600 text-white">
                      <Trash2 size={10} />
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                          className="absolute inset-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Nome da loja</label>
                <input value={termo} onChange={e => setTermo(e.target.value)} placeholder="Padaria do Zé" maxLength={60}
                       className="w-full h-10 rounded-xl bg-card border border-border px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>
            <button onClick={salvar} disabled={saving || uploading}
                    className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar marca
            </button>
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
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white flex items-center justify-center ring-1 ring-border/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.logo_url} alt={m.termo} className="w-[86%] h-[86%] object-contain" />
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
