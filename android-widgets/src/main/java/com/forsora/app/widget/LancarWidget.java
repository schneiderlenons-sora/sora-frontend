package com.forsora.app.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import com.forsora.app.R;

/**
 * Widget "Lancar rapido" (2x2): Gasto, Receita, Audio e Foto.
 *
 * Os quatro botoes abrem a conversa com a Sora no WhatsApp. Gasto e Receita ja
 * chegam com "gastei " / "recebi " escrito; Audio e Foto so abrem a conversa
 * (o WhatsApp nao deixa abrir direto no gravador nem na camera).
 *
 * Widgets sao so pra assinantes (decisao do dono): sem conexao o widget pede
 * pra conectar, e fora do plano diz que nao faz parte do plano. Sem internet
 * (nunca conseguiu conferir), os botoes aparecem: eles so abrem o WhatsApp,
 * que guarda a mensagem e manda quando o sinal volta. Igual ao iPhone.
 *
 * ATENCAO: o codigo-fonte vive em sora-frontend/android-widgets/ e e COPIADO para o
 * projeto do Bubblewrap por aplicar.cjs. Editar direto no projeto do build se
 * perde no proximo `bubblewrap update`.
 */
public class LancarWidget extends BaseWidget {

    /** O numero da Sora no WhatsApp (o mesmo de lib/sora-whatsapp.ts). */
    private static final String NUMERO_SORA = "5532985096225";

    @Override
    protected RemoteViews desenhar(Context c, int id, Resumo.Situacao s, Bundle opcoes) {
        if (s.tipo == Resumo.Tipo.DESCONECTADO || s.tipo == Resumo.Tipo.FORA_DO_PLANO) {
            return estado(c, s.tipo, id);
        }
        RemoteViews tela = new RemoteViews(c.getPackageName(), R.layout.widget_lancar);
        tela.setOnClickPendingIntent(R.id.widget_lancar_gasto, abrirConversa(c, codigo(id, 1), "gastei "));
        tela.setOnClickPendingIntent(R.id.widget_lancar_receita, abrirConversa(c, codigo(id, 2), "recebi "));
        tela.setOnClickPendingIntent(R.id.widget_lancar_audio, abrirConversa(c, codigo(id, 3), null));
        tela.setOnClickPendingIntent(R.id.widget_lancar_foto, abrirConversa(c, codigo(id, 4), null));
        return tela;
    }

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
