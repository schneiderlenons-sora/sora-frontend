'use client';

import { useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import {
  Bug, ImagePlus, X, Loader2, CheckCircle2, AlertCircle, Send, LifeBuoy,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const MAX_IMG = 6 * 1024 * 1024; // 6MB (cabe no limite de 10MB do backend após base64)

export default function ReportarBugPage() {
  const [mensagem, setMensagem] = useState('');
  const [imagem, setImagem]     = useState<string | null>(null); // data URI base64
  const [imagemNome, setImagemNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado]   = useState(false);
  const [erro, setErro]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reanexar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErro('Anexe uma imagem (PNG, JPG, WEBP).'); return; }
    if (file.size > MAX_IMG) { setErro('Imagem muito grande — máximo 6MB.'); return; }
    setErro('');
    const reader = new FileReader();
    reader.onload = () => { setImagem(reader.result as string); setImagemNome(file.name); };
    reader.readAsDataURL(file);
  }

  async function enviar() {
    if (!mensagem.trim() || enviando) return;
    setEnviando(true); setErro('');
    try {
      await api.bug.reportar({ mensagem: mensagem.trim(), imagem: imagem || undefined });
      setEnviado(true);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui enviar seu relato. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  function novoRelato() {
    setMensagem(''); setImagem(null); setImagemNome(''); setErro(''); setEnviado(false);
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-6">

        {/* Hero */}
        <div className="space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
               style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
            <Bug size={22} style={{ color: BRAND }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            Relatar um problema
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Encontrou um bug ou algo estranho? Conta pra gente o que aconteceu — quanto mais
            detalhe, mais rápido a gente resolve. Você pode anexar um print, se quiser.
          </p>
        </div>

        {enviado ? (
          /* ── Estado de sucesso ─────────────────────────────────── */
          <div
            className="rounded-3xl border p-8 text-center animate-fade-in"
            style={{
              borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)`,
              background: `color-mix(in srgb, ${BRAND} 5%, transparent)`,
            }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
              <CheckCircle2 size={30} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Relato enviado! 💚</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              Recebemos aqui e o time já vai dar uma olhada. Se precisarmos de mais detalhes,
              a gente te chama no WhatsApp. Obrigado por ajudar a melhorar a Sora!
            </p>
            <button
              onClick={novoRelato}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}
            >
              Relatar outro problema
            </button>
          </div>
        ) : (
          /* ── Formulário ────────────────────────────────────────── */
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <label htmlFor="bug-msg" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                O que aconteceu?
              </label>
              <textarea
                id="bug-msg"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={6}
                maxLength={4000}
                autoFocus
                placeholder="Ex.: Quando eu clico em 'Salvar conta' no onboarding, o botão não faz nada. Acontece sempre que…"
                className="w-full px-3.5 py-3 rounded-2xl bg-background border border-border text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-y min-h-[120px]"
              />
              <p className="text-[11px] text-muted-foreground text-right tabular-nums">{mensagem.length}/4000</p>
            </div>

            {/* Anexo de imagem (opcional) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Print da tela <span className="font-medium normal-case tracking-normal opacity-70">(opcional)</span>
              </span>

              {imagem ? (
                <div className="relative rounded-2xl border border-border overflow-hidden bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagem} alt={imagemNome || 'Print anexado'} className="w-full max-h-72 object-contain" />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-card/80 backdrop-blur">
                    <span className="text-xs text-muted-foreground truncate">{imagemNome}</span>
                    <button
                      onClick={() => { setImagem(null); setImagemNome(''); }}
                      className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      aria-label="Remover imagem"
                    >
                      <X size={14} /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full p-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                  style={{ minHeight: 44 }}
                >
                  <ImagePlus size={16} /> Anexar print
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
            </div>

            {/* Erro */}
            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60" role="alert">
                <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
              </div>
            )}

            {/* Enviar */}
            <button
              onClick={enviar}
              disabled={!mensagem.trim() || enviando}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}
            >
              {enviando ? <><Loader2 size={17} className="animate-spin" /> Enviando…</> : <><Send size={16} /> Enviar relato</>}
            </button>
          </div>
        )}

        {/* Atalho pro suporte humano */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card/60">
          <LifeBuoy size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Precisa de ajuda mais rápida? Fale direto com o suporte:{' '}
            <a href="mailto:contatosora.ai@gmail.com" className="font-semibold text-foreground hover:underline">contatosora.ai@gmail.com</a>{' '}
            ou no WhatsApp{' '}
            <a href="https://wa.me/5532999167475" className="font-semibold text-foreground hover:underline">(32) 99916-7475</a>.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
