/**
 * Frequência de recorrência — porte de LEITURA da aritmética do backend.
 *
 * ⚠️ O BACKEND É CANÔNICO: `sora-backend/src/services/frequenciaRecorrencia.js`
 * é quem decide o que a Sora lança, e é lá que mora o eval que compara 11.315
 * combinações contra a regra antiga (`npm run eval:frequencia`). Este arquivo
 * NÃO decide nada — ele só antecipa na tela o que o servidor vai gravar, pra a
 * pessoa ver "termina em março de 2027" antes de salvar em vez de escolher
 * "12x" no escuro.
 *
 * Mexeu num, mexa no outro: a data que a tela promete e a que o banco guarda
 * discordarem é pior do que não mostrar data nenhuma.
 *
 * `data_fim` é a fonte do encerramento — não uma contagem de ocorrências. Um
 * contador precisa ser incrementado a cada lançamento e sai de sincronia com um
 * restart no meio do laço, um lançamento manual ou um restore de backup.
 */

export type Frequencia = 'semanal' | 'mensal' | 'anual';

/** Último dia do mês (1..12 em `mes`). */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function partes(iso: string) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return { ano, mes, dia };
}

const pad = (n: number) => String(n).padStart(2, '0');

const iso = (ano: number, mes: number, dia: number) => `${ano}-${pad(mes)}-${pad(dia)}`;

/** Dia da semana de 'YYYY-MM-DD' (0 = domingo). Construído por PARTES —
 *  `new Date('YYYY-MM-DD')` é lido como UTC e no Brasil devolve o dia anterior. */
function diaDaSemana(isoStr: string): number {
  const { ano, mes, dia } = partes(isoStr);
  return new Date(ano, mes - 1, dia).getDay();
}

/**
 * PRIMEIRA vez que a recorrência vai disparar, a partir de `dataInicio`.
 *
 * ⚠️ É O ANCORADOURO DA DURAÇÃO, e ignorá-lo custa uma repetição INTEIRA.
 * Medido no backend antes do conserto: conta do dia 5 criada no dia 20 (o dia
 * 5 já passou) marcada como "12x" disparava 11; semanal "3x" criada numa
 * sexta com alvo na segunda disparava 2.
 */
export function primeiraOcorrencia({
  frequencia, dataInicio, diaVencimento, diaSemana, mesVencimento,
}: {
  frequencia?: Frequencia;
  dataInicio: string;
  diaVencimento?: number | null;
  diaSemana?: number | null;
  mesVencimento?: number | null;
}): string | null {
  const base = String(dataInicio || '').slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(base)) return null;
  const { ano, mes, dia } = partes(base);
  const freq = frequencia || 'mensal';

  if (freq === 'semanal') {
    const alvo = Number(diaSemana);
    if (!Number.isInteger(alvo) || alvo < 0 || alvo > 6) return base;
    const adiante = (alvo - diaDaSemana(base) + 7) % 7;   // 0 = hoje mesmo
    const d = new Date(ano, mes - 1, dia + adiante);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  if (freq === 'anual') {
    const mAlvo = Number(mesVencimento);
    if (!Number.isInteger(mAlvo) || mAlvo < 1 || mAlvo > 12) return base;
    const dAlvo = Number(diaVencimento) || dia;
    const candidato = iso(ano, mAlvo, Math.min(dAlvo, ultimoDiaDoMes(ano, mAlvo)));
    if (candidato >= base) return candidato;
    return iso(ano + 1, mAlvo, Math.min(dAlvo, ultimoDiaDoMes(ano + 1, mAlvo)));
  }

  const dAlvo = Number(diaVencimento) || dia;
  const candidato = iso(ano, mes, Math.min(dAlvo, ultimoDiaDoMes(ano, mes)));
  if (candidato >= base) return candidato;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  return iso(proxAno, proxMes, Math.min(dAlvo, ultimoDiaDoMes(proxAno, proxMes)));
}

/**
 * Data em que a recorrência deve PARAR, a partir do número de repetições.
 * `null` = para sempre (o default, e o comportamento de toda recorrência que
 * já existe no banco).
 *
 * ⚠️ Conta a partir da PRIMEIRA OCORRÊNCIA, não da data de criação.
 */
export function calcularDataFim({
  frequencia, repeticoes, dataInicio, diaVencimento, diaSemana, mesVencimento,
}: {
  frequencia?: Frequencia;
  repeticoes?: number | null;
  dataInicio: string;
  diaVencimento?: number | null;
  diaSemana?: number | null;
  mesVencimento?: number | null;
}): string | null {
  const n = Number(repeticoes);
  if (!Number.isFinite(n) || n <= 0) return null;

  const primeira = primeiraOcorrencia({
    frequencia, dataInicio, diaVencimento, diaSemana, mesVencimento,
  });
  if (!primeira) return null;
  const { ano, mes, dia } = partes(primeira);
  const freq = frequencia || 'mensal';

  // A ÚLTIMA ocorrência é a de índice n-1 a partir da primeira: 3x anual a
  // partir de 2026 termina em 2028, não em 2029.
  const passos = n - 1;

  if (freq === 'semanal') {
    const d = new Date(ano, mes - 1, dia + passos * 7);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  const mesesAdiante = freq === 'anual' ? passos * 12 : passos;
  const total = (ano * 12) + (mes - 1) + mesesAdiante;
  const anoFim = Math.floor(total / 12);
  const mesFim = (total % 12) + 1;
  // Mesmo clamp do disparo: dia 31 em fevereiro vira o último dia do mês.
  const alvo = Number(diaVencimento) || dia;
  const diaFim = Math.min(alvo, ultimoDiaDoMes(anoFim, mesFim));
  return iso(anoFim, mesFim, diaFim);
}
/** Hoje em São Paulo, 'YYYY-MM-DD'. Nunca `toISOString()` (é UTC). */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const SEMANA_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * "toda segunda" · "todo dia 5" · "todo dia 10 de março".
 *
 * ⚠️ Uma linha que diz só "dia 5" numa recorrência SEMANAL mente: ela não cai
 * no dia 5 de nada. Antes da 157 todas eram mensais e a frase estava certa por
 * acidente — depois dela, a lista precisa dizer a frequência de verdade.
 */
export function descreveQuando(r: {
  frequencia?: Frequencia | null;
  dia_vencimento?: number | null;
  dia_semana?: number | null;
  mes_vencimento?: number | null;
}): string {
  const freq = r.frequencia || 'mensal';
  if (freq === 'semanal') {
    const d = SEMANA_PT[Number(r.dia_semana) || 0];
    return `toda ${d}`;
  }
  if (freq === 'anual') {
    return `todo dia ${r.dia_vencimento} de ${MESES_PT[(Number(r.mes_vencimento) || 1) - 1]}`;
  }
  return `todo dia ${r.dia_vencimento}`;
}

/** "termina em março de 2027" — vazio quando é pra sempre. */
export function descreveFim(dataFim?: string | null): string {
  const f = String(dataFim || '').slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(f)) return '';
  return `até ${MESES_PT[Number(f.slice(5, 7)) - 1]}/${f.slice(2, 4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quantas vezes cai num mês — o que as PROJEÇÕES precisam saber.
//
// ⚠️ Antes da 157 toda recorrência era mensal, e por isso todo somatório do
// painel multiplicava por 1 sem dizer que multiplicava. Com semanal e anual no
// ar, esse 1 implícito passa a MENTIR nos dois sentidos: o IPVA (anual) seria
// contado em TODO mês da projeção, e a diarista (semanal) UMA vez em vez de
// quatro. Erro de projeção não estoura — vira um número plausível e errado.
// ─────────────────────────────────────────────────────────────────────────────

export type RecorrenciaQuando = {
  frequencia?: Frequencia | null;
  dia_vencimento?: number | null;
  dia_semana?: number | null;
  mes_vencimento?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

/** Porte de `venceHoje` do backend (que é canônico). */
export function venceEm(r: RecorrenciaQuando, isoDia: string): boolean {
  if (!r) return false;
  const hoje = String(isoDia).slice(0, 10);

  const fim = r.data_fim ? String(r.data_fim).slice(0, 10) : null;
  if (fim && hoje > fim) return false;

  const inicio = r.data_inicio ? String(r.data_inicio).slice(0, 10) : null;
  if (inicio && hoje < inicio) return false;

  const freq = r.frequencia || 'mensal';
  const { ano, mes, dia } = partes(hoje);

  if (freq === 'semanal') {
    const alvo = Number(r.dia_semana);
    if (!Number.isInteger(alvo) || alvo < 0 || alvo > 6) return false;
    return new Date(ano, mes - 1, dia).getDay() === alvo;
  }

  if (freq === 'anual' && Number(r.mes_vencimento) !== mes) return false;

  const alvo = Number(r.dia_vencimento);
  if (!alvo || alvo < 1 || alvo > 31) return false;
  if (alvo === dia) return true;
  // Clamp: dia que não existe no mês cai no ÚLTIMO dia dele.
  const ultimo = ultimoDiaDoMes(ano, mes);
  return dia === ultimo && alvo > ultimo;
}

/**
 * Quantas vezes cai no mês `ym` ('YYYY-MM'), contando dia a dia.
 *
 * Varredura em vez de fórmula de propósito: o mês tem no máximo 31 iterações e
 * ela reaproveita `venceEm`, então clamp de fim de mês, `data_inicio` e
 * `data_fim` valem aqui pelo MESMO código que decide o disparo — não por uma
 * segunda regra que pode divergir.
 *
 * `deDia` limita a contagem ao que AINDA vem (usado pelo "fecha o mês em").
 */
export function ocorrenciasNoMes(r: RecorrenciaQuando, ym: string, deDia = 1): number {
  const [ano, mes] = String(ym).slice(0, 7).split('-').map(Number);
  if (!ano || !mes) return 0;

  // ⚠️ SEM AGENDA UTILIZÁVEL, CAI UMA VEZ NO MÊS — e isto NÃO é detalhe
  // defensivo: é o comportamento de antes da 157, quando ninguém consultava
  // `dia_vencimento` pra decidir SE a conta entra no mês (só QUANDO). Fazer a
  // varredura sem esse resgate devolveria zero e a conta sumiria da projeção
  // inteira — dinheiro desaparecendo em silêncio, que é o pior desfecho
  // possível aqui. O eval `eval:previstos` pegou exatamente isso.
  const freq = r.frequencia || 'mensal';
  const semAgenda = freq === 'semanal'
    ? !Number.isInteger(Number(r.dia_semana))
    : freq === 'anual'
      ? !Number(r.mes_vencimento)
      : !Number(r.dia_vencimento);
  if (semAgenda) {
    // Ainda assim respeita começo e fim: é o que faz a DURAÇÃO valer.
    const inicio = r.data_inicio ? String(r.data_inicio).slice(0, 7) : null;
    const fim = r.data_fim ? String(r.data_fim).slice(0, 7) : null;
    const mesRef = `${ano}-${pad(mes)}`;
    if (inicio && mesRef < inicio) return 0;
    if (fim && mesRef > fim) return 0;
    return 1;
  }

  const ultimo = ultimoDiaDoMes(ano, mes);
  let n = 0;
  for (let d = Math.max(1, deDia); d <= ultimo; d += 1) {
    if (venceEm(r, `${ano}-${pad(mes)}-${pad(d)}`)) n += 1;
  }
  return n;
}

/** Quantas vezes ainda cai NESTE mês, de hoje (inclusive) até o fim dele. */
export function ocorrenciasRestantes(r: RecorrenciaQuando, hojeISO = hojeSP()): number {
  const iso = String(hojeISO).slice(0, 10);
  return ocorrenciasNoMes(r, iso.slice(0, 7), Number(iso.slice(8, 10)));
}
