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
    <DashboardLayout>
      <EmpresaProvider>
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
      </EmpresaProvider>
    </DashboardLayout>
  );
}
