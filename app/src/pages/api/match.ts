import type { APIRoute } from 'astro';
import catalog from '../../data/catalog.json';
import { scoreBatch } from '../../lib/jev';

export const prerender = false;

const byId = new Map(catalog.map((m) => [m.id, m]));

/** POST { idea, ids } -> { scores: { id: prob } }
 *  El navegador manda una tanda por request; así cada tanda que vuelve es una oleada. */
export const POST: APIRoute = async ({ request }) => {
  const { idea, ids } = (await request.json()) as { idea?: string; ids?: string[] };
  const text = (idea ?? '').trim().slice(0, 300);
  if (!text || !Array.isArray(ids) || ids.length === 0 || ids.length > 40) {
    return Response.json({ error: 'Pedido inválido' }, { status: 400 });
  }
  const models = ids.flatMap((id) => {
    const m = byId.get(id);
    return m ? [{ id: m.id, name: m.name, description: m.description }] : [];
  });
  try {
    return Response.json({ scores: await scoreBatch(text, models) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'error' }, { status: 502 });
  }
};
