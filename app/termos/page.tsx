import Link from 'next/link';

export const metadata = { title: 'Termos de Uso — Sora' };

// ⚠️ TEMPLATE — revise com seu/sua advogado(a) antes de publicar definitivamente.
export default function TermosPage() {
  return (
    <main className="min-h-dvh bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <Link href="/" className="text-sm font-semibold" style={{ color: '#61ce70' }}>← Voltar</Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-2">Termos de Uso</h1>
        <p className="text-sm text-zinc-500 dark:text-white/50 mb-10">Última atualização: 31/05/2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">1. Quem somos</h2>
            <p>A Sora é uma assistente financeira pessoal que organiza gastos, receitas e metas, com interação pelo WhatsApp e por um painel web. Ao criar uma conta e/ou assinar um plano, você concorda com estes Termos.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">2. Conta e elegibilidade</h2>
            <p>Você é responsável pela veracidade dos dados informados e pela segurança das suas credenciais. É necessário ter 18 anos ou mais. Você se compromete a não usar a Sora para fins ilícitos.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">3. Planos, pagamento e renovação</h2>
            <p>Os planos são cobrados de forma recorrente (mensal ou anual) via Stripe. A assinatura renova automaticamente até o cancelamento. Você pode cancelar a qualquer momento pelo portal de assinatura; o acesso permanece ativo até o fim do período já pago. Preços podem ser alterados com aviso prévio.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">4. Teste grátis</h2>
            <p>Quando oferecido (ex.: 7 dias de Sora Grow no plano Básico), o período de teste é informado na contratação. Após o teste, aplicam-se as condições do plano escolhido.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">5. Cancelamento e reembolso</h2>
            <p>Você pode cancelar quando quiser. Conforme o art. 49 do Código de Defesa do Consumidor, contratações feitas fora do estabelecimento podem ser canceladas em até 7 dias com reembolso. Após esse prazo, não há reembolso proporcional do período já utilizado, salvo disposição legal.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">6. Natureza do serviço</h2>
            <p>A Sora é uma ferramenta de organização financeira e <strong>não presta consultoria de investimentos</strong> nem recomendação financeira regulamentada. As informações são de apoio à sua decisão. A categorização por IA pode conter imprecisões — revise seus dados.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">7. Open Finance</h2>
            <p>A conexão com instituições financeiras, quando utilizada, ocorre via Open Finance Brasil, com seu consentimento explícito e revogável a qualquer momento. A Sora não armazena credenciais bancárias.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">8. Limitação de responsabilidade</h2>
            <p>O serviço é fornecido "no estado em que se encontra". Não nos responsabilizamos por decisões financeiras tomadas com base nas informações exibidas. Buscamos disponibilidade contínua, mas não garantimos ausência de interrupções.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">9. Privacidade</h2>
            <p>O tratamento de dados pessoais segue a nossa <Link href="/privacidade" className="font-semibold underline" style={{ color: '#61ce70' }}>Política de Privacidade</Link> e a LGPD (Lei 13.709/2018).</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">10. Contato</h2>
            <p>Dúvidas sobre estes Termos: <strong>contato@forsora.com</strong>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
