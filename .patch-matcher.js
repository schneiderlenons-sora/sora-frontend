const fs = require('fs');
const F = 'middleware.ts';
let s = fs.readFileSync(F, 'utf8');

const velho = `export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\\\..*).*)'],
};`;

const novo = `export const config = {
  // ⚠️ \`api\` FICA DE FORA, e a exclusão vale um round-trip por chamada.
  //
  // O middleware roda \`supabase.auth.getUser()\` — ida de REDE ao Supabase Auth —
  // em tudo que ele intercepta. As 26 rotas de \`/api\` caíam aqui e pagavam esse
  // custo à toa: nenhuma delas está em ROTAS_PROTEGIDAS (então o middleware não
  // bloqueia nada), nenhuma lê \`x-sora-locale\` nem \`x-sora-user-id\`, e 23 das 26
  // já autenticam por conta própria (createSupabaseServer, checkAdmin, ou a
  // assinatura do Stripe). As outras 3 são públicas de propósito: os dois
  // bridges de analytics e o webhook do Mercado Pago — que é chamado pelos
  // servidores deles e não pode exigir sessão.
  //
  // Como toda revalidação do SWR passa por \`/api\`, isso tirava uma ida ao
  // Supabase de cada atualização de dado do painel. E o webhook do Stripe pagava
  // uma validação de sessão que ele nunca usa.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\\\..*).*)'],
};`;

if (!s.includes(velho)) { console.error('ANCORA NAO ENCONTRADA'); process.exit(1); }
s = s.replace(velho, novo);
fs.writeFileSync(F, s);
console.log('matcher atualizado');
