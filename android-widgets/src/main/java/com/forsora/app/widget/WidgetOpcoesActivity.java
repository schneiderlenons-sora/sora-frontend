package com.forsora.app.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.TextView;

import com.forsora.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Opcoes de um widget (toque e segure no widget -> Personalizar): mostrar ou
 * esconder os valores e, no do cartao, qual cartao. Abre como uma janelinha
 * por cima da tela inicial.
 */
public class WidgetOpcoesActivity extends Activity {

    private int idWidget = AppWidgetManager.INVALID_APPWIDGET_ID;
    private boolean ehCartao;
    private RadioGroup grupo;
    private TextView aviso;
    private String cartaoAtual;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        Bundle extras = getIntent() != null ? getIntent().getExtras() : null;
        if (extras != null) idWidget = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        // Sem confirmar, o sistema descarta o widget recem-adicionado (Android 11 e antes).
        setResult(RESULT_CANCELED, resultado());
        if (idWidget == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(idWidget);
        ehCartao = info != null && info.provider != null
                && info.provider.getClassName().equals(CartaoWidget.class.getName());

        setContentView(R.layout.widget_opcoes);
        final Switch valores = findViewById(R.id.widget_opcoes_valores);
        grupo = findViewById(R.id.widget_opcoes_cartoes);
        aviso = findViewById(R.id.widget_opcoes_aviso);
        valores.setChecked(Opcoes.mostrarValores(this, idWidget));
        cartaoAtual = Opcoes.cartao(this, idWidget);

        findViewById(R.id.widget_opcoes_secao_cartao).setVisibility(ehCartao ? View.VISIBLE : View.GONE);
        if (ehCartao) carregarCartoes();

        Button cancelar = findViewById(R.id.widget_opcoes_cancelar);
        Button salvar = findViewById(R.id.widget_opcoes_salvar);
        cancelar.setOnClickListener(x -> finish());
        salvar.setOnClickListener(x -> {
            String cartao = cartaoAtual;
            if (ehCartao) {
                View marcado = grupo.findViewById(grupo.getCheckedRadioButtonId());
                if (marcado != null && marcado.getTag() != null) cartao = String.valueOf(marcado.getTag());
            }
            Opcoes.salvar(this, idWidget, valores.isChecked(), cartao);
            redesenhar(this, idWidget);
            setResult(RESULT_OK, resultado());
            finish();
        });
    }

    private Intent resultado() {
        return new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
    }

    /** Mostra os cartoes do ultimo retrato; sem retrato, busca (fora da linha principal). */
    private void carregarCartoes() {
        JSONObject guardado = Resumo.guardado(this);
        if (guardado != null || !Resumo.conectado(this)) {
            mostrarCartoes(guardado);
            return;
        }
        aviso.setText(R.string.widget_opcoes_carregando);
        aviso.setVisibility(View.VISIBLE);
        final Context app = getApplicationContext();
        final Handler principal = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            final Resumo.Situacao s = Resumo.buscar(app);
            principal.post(() -> {
                if (!isFinishing()) mostrarCartoes(s.json);
            });
        }).start();
    }

    private void mostrarCartoes(JSONObject resumo) {
        grupo.removeAllViews();
        JSONArray lista = resumo != null ? resumo.optJSONArray("cartoes") : null;
        if (lista == null || lista.length() == 0) {
            aviso.setText(Resumo.conectado(this) ? R.string.widget_opcoes_sem_cartao : R.string.widget_opcoes_conecte);
            aviso.setVisibility(View.VISIBLE);
            return;
        }
        aviso.setVisibility(View.GONE);
        JSONObject escolhido = CartaoWidget.escolhido(lista, cartaoAtual);
        String idEscolhido = escolhido != null ? escolhido.optString("id") : null;
        for (int i = 0; i < lista.length(); i++) {
            JSONObject c = lista.optJSONObject(i);
            if (c == null) continue;
            RadioButton r = (RadioButton) getLayoutInflater().inflate(R.layout.widget_opcoes_cartao, grupo, false);
            r.setId(View.generateViewId());
            r.setText(c.optString("nome", ""));
            r.setTag(c.optString("id"));
            grupo.addView(r);
            if (c.optString("id").equals(idEscolhido)) grupo.check(r.getId());
        }
    }

    /** Redesenha so este widget com as opcoes novas. */
    static void redesenhar(Context c, int id) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(c).getAppWidgetInfo(id);
        if (info == null || info.provider == null) return;
        Intent i = new Intent().setComponent(info.provider)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[] { id });
        c.sendBroadcast(i);
    }
}
