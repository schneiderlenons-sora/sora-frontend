'use client';

import { useState } from 'react';
import { api, type NovaRegra, type TipoRegra, type ModoMatch, type EscopoIgnorar } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { Loader2, Search, Tag, Pencil, Repeat, AlertCircle } from 'lucide-react';

// =============================================================================
// "Nova regra" — o formulário do card do Watson.
//
// Reproduz a tela de referência campo a campo:
//   CATEGORIZAR      descrição · texto exato|contém · categoria · renomear para
//                    · considerar como recorrente
//   NÃO CONSIDERAR   em tudo|só na despesa/receita · descrição · exato|contém
//
// ⚠️ A DESCRIÇÃO NÃO É ADIVINHAÇÃO. O texto que se digita aqui é o que o banco
// escreve no extrato — o servidor só normaliza caixa e acento, sem remover
// nenhuma palavra. É por isso que "PAGAMENTO DEBITO AUTOMATICO" funciona: a
// extração de termo (que tira "pagamento", "debito"…) NÃO roda neste caminho.
//
// Regras de UI (skill ui-ux-pro-max):
//  · rótulo visível em cada campo, nunca placeholder sozinho (§8 input-labels);
//  · o texto de ajuda muda com a escolha e explica a CONSEQUÊNCIA (§8);
//  · botão desabilitado com spinner enquanto grava (§2 loading-buttons);
//  · alvos de toque ≥44pt e `aria-pressed` nos segmentados (§1, §2).
// =============================================================================

type Props = {
  phone: string;
  categorias: { id: string; nome: string }[];
  /** Pré-preenche a descrição (sugestão do Watson ou edição de transação). */
  descricaoInicial?: string;
  categoriaInicial?: string | null;
  onPronto: (r: { atualizadas: number }) => void;
  onCancelar: () => void;
};

function Segmentado<T extends string>({ valor, onChange, opcoes }: {
  valor: T; onChange: (v: T) => void; opcoes: { v: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border/60 p-1"
         style={{ background: 'hsl(var(--bg-muted) / 0.4)' }}>
      {opcoes.map((o) => {
        const ativo = valor === o.v;
        return (
          <button key={o.v} type="button" aria-pressed={ativo}
            onClick={() => onChange(o.v)}
            className={`rounded-xl px-3 text-[13px] font-bold transition-colors ${
              ativo ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
            style={{ background: ativo ? 'hsl(var(--primary))' : 'transparent', minHeight: 44 }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function RegraForm({
  phone, categorias, descricaoInicial = '', categoriaInicial = null, onPronto, onCancelar,
}: Props) {
  const [tipo, setTipo]         = useState<TipoRegra>('categorizar');
  const [descricao, setDesc]    = useState(descricaoInicial);
  const [match, setMatch]       = useState<ModoMatch>('contem');
  const [categoria, setCat]     = useState<string>(categoriaInicial || '');
  const [renomear, setRenomear] = useState('');
  const [recorrente, setRec]    = useState(false);
  const [escopo, setEscopo]     = useState<EscopoIgnorar>('tudo');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState('');

  async function salvar() {
    const texto = descricao.trim();
    if (!texto) { setErro('Escreva a descrição do lançamento.'); return; }
    if (tipo === 'categorizar' && !categoria && !renomear.trim()) {
      setErro('Escolha uma categoria ou um novo nome.'); return;
    }
    setSalvando(true); setErro('');
    try {
      const body: NovaRegra & { phone: string } = {
        phone, descricao: texto, tipo, modo_match: match,
        categoria:      tipo === 'categorizar' ? (categoria || null) : null,
        renomear_para:  tipo === 'categorizar' ? (renomear.trim() || null) : null,
        recorrente:     tipo === 'categorizar' ? recorrente : false,
        ignorar_escopo: tipo === 'ignorar' ? escopo : undefined,
      };
      const r = await api.regras.criar(body);
      onPronto({ atualizadas: r.atualizadas || 0 });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui criar a regra.');
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Categorizar × Não considerar */}
      <Segmentado
        valor={tipo} onChange={setTipo}
        opcoes={[{ v: 'categorizar', label: 'Categorizar' }, { v: 'ignorar', label: 'Não considerar' }]}
      />

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        {tipo === 'categorizar'
          ? 'Quando a descrição de um lançamento casar, ele vai pra categoria escolhida — e nos próximos que chegarem do banco também.'
          : 'Lançamentos que casam com esse texto deixam de ser considerados. Apague a regra pra voltar.'}
      </p>

      {/* Escopo — só no "Não considerar", e ANTES da descrição, como na
          referência: é a decisão mais pesada da tela. */}
      {tipo === 'ignorar' && (
        <>
          <Segmentado
            valor={escopo} onChange={setEscopo}
            opcoes={[{ v: 'tudo', label: 'Em tudo' }, { v: 'fluxo', label: 'Só na despesa/receita' }]}
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {escopo === 'tudo'
              ? 'Não conta em lugar nenhum: sai das somas e da fatura do cartão.'
              : 'Sai de receitas e despesas, mas CONTINUA na fatura do cartão.'}
          </p>
        </>
      )}

      {/* Descrição */}
      <div>
        <label htmlFor="regra-desc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Search size={11} /> Descrição
        </label>
        <input
          id="regra-desc" type="text" value={descricao}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ex: PAGAMENTO DEBITO AUTOMATICO"
          className="input py-3 text-[14px]" style={{ minHeight: 44 }}
        />
        {/* ⚠️ A instrução que torna isto NÃO-adivinhação. */}
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Escreva <b className="text-foreground">como aparece no extrato do banco</b>. Pode copiar da
          própria transação — maiúsculas, acentos e pontuação não importam.
        </p>
      </div>

      {/* Texto exato × Contém */}
      <Segmentado
        valor={match} onChange={setMatch}
        opcoes={[{ v: 'exato', label: 'Texto exato' }, { v: 'contem', label: 'Contém' }]}
      />
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        {match === 'exato'
          ? 'Casa quando a descrição é idêntica (ignora acento e maiúscula).'
          : 'Casa quando a descrição tem esse trecho em qualquer lugar — pega variações com data e código.'}
      </p>

      {/* Campos do "Categorizar" */}
      {tipo === 'categorizar' && (
        <div className="rounded-2xl border border-border/60 divide-y divide-border/50"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center gap-3 p-3">
            <Tag size={15} className="text-muted-foreground flex-shrink-0" />
            <label htmlFor="regra-cat" className="text-[13px] font-semibold text-foreground flex-1">Categoria</label>
            <select id="regra-cat" value={categoria} onChange={(e) => setCat(e.target.value)}
                    className="input py-2 text-[13px] max-w-[52%]" style={{ minHeight: 44 }}>
              <option value="">Selecionar</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nome}>{nomeCategoria(c.nome)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3">
            <Pencil size={15} className="text-muted-foreground flex-shrink-0" />
            <label htmlFor="regra-nome" className="text-[13px] font-semibold text-foreground flex-1">Renomear para</label>
            <input id="regra-nome" type="text" value={renomear}
                   onChange={(e) => setRenomear(e.target.value)}
                   placeholder="Opcional"
                   className="input py-2 text-[13px] max-w-[52%]" style={{ minHeight: 44 }} />
          </div>

          <div className="flex items-center gap-3 p-3">
            <Repeat size={15} className="text-muted-foreground flex-shrink-0" />
            <span className="text-[13px] font-semibold text-foreground flex-1">Considerar como recorrente</span>
            <button type="button" role="switch" aria-checked={recorrente}
              aria-label="Considerar como recorrente"
              onClick={() => setRec((v) => !v)}
              className="relative rounded-full transition-colors flex-shrink-0"
              style={{ width: 46, height: 28, background: recorrente ? 'hsl(var(--primary))' : 'hsl(var(--bg-muted))' }}>
              <span className="absolute top-1 rounded-full bg-white transition-all"
                    style={{ width: 20, height: 20, left: recorrente ? 22 : 4 }} />
            </button>
          </div>
        </div>
      )}

      {tipo === 'categorizar' && (
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Ligue o recorrente se esse nome é sempre a mesma conta do mês, mesmo quando o valor muda.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-[12px] text-red-500 flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {erro}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancelar} disabled={salvando}
          className="flex-1 rounded-xl border border-border text-[13px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
          style={{ minHeight: 44 }}>
          Cancelar
        </button>
        <button type="button" onClick={salvar} disabled={salvando}
          className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: 'hsl(var(--primary))', minHeight: 44 }}>
          {salvando ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : 'Criar regra'}
        </button>
      </div>
    </div>
  );
}
