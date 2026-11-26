package com.forsora.app.widget;

import android.content.Context;

/** As opcoes de cada widget (toque e segure -> Editar): mostrar valores e qual cartao. */
public final class Opcoes {
    private Opcoes() {}

    public static boolean mostrarValores(Context c, int id) {
        return Resumo.prefs(c).getBoolean("valores_" + id, true);
    }

    public static String cartao(Context c, int id) {
        return Resumo.prefs(c).getString("cartao_" + id, null);
    }

    static void salvar(Context c, int id, boolean mostrarValores, String cartao) {
        Resumo.prefs(c).edit().putBoolean("valores_" + id, mostrarValores).putString("cartao_" + id, cartao).apply();
    }

    static void apagar(Context c, int id) {
        Resumo.prefs(c).edit().remove("valores_" + id).remove("cartao_" + id).apply();
    }
}
