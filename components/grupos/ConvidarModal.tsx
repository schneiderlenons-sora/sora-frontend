'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Check, Copy, RefreshCw, MessageCircle, Share2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  phone:    string;
  grupoId:  string;
  grupoNome: string;
  onClose:  () => void;
}

export default function ConvidarModal({ phone, grupoId, grupoNome, onClose }: Props) {
  const [codigo,    setCodigo]    = useState<string>('');
  const [loading,   setLoading]   = useState(false);
  const [erro,      setErro]      = useState('');
  const [copiado,   setCopiado]   = useState(false);

  async function gerarCodigo() {
    setErro('');
    setLoading(true);
    try {
      const r = await api.grupos.convidar(phone, grupoId);
      setCodigo(r.codigo);
    } catch (e: any) {
      setErro(e.message || 'Erro ao gerar código.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { gerarCodigo(); /* eslint-disable-next-line */ }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }

  const mensagemWA = encodeURIComponent(
    `🌱 Você foi convidado para o grupo "${grupoNome}" no Sora!\n\nUse o código *${codigo}* para entrar:\nhttps://sora.app\n\nO código expira em 7 dias.`
  );
  const qrUrl = codigo
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(codigo)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">Convidar para o grupo</h2>
            <p className="text-xs text-muted-foreground">{grupoNome}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading || !codigo ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Gerando código...</p>
            </div>
          ) : (
            <>
              {/* Código grande */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Código de convite
                </p>
                <p className="text-4xl font-mono font-bold text-foreground tracking-[0.3em] tabular">
                  {codigo}
                </p>
                <button
                  onClick={handleCopy}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-xs font-semibold transition-colors"
                >
                  {copiado ? (
                    <><Check size={12} className="text-green-600" /> Copiado!</>
                  ) : (
                    <><Copy size={12} /> Copiar código</>
                  )}
                </button>
              </div>

              {/* QR */}
              <div className="flex flex-col items-center">
                <div className="rounded-xl bg-white p-2 border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt={`QR ${codigo}`} className="block" width={180} height={180} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Compartilhe o código ou aponte a câmera no QR
                </p>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                ⏱️ Expira em <strong className="text-foreground">7 dias</strong>
              </p>

              {/* Compartilhar */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${mensagemWA}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline px-3 py-2 text-sm gap-2 justify-center inline-flex items-center"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `Convite Sora — ${grupoNome}`,
                          text: `Use o código ${codigo} para entrar no meu grupo Sora!`,
                        });
                      } catch {}
                    } else {
                      handleCopy();
                    }
                  }}
                  className="btn-outline px-3 py-2 text-sm gap-2 justify-center"
                >
                  <Share2 size={14} /> Compartilhar
                </button>
              </div>

              <button
                onClick={gerarCodigo}
                disabled={loading}
                className="w-full btn-ghost px-3 py-2 text-xs gap-1.5"
              >
                <RefreshCw size={11} /> Gerar novo código
              </button>
            </>
          )}

          {erro && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">{erro}</p>
          )}
        </div>
      </div>
    </div>
  );
}
