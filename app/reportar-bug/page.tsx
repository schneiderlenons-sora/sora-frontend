'use client';

import { useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import MeusChamados from '@/components/suporte/MeusChamados';
import {
  Bug, ImagePlus, X, Loader2, CheckCircle2, AlertCircle, Send, LifeBuoy, Lightbulb,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const MAX_IMG = 6 * 1024 * 1024; // 6MB (cabe no limite de 10MB do backend após base64)

export default function ReportarBugPage() {
  const [tipo, setTipo] = useState<'problema' | 'melhoria'>('problema');
  const ehMelhoria = tipo === 'melhoria';
  const [mensagem, setMensagem] = useState('');
  const [imagem, setImagem]     = useState<string | null>(null); // data URI base64
  const [imagemNome, setImagemNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado]   = useState(false);
  const [erro, setErro]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Deixa a lista de chamados se recarregar quando um relato novo entra —
  // senao o chamado que a pessoa acabou de abrir so aparece no proximo F5.
  const recarregarChamados = useRef<(() => void) | null>(null);

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
      await api.bug.reportar({ mensagem: mensagem.trim(), imagem: imagem || undefined, tipo });
      setEnviado(true);
      recarregarChamados.current?.();
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

        {/* Alternador problema / melhoria */}
        {!enviado && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {([['problema', 'Relatar problema', Bug], ['melhoria', 'Propor melhoria', Lightbulb]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setTipo(id); setErro(''); }}
                      className={`inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all ${
                        tipo === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`} style={{ minHeight: 44 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Hero */}
        <div className="space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
               style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
            {ehMelhoria ? <Lightbulb size={22} style={{ color: BRAND }} /> : <Bug size={22} style={{ color: BRAND }} />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            {ehMelhoria ? 'Propor uma melhoria' : 'Relatar um problema'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {ehMelhoria
              ? 'Tem uma ideia ou sente falta de algo na Sora? Conta pra gente o que você gostaria de ver — toda sugestão é lida e ajuda a definir o que vem por aí.'
              : 'Encontrou um bug ou algo estranho? Conta pra gente o que aconteceu — quanto mais detalhe, mais rápido a gente resolve. Você pode anexar um print, se quiser.'}
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
            <h2 className="text-xl font-bold text-foreground">{ehMelhoria ? 'Sugestão enviada! 💡' : 'Relato enviado! 💚'}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              {ehMelhoria
                ? 'Recebemos sua ideia e ela já entrou na nossa lista pra avaliar. Obrigado por ajudar a construir a Sora! 💚'
                : 'Recebemos aqui e o time já vai dar uma olhada. Se precisarmos de mais detalhes, a gente te chama no WhatsApp. Obrigado por ajudar a melhorar a Sora!'}
            </p>
            <button
              onClick={novoRelato}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}
            >
              {ehMelhoria ? 'Propor outra melhoria' : 'Relatar outro problema'}
            </button>
          </div>
        ) : (
          /* ── Formulário ────────────────────────────────────────── */
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <label htmlFor="bug-msg" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {ehMelhoria ? 'Qual a sua ideia?' : 'O que aconteceu?'}
              </label>
              <textarea
                id="bug-msg"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={6}
                maxLength={4000}
                autoFocus
                placeholder={ehMelhoria
                  ? 'Ex.: Seria ótimo poder exportar minhas transações em PDF. Ou: queria uma categoria pra assinaturas…'
                  : "Ex.: Quando eu clico em 'Salvar conta' no onboarding, o botão não faz nada. Acontece sempre que…"}
                className="w-full px-3.5 py-3 rounded-2xl bg-background border border-border text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-y min-h-[120px]"
              />
              <p className="text-[11px] text-muted-foreground text-right tabular-nums">{mensagem.length}/4000</p>
            </div>

            {/* Anexo de imagem (opcional) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {ehMelhoria ? 'Imagem de referência' : 'Print da tela'} <span className="font-medium normal-case tracking-normal opacity-70">(opcional)</span>
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
              {enviando ? <><Loader2 size={17} className="animate-spin" /> Enviando…</> : <><Send size={16} /> {ehMelhoria ? 'Enviar sugestão' : 'Enviar relato'}</>}
            </button>
          </div>
        )}

        {/* Chamados abertos — a conversa com o suporte. Fica ABAIXO do
            formulario porque quem chega nesta tela vem relatar algo; a lista
            e consulta, nao a acao principal. Some sozinha quando nao ha
            chamado nenhum (o componente devolve null). */}
        <MeusChamados recarregarRef={recarregarChamados} />

        {/* Atalho pro suporte humano */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card/60">
          <LifeBuoy size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Precisa de ajuda mais rápida? Fale direto com o suporte:{' '}
            <a href="mailto:contato@forsora.com" className="font-semibold text-foreground hover:underline">contato@forsora.com</a>.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
