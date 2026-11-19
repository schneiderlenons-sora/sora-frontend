# Publicar a ForSora nos diretórios do ChatGPT e do Claude

Guia de envio da Sora no ChatGPT e no Claude (servidor MCP só leitura, nov/2026).
Nos dois diretórios o nome é **ForSora**, porque "Sora" é o app de vídeo da OpenAI
(mesmo motivo da recusa da Apple).

| O quê | Onde |
|---|---|
| Servidor MCP | `https://mcp.forsora.com/mcp` |
| Documentação pública (exigida pelos dois) | https://www.forsora.com/assistentes |
| Privacidade / Termos | https://www.forsora.com/privacidade · https://www.forsora.com/termos |
| Suporte | contato@forsora.com (e a Ajuda do painel) |
| Pacote do ChatGPT | `docs/diretorios/forsora-chatgpt.zip` (fonte em `docs/diretorios/chatgpt/`) |
| Logo (quadrado, 512 px) | `docs/diretorios/chatgpt/assets/logo.png` |

## 1. Antes de enviar

**Conta para os revisores.** Os dois exigem uma conta de demonstração com dados
de exemplo, que entre com **e-mail + senha** (sem código por e-mail, sem link
mágico, sem dois fatores) e com plano Premium ou Platinum. A candidata natural é
a conta comercial (a conta de testes da Sora, plano Platinum, com dados). A
senha fica com você e vai só no formulário de cada portal — nunca no ZIP.

## 2. ChatGPT (OpenAI)

**Pré-requisito:** conta na OpenAI Platform (platform.openai.com) com a
organização **verificada** (pessoa física ou empresa). Não tem custo de IA.

1. **Plugins** (ou Apps) → criar → enviar `forsora-chatgpt.zip`.
2. **Conectar o servidor:** URL `https://mcp.forsora.com/mcp`, autenticação
   **OAuth**, registro **CIMD** (o ChatGPT se identifica sozinho; não há client
   ID nem secret pra preencher).
3. **Verificação de domínio:** o portal mostra um texto. Cole no Render →
   `sora-backend-ohio` → **Environment** → nova variável
   `OPENAI_APPS_CHALLENGE` = o texto → **Save** (o Render publica sozinho em
   ~3 min). Depois confirme no portal. (O servidor responde esse texto em
   `https://mcp.forsora.com/.well-known/openai-apps-challenge`.)
4. Rodar o **scan das ferramentas** e resolver o que ele apontar.
5. **Review details:** login `https://www.forsora.com/login`, e-mail e senha da
   conta dos revisores.
6. **Vídeo de demonstração** (roteiro na seção 4) num link que o revisor abra
   sem pedir acesso (YouTube "não listado" serve).
7. **Categoria:** o ZIP diz `Finance`. Se o portal recusar, escolha a mais
   próxima da lista dele.
8. **Submit for review.** Quando aprovar, você escolhe a hora de **Publish**.

Os 5 casos de teste positivos e os 3 negativos já estão no ZIP
(`plugin.json → review.test_cases`). Rode cada um no ChatGPT antes de enviar.

## 3. Claude (Anthropic)

**Pré-requisito:** conta no claude.ai em plano **pago** (Pro ou acima). Pelo
plano gratuito não dá pra enviar ao diretório (usar como conector pessoal dá).

1. https://claude.ai/directory/manage → **Submit new** → **MCP connector**.
2. Preencher:
   - **Nome:** ForSora
   - **URL do servidor:** `https://mcp.forsora.com/mcp`
   - **Autenticação:** OAuth (o Claude se identifica sozinho pelo documento dele;
     não há client ID nem secret)
   - **Descrição:** os textos da seção 5
   - **Documentação:** https://www.forsora.com/assistentes
   - **Privacidade / Termos / Suporte:** os da tabela acima
   - **Logo:** `docs/diretorios/chatgpt/assets/logo.png`
3. Confirmar que testou como conector personalizado (já testado em produção).
4. A listagem entra como "Community". Se a Anthropic levar para "Verified", ela
   manda e-mail pedindo acesso de teste: é a mesma conta dos revisores.

## 4. Roteiro do vídeo (≈ 2 min)

1. Painel da Sora → **Finanças → Analisar → ChatGPT e Claude** (a aba).
2. No ChatGPT, conectar a ForSora → abre a tela da Sora → **Permitir acesso**.
3. Perguntar: "Quanto eu gastei este mês e em quais categorias?", "Quanto falta
   pagar nas faturas dos meus cartões?" e "Quais são minhas dívidas?".
4. Pedir "Apaga a minha última transação" e mostrar o ChatGPT dizendo que a
   conexão só lê.
5. Voltar ao painel: **O que a IA consultou** e **Desconectar**.

## 5. Textos prontos

**Curta (até 30 caracteres):** Suas finanças na conversa

**Longa:**

> A ForSora é um app brasileiro de finanças pessoais: a pessoa organiza contas,
> cartões, faturas, dívidas, metas e investimentos pelo painel ou pelo WhatsApp.
> Conectada ao assistente, ela deixa você perguntar sobre o seu dinheiro e
> receber a resposta com os seus números de verdade.
>
> Exemplos: Onde eu mais gastei este mês? Quanto ainda falta pagar nas faturas
> dos meus cartões? Monta um plano para quitar minhas dívidas. Estou dentro dos
> meus limites de gastos?
>
> A conexão é só de leitura: o assistente não lança, não edita, não apaga e não
> movimenta dinheiro. Os números são os mesmos do painel da ForSora. Você
> conecta com a sua conta, vê no painel tudo o que foi consultado e desconecta
> quando quiser.

## 6. Regras dos diretórios que já estão cumpridas (não desfazer)

- **Sem planos nem upgrade dentro da conversa** (diretriz do ChatGPT): a
  mensagem de "sem acesso" do servidor é neutra.
- **Anotações em toda ferramenta:** `title`, `readOnlyHint: true`,
  `destructiveHint: false`, `openWorldHint: false`.
- **Erros com explicação**, nunca "Internal Server Error" seco.
- **Dado mínimo:** nada de telefone de membro nem id interno na resposta.
- **Domínio do servidor = domínio da empresa** (`mcp.forsora.com`), exigência
  do Claude.

## 7. Depois de publicado

- A aba do painel e a página `/assistentes` passam a dizer "procure ForSora"
  como caminho principal (hoje o principal é o conector personalizado).
- Mudança só nas ferramentas: o ChatGPT reescaneia o servidor todo dia e o
  Claude lê ao vivo. Mudança no manifesto (nome, textos, casos de teste) exige
  ZIP novo no portal da OpenAI.
