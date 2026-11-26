// Gera os drawables da fase 2 dos widgets Android (ícones no traço do Lucide,
// marca, faixas de cor). Uso: node android-widgets/gerar/gerar-drawables.cjs
const fs = require('fs');
const path = require('path');
const res = process.argv[2] || path.join(__dirname, '..', 'src', 'main', 'res');
const dir = path.join(res, 'drawable');
fs.mkdirSync(dir, { recursive: true });

const ICONES = {
  check: ['M3,12a9,9 0,1 0,18 0a9,9 0,1 0,-18 0', 'M8,12.4l2.8,2.8L16,9.6'],
  alerta: ['M10.29,3.86L1.82,18a2,2 0,0 0,1.71 3h16.94a2,2 0,0 0,1.71 -3L13.71,3.86a2,2 0,0 0,-3.42 0z', 'M12,9v4', 'M12,17h0.01'],
  alerta_circulo: ['M3,12a9,9 0,1 0,18 0a9,9 0,1 0,-18 0', 'M12,8v4', 'M12,16h0.01'],
  offline: ['M2,2l20,20', 'M8.5,16.5a5,5 0,0 1,7 0', 'M2,8.82a15,15 0,0 1,4.17 -2.65', 'M10.66,5c4.01,-0.36 8.14,0.9 11.34,3.76', 'M16.85,11.25a10,10 0,0 1,2.22 1.68', 'M5,13a10,10 0,0 1,5.24 -2.76', 'M12,20h0.01'],
  cadeado: ['M5,11h14a2,2 0,0 1,2 2v7a2,2 0,0 1,-2 2H5a2,2 0,0 1,-2 -2v-7a2,2 0,0 1,2 -2z', 'M7,11V7a5,5 0,0 1,10 0v4'],
  luz: ['M13,2L3,14h9l-1,8l10,-12h-9l1,-8z'],
  agua: ['M12,22a7,7 0,0 0,7 -7c0,-2 -1,-3.9 -3,-5.5s-3.5,-4 -4,-6.5c-0.5,2.5 -2,4.9 -4,6.5C6,11.1 5,13 5,15a7,7 0,0 0,7 7z'],
  internet: ['M12,20h0.01', 'M2,8.82a15,15 0,0 1,20 0', 'M5,12.86a10,10 0,0 1,14 0', 'M8.5,16.43a5,5 0,0 1,7 0'],
  casa: ['M3,10.5L12,3l9,7.5V20a1,1 0,0 1,-1 1h-5v-6h-6v6H4a1,1 0,0 1,-1 -1z'],
  cartao: ['M4,5h16a2,2 0,0 1,2 2v10a2,2 0,0 1,-2 2H4a2,2 0,0 1,-2 -2V7a2,2 0,0 1,2 -2z', 'M2,10h20'],
  divida: ['M3,22h18', 'M6,18v-7', 'M10,18v-7', 'M14,18v-7', 'M18,18v-7', 'M12,2l8,5H4z'],
  agendado: ['M8,2v4', 'M16,2v4', 'M5,4h14a2,2 0,0 1,2 2v14a2,2 0,0 1,-2 2H5a2,2 0,0 1,-2 -2V6a2,2 0,0 1,2 -2z', 'M3,10h18'],
  fixa: ['M17,2l4,4l-4,4', 'M3,11v-1a4,4 0,0 1,4 -4h14', 'M7,22l-4,-4l4,-4', 'M21,13v1a4,4 0,0 1,-4 4H3'],
};

function vetor(caminhos, cor, traco = 2) {
  const p = caminhos.map((d) =>
    `    <path android:pathData="${d}" android:strokeColor="@color/${cor}" android:strokeWidth="${traco}"\n` +
    `        android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000" />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Gerado (traço do Lucide). Cor por tema em values/values-night. -->\n` +
    `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n` +
    `    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n${p}\n</vector>\n`;
}

const ARQUIVOS = {
  // Status do "Livre pra gastar" (a cor muda com a situação)
  widget_ic_check_verde: vetor(ICONES.check, 'widget_status_verde', 2.4),
  widget_ic_alerta_ambar: vetor(ICONES.alerta, 'widget_status_ambar', 2.4),
  widget_ic_alerta_coral: vetor(ICONES.alerta, 'widget_status_coral', 2.4),
  widget_ic_offline_cinza: vetor(ICONES.offline, 'widget_texto2', 2.2),
  widget_ic_cadeado: vetor(ICONES.cadeado, 'widget_texto2', 2.2),
  widget_ic_alerta_vermelho: vetor(ICONES.alerta_circulo, 'widget_vermelho', 2.6),
  widget_ic_check_marca: vetor(ICONES.check, 'widget_verde_marca', 2.2),
  // Ícones das contas (a cor de cada tipo é fixa)
  widget_ic_luz: vetor(ICONES.luz, 'widget_ic_ambar'),
  widget_ic_agua: vetor(ICONES.agua, 'widget_ic_azul'),
  widget_ic_internet: vetor(ICONES.internet, 'widget_ic_azul'),
  widget_ic_agendado: vetor(ICONES.agendado, 'widget_ic_azul'),
  widget_ic_casa: vetor(ICONES.casa, 'widget_ic_cinza'),
  widget_ic_fixa: vetor(ICONES.fixa, 'widget_ic_cinza'),
  widget_ic_cartao: vetor(ICONES.cartao, 'widget_ic_violeta'),
  widget_ic_divida: vetor(ICONES.divida, 'widget_ic_teal'),
};

const forma = (cor, raio) => `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n` +
  `    <solid android:color="@color/${cor}" />\n    <corners android:radius="${raio}" />\n</shape>\n`;
const ponto = (cor) => `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">\n` +
  `    <solid android:color="@color/${cor}" />\n    <size android:width="5dp" android:height="5dp" />\n</shape>\n`;

for (const t of ['ambar', 'azul', 'violeta', 'teal', 'cinza']) ARQUIVOS['widget_tile_' + t] = forma('widget_tile_' + t, '9dp');
for (const o of ['fatura', 'divida', 'fixa', 'agendado']) ARQUIVOS['widget_ponto_' + o] = ponto('widget_ponto_' + o);
ARQUIVOS.widget_hoje = forma('widget_hoje_fundo', '5dp');
ARQUIVOS.widget_botao_conectar = forma('widget_conectar_fundo', '100dp');
ARQUIVOS.widget_marca = `<?xml version="1.0" encoding="utf-8"?>\n<!-- A marca da Sora: círculo verde com a onda (igual ao MarcaSora do iPhone). -->\n` +
  `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n` +
  `    android:width="16dp" android:height="16dp" android:viewportWidth="16" android:viewportHeight="16">\n` +
  `    <path android:pathData="M0,8a8,8 0,1 0,16 0a8,8 0,1 0,-16 0" android:fillColor="@color/widget_verde_marca" />\n` +
  `    <path android:pathData="M3.4,9.3C4.55,7.95 5.7,7.95 6.85,9.3C8,10.65 9.15,10.65 10.3,9.3C10.9,8.6 11.45,8.25 12.05,8.25"\n` +
  `        android:strokeColor="@color/widget_marca_onda" android:strokeWidth="1.6" android:strokeLineCap="round" android:fillColor="#00000000" />\n` +
  `</vector>\n`;

for (const [nome, xml] of Object.entries(ARQUIVOS)) fs.writeFileSync(path.join(dir, nome + '.xml'), xml);
console.log('drawables:', Object.keys(ARQUIVOS).length);
