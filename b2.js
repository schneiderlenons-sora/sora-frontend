const fs=require('fs');
const p='app/api/admin/overview/route.ts';
let s=fs.readFileSync(p,'utf8');
const velho=`  let ofConectados = 0, ofGrupos = 0, ofComProblema = 0;
  try {
    const { data, error } = await supabaseAdmin.from('of_conexoes').select('grupo_id, status');
    if (error) throw error;
    const grupos = new Set<string>();
    for (const c of data || []) {
      ofConectados++;
      if (c.grupo_id) grupos.add(String(c.grupo_id));
      if (c.status !== 'updated') ofComProblema++;
    }
    ofGrupos = grupos.size;
  } catch { /* tabela of_conexoes pode não existir */ }`;
const novo=`  let ofConectados = 0, ofGrupos = 0, ofComProblema = 0;
  let ofGruposFranquia = 0, ofGruposPagando = 0, ofPagandoSemUsar = 0;
  try {
    const { data, error } = await supabaseAdmin.from('of_conexoes').select('grupo_id, status');
    if (error) throw error;
    const grupos = new Set<string>();
    for (const c of data || []) {
      ofConectados++;
      if (c.grupo_id) grupos.add(String(c.grupo_id));
      if (c.status !== 'updated') ofComProblema++;
    }
    ofGrupos = grupos.size;

    // ⚠️ QUEM CONECTA NÃO É SÓ QUEM PAGA. A assinatura recorrente tem franquia
    // (Básico 1, Premium 3) e conecta de graça — medido: 9 dos 17 grupos
    // conectados são de franquia. Olhando só a receita, metade de quem USA
    // Open Finance ficava invisível.
    //
    // E o cruzamento revela o inverso, que é o caso caro: quem PAGA e NÃO
    // conectou nada. É dinheiro sendo cobrado por um serviço parado.
    const { data: pagantes } = await supabaseAdmin
      .from('users').select('grupo_ativo, of_conexoes_pagas').gt('of_conexoes_pagas', 0);
    const gruposPagantes = new Set(
      (pagantes || []).map((u) => u.grupo_ativo).filter(Boolean).map(String));
    for (const g of grupos) {
      if (gruposPagantes.has(g)) ofGruposPagando++;
      else ofGruposFranquia++;
    }
    for (const g of gruposPagantes) if (!grupos.has(g)) ofPagandoSemUsar++;
  } catch { /* tabela of_conexoes pode não existir */ }`;
if(s.indexOf(velho)<0){console.error('bloco nao achado');process.exit(1);}
s=s.replace(velho,novo);
s=s.replace(`    ofConectados, ofGrupos, ofComProblema,`,
            `    ofConectados, ofGrupos, ofComProblema,
    ofGruposFranquia, ofGruposPagando, ofPagandoSemUsar,`);
fs.writeFileSync(p,s);
console.log('overview: franquia x pagante + pagando sem usar');
