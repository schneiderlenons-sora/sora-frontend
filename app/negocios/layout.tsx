import DashboardLayout from '@/components/layout/DashboardLayout';
import { EmpresaProvider } from '@/components/negocios/EmpresaContext';

// =============================================================================
// Shell do painel Sora Negócios.
//
// ⚠️ É ELE que deixa a navegação instantânea. Antes, CADA página do painel
// montava o `DashboardLayout` por conta própria: ao ir de /negocios/caixa pra
// /negocios/contas o React desmontava sidebar, drawer, tema e o contexto de
// auth e montava tudo de novo — trabalho puro, com a tela piscando no meio.
//
// Como layout de SEGMENTO, isto monta uma vez só: ao trocar de rota o Next
// substitui apenas `children`. A sidebar (com o seletor de empresa e o estado
// de qual empresa está ativa) simplesmente continua lá.
//
// Regra pra quem for criar tela nova aqui: a página NÃO importa
// `DashboardLayout` — ela devolve só o conteúdo. Reintroduzir o layout na
// página aninha dois shells e traz o remount de volta.
// =============================================================================

export default function NegociosLayout({ children }: { children: React.ReactNode }) {
  return (
    // ⚠️ O PROVIDER FICA POR FORA DO `DashboardLayout`, NÃO POR DENTRO.
    //
    // BUG QUE ISTO CORRIGE: a Sidebar é renderizada PELO `DashboardLayout`, e
    // é ela que desenha o seletor de empresa ("Nova empresa", trocar de
    // empresa, editar). Com o provider por dentro, a Sidebar ficava FORA dele:
    // `useEmpresa()` não achava o contexto, caía no fallback — que devolve
    // `empresas: []` de propósito, pra não derrubar a tela — e o seletor
    // simplesmente não renderizava, porque ele só aparece com
    // `empresas.length > 0`.
    //
    // Nada quebrava, nada dava erro: o usuário só não tinha como criar a
    // segunda empresa nem trocar de negócio. Foi assim que passou batido.
    //
    // `EmpresaProvider` depende de `useAuth()`, que vem do root layout
    // (components/providers.tsx), então subir um nível é seguro.
    <EmpresaProvider>
      <DashboardLayout>
        {/* CONTAINER PADRÃO DO PAINEL — largura e respiro iguais em TODA tela.
            Fica aqui, e não em cada página, porque quando cada uma declarava o
            próprio `max-w-*` elas divergiam de fato: o Fluxo de caixa abria em
            `7xl` e o DRE em `5xl`, e a borda "pulava" ao trocar de aba.
            ⚠️ Tela nova NÃO declara `max-w-… mx-auto` no bloco raiz — só o
            conteúdo. Empty state estreito (paywall, "sem empresa") pode usar
            `max-w-md mx-auto` DENTRO daqui: isso é conteúdo, não container. */}
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </DashboardLayout>
    </EmpresaProvider>
  );
}
