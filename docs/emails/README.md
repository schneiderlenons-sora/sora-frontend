# E-mails de autenticação (Supabase)

Tudo aqui é **configuração no painel do Supabase**, não código do app. Estes
arquivos são a fonte versionada do que está colado lá.

> ⚠️ O painel do Supabase não guarda histórico. Se alguém editar por lá e não
> trouxer a mudança pra cá, o próximo que colar este arquivo apaga a edição.

## Qual e-mail a Sora usa hoje

**Só o de redefinir senha.** A confirmação de e-mail no cadastro está
desligada (o `signUp` já devolve sessão e o wizard segue direto pro pagamento),
e não usamos magic link nem convite. Os outros templates do painel continuam em
inglês e **não são enviados** — traduzir só faz sentido se algum dia forem
ligados.

| Template no painel | Usado? |
|---|---|
| Reset Password | ✅ `recuperar-senha.html` |
| Confirm signup | ❌ confirmação desligada |
| Magic Link · Invite · Change Email · Reauthentication | ❌ não usados |

## 1. Remetente próprio (SMTP)

Hoje o e-mail sai de `noreply@mail.app.supabase.io`.

⚠️ **Isso não é só uma questão de marca.** O serviço embutido do Supabase é
declaradamente para desenvolvimento e tem **limite baixo de envios por hora**
(na ordem de 2 a 4). Passou disso, os e-mails seguintes simplesmente **não
saem** — e ninguém recebe erro. Se aparecer relato de "pedi e não chegou nada",
esse limite é o primeiro suspeito.

**Onde configurar:** Dashboard → *Project Settings* → *Authentication* →
*SMTP Settings* (em versões novas do painel: *Authentication* → *Emails* →
*SMTP Settings*).

Campos: host, porta `587`, usuário, senha, *Sender email* e *Sender name*.

Depois de ligar o SMTP próprio, subir também o teto de envio em
*Authentication* → *Rate Limits* → *Emails per hour* — ele continua no valor
baixo do serviço embutido.

### Provedor

Qualquer um com SMTP serve. O domínio `forsora.com` precisa ser verificado no
provedor (registros **SPF** e **DKIM** no DNS) — sem isso o e-mail cai no spam
ou é recusado.

⚠️ **Não usar o SMTP do Gmail / Google Workspace** para isso. O limite diário é
baixo, a autenticação por senha de app é frágil e a conta pode ser bloqueada
por envio automatizado.

Sugestão de remetente: `nao-responda@forsora.com` (ou uma caixa real, se
preferir que a pessoa possa responder).

## 2. Template em português

**Onde:** Dashboard → *Authentication* → *Emails* → template **Reset Password**.

- **Assunto:** `Redefinir sua senha da Sora`
- **Corpo:** conteúdo de [`recuperar-senha.html`](./recuperar-senha.html)

### Variáveis disponíveis

| Variável | O que é |
|---|---|
| `{{ .ConfirmationURL }}` | Link pronto — é o que o template usa |
| `{{ .Token }}` | Código de 6 dígitos |
| `{{ .TokenHash }}` | Hash do token, pra montar link próprio |
| `{{ .SiteURL }}` | Site URL do projeto |
| `{{ .Email }}` | E-mail de destino |
| `{{ .RedirectTo }}` | O `redirectTo` que o app pediu |

### Por que o template é feito de tabela e estilo inline

O Gmail remove `<style>` do `<head>` e o Outlook renderiza com o motor do Word
— flex, grid e classes não valem. O arquivo tem os detalhes comentados, mas os
três que mais quebram na prática:

1. **Sem imagem no cabeçalho.** Outlook e boa parte dos clientes bloqueiam
   imagem por padrão; um logo em `<img>` vira retângulo vazio justamente no
   e-mail em que a pessoa precisa confiar. O wordmark é texto.
2. **O padding do botão vive no `<td>`**, não no `<a>` — o Outlook ignora
   padding em elemento inline.
3. **O verde da marca não serve para o botão.** `#61D17B` com texto branco dá
   **1,92:1**. O botão usa `#268046` (mesmo verde, mais fundo), que dá
   **4,93:1**.

## Depois de mexer, testar

1. Pedir recuperação em <https://www.forsora.com/recuperar-senha>.
2. Conferir remetente, assunto e visual — **abrir no Gmail e no Outlook**, que
   são os que mais quebram layout de e-mail.
3. Clicar no link **no mesmo navegador** e confirmar que cai na tela de nova
   senha (ver o aviso de PKCE em `app/redefinir-senha/page.tsx`).
