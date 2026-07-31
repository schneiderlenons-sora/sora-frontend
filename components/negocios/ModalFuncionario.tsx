'use client';

import { useState } from 'react';
import { X, Check, Loader2, AlertCircle, Camera, Trash2, UserRound, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtCent } from '@/lib/lancamentos';
import { VINCULOS, iniciais, type Funcionario, type VinculoFuncionario } from '@/lib/funcionarios';

// Foto do funcionário: recorte CENTRAL automático (diferente da logo da
// empresa, que tem enquadramento manual porque é identidade de marca). Aqui o
// centro da imagem quase sempre é o rosto — não vale o custo de UI extra.
const OUT = 256;

function centralizarQuadrado(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Não consegui ler a imagem.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - lado) / 2;
        const sy = (img.naturalHeight - lado) / 2;
        const c = document.createElement('canvas');
        c.width = OUT; c.height = OUT;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, OUT, OUT);
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, OUT, OUT);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

export default function ModalFuncionario({
  empresaId, cor, funcionario, onClose, onSalvo, onArquivado,
}: {
  empresaId: string;
  cor: string;
  funcionario?: Funcionario | null;   // ausente = novo
  onClose: () => void;
  onSalvo: () => void;
  onArquivado?: () => void;
}) {
  const editando = !!funcionario?.id;

  const [nome, setNome] = useState(funcionario?.nome || '');
  const [cargo, setCargo] = useState(funcionario?.cargo || '');
  const [vinculo, setVinculo] = useState<VinculoFuncionario>(funcionario?.vinculo || 'clt');
  const [salario, setSalario] = useState(funcionario ? String(funcionario.salario) : '');
  const [dia, setDia] = useState(funcionario?.dia_pagamento ? String(funcionario.dia_pagamento) : '');
  const [pix, setPix] = useState(funcionario?.pix || '');
  const [foto, setFoto] = useState<string | null>(funcionario?.foto_url || null);
  const [comissao, setComissao] = useState(
    funcionario?.comissao_pct ? String(funcionario.comissao_pct).replace('.', ',') : '');
  const [encargos, setEncargos] = useState(!!funcionario?.encargos);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salarioCent = parseInt(salario || '0', 10) || 0;

  async function escolherFoto(file?: File | null) {
    if (!file) return;
    try { setFoto(await centralizarQuadrado(file)); }
    catch (e: any) { setErro(e?.message || 'Não consegui usar essa imagem.'); }
  }

  async function salvar() {
    if (salvando) return;
    setErro('');
    if (nome.trim().length < 2) { setErro('Informe o nome do funcionário.'); return; }
    const diaNum = dia ? parseInt(dia, 10) : null;
    if (diaNum !== null && (isNaN(diaNum) || diaNum < 1 || diaNum > 31)) {
      setErro('O dia do pagamento deve ser entre 1 e 31.'); return;
    }

    setSalvando(true);
    try {
      const body = {
        empresa_id: empresaId,
        nome: nome.trim(),
        cargo: cargo.trim() || undefined,
        vinculo,
        salario: salarioCent,
        dia_pagamento: diaNum ?? undefined,
        pix: pix.trim() || undefined,
        foto_url: foto || undefined,
        comissao_pct: parseFloat((comissao || '0').replace(',', '.')) || 0,
        encargos,
      };
      if (editando) await api.negocios.funcionarios.editar(funcionario!.id, body);
      else await api.negocios.funcionarios.criar(body);
      onSalvo();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function arquivar() {
    if (!editando || salvando) return;
    if (!confirm(`Arquivar ${funcionario!.nome}? O histórico de pagamentos é preservado.`)) return;
    setSalvando(true);
    try {
      await api.negocios.funcionarios.arquivar(funcionario!.id);
      onArquivado?.();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui arquivar.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">
            {editando ? 'Editar funcionário' : 'Novo funcionário'}
          </h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Foto + identidade */}
          <div className="flex items-center gap-4">
            <span className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: foto ? 'transparent' : `color-mix(in srgb, ${cor} 16%, transparent)` }}>
              {foto
                ? <img src={foto} alt="" className="w-full h-full object-cover" />
                : nome
                  ? <span className="text-lg font-bold" style={{ color: cor }}>{iniciais(nome)}</span>
                  : <UserRound size={24} style={{ color: cor }} />}
            </span>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 h-11 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold cursor-pointer transition-colors">
                <Camera size={14} /> {foto ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" className="hidden"
                       onChange={e => escolherFoto(e.target.files?.[0])} />
              </label>
              {foto && (
                <button onClick={() => setFoto(null)} aria-label="Remover foto"
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="f-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
            <input id="f-nome" value={nome} onChange={e => setNome(e.target.value)}
                   className="input w-full" placeholder="Ex.: João da Silva" autoComplete="name" />
          </div>

          <div>
            <label htmlFor="f-cargo" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Cargo <span className="normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <input id="f-cargo" value={cargo} onChange={e => setCargo(e.target.value)}
                   className="input w-full" placeholder="Ex.: Atendente" />
          </div>

          {/* Vínculo */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Vínculo</span>
            <div className="flex flex-wrap gap-2">
              {VINCULOS.map(v => {
                const on = vinculo === v.v;
                return (
                  <button key={v.v} onClick={() => setVinculo(v.v)} aria-pressed={on}
                          className="h-11 px-4 rounded-xl text-xs font-semibold border transition-colors"
                          style={{
                            borderColor: on ? cor : 'hsl(var(--border) / 0.6)',
                            background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                            color: on ? cor : 'hsl(var(--foreground))',
                          }}>
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salário + dia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="f-sal" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Salário</label>
              <input id="f-sal" inputMode="numeric" value={salario}
                     onChange={e => setSalario(e.target.value.replace(/\D/g, ''))}
                     className="input w-full tabular" placeholder="0,00" />
              <p className="text-[11px] text-muted-foreground mt-1 tabular">{fmtCent(salarioCent)}</p>
            </div>
            <div>
              <label htmlFor="f-dia" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Dia do pagamento</label>
              <input id="f-dia" inputMode="numeric" value={dia}
                     onChange={e => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))}
                     className="input w-full tabular" placeholder="5" />
              <p className="text-[11px] text-muted-foreground mt-1">A Sora te lembra na Agenda</p>
            </div>
          </div>

          <div>
            <label htmlFor="f-com" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Comissão por venda <span className="normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <div className="relative">
              <input id="f-com" inputMode="decimal" value={comissao}
                     onChange={e => setComissao(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
                     className="input w-full tabular pr-9" placeholder="0" />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              A Sora calcula sozinha a cada venda registrada com essa pessoa como vendedora.
            </p>
          </div>

          {/* Encargos: opt-in, com o motivo do padrão desligado escrito */}
          <div className="rounded-2xl border border-border p-3.5">
            <button onClick={() => setEncargos(v => !v)} role="switch" aria-checked={encargos}
                    className="w-full flex items-center gap-3 text-left" style={{ minHeight: 44 }}>
              <span className="w-11 h-6 rounded-full flex-shrink-0 transition-colors relative"
                    style={{ background: encargos ? cor : 'hsl(var(--muted))' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                      style={{ left: encargos ? 22 : 2 }} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Estimar encargos</span>
                <span className="block text-[11px] text-muted-foreground leading-snug">
                  FGTS, 13º e férias — soma ~29% ao custo desta pessoa
                </span>
              </span>
            </button>
            {encargos && (
              <p className="flex items-start gap-2 text-[11px] text-muted-foreground mt-2.5 pt-2.5 border-t border-border/60 leading-relaxed">
                <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
                É estimativa gerencial pra você saber o custo — <b className="text-foreground">não é folha
                oficial</b>. No Simples Nacional (anexos I a III) a contribuição patronal já vai dentro do DAS.
                Confirme com seu contador.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="f-pix" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Chave Pix <span className="normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <input id="f-pix" value={pix} onChange={e => setPix(e.target.value)}
                   className="input w-full" placeholder="CPF, e-mail ou telefone" />
          </div>

          {erro && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          {editando && (
            <button onClick={arquivar} disabled={salvando} aria-label="Arquivar funcionário"
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => !salvando && onClose()} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity"
                  style={{ background: cor }}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
