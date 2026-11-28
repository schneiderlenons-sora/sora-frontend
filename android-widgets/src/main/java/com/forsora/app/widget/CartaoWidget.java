package com.forsora.app.widget;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.forsora.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "Cartao" (2x2): a fatura atual do cartao escolhido, quando fecha e quando
 * vence. Sem escolha (ou se o cartao saiu), mostra o primeiro da lista.
 */
public class CartaoWidget extends BaseWidget {

    @Override
    protected RemoteViews desenhar(Context c, int id, Resumo.Situacao s, Bundle opcoes) {
        if (s.tipo != Resumo.Tipo.OK) return estado(c, s.tipo, id);
        if (s.json == null) return estado(c, Resumo.Tipo.INDISPONIVEL, id);

        JSONObject cartao = escolhido(s.json.optJSONArray("cartoes"), Opcoes.cartao(c, id));
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_cartao);
        v.setOnClickPendingIntent(R.id.widget_cartao_raiz, abrirNoApp(c, codigo(id, 7), "/cartao-de-credito"));

        if (cartao == null) {
            v.setTextViewText(R.id.widget_cartao_nome, c.getString(R.string.widget_cartao_nome));
            v.setTextViewText(R.id.widget_cartao_rotulo, c.getString(R.string.widget_nenhum_cartao));
            v.setViewVisibility(R.id.widget_cartao_valor, View.GONE);
            v.setTextViewText(R.id.widget_cartao_sub, c.getString(R.string.widget_cadastre_cartao));
            v.setViewVisibility(R.id.widget_cartao_atraso, View.GONE);
            return v;
        }

        boolean mostrar = Opcoes.mostrarValores(c, id);
        String valor = mostrar ? cartao.optString("valor_txt", "")
                : s.json.optString("simbolo", "R$") + " " + Desenho.OCULTO;
        v.setTextViewText(R.id.widget_cartao_nome, cartao.optString("nome", ""));
        v.setTextViewText(R.id.widget_cartao_rotulo, s.offline
                ? c.getString(R.string.widget_as, Desenho.hora(s.atualizadoEm))
                : c.getString(R.string.widget_fatura_atual));
        v.setTextViewText(R.id.widget_cartao_valor, valor);
        // No Android 8+ o layout ajusta a fonte pela largura real; abaixo disso
        // vale o tamanho pela quantidade de caracteres.
        if (Build.VERSION.SDK_INT < 26) {
            v.setTextViewTextSize(R.id.widget_cartao_valor, TypedValue.COMPLEX_UNIT_SP, tamanhoDoValor(valor));
        }
        v.setTextViewText(R.id.widget_cartao_sub, cartao.optString("sub", ""));

        String atraso = cartao.optString("atraso_txt", "");
        v.setViewVisibility(R.id.widget_cartao_atraso, atraso.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.widget_cartao_atraso_txt, mostrar ? atraso : c.getString(R.string.widget_fatura_em_atraso));
        return v;
    }

    /** O cartao escolhido nas opcoes; se ele nao existe mais, o primeiro. */
    static JSONObject escolhido(JSONArray lista, String id) {
        if (lista == null || lista.length() == 0) return null;
        if (id != null) {
            for (int i = 0; i < lista.length(); i++) {
                JSONObject x = lista.optJSONObject(i);
                if (x != null && id.equals(x.optString("id"))) return x;
            }
        }
        return lista.optJSONObject(0);
    }

    /** "R$ 1.631,27" cabe em 26sp; "R$ 12.345,67" precisa encolher pra nao cortar. */
    static float tamanhoDoValor(String valor) {
        int n = valor.length();
        if (n <= 11) return 26;
        if (n == 12) return 23;
        if (n == 13) return 21;
        return 19;
    }
}
