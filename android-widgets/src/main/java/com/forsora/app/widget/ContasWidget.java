package com.forsora.app.widget;

import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.forsora.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "Proximas contas" (4x2): o que vence nos proximos 7 dias, com as atrasadas
 * primeiro. A faixa de dias marca com um ponto colorido o dia de cada conta.
 */
public class ContasWidget extends BaseWidget {

    private static final int[] DIA = { R.id.widget_contas_dia0, R.id.widget_contas_dia1, R.id.widget_contas_dia2,
            R.id.widget_contas_dia3, R.id.widget_contas_dia4, R.id.widget_contas_dia5, R.id.widget_contas_dia6 };
    private static final int[] PONTO = { R.id.widget_contas_ponto0, R.id.widget_contas_ponto1, R.id.widget_contas_ponto2,
            R.id.widget_contas_ponto3, R.id.widget_contas_ponto4, R.id.widget_contas_ponto5, R.id.widget_contas_ponto6 };
    private static final int[] LINHA = { R.id.widget_contas_linha0, R.id.widget_contas_linha1, R.id.widget_contas_linha2 };
    private static final int[] ICONE = { R.id.widget_contas_icone0, R.id.widget_contas_icone1, R.id.widget_contas_icone2 };
    private static final int[] TITULO = { R.id.widget_contas_titulo0, R.id.widget_contas_titulo1, R.id.widget_contas_titulo2 };
    private static final int[] VALOR = { R.id.widget_contas_valor0, R.id.widget_contas_valor1, R.id.widget_contas_valor2 };
    private static final int[] ALERTA = { R.id.widget_contas_alerta0, R.id.widget_contas_alerta1, R.id.widget_contas_alerta2 };
    private static final int[] SUB = { R.id.widget_contas_sub0, R.id.widget_contas_sub1, R.id.widget_contas_sub2 };

    @Override
    protected RemoteViews desenhar(Context c, int id, Resumo.Situacao s, Bundle opcoes) {
        JSONObject k = s.json != null ? s.json.optJSONObject("contas") : null;
        if (s.tipo != Resumo.Tipo.OK) return estado(c, s.tipo, id);
        if (k == null) return estado(c, Resumo.Tipo.INDISPONIVEL, id);

        boolean mostrar = Opcoes.mostrarValores(c, id);
        String oculto = s.json.optString("simbolo", "R$") + " " + Desenho.OCULTO;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_contas);

        v.setTextViewText(R.id.widget_contas_cabecalho, s.offline
                ? c.getString(R.string.widget_as, Desenho.hora(s.atualizadoEm))
                : c.getString(R.string.widget_contas_7dias));
        v.setTextViewText(R.id.widget_contas_qtd, String.valueOf(k.optInt("quantidade", 0)));
        v.setTextViewText(R.id.widget_contas_rotulo, k.optString("rotulo", ""));
        v.setTextViewText(R.id.widget_contas_total, mostrar ? k.optString("total_txt", "") : oculto);

        // A faixa dos 7 dias: hoje destacado, um ponto no dia de cada conta.
        JSONArray dias = k.optJSONArray("dias");
        for (int i = 0; i < DIA.length; i++) {
            JSONObject d = dias != null ? dias.optJSONObject(i) : null;
            String letra = d != null ? d.optString("letra", "") : "";
            boolean hoje = d != null && d.optBoolean("hoje", false);
            v.setTextViewText(DIA[i], hoje ? Desenho.negrito(letra) : letra);
            v.setInt(DIA[i], "setBackgroundResource", hoje ? R.drawable.widget_hoje : 0);
            Desenho.corTexto(c, v, DIA[i], hoje ? R.color.widget_hoje_texto : R.color.widget_texto2);
            int ponto = pontoDa(d != null && !d.isNull("origem") ? d.optString("origem", "") : "");
            if (ponto == 0) {
                v.setViewVisibility(PONTO[i], View.INVISIBLE);
            } else {
                v.setViewVisibility(PONTO[i], View.VISIBLE);
                v.setImageViewResource(PONTO[i], ponto);
            }
        }

        JSONArray itens = k.optJSONArray("itens");
        int n = itens != null ? itens.length() : 0;
        v.setViewVisibility(R.id.widget_contas_vazio, n == 0 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_contas_lista, n == 0 ? View.GONE : View.VISIBLE);
        for (int i = 0; i < LINHA.length; i++) {
            JSONObject it = i < n ? itens.optJSONObject(i) : null;
            if (it == null) {
                // INVISIBLE, nao GONE: as linhas que existem ficam no mesmo lugar.
                v.setViewVisibility(LINHA[i], View.INVISIBLE);
                continue;
            }
            v.setViewVisibility(LINHA[i], View.VISIBLE);
            String icone = it.optString("icone", "fixa");
            v.setImageViewResource(ICONE[i], iconeDe(icone));
            v.setInt(ICONE[i], "setBackgroundResource", tileDe(icone));
            v.setTextViewText(TITULO[i], it.optString("titulo", ""));
            String valor = it.optString("valor_txt", "");
            v.setTextViewText(VALOR[i], mostrar || valor.isEmpty() ? valor : oculto);
            boolean atrasada = it.optBoolean("atrasada", false);
            v.setViewVisibility(ALERTA[i], atrasada ? View.VISIBLE : View.GONE);
            v.setTextViewText(SUB[i], atrasada ? Desenho.negrito(it.optString("sub", "")) : it.optString("sub", ""));
            Desenho.corTexto(c, v, SUB[i], atrasada ? R.color.widget_vermelho : R.color.widget_texto2);
        }
        int mais = k.optInt("mais", 0);
        v.setViewVisibility(R.id.widget_contas_mais, mais > 0 && n > 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.widget_contas_mais, c.getString(R.string.widget_e_mais, mais));

        v.setOnClickPendingIntent(R.id.widget_contas_raiz, abrirNoApp(c, codigo(id, 6), "/previstos"));
        return v;
    }

    static int pontoDa(String origem) {
        switch (origem) {
            case "fatura": return R.drawable.widget_ponto_fatura;
            case "divida": return R.drawable.widget_ponto_divida;
            case "fixa": return R.drawable.widget_ponto_fixa;
            case "agendado": return R.drawable.widget_ponto_agendado;
            default: return 0;
        }
    }

    static int iconeDe(String icone) {
        switch (icone) {
            case "luz": return R.drawable.widget_ic_luz;
            case "agua": return R.drawable.widget_ic_agua;
            case "internet": return R.drawable.widget_ic_internet;
            case "casa": return R.drawable.widget_ic_casa;
            case "cartao": return R.drawable.widget_ic_cartao;
            case "divida": return R.drawable.widget_ic_divida;
            case "agendado": return R.drawable.widget_ic_agendado;
            default: return R.drawable.widget_ic_fixa;
        }
    }

    static int tileDe(String icone) {
        switch (icone) {
            case "luz": return R.drawable.widget_tile_ambar;
            case "agua": case "internet": case "agendado": return R.drawable.widget_tile_azul;
            case "cartao": return R.drawable.widget_tile_violeta;
            case "divida": return R.drawable.widget_tile_teal;
            default: return R.drawable.widget_tile_cinza;
        }
    }
}
