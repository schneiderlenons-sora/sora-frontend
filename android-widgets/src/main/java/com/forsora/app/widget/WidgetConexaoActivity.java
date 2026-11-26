package com.forsora.app.widget;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import com.forsora.app.R;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Recebe o codigo de conexao da aba Widgets do painel e o troca pela chave do
 * aparelho. O link vem do site, dentro do app:
 *
 *   forsora://widget/conectar?codigo=sora_wc_...&api=https://...
 *
 * O codigo vale 5 minutos e so uma vez; a chave fica so neste aparelho e so
 * abre o resumo dos widgets (nunca o painel). Sem tela: mostra um aviso curto
 * e volta pra onde a pessoa estava.
 */
public class WidgetConexaoActivity extends Activity {

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        Uri link = getIntent() != null ? getIntent().getData() : null;
        final String codigo = link != null ? link.getQueryParameter("codigo") : null;
        final String api = apiSegura(link != null ? link.getQueryParameter("api") : null);
        if (codigo == null || !codigo.startsWith("sora_wc_")) {
            avisar(R.string.widget_conexao_invalida);
            finish();
            return;
        }
        final Context app = getApplicationContext();
        final Handler principal = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            final int msg = trocar(app, codigo, api);
            principal.post(() -> {
                Toast.makeText(app, msg, Toast.LENGTH_LONG).show();
                if (msg == R.string.widget_conectado) BaseWidget.atualizarTodos(app);
            });
        }).start();
        finish();
    }

    private void avisar(int msg) {
        Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_LONG).show();
    }

    /**
     * So aceita o servidor da Sora: um link forjado com outro endereco mandaria
     * o codigo (e depois a chave) para um servidor de terceiros.
     */
    static String apiSegura(String api) {
        if (api == null) return Resumo.API_PADRAO;
        try {
            Uri u = Uri.parse(api);
            String host = u.getHost();
            if (!"https".equals(u.getScheme()) || host == null) return Resumo.API_PADRAO;
            boolean daSora = host.equals("forsora.com") || host.endsWith(".forsora.com")
                    || (host.startsWith("sora-backend") && host.endsWith(".onrender.com"));
            if (!daSora) return Resumo.API_PADRAO;
            return "https://" + host;
        } catch (RuntimeException e) {
            return Resumo.API_PADRAO;
        }
    }

    private static int trocar(Context c, String codigo, String api) {
        HttpURLConnection con = null;
        try {
            JSONObject corpo = new JSONObject();
            corpo.put("codigo", codigo);
            corpo.put("plataforma", "android");
            corpo.put("aparelho", (Build.MANUFACTURER + " " + Build.MODEL).trim());
            byte[] bytes = corpo.toString().getBytes("UTF-8");

            con = (HttpURLConnection) new URL(api + "/api/widget/token").openConnection();
            con.setConnectTimeout(15000);
            con.setReadTimeout(20000);
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            OutputStream out = con.getOutputStream();
            out.write(bytes);
            out.close();

            int status = con.getResponseCode();
            if (status != 200) {
                return status == 400 || status == 401 || status == 404 || status == 410
                        ? R.string.widget_conexao_expirada : R.string.widget_conexao_falhou;
            }
            JSONObject j = new JSONObject(Resumo.ler(con.getInputStream()));
            String chave = j.optString("chave", "");
            if (!chave.startsWith("sora_wg_")) return R.string.widget_conexao_falhou;
            Resumo.salvarChave(c, chave, api);
            return R.string.widget_conectado;
        } catch (Exception e) {
            return R.string.widget_conexao_falhou;
        } finally {
            if (con != null) con.disconnect();
        }
    }
}
