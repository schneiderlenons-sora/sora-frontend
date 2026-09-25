'use client';

// ─────────────────────────────────────────────────────────────
// Categorias do grupo, disponíveis em QUALQUER tela do painel — pra o ícone e
// a cor de uma transação saírem do que o usuário configurou, e não de um
// palpite pelo nome.
//
// Relato de cliente (25/09/2026): "mudar a categoria de uma transação e o
// emoji dela não sincronizar com o emoji da nova categoria e ficar com o
// emoji da categoria 'outros'".
//
// ⚠️ A CAUSA NÃO ERA O EMOJI NÃO SER GRAVADO. `getCategoriaTheme(nome, cats)`
// sempre soube ler o emoji do usuário — no passo 1, e só quando recebe a
// LISTA. Medido: de ~22 call sites, **4** passavam a lista. Todos os outros
// chamavam `getCategoriaTheme(tx.categoria)` seco, então o passo 1 era pulado,
// o nome caía no catálogo embutido e, não estando lá (categoria criada pelo
// usuário), terminava no fallback `📦` — que é exatamente o ícone de "Outros".
// Por isso o sintoma aparecia só em categoria personalizada.
//
// ⚠️ POR QUE UM PROVIDER E NÃO CONSERTAR OS CALL SITES: passar a lista à mão
// em 18 lugares deixa o 19º nascer errado — e foi assim que este bug se
// espalhou. Mesmo desenho do MarcasCustomContext, que já resolve a logo de
// marca por baixo do CategoriaIcon.
//
// Sem provider o hook devolve o comportamento antigo (degrada, não quebra).
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';
import { chave } from '@/lib/chaves-swr';
import { getCategoriaTheme, type CategoriaUserMin } from '@/lib/categorias';

type Ctx = { categorias: CategoriaUserMin[] };

const CategoriasUserContext = createContext<Ctx>({ categorias: [] });

export function CategoriasUserProvider({ children }: { children: React.ReactNode }) {
  const { phone } = useAuth();

  // ⚠️ `useSWR` DIRETO, não `useApi`: o `useApi` registra no LoadingGate e a
  // baleia cobriria a página inteira só pra resolver o ícone de uma linha.
  //
  // ⚠️ E na CHAVE CANÔNICA (`chave.categorias`), a mesma que a aba /categorias
  // e o prefetch da sidebar usam — então na prática isto não é requisição
  // nova, é o mesmo cache. Uma chave própria aqui duplicaria a consulta mais
  // chamada do painel (16 telas), que é justamente a que já foi enxugada por
  // causa de egress.
  const { data } = useSWR(
    phone ? chave.categorias(phone) : null,
    () => api.categorias.listar(phone!),
    { revalidateOnFocus: false },
  );

  const valor = useMemo(
    () => ({ categorias: (data as CategoriaUserMin[]) ?? [] }),
    [data],
  );

  return (
    <CategoriasUserContext.Provider value={valor}>
      {children}
    </CategoriasUserContext.Provider>
  );
}

/**
 * `tema(nome)` = `getCategoriaTheme` já com as categorias do usuário dentro.
 *
 * Use ESTE em vez de importar `getCategoriaTheme` direto sempre que o nome
 * vier de uma transação/lançamento — é o que faz o ícone ser o que a pessoa
 * escolheu. Quando o objeto da categoria já está em mãos (seletores, aba de
 * categorias), chamar a função pura continua certo.
 */
export function useTemaCategoria() {
  const { categorias } = useContext(CategoriasUserContext);
  return useCallback(
    (nome: string) => getCategoriaTheme(nome || '', categorias),
    [categorias],
  );
}

/** A lista crua, pra quem precisa dela (ex.: casar pai/filha). */
export function useCategoriasUser() {
  return useContext(CategoriasUserContext).categorias;
}
