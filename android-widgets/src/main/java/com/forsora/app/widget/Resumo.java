package com.forsora.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * O retrato dos widgets (GET /api/widget/resumo) - busca, cache e estados.
 *
 * O TEXTO JA VEM PRONTO do servidor ("R$ 47", "Amanha", "Atrasada ha 2 dias"):
 * aqui so se busca e se guarda. A regra mora em
 * sora-backend/src/services/widgetResumo.js, a mesma que o iPhone usa.
 *
 * Barato de proposito: manda o ETag do ultimo retrato e, se nada mudou, o
 * servidor responde 304 sem corpo. Sem internet, devolve o ultimo guardado.
 */
public final class Resumo {

    public enum Tipo { OK, DESCONECTADO, FORA_DO_PLANO, INDISPONIVEL }

    public static final class Situacao {
        public final Tipo tipo;
        public final JSONObject json;
        public final long atualizadoEm;
        public final boolean offline;

        Situacao(Tipo tipo, JSONObject json, long atualizadoEm, boolean offline) {
            this.tipo = tipo;
            this.json = json;
            this.atualizadoEm = atualizadoEm;
            this.offline = offline;
        }
    }

    static final String PREFS = "sora_widgets";
    static final String API_PADRAO = "https://sora-backend-ohio.onrender.com";

    private Resumo() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean conectado(Context c) {
        return prefs(c).getString("chave", null) != null;
    }

    static void salvarChave(Context c, String chave, String api) {
        prefs(c).edit().putString("chave", chave).putString("api", api)
                .remove("corpo").remove("etag").remove("em").apply();
    }

    static void esquecer(Context c) {
        prefs(c).edit().remove("corpo").remove("etag").remove("em").apply();
    }

    /** O ultimo retrato guardado (sem internet ou pra listar os cartoes). */
    public static JSONObject guardado(Context c) {
        String corpo = prefs(c).getString("corpo", null);
        if (corpo == null) return null;
        try { return new JSONObject(corpo); } catch (Exception e) { return null; }
    }

    /**
     * Retrato buscado ha menos disto e reaproveitado: quando varios widgets
     * atualizam juntos (ligar o celular, conectar, mudar uma opcao), so o
     * primeiro vai ao servidor.
     */
    private static final long FRESCO_MS = 90 * 1000;

    /** Busca o retrato. Roda FORA da linha principal (rede). */
    public static Situacao buscar(Context c) {
        SharedPreferences p = prefs(c);
        String chave = p.getString("chave", null);
        if (chave == null) {
            esquecer(c);
            return new Situacao(Tipo.DESCONECTADO, null, 0, false);
        }
        long em = p.getLong("em", 0);
        long agora = System.currentTimeMillis();
        if (em > 0 && agora - em >= 0 && agora - em < FRESCO_MS) {
            JSONObject g = guardado(c);
            if (g != null) return new Situacao(Tipo.OK, g, em, false);
        }
        String api = p.getString("api", API_PADRAO);
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(api + "/api/widget/resumo").openConnection();
            con.setConnectTimeout(15000);
            con.setReadTimeout(15000);
            con.setRequestProperty("Authorization", "Bearer " + chave);
            String etag = p.getString("etag", null);
            if (etag != null && p.getString("corpo", null) != null) con.setRequestProperty("If-None-Match", etag);

            int status = con.getResponseCode();
            if (status == 304) {
                JSONObject g = guardado(c);
                if (g != null) {
                    p.edit().putLong("em", System.currentTimeMillis()).apply();
                    return new Situacao(Tipo.OK, g, System.currentTimeMillis(), false);
                }
            }
            if (status == 401) {
                // Chave desconectada na aba Widgets: esquece tudo (nada de
                // bater no servidor com uma chave que nao vale mais).
                p.edit().remove("chave").apply();
                esquecer(c);
                return new Situacao(Tipo.DESCONECTADO, null, 0, false);
            }
            if (status != 200) return doGuardado(c);

            String corpo = ler(con.getInputStream());
            JSONObject j = new JSONObject(corpo);
            String estado = j.optString("estado", "");
            if (estado.equals("plano") || estado.equals("teste") || estado.equals("desligado")) {
                esquecer(c);
                return new Situacao(Tipo.FORA_DO_PLANO, null, 0, false);
            }
            if (!estado.equals("ok")) return doGuardado(c);
            p.edit().putString("corpo", corpo).putString("etag", con.getHeaderField("ETag"))
                    .putLong("em", System.currentTimeMillis()).apply();
            return new Situacao(Tipo.OK, j, System.currentTimeMillis(), false);
        } catch (Exception e) {
            return doGuardado(c);
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static Situacao doGuardado(Context c) {
        JSONObject g = guardado(c);
        if (g != null) return new Situacao(Tipo.OK, g, prefs(c).getLong("em", 0), true);
        return new Situacao(Tipo.INDISPONIVEL, null, 0, false);
    }

    static String ler(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toString("UTF-8");
    }
}
