import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Documentação PÚBLICA da Sora no ChatGPT e no Claude (forsora.com/assistentes).
//
// Os dois diretórios exigem uma página aberta, sem login: o do ChatGPT pede
// "websiteURL" e "supportURL", e o do Claude pede "documentação pública" até a
// publicação. É também o link que a gente manda pra quem pergunta "como faço?".
//
// ⚠️ Nos diretórios a Sora se chama FORSORA ("Sora" é o app de vídeo da
// OpenAI). A página diz isso, senão quem procura "Sora" lá não acha.
// ⚠️ Pública no middleware e nas allowlists (abertura, onboarding, paywall).
// A linha de planos some no app de iPhone (`oculto-no-app-ios`).
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Sora no ChatGPT e no Claude',
  description: 'Converse sobre o seu dinheiro no ChatGPT ou no Claude, com os números que você organiza na Sora.',
};

const COR = 'hsl(var(--primary))';

const ENDERECO = 'https://mcp.forsora.com/mcp';

const VE = [
  'Transações e o resumo de cada mês e do ano',
  'Saldos das contas, cartões de crédito e faturas',
  'Dívidas, parcelamentos, metas e contas fixas',
  'Investimentos, caixinhas e limites de gastos',
];
const NAO_FAZ = [
  'Lançar, editar ou apagar qualquer coisa',
  'Mover dinheiro ou pagar contas',
  'Ver a sua senha ou o acesso ao seu banco',
];

export default function AssistentesPage() {
  return (
    <main className="min-h-dvh bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <Link href="/" className="text-sm font-semibold" style={{ color: COR }}>← Voltar</Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-3">A Sora no ChatGPT e no Claude</h1>
        <p className="text-[17px] leading-relaxed text-zinc-700 dark:text-white/75">
          Pergunte sobre o seu dinheiro na IA que você já usa. O ChatGPT ou o Claude lê os números que você organiza
          na Sora e responde: onde você mais gastou, quanto falta pagar nas faturas, como quitar as dívidas.
        </p>
        <p className="mt-3 text-sm text-zinc-500 dark:text-white/50">
          Nos diretórios do ChatGPT e do Claude, a Sora aparece como <strong className="text-zinc-900 dark:text-white">ForSora</strong>.
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-zinc-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Quem pode usar</h2>
            <p>
              Quem tem conta na Sora. A IA usa a sua própria conta do ChatGPT ou do Claude — a Sora não cobra nada a
              mais pela conversa.
              <span className="oculto-no-app-ios"> A conexão faz parte dos planos Premium e Platinum da Sora.</span>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Como conectar no ChatGPT</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Em <strong>chatgpt.com</strong>, procure <strong>ForSora</strong> em Apps (ou Plugins) e toque em <strong>Conectar</strong>.</li>
              <li>Se ela ainda não aparecer na sua conta, use <strong>Adicionar servidor MCP personalizado</strong>, com o nome Sora,
                endereço público <code className="text-[13px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10">{ENDERECO}</code> e autenticação OAuth.</li>
              <li>Abre a tela da Sora: entre na sua conta, confira o que a IA vai poder ver e toque em <strong>Permitir acesso</strong>.</li>
              <li>Numa conversa, ative a ForSora e pergunte.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Como conectar no Claude</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Em <strong>claude.ai</strong>, abra <strong>Configurações → Conectores</strong>.</li>
              <li>Procure <strong>ForSora</strong> no diretório, ou toque em <strong>Adicionar conector personalizado</strong> e cole
                o endereço <code className="text-[13px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10">{ENDERECO}</code>.</li>
              <li>Toque em <strong>Conectar</strong>, entre na sua conta da Sora e toque em <strong>Permitir acesso</strong>.</li>
              <li>A conexão vale também no app do Claude no celular.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">O que a IA vê e o que ela não faz</h2>
            <p className="mb-2">A conexão é <strong>só de leitura</strong>. A IA pode ver:</p>
            <ul className="list-disc pl-5 space-y-1">{VE.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="mt-3 mb-2">E não pode:</p>
            <ul className="list-disc pl-5 space-y-1">{NAO_FAZ.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="mt-3">
              Os números são os mesmos do painel da Sora. Os dados são os do seu grupo ativo; em gestão compartilhada,
              entram os lançamentos das outras pessoas do grupo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Privacidade</h2>
            <p>
              A conexão só acontece com a sua autorização. O que a IA ler fica na sua conta do ChatGPT (OpenAI) ou do
              Claude (Anthropic) e segue as configurações e a política de privacidade dessa conta. A Sora registra quais
              consultas foram feitas, e você vê a lista no painel. Detalhes na{' '}
              <Link href="/privacidade" className="font-semibold underline" style={{ color: COR }}>Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Como desconectar</h2>
            <p>
              No painel da Sora, abra <strong>Finanças → Analisar → ChatGPT e Claude</strong> e toque em <strong>Desconectar</strong>.
              O acesso cai na hora. Você também pode remover a ForSora pelas configurações do próprio ChatGPT ou Claude.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Ajuda</h2>
            <p>
              Fale com a gente pela <strong>Ajuda</strong> do painel da Sora ou pelo e-mail <strong>contato@forsora.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
