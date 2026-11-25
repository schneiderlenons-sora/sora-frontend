// Leva os widgets da Sora para o projeto Android do Bubblewrap.
//
// Por que existe: o projeto Android é GERADO pelo Bubblewrap e mora fora do
// repositório (C:\Users\jenif\sora-android; ver docs/ANDROID-TWA.md). O
// `bubblewrap update` reescreve o AndroidManifest.xml e apagaria o registro do
// widget. O código dos widgets fica aqui, versionado, e este script o copia
// para o projeto e registra o widget no manifesto.
//
// Uso (na ordem, a cada build novo):
//   bubblewrap update
//   node splash-transparente.cjs
//   node "<repo>/sora-frontend/android-widgets/aplicar.cjs"
//   bubblewrap build
//
// Pode rodar quantas vezes quiser: copia por cima e só registra o widget no
// manifesto se ele ainda não estiver lá.
const fs = require('fs');
const path = require('path');

const destino = process.argv[2] || 'C:\\Users\\jenif\\sora-android';
const origem = path.join(__dirname, 'src', 'main');
const mainDestino = path.join(destino, 'app', 'src', 'main');
const manifesto = path.join(mainDestino, 'AndroidManifest.xml');

if (!fs.existsSync(manifesto)) {
  console.error('Não achei o projeto Android em ' + destino + ' (falta app/src/main/AndroidManifest.xml).');
  process.exit(1);
}

// 1) Copia o código e os recursos (só os arquivos dos widgets, todos com nome widget_*).
let copiados = 0;
function copiar(de, para) {
  for (const nome of fs.readdirSync(de)) {
    const a = path.join(de, nome);
    const b = path.join(para, nome);
    if (fs.statSync(a).isDirectory()) {
      fs.mkdirSync(b, { recursive: true });
      copiar(a, b);
    } else {
      fs.copyFileSync(a, b);
      copiados++;
    }
  }
}
copiar(origem, mainDestino);

// 2) Registra os widgets no manifesto (uma vez).
const RECEPTORES = [
  {
    classe: 'com.forsora.app.widget.LancarWidget',
    bloco: [
      '        <!-- Widget "Lançar rápido" (sora-frontend/android-widgets) -->',
      '        <receiver',
      '            android:name="com.forsora.app.widget.LancarWidget"',
      '            android:exported="true"',
      '            android:label="@string/widget_lancar_nome">',
      '            <intent-filter>',
      '                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />',
      '            </intent-filter>',
      '            <meta-data',
      '                android:name="android.appwidget.provider"',
      '                android:resource="@xml/widget_lancar_info" />',
      '        </receiver>',
    ].join('\n'),
  },
];

let xml = fs.readFileSync(manifesto, 'utf8');
const antes = xml;
const fim = xml.lastIndexOf('</application>');
if (fim < 0) {
  console.error('O manifesto não tem </application>; nada foi registrado.');
  process.exit(1);
}
let registrados = 0;
for (const r of RECEPTORES) {
  if (xml.includes(r.classe)) continue;
  const pos = xml.lastIndexOf('</application>');
  xml = xml.slice(0, pos) + r.bloco + '\n\n    ' + xml.slice(pos);
  registrados++;
}
if (xml !== antes) {
  const copia = manifesto + '.antes-widgets';
  if (!fs.existsSync(copia)) fs.writeFileSync(copia, antes);
  fs.writeFileSync(manifesto, xml);
}

console.log(`Widgets aplicados: ${copiados} arquivos copiados, ${registrados} registrado(s) agora no manifesto` +
  (registrados === 0 ? ' (já estavam lá).' : '.'));
