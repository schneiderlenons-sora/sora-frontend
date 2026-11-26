package com.forsora.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.forsora.app.R;

/**
 * Base dos widgets com dados: busca o retrato FORA da linha principal
 * (goAsync + thread) e desenha cada widget. Cada widget so diz como desenhar.
 *
 * ATENCAO: o codigo-fonte vive em sora-frontend/android-widgets/ e e COPIADO
 * para o projeto do Bubblewrap por aplicar.cjs.
 */
public abstract class BaseWidget extends AppWidgetProvider {

    /** Desenha UM widget com a situacao atual. */
    protected abstract RemoteViews desenhar(Context c, int id, Resumo.Situacao s, Bundle opcoes);

    @Override
    public void onUpdate(final Context contexto, final AppWidgetManager gerente, final int[] ids) {
        final PendingResult pendente = goAsync();
        new Thread(() -> {
            try {
                Resumo.Situacao s = Resumo.buscar(contexto);
                for (int id : ids) {
                    try {
                        gerente.updateAppWidget(id, desenhar(contexto, id, s, gerente.getAppWidgetOptions(id)));
                    } catch (RuntimeException e) {
                        // Um widget com problema nao derruba os outros.
                        gerente.updateAppWidget(id, estado(contexto, Resumo.Tipo.INDISPONIVEL, id));
                    }
                }
            } finally {
                pendente.finish();
            }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager gerente, int id, Bundle opcoes) {
        onUpdate(c, gerente, new int[] { id });
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        for (int id : ids) Opcoes.apagar(c, id);
    }

    /** Pede a TODOS os widgets da Sora pra atualizarem (depois de conectar ou mudar opcoes). */
    public static void atualizarTodos(Context c) {
        Class<?>[] tipos = { LivreWidget.class, ContasWidget.class, CartaoWidget.class, LancarWidget.class };
        AppWidgetManager gerente = AppWidgetManager.getInstance(c);
        for (Class<?> t : tipos) {
            int[] ids = gerente.getAppWidgetIds(new ComponentName(c, t));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, t).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }

    /**
     * Codigo de pedido UNICO por widget e por toque: PendingIntents com o mesmo
     * codigo e intencoes diferentes se sobrescrevem, e um toque passaria a
     * abrir o lugar do outro.
     */
    static int codigo(int idWidget, int toque) {
        return idWidget * 16 + toque;
    }

    /** Toque no widget: abre esta tela DENTRO do app (a TWA abre links do site). */
    static PendingIntent abrirNoApp(Context c, int codigo, String caminho) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.forsora.com" + caminho));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Os estados que todos os widgets compartilham (conectar, fora do plano, sem dados). */
    static RemoteViews estado(Context c, Resumo.Tipo tipo, int idWidget) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_estado);
        int icone, titulo, texto;
        String caminho;
        boolean botao = false;
        if (tipo == Resumo.Tipo.DESCONECTADO) {
            icone = R.drawable.widget_marca;
            titulo = R.string.widget_conectar_titulo;
            texto = R.string.widget_conectar_texto;
            caminho = "/widgets";
            botao = true;
        } else if (tipo == Resumo.Tipo.FORA_DO_PLANO) {
            icone = R.drawable.widget_ic_cadeado;
            titulo = R.string.widget_plano_titulo;
            texto = R.string.widget_plano_texto;
            caminho = "/widgets";
        } else {
            icone = R.drawable.widget_ic_offline_cinza;
            titulo = R.string.widget_sem_dados_titulo;
            texto = R.string.widget_sem_dados_texto;
            caminho = "/dashboard";
        }
        v.setImageViewResource(R.id.widget_estado_icone, icone);
        v.setTextViewText(R.id.widget_estado_titulo, c.getString(titulo));
        v.setTextViewText(R.id.widget_estado_texto, c.getString(texto));
        v.setViewVisibility(R.id.widget_estado_botao, botao ? View.VISIBLE : View.GONE);
        v.setOnClickPendingIntent(R.id.widget_estado_raiz, abrirNoApp(c, codigo(idWidget, 8), caminho));
        return v;
    }
}
