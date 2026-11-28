// Gera res/layout/widget_contas.xml (7 dias e 3 linhas repetidas — gerado
// pra não errar um id). Uso: node android-widgets/gerar/gerar-layout-contas.cjs
const fs = require('fs');
const path = require('path');
const res = process.argv[2] || path.join(__dirname, '..', 'src', 'main', 'res');

const ind = (n) => ' '.repeat(n);
const dia = (i) => `
${ind(12)}<LinearLayout
${ind(16)}android:layout_width="0dp"
${ind(16)}android:layout_height="wrap_content"
${ind(16)}android:layout_weight="1"
${ind(16)}android:gravity="center_horizontal"
${ind(16)}android:orientation="vertical">

${ind(16)}<TextView
${ind(20)}android:id="@+id/widget_contas_dia${i}"
${ind(20)}android:layout_width="15dp"
${ind(20)}android:layout_height="18dp"
${ind(20)}android:fontFamily="sans-serif-medium"
${ind(20)}android:gravity="center"
${ind(20)}android:includeFontPadding="false"
${ind(20)}android:maxLines="1"
${ind(20)}android:textColor="@color/widget_texto2"
${ind(20)}android:textSize="10.5sp" />

${ind(16)}<ImageView
${ind(20)}android:id="@+id/widget_contas_ponto${i}"
${ind(20)}android:layout_width="5dp"
${ind(20)}android:layout_height="5dp"
${ind(20)}android:layout_marginTop="4dp"
${ind(20)}android:importantForAccessibility="no"
${ind(20)}android:visibility="invisible" />
${ind(12)}</LinearLayout>`;

const linha = (i) => `
${ind(12)}<LinearLayout
${ind(16)}android:id="@+id/widget_contas_linha${i}"
${ind(16)}android:layout_width="match_parent"
${ind(16)}android:layout_height="0dp"
${ind(16)}android:layout_weight="1"
${ind(16)}android:gravity="center_vertical"
${ind(16)}android:orientation="horizontal"
${ind(16)}android:visibility="invisible">

${ind(16)}<ImageView
${ind(20)}android:id="@+id/widget_contas_icone${i}"
${ind(20)}android:layout_width="28dp"
${ind(20)}android:layout_height="28dp"
${ind(20)}android:importantForAccessibility="no"
${ind(20)}android:padding="7dp" />

${ind(16)}<LinearLayout
${ind(20)}android:layout_width="0dp"
${ind(20)}android:layout_height="wrap_content"
${ind(20)}android:layout_marginStart="9dp"
${ind(20)}android:layout_weight="1"
${ind(20)}android:orientation="vertical">

${ind(20)}<LinearLayout
${ind(24)}android:layout_width="match_parent"
${ind(24)}android:layout_height="wrap_content"
${ind(24)}android:orientation="horizontal">

${ind(24)}<TextView
${ind(28)}android:id="@+id/widget_contas_titulo${i}"
${ind(28)}android:layout_width="0dp"
${ind(28)}android:layout_height="wrap_content"
${ind(28)}android:layout_weight="1"
${ind(28)}android:ellipsize="end"
${ind(28)}android:fontFamily="sans-serif-medium"
${ind(28)}android:includeFontPadding="false"
${ind(28)}android:maxLines="1"
${ind(28)}android:textColor="@color/widget_texto"
${ind(28)}android:textSize="13.5sp" />

${ind(24)}<TextView
${ind(28)}android:id="@+id/widget_contas_valor${i}"
${ind(28)}android:layout_width="wrap_content"
${ind(28)}android:layout_height="wrap_content"
${ind(28)}android:layout_marginStart="8dp"
${ind(28)}android:fontFamily="sans-serif-medium"
${ind(28)}android:fontFeatureSettings="tnum"
${ind(28)}android:includeFontPadding="false"
${ind(28)}android:maxLines="1"
${ind(28)}android:textColor="@color/widget_texto"
${ind(28)}android:textSize="13.5sp" />
${ind(20)}</LinearLayout>

${ind(20)}<LinearLayout
${ind(24)}android:layout_width="match_parent"
${ind(24)}android:layout_height="wrap_content"
${ind(24)}android:layout_marginTop="3dp"
${ind(24)}android:gravity="center_vertical"
${ind(24)}android:orientation="horizontal">

${ind(24)}<ImageView
${ind(28)}android:id="@+id/widget_contas_alerta${i}"
${ind(28)}android:layout_width="10dp"
${ind(28)}android:layout_height="10dp"
${ind(28)}android:layout_marginEnd="4dp"
${ind(28)}android:importantForAccessibility="no"
${ind(28)}android:src="@drawable/widget_ic_alerta_vermelho"
${ind(28)}android:visibility="gone" />

${ind(24)}<TextView
${ind(28)}android:id="@+id/widget_contas_sub${i}"
${ind(28)}android:layout_width="0dp"
${ind(28)}android:layout_height="wrap_content"
${ind(28)}android:layout_weight="1"
${ind(28)}android:ellipsize="end"
${ind(28)}android:includeFontPadding="false"
${ind(28)}android:maxLines="1"
${ind(28)}android:textColor="@color/widget_texto2"
${ind(28)}android:textSize="11.5sp" />
${ind(20)}</LinearLayout>
${ind(16)}</LinearLayout>
${ind(12)}</LinearLayout>`;

const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- "Próximas contas" (4x2). GERADO por android-widgets/gerar/gerar-layout-contas.cjs:
     os 7 dias e as 3 linhas se repetem. À esquerda quantas contas, o total e a faixa dos 7
     dias; à direita até 3 contas, atrasadas primeiro. -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_contas_raiz"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_fundo"
    android:baselineAligned="false"
    android:clipToOutline="true"
    android:orientation="horizontal"
    android:padding="16dp">

    <LinearLayout
        android:layout_width="108dp"
        android:layout_height="match_parent"
        android:orientation="vertical">

        <TextView
            android:id="@+id/widget_contas_cabecalho"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:ellipsize="end"
            android:fontFamily="sans-serif-medium"
            android:includeFontPadding="false"
            android:maxLines="1"
            android:textColor="@color/widget_texto2"
            android:textSize="12sp" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="6dp"
            android:baselineAligned="true"
            android:orientation="horizontal">

            <TextView
                android:id="@+id/widget_contas_qtd"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:fontFamily="sans-serif"
                android:fontFeatureSettings="tnum"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:textColor="@color/widget_texto"
                android:textSize="34sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/widget_contas_rotulo"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="5dp"
                android:fontFamily="sans-serif-medium"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:textColor="@color/widget_texto"
                android:textSize="15sp" />
        </LinearLayout>

        <TextView
            android:id="@+id/widget_contas_total"
            android:layout_width="match_parent"
            android:layout_height="19sp"
            android:autoSizeTextType="uniform"
            android:autoSizeMinTextSize="8sp"
            android:autoSizeMaxTextSize="13sp"
            android:autoSizeStepGranularity="1sp"
            android:layout_marginTop="5dp"
            android:ellipsize="end"
            android:fontFamily="sans-serif-medium"
            android:fontFeatureSettings="tnum"
            android:includeFontPadding="false"
            android:maxLines="1"
            android:textColor="@color/widget_texto"
            android:textSize="13sp" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:orientation="vertical" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:baselineAligned="false"
            android:orientation="horizontal">
${[0, 1, 2, 3, 4, 5, 6].map(dia).join('\n')}
        </LinearLayout>
    </LinearLayout>

    <ImageView
        android:layout_width="1dp"
        android:layout_height="match_parent"
        android:layout_marginStart="12dp"
        android:layout_marginEnd="12dp"
        android:background="@color/widget_divisor"
        android:importantForAccessibility="no" />

    <FrameLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1">

        <LinearLayout
            android:id="@+id/widget_contas_vazio"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:gravity="center"
            android:orientation="vertical"
            android:visibility="gone">

            <ImageView
                android:layout_width="24dp"
                android:layout_height="24dp"
                android:importantForAccessibility="no"
                android:src="@drawable/widget_ic_check_marca" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="6dp"
                android:fontFamily="sans-serif-medium"
                android:gravity="center"
                android:includeFontPadding="false"
                android:text="@string/widget_nada_vence"
                android:textColor="@color/widget_texto"
                android:textSize="13sp" />
        </LinearLayout>

        <LinearLayout
            android:id="@+id/widget_contas_lista"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical">
${[0, 1, 2].map(linha).join('\n')}

            <TextView
                android:id="@+id/widget_contas_mais"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="37dp"
                android:layout_marginTop="2dp"
                android:fontFamily="sans-serif-medium"
                android:includeFontPadding="false"
                android:textColor="@color/widget_texto2"
                android:textSize="11sp"
                android:visibility="gone" />
        </LinearLayout>
    </FrameLayout>
</LinearLayout>
`;
fs.writeFileSync(path.join(res, 'layout', 'widget_contas.xml'), xml);
console.log('widget_contas.xml', xml.split('\n').length, 'linhas');
