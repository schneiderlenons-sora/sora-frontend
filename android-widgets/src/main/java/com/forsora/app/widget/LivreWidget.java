package com.forsora.app.widget;

import android.content.Context;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.forsora.app.R;

import org.json.JSONObject;

/**
 * "Livre pra gastar" (2x2): quanto da pra gastar por dia ate o fim do mes,
 * com a mare ao fundo. Os textos vem prontos do servidor (widgetResumo.js).
 */
public class LivreWidget extends BaseWidget {

    @Override
    protected RemoteViews desenhar(Context c, int id, Resumo.Situacao s, Bundle opcoes) {
        JSONObject l = s.json != null ? s.json.optJSONObject("livre") : null;
        if (s.tipo != Resumo.Tipo.OK) return estado(c, s.tipo, id);
        if (l == null) return estado(c, Resumo.Tipo.INDISPONIVEL, id);

        boolean mostrar = Opcoes.mostrarValores(c, id);
        String est = l.optString("estado", "folgado");
        int agua, frente, status, resto, icone;
        if (est.equals("apertado")) {
            agua = R.color.widget_mare_ambar_agua; frente = R.color.widget_mare_ambar_frente;
            status = R.color.widget_status_ambar; resto = R.color.widget_resto_ambar;
            icone = R.drawable.widget_ic_alerta_ambar;
        } else if (est.equals("vermelho")) {
            agua = R.color.widget_mare_coral_agua; frente = R.color.widget_mare_coral_frente;
            status = R.color.widget_status_coral; resto = R.color.widget_resto_coral;
            icone = R.drawable.widget_ic_alerta_coral;
        } else {
            agua = R.color.widget_mare_verde_agua; frente = R.color.widget_mare_verde_frente;
            status = R.color.widget_status_verde; resto = R.color.widget_resto_verde;
            icone = R.drawable.widget_ic_check_verde;
        }

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_livre);

        v.setImageViewBitmap(R.id.widget_livre_mare, Desenho.mare(Desenho.tamanhoPx(c, opcoes, 150),
                l.optDouble("nivel", 0), l.optDouble("ritmo", 0), !est.equals("vermelho"),
                c.getColor(agua), c.getColor(frente), c.getColor(R.color.widget_linha_ritmo)));
        v.setInt(R.id.widget_livre_mare, "setImageAlpha", s.offline ? 140 : 255);

        String numero = mostrar ? l.optString("numero", "") : "•••";
        v.setTextViewText(R.id.widget_livre_prefixo, l.optString("prefixo", ""));
        v.setTextViewText(R.id.widget_livre_numero, numero);
        v.setTextViewTextSize(R.id.widget_livre_numero, TypedValue.COMPLEX_UNIT_SP,
                mostrar ? Desenho.tamanhoDoNumero(numero, 44) : 32);
        visivelComTexto(v, R.id.widget_livre_sufixo, l.optString("sufixo", ""));
        visivelComTexto(v, R.id.widget_livre_abaixo, l.optString("abaixo", ""));

        if (s.offline) {
            v.setImageViewResource(R.id.widget_livre_status_icone, R.drawable.widget_ic_offline_cinza);
            v.setTextViewText(R.id.widget_livre_status, c.getString(R.string.widget_atualizado_as, Desenho.hora(s.atualizadoEm)));
            Desenho.corTexto(c, v, R.id.widget_livre_status, R.color.widget_texto2);
            Desenho.corTexto(c, v, R.id.widget_livre_resto, R.color.widget_texto2);
        } else {
            v.setImageViewResource(R.id.widget_livre_status_icone, icone);
            v.setTextViewText(R.id.widget_livre_status, l.optString("status", ""));
            Desenho.corTexto(c, v, R.id.widget_livre_status, status);
            Desenho.corTexto(c, v, R.id.widget_livre_resto, resto);
        }
        v.setTextViewText(R.id.widget_livre_resto, mostrar ? l.optString("resto", "") : l.optString("resto_oculto", ""));

        v.setOnClickPendingIntent(R.id.widget_livre_raiz, abrirNoApp(c, codigo(id, 5), "/previstos"));
        return v;
    }

    static void visivelComTexto(RemoteViews v, int id, String texto) {
        v.setTextViewText(id, texto);
        v.setViewVisibility(id, texto.isEmpty() ? View.GONE : View.VISIBLE);
    }
}
