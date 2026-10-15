import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// Extração de texto do PDF de fatura/extrato. Roda no SERVIDOR (Node) de
// propósito: o pdf.js no navegador quebra o bundle (require("canvas")), e em
// Node esse require é preguiçoso — a extração de TEXTO nunca o dispara. O
// arquivo é parseado em memória e descartado (nada é gravado). O parser que
// vira as linhas em lançamentos é o `parsePdfLinhas`, no client (testável).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// PDF + pdf.js + cold start do Render-free não; aqui é só a Vercel, mas o parse
// de um PDF grande pode passar do padrão.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // ⚠️ SÓ LOGADO. O endpoint gasta CPU (parse de PDF); aberto, viraria alvo de
  // abuso. Não toca em dado nenhum do usuário além do arquivo que ele enviou.
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  } catch {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ erro: 'Envio inválido.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ erro: 'Nenhum arquivo recebido.' }, { status: 400 });
  // ⚠️ 4 MB: a Vercel corta o corpo da requisição em ~4,5 MB. Fatura/extrato
  // em PDF é bem menor; acima disso o cliente já avisa pra usar OFX/planilha.
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ erro: 'PDF muito grande (máx. 4 MB). Use OFX ou planilha.' }, { status: 413 });
  }

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    // Build legado = compatível com Node. Sem worker (fake worker em Node) e sem
    // eval. `serverExternalPackages` mantém o pacote fora do bundle.
    const mod: any = await import('pdfjs-dist/legacy/build/pdf');
    // Interop: build legado é CJS — `getDocument` pode estar na raiz ou em .default.
    const pdfjs: any = typeof mod?.getDocument === 'function' ? mod : (mod?.default ?? mod);
    const doc = await pdfjs.getDocument({
      data: buf, isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
    }).promise;

    const linhas: string[] = [];
    const MAX_PAGINAS = 40;                       // fatura/extrato normal não passa disso
    const nPags = Math.min(doc.numPages || 0, MAX_PAGINAS);
    for (let p = 1; p <= nPags; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // O PDF não tem "linhas", só fragmentos posicionados. Agrupa por Y
      // (arredondado), ordena por X e junta — reconstrói a linha visual.
      const porY = new Map<number, { x: number; s: string }[]>();
      for (const it of (content.items as any[])) {
        const s = (it.str || '').trim();
        if (!s) continue;
        const y = Math.round(it.transform?.[5] ?? 0);
        const x = it.transform?.[4] ?? 0;
        if (!porY.has(y)) porY.set(y, []);
        porY.get(y)!.push({ x, s });
      }
      for (const y of [...porY.keys()].sort((a, b) => b - a)) {   // topo → base
        const texto = porY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ');
        if (texto.trim()) linhas.push(texto);
      }
      try { page.cleanup(); } catch { /* ok */ }
    }
    try { await doc.destroy(); } catch { /* ok */ }

    return NextResponse.json({ linhas });
  } catch (e) {
    // PDF escaneado (imagem, sem texto), protegido por senha ou corrompido.
    console.error('[importar/pdf] falha ao ler:', e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: 'Não consegui ler este PDF (pode ser escaneado/imagem ou protegido).' }, { status: 422 });
  }
}
