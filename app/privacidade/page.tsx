import Link from 'next/link';

export const metadata = { title: 'Política de Privacidade — Sora' };

// ⚠️ TEMPLATE — revise com seu/sua advogado(a)/DPO antes de publicar definitivamente.
export default function PrivacidadePage() {
  return (
    <main className="min-h-dvh bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>← Voltar</Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-zinc-500 dark:text-white/50 mb-10">Última atualização: 31/05/2026 · Conforme a LGPD (Lei 13.709/2018)</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">1. Dados que coletamos</h2>
            <p>Cadastro (nome, e-mail, número de WhatsApp); dados financeiros que você registra ou conecta via Open Finance (transações, saldos, contas, categorias, metas); dados de uso do produto; e dados de pagamento processados pelo Stripe (não armazenamos o número completo do cartão).</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">2. Para que usamos</h2>
            <p>Para operar a Sora (organizar e categorizar suas finanças, enviar mensagens no WhatsApp, gerar relatórios), processar pagamentos, dar suporte e melhorar o serviço. Base legal: execução de contrato, consentimento (Open Finance e comunicações) e legítimo interesse.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">3. Compartilhamento e operadores</h2>
            <p>Compartilhamos dados apenas com operadores necessários ao funcionamento: <strong>Supabase</strong> (banco de dados/autenticação), <strong>Stripe</strong> (pagamentos), <strong>Z-API</strong> (WhatsApp) e provedores de IA (interpretação de texto/áudio/imagem). Não vendemos seus dados.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">4. IA</h2>
            <p>Mensagens e mídias enviadas podem ser processadas por modelos de IA exclusivamente para interpretar e registrar suas finanças. Não usamos seus dados financeiros para treinar modelos.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">5. Seus direitos (LGPD)</h2>
            <p>Você pode solicitar acesso, correção, portabilidade, anonimização e exclusão dos seus dados, além de revogar consentimentos. Para exercer, escreva para <strong>contato@forsora.com</strong>.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">6. Segurança e retenção</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados (criptografia em trânsito, controle de acesso). Mantemos os dados enquanto sua conta estiver ativa e pelo prazo legal aplicável após o encerramento.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">7. Exclusão da conta</h2>
            <p>Você pode solicitar a exclusão da sua conta e dos dados associados a qualquer momento pelo e-mail acima ou pelas Configurações do app.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">8. Contato / Encarregado (DPO)</h2>
            <p>Para assuntos de privacidade: <strong>contato@forsora.com</strong>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
