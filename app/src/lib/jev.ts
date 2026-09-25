import { AI_GATEWAY_API_KEY, JEV_BASE_URL, JEV_MODEL } from 'astro:env/server';

/** La pregunta que funcionó en el spike: "tarea central", no "construir el proyecto".
 *  Con "construir", Jev leía literal y un modelo de código servía para cualquier app. */
const QUESTION =
  'Would the model described in `model` perform the core task of the product described in `idea`?';

export interface Candidate { id: string; name: string; description: string }

/** Una tanda: la idea en el state y una pregunta sí/no por modelo, todas en paralelo.
 *  Devuelve { id: probabilidad }. Reintenta 503/429 respetando retry-after. */
export async function scoreBatch(idea: string, models: Candidate[]): Promise<Record<string, number>> {
  const questions = Object.fromEntries(
    models.map((m, i) => [
      `m${i}`, // los ids tienen '/' y '.', mejor claves neutras
      { type: 'noul', instructions: { question: QUESTION, model: { name: m.name, description: m.description } } },
    ]),
  );
  const body = JSON.stringify({ model: JEV_MODEL, state: { idea }, questions });

  let lastError = '';
  // Presupuesto total por tanda: pasado este tiempo, mejor mostrar el resultado parcial
  // que dejar al usuario mirando un contador trabado.
  const deadline = Date.now() + 10_000;
  for (let attempt = 0; attempt < 4 && Date.now() < deadline - 500; attempt++) {
    try {
      const res = await fetch(`${JEV_BASE_URL}/v1/systemone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AI_GATEWAY_API_KEY}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(Math.min(6000, deadline - Date.now())), // en el spike un request se colgó >60 s
      });
      if (res.ok) {
        const out = (await res.json()) as { answers: Record<string, { noul: number }> };
        return Object.fromEntries(
          Object.entries(out.answers).map(([k, v]) => [models[Number(k.slice(1))].id, v.noul]),
        );
      }
      lastError = `HTTP ${res.status}`;
      if (res.status !== 429 && res.status < 500) break; // 4xx de verdad: no tiene sentido reintentar
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 300 * 2 ** attempt, Math.max(0, deadline - Date.now() - 500)));
    } catch (e) {
      lastError = e instanceof Error ? e.name : 'error';
      await sleep(300 * 2 ** attempt);
    }
  }
  throw new Error(lastError);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
