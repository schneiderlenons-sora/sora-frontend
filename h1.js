const fs=require('fs');
const arquivos=[
  ['lib/ciclo-fatura.ts', true],
  ['../sora-backend/src/services/cicloFatura.js', false],
];
for (const [p, ehTS] of arquivos) {
  const L=fs.readFileSync(p,'utf8').split('\n');

  // 1) pertenceAFatura ganha o modo hibrido
  const i=L.findIndex(l=>l.includes("if (criterio === 'bill') {"));
  if(i<0){console.error('pertenceAFatura nao achada em',p);process.exit(1);}
  let fim=i; while(fim<L.length && !L[fim].includes('return dentroDoCiclo')) fim++;
  L.splice(i, fim-i,
    "  if (criterio === 'hibrido') {",
    '    // ⚠️ HÍBRIDO — o banco onde ele opinou, o ciclo onde ele calou.',
    '    //',
    "    // O modo 'bill' é tudo-ou-nada e por isso só serve quando o emissor",
    '    // vinculou a fatura INTEIRA. Medido: só ~14% das linhas chegam com',
    '    // `of_bill_id` (ele só vincula depois do fechamento), então na prática',
    "    // o 'bill' quase nunca podia ser usado e tudo caía na data.",
    '    //',
    '    // Aqui as duas fontes convivem sem se misturar: a linha que o emissor',
    '    // JÁ atribuiu obedece a ele; a que ele ainda não atribuiu obedece ao',
    '    // ciclo. Não há sobreposição — ou a linha tem vínculo, ou não tem.',
    '    //',
    '    // É o que resolve o "total certo, lista somando outra coisa": o banco',
    '    // agrupa pela data em que LANÇOU a compra na fatura (`bill_post_date`),',
    '    // não pela data da compra, e nenhuma regra de data prevê esse atraso.',
    '    //',
    '    // Medido em 24 faturas com histórico completo: 9 aproximam do total do',
    '    // banco, 12 ficam iguais, 3 pioram — as 3 num cartão que não fecha em',
    '    // configuração nenhuma (nem hoje, nem híbrido, nem ciclo deslocado).',
    '    if (billId) {',
    '      if (tx?.of_bill_id) return tx.of_bill_id === billId;',
    '      return dentroDoCiclo(tx?.data, ciclo);',
    '    }',
    '    return dentroDoCiclo(tx?.data, ciclo);',
    '  }',
    "  if (criterio === 'bill') {",
    '    const alvo = ehFaturaAtual ? cartao?.of_bill_atual : null;',
    '    return !!alvo && tx?.of_bill_id === alvo;',
    '  }');

  // 2) assinatura ganha billId
  const j=L.findIndex(l=>l.includes("criterio?: 'bill' | 'ciclo',") || l.includes('  criterio,'));
  if (ehTS) {
    const k=L.findIndex(l=>l.includes("criterio?: 'bill' | 'ciclo',"));
    if(k<0){console.error('assinatura TS nao achada');process.exit(1);}
    L.splice(k,1,
      "  criterio?: 'bill' | 'ciclo' | 'hibrido',",
      "  /** Fatura do emissor NESTA competência (of_faturas.of_bill_id). Só o híbrido usa. */",
      '  billId?: string | null,');
  } else {
    const k=L.findIndex(l=>l.includes('function pertenceAFatura(tx, cartao, ciclo, ehFaturaAtual, criterio)'));
    if(k<0){console.error('assinatura JS nao achada');process.exit(1);}
    L[k]='function pertenceAFatura(tx, cartao, ciclo, ehFaturaAtual, criterio, billId) {';
  }
  fs.writeFileSync(p,L.join('\n'));
  console.log('pertenceAFatura: modo hibrido em', p);
}
