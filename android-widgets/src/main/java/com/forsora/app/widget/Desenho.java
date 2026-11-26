package com.forsora.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Ajudantes de desenho dos widgets: cores que seguem o tema e a mare. */
final class Desenho {
    private Desenho() {}

    /** Pontinhos no lugar do valor quando a pessoa escolhe esconder. */
    static final String OCULTO = "••••";

    /**
     * Cor de texto que acompanha o tema (claro/escuro). No Android 12+ a cor e
     * resolvida pelo proprio lancador, entao muda junto com o tema na hora.
     */
    static void corTexto(Context c, RemoteViews v, int id, int corRes) {
        if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(id, "setTextColor", corRes);
        else v.setTextColor(id, c.getColor(corRes));
    }

    static String hora(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms));
    }

    static CharSequence negrito(String s) {
        SpannableString t = new SpannableString(s);
        t.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return t;
    }

    /**
     * Tamanho do numero grande pelo comprimento: "47" cabe enorme, "12.345"
     * precisa encolher pra nao cortar (o RemoteViews nao encolhe sozinho).
     */
    static float tamanhoDoNumero(String numero, float grande) {
        int n = numero == null ? 0 : numero.length();
        if (n <= 3) return grande;
        if (n == 4) return grande * 0.84f;
        if (n == 5) return grande * 0.72f;
        if (n <= 7) return grande * 0.6f;
        return grande * 0.5f;
    }

    /**
     * Lado maximo da imagem da mare, em px. A imagem viaja inteira pro lancador
     * a cada atualizacao, e o Android recusa pacote acima de ~1 MB: 320x320
     * ocupa 400 KB. A mare e uma forma suave, e o lancador estica sem perda visivel.
     */
    private static final int LADO_MAX_PX = 320;

    /**
     * Tamanho da imagem da mare e a escala (px por dp) usada nela. O widget e
     * esticado (fitXY), entao a proporcao basta; a escala acerta o traco e a onda.
     */
    static float[] tamanhoPx(Context c, Bundle opcoes, int padraoDp) {
        int w = opcoes != null ? opcoes.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, padraoDp) : padraoDp;
        int h = opcoes != null ? opcoes.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, padraoDp) : padraoDp;
        if (w <= 0) w = padraoDp;
        if (h <= 0) h = padraoDp;
        float e = Math.min(c.getResources().getDisplayMetrics().density, 2f);
        float maior = Math.max(w, h) * e;
        if (maior > LADO_MAX_PX) e = e * LADO_MAX_PX / maior;
        return new float[] { Math.max(1, Math.round(w * e)), Math.max(1, Math.round(h * e)), e };
    }

    /**
     * A MARE do "Livre pra gastar": o nivel e quanto do dinheiro livre do mes
     * ainda resta; a linha tracejada e quanto do mes ainda falta. Igual ao iPhone.
     */
    static Bitmap mare(float[] tamanho, double nivel, double ritmo, boolean comRitmo,
                       int corAgua, int corFrente, int corLinha) {
        int w = (int) tamanho[0], h = (int) tamanho[1];
        float e = tamanho[2];
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        p.setColor(corAgua);
        cv.drawPath(onda(w, h, nivel, -2 * e, false, e), p);
        p.setColor(corFrente);
        cv.drawPath(onda(w, h, nivel, 5 * e, true, e), p);

        if (comRitmo) {
            Paint l = new Paint(Paint.ANTI_ALIAS_FLAG);
            l.setStyle(Paint.Style.STROKE);
            l.setColor(corLinha);
            l.setStrokeWidth(1.2f * e);
            l.setStrokeCap(Paint.Cap.ROUND);
            l.setPathEffect(new DashPathEffect(new float[] { 2 * e, 4 * e }, 0));
            float y = (float) (h * (1 - limitar(ritmo)));
            cv.drawLine(0, y, w, y, l);
        }
        return b;
    }

    private static double limitar(double x) {
        if (Double.isNaN(x)) return 0;
        return Math.max(0, Math.min(1, x));
    }

    private static Path onda(int w, int h, double nivel, float fase, boolean inverte, float e) {
        float y = (float) (h * (1 - limitar(nivel))) + fase;
        float a = (inverte ? -4.5f : 4.5f) * e;
        Path p = new Path();
        p.moveTo(0, y);
        p.cubicTo(w * 0.2f, y - a, w * 0.34f, y - a, w * 0.5f, y);
        p.cubicTo(w * 0.66f, y + a, w * 0.8f, y + a, w, y);
        p.lineTo(w, h);
        p.lineTo(0, h);
        p.close();
        return p;
    }
}
