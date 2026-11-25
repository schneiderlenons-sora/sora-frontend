package com.forsora.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.forsora.app.R;

/**
 * Widget "Lancar rapido" (2x2): Gasto, Receita, Audio e Foto.
 *
 * Os quatro botoes abrem a conversa com a Sora no WhatsApp. Gasto e Receita ja
 * chegam com "gastei " / "recebi " escrito; Audio e Foto so abrem a conversa
 * (o WhatsApp nao deixa abrir direto no gravador nem na camera).
 *
 * Nao precisa de login nem de internet: sem sinal, o WhatsApp guarda a mensagem
 * e manda quando a conexao volta.
 *
 * ATENCAO: O codigo-fonte vive em sora-frontend/android-widgets/ e e COPIADO para o
 * projeto do Bubblewrap por aplicar.cjs. Editar direto no projeto do build se
 * perde no proximo `bubblewrap update`.
 */
public class LancarWidget extends AppWidgetProvider {

    /** O numero da Sora no WhatsApp (o mesmo de lib/sora-whatsapp.ts). */
    private static final String NUMERO_SORA = "5532985096225";

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gerente, int[] ids) {
        for (int id : ids) {
            gerente.updateAppWidget(id, montar(contexto));
        }
    }

    static RemoteViews montar(Context contexto) {
        RemoteViews tela = new RemoteViews(contexto.getPackageName(), R.layout.widget_lancar);
        tela.setOnClickPendingIntent(R.id.widget_lancar_gasto, abrirConversa(contexto, 1, "gastei "));
        tela.setOnClickPendingIntent(R.id.widget_lancar_receita, abrirConversa(contexto, 2, "recebi "));
        tela.setOnClickPendingIntent(R.id.widget_lancar_audio, abrirConversa(contexto, 3, null));
        tela.setOnClickPendingIntent(R.id.widget_lancar_foto, abrirConversa(contexto, 4, null));
        return tela;
    }

    /**
     * Cada botao precisa do PROPRIO codigo de pedido: PendingIntents iguais com o
     * mesmo codigo sao reaproveitados pelo sistema, e os quatro botoes passariam
     * a abrir a mesma coisa.
     */
    private static PendingIntent abrirConversa(Context contexto, int codigo, String texto) {
        Uri.Builder endereco = Uri.parse("https://wa.me/" + NUMERO_SORA).buildUpon();
        if (texto != null) {
            endereco.appendQueryParameter("text", texto);
        }
        Intent intencao = new Intent(Intent.ACTION_VIEW, endereco.build());
        intencao.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(
                contexto,
                codigo,
                intencao,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
