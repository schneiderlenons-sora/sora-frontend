import Link from 'next/link';

export const metadata = { title: 'Política de Privacidade — Sora' };

// ⚠️ TEMPLATE — revise com seu/sua advogado(a)/DPO antes de publicar definitivamente.
export default function PrivacidadePage() {
  return (
    <main className="min-h-dvh bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>← Voltar</Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-zinc-500 dark:text-white/50 mb-10">Última atualização: 28/10/2026 · Conforme a LGPD (Lei 13.709/2018)</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">1. Dados que coletamos</h2>
            <p>Cadastro (nome, e-mail, número de WhatsApp); dados financeiros que você registra ou conecta via Open Finance (transações, saldos, contas, cartões, categorias, metas, dívidas e investimentos); dados de saúde e bem-estar que você registra no Sora Grow (consultas, medicamentos, treinos e alimentação); fotos, áudios e arquivos que você envia (comprovantes, imagens, documentos do Drive); mensagens de suporte; e o histórico da sua assinatura. Os dados de pagamento são processados pelo Stripe, pelo Mercado Pago ou pela Google Play — não armazenamos o número do cartão.</p>
            <p className="mt-2">No site (forsora.com), usamos pixels de publicidade da Meta e do TikTok para medir nossas campanhas. Eles <strong>não são usados no aplicativo para iPhone</strong>, e nenhum dado financeiro é enviado a eles.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">2. Para que usamos</h2>
            <p>Para operar a Sora (organizar e categorizar suas finanças, enviar mensagens no WhatsApp, gerar relatórios), processar pagamentos, dar suporte e melhorar o serviço. Base legal: execução de contrato, consentimento (Open Finance e comunicações) e legítimo interesse.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">3. Compartilhamento e operadores</h2>
            <p>Compartilhamos dados apenas com os operadores necessários ao funcionamento da Sora, cada um recebendo só o que precisa para a sua função:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos;</li>
              <li><strong>Vercel</strong> e <strong>Render</strong> — hospedagem do site e dos servidores;</li>
              <li><strong>OpenAI</strong> — inteligência artificial que interpreta textos, áudios e imagens (ver item 4);</li>
              <li><strong>Meta (WhatsApp)</strong> — envio e recebimento das mensagens da Sora no WhatsApp;</li>
              <li><strong>Polp / Celcoin</strong> — conexão com o seu banco via Open Finance, apenas com o seu consentimento e somente para leitura (a Sora não movimenta dinheiro);</li>
              <li><strong>Stripe</strong>, <strong>Mercado Pago</strong> e <strong>Google Play</strong> — processamento de pagamentos e assinaturas;</li>
              <li><strong>Meta</strong> e <strong>TikTok</strong> — medição de campanhas, apenas no site (ver item 1).</li>
            </ul>
            <p className="mt-2">Não vendemos seus dados.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">4. IA</h2>
            <p>Mensagens e mídias enviadas podem ser processadas por modelos de IA da <strong>OpenAI</strong> exclusivamente para interpretar e registrar suas finanças. Não usamos seus dados financeiros para treinar modelos, e os dados enviados pela API da OpenAI não são usados por ela para treinar os modelos dela.</p>
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
            <p>Você pode solicitar a exclusão da sua conta e dos dados associados a qualquer momento pela página <Link href="/excluir-conta" className="font-semibold underline" style={{ color: 'hsl(var(--primary))' }}>forsora.com/excluir-conta</Link> (abre sem precisar entrar na conta), pelas Configurações do app ou pelo e-mail acima. Lá explicamos o que é apagado, o que fica guardado e por quanto tempo.</p>
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
