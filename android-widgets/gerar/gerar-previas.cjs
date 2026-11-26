// Gera as PRÉVIAS da galeria de widgets (Android 12+ usa o previewLayout) a
// partir dos layouts de verdade, preenchendo com a mesma amostra do iPhone.
// Também gera os textos da amostra (values/widget_previa.xml), a maré de
// exemplo (drawable/widget_mare_previa.xml) e os arquivos de registro
// (xml/widget_*_info.xml). Uso: node android-widgets/gerar/gerar-previas.cjs
const fs = require('fs');
const path = require('path');
const res = process.argv[2] || path.join(__dirname, '..', 'src', 'main', 'res');
const ler = (p) => fs.readFileSync(path.join(res, p), 'utf8');
const gravar = (p, s) => fs.writeFileSync(path.join(res, p), s);

const textos = {};
function txt(nome, valor) {
  textos[nome] = valor;
  return '@string/widget_previa_' + nome;
}

// Troca/insere atributos no elemento de um id. Remove o atributo antigo antes
// (atributo repetido é erro de XML).
function preencher(xml, id, attrs) {
  const marca = `android:id="@+id/${id}"`;
  const i = xml.indexOf(marca);
  if (i < 0) throw new Error('id não achado: ' + id);
  const ini = xml.lastIndexOf('<', i);
  const fimTag = (() => {
    const a = xml.indexOf('/>', i), b = xml.indexOf('>', i);
    return Math.min(a < 0 ? Infinity : a, b < 0 ? Infinity : b);
  })();
  let tag = xml.slice(ini, fimTag);
  const indent = (tag.match(/\n(\s*)android:id=/) || [, '    '])[1];
  for (const nome of Object.keys(attrs)) {
    tag = tag.replace(new RegExp(`\\s*android:${nome}="[^"]*"`), '');
  }
  const novos = Object.entries(attrs).map(([k, v]) => `\n${indent}android:${k}="${v}"`).join('');
  tag = tag.replace(marca, marca + novos);
  return xml.slice(0, ini) + tag + xml.slice(fimTag);
}

function previa(origem, destino, mapa, comentario) {
  let xml = ler('layout/' + origem);
  for (const [id, attrs] of Object.entries(mapa)) xml = preencher(xml, id, attrs);
  xml = xml.replace(/<!--[\s\S]*?-->/, `<!-- PRÉVIA da galeria (${comentario}). Gerada a partir de ${origem}:\n     mexeu no layout, gere de novo. Os textos estão em values/widget_previa.xml. -->`);
  gravar('layout/' + destino, xml);
}

// ---- Livre pra gastar
previa('widget_livre.xml', 'widget_livre_previa.xml', {
  widget_livre_mare: { src: '@drawable/widget_mare_previa' },
  widget_livre_prefixo: { text: txt('livre_prefixo', 'R$') },
  widget_livre_numero: { text: txt('livre_numero', '47') },
  widget_livre_sufixo: { text: txt('livre_sufixo', 'por dia') },
  widget_livre_status_icone: { src: '@drawable/widget_ic_check_verde' },
  widget_livre_status: { text: txt('livre_status', 'No ritmo'), textColor: '@color/widget_status_verde' },
  widget_livre_resto: { text: txt('livre_resto', 'R$ 612 até 30/11'), textColor: '@color/widget_resto_verde' },
}, 'Livre pra gastar');

// ---- Próximas contas
const dias = ['T', 'Q', 'Q', 'S', 'S', 'D', 'S'];
const pontos = { 1: 'fixa', 3: 'fatura', 5: 'agendado' };
const contas = {
  widget_contas_cabecalho: { text: txt('contas_cabecalho', 'Próximos 7 dias') },
  widget_contas_qtd: { text: txt('contas_qtd', '4') },
  widget_contas_rotulo: { text: txt('contas_rotulo', 'contas') },
  widget_contas_total: { text: txt('contas_total', 'R$ 1.322,30') },
  widget_contas_mais: { text: txt('contas_mais', 'e mais 1'), visibility: 'visible' },
};
dias.forEach((l, i) => {
  contas['widget_contas_dia' + i] = i === 0
    ? { text: txt('contas_dia' + i, l), background: '@drawable/widget_hoje', textColor: '@color/widget_hoje_texto', textStyle: 'bold' }
    : { text: txt('contas_dia' + i, l) };
  if (pontos[i]) contas['widget_contas_ponto' + i] = { src: '@drawable/widget_ponto_' + pontos[i], visibility: 'visible' };
});
const linhas = [
  { icone: 'casa', tile: 'cinza', titulo: 'Condomínio', valor: 'R$ 480,00', sub: 'Atrasada há 2 dias', atrasada: true },
  { icone: 'luz', tile: 'ambar', titulo: 'Luz', valor: 'R$ 182,40', sub: 'Amanhã' },
  { icone: 'cartao', tile: 'violeta', titulo: 'Fatura Nubank', valor: 'R$ 524,90', sub: 'Sexta, 21' },
];
linhas.forEach((r, i) => {
  contas['widget_contas_linha' + i] = { visibility: 'visible' };
  contas['widget_contas_icone' + i] = { src: '@drawable/widget_ic_' + r.icone, background: '@drawable/widget_tile_' + r.tile };
  contas['widget_contas_titulo' + i] = { text: txt('contas_titulo' + i, r.titulo) };
  contas['widget_contas_valor' + i] = { text: txt('contas_valor' + i, r.valor) };
  contas['widget_contas_sub' + i] = r.atrasada
    ? { text: txt('contas_sub' + i, r.sub), textColor: '@color/widget_vermelho', textStyle: 'bold' }
    : { text: txt('contas_sub' + i, r.sub) };
  if (r.atrasada) contas['widget_contas_alerta' + i] = { visibility: 'visible' };
});
previa('widget_contas.xml', 'widget_contas_previa.xml', contas, 'Próximas contas');

// ---- Cartão
previa('widget_cartao.xml', 'widget_cartao_previa.xml', {
  widget_cartao_nome: { text: txt('cartao_nome', 'Nubank') },
  widget_cartao_rotulo: { text: txt('cartao_rotulo', 'Fatura atual') },
  widget_cartao_valor: { text: txt('cartao_valor', 'R$ 1.631,27') },
  widget_cartao_sub: { text: txt('cartao_sub', 'Fecha em 8 dias · vence 10/12') },
}, 'Cartão');

// ---- Textos da amostra (não traduzir: é exemplo)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");
gravar('values/widget_previa.xml', '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<!-- Amostra das prévias da galeria (gerada por gerar-previas.cjs). Igual à do iPhone. -->\n<resources>\n' +
  Object.entries(textos).map(([k, v]) => `    <string name="widget_previa_${k}" translatable="false">${esc(v)}</string>`).join('\n') +
  '\n</resources>\n');

// ---- Maré de exemplo (nível 0,45 e ritmo 0,36, como a amostra)
const L = 170, nivel = 0.45, ritmo = 0.36;
const onda = (fase, inv) => {
  const y = +(L * (1 - nivel) + fase).toFixed(2), a = inv ? -4.5 : 4.5;
  return `M0,${y}C${L * 0.2},${y - a} ${L * 0.34},${y - a} ${L * 0.5},${y}C${L * 0.66},${y + a} ${L * 0.8},${y + a} ${L},${y}L${L},${L}L0,${L}Z`;
};
const yr = +(L * (1 - ritmo)).toFixed(2);
let tracos = '';
for (let x = 1; x < L; x += 6) tracos += `M${x},${yr}h2`;
gravar('drawable/widget_mare_previa.xml', '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<!-- Maré da prévia (gerada por gerar-previas.cjs). O widget de verdade desenha a dele em Desenho.mare. -->\n' +
  '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n' +
  `    android:width="${L}dp" android:height="${L}dp" android:viewportWidth="${L}" android:viewportHeight="${L}">\n` +
  `    <path android:pathData="${onda(-2, false)}" android:fillColor="@color/widget_mare_verde_agua" />\n` +
  `    <path android:pathData="${onda(5, true)}" android:fillColor="@color/widget_mare_verde_frente" />\n` +
  `    <path android:pathData="${tracos}" android:strokeColor="@color/widget_linha_ritmo" android:strokeWidth="1.2" android:strokeLineCap="round" android:fillColor="#00000000" />\n` +
  '</vector>\n');

// ---- Registro de cada widget
function info(nome, { layout, previa, w, h, cw, ch, periodo, opcoes, descricao }) {
  return '<?xml version="1.0" encoding="utf-8"?>\n' +
    `<!-- Registro do widget "${nome}" (gerado por gerar-previas.cjs). -->\n` +
    '<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    (opcoes ? '    android:configure="com.forsora.app.widget.WidgetOpcoesActivity"\n' : '') +
    `    android:description="@string/${descricao}"\n` +
    `    android:initialLayout="@layout/${layout}"\n` +
    `    android:minWidth="${w}dp"\n` +
    `    android:minHeight="${h}dp"\n` +
    `    android:minResizeWidth="${w}dp"\n` +
    `    android:minResizeHeight="${h}dp"\n` +
    `    android:previewLayout="@layout/${previa}"\n` +
    '    android:resizeMode="horizontal|vertical"\n' +
    `    android:targetCellWidth="${cw}"\n` +
    `    android:targetCellHeight="${ch}"\n` +
    `    android:updatePeriodMillis="${periodo}"\n` +
    (opcoes ? '    android:widgetFeatures="reconfigurable|configuration_optional"\n' : '') +
    '    android:widgetCategory="home_screen" />\n';
}
const HORA = 60 * 60 * 1000;
gravar('xml/widget_livre_info.xml', info('Livre pra gastar', { layout: 'widget_livre', previa: 'widget_livre_previa', w: 110, h: 110, cw: 2, ch: 2, periodo: HORA, opcoes: true, descricao: 'widget_livre_descricao' }));
gravar('xml/widget_contas_info.xml', info('Próximas contas', { layout: 'widget_contas', previa: 'widget_contas_previa', w: 250, h: 110, cw: 4, ch: 2, periodo: HORA, opcoes: true, descricao: 'widget_contas_descricao' }));
gravar('xml/widget_cartao_info.xml', info('Cartão', { layout: 'widget_cartao', previa: 'widget_cartao_previa', w: 110, h: 110, cw: 2, ch: 2, periodo: HORA, opcoes: true, descricao: 'widget_cartao_descricao' }));
gravar('xml/widget_lancar_info.xml', info('Lançar rápido', { layout: 'widget_lancar', previa: 'widget_lancar', w: 110, h: 110, cw: 2, ch: 2, periodo: 3 * HORA, opcoes: false, descricao: 'widget_lancar_descricao' }));

console.log('prévias, textos (' + Object.keys(textos).length + '), maré e 4 registros gerados');
