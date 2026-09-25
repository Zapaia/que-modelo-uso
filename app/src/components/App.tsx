import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Pile, { type Target } from './Pile';
import { BIG, COMPACT, CostChart, chartPos, frontier, marginPos } from './Chart';
import Typewriter from './Typewriter';
import type { Model, Status } from './types';
import '../styles/app.css';

const RETRIES = 5; // intentos por tanda antes de darla por perdida (esperas de 0,5 s a 4 s)
const PER_BATCH = 19; // tandas chicas: con saturación, TypeSafe corta primero los requests grandes (medido: 19 sí, 25 a veces no)
const THRESHOLD = 0.5;
const MAX_ROW = 10;
const ROW_Y = 0.43; // la fila, en fracción de pantalla desde arriba
const ROW_GAP = 1.45; // entre centros de ficha, en unidades del mundo
const ROW_MARGIN = 0.8; // del borde de la pantalla al centro de la primera ficha, si la fila se desliza
const MAX_CHART = 16;
const MAX_LOOSE = 6;
const FIBRONES = ['var(--fibron-1)', 'var(--fibron-2)', 'var(--fibron-3)', 'var(--fibron-4)', 'var(--fibron-5)', 'var(--fibron-6)'];
const EXAMPLES = [
  'app para investigar biología',
  'transcribir las reuniones de mi equipo',
  'chatbot barato que responda al toque',
  'detectar techos en imágenes satelitales',
];
// Precio en escala logarítmica: la mayoría cuesta menos de 1 USD, unos pocos más de 20.
const PRICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, Infinity];
const SPEED_STEPS = [0, 25, 50, 100, 150, 200, 300, 500];

// En Webflow Cloud la app vive bajo un mount path (por ejemplo /app): la API también.
const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/match`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const shortName = (m: Model) => m.name.replace(/^[^:]+:\s*/, '');

export default function App({ models }: { models: Model[] }) {
  const [idea, setIdea] = useState('');
  const [asked, setAsked] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [answered, setAnswered] = useState(0);
  const [failed, setFailed] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState(false);
  const [maxPrice, setMaxPrice] = useState(PRICE_STEPS.length - 1);
  const [minSpeed, setMinSpeed] = useState(0);
  const [world, setWorld] = useState({ w: 25, h: 14 });
  const [expanded, setExpanded] = useState(false); // gráfico agrandado al centro
  const [hovered, setHovered] = useState<string | null>(null); // ficha con el mouse encima
  const [shift, setShift] = useState(0); // desplazamiento de la fila en el celular, en unidades del mundo
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; from: number; moved: boolean } | null>(null);
  const run = useRef(0);
  const pending = useRef<string[][]>([]);

  // Las tandas mezclan modelos de todo el catálogo: cada oleada levanta de todo un poco.
  const batches = useMemo(
    () => {
      const n = Math.ceil(models.length / PER_BATCH); // el catálogo crece: las tandas se ajustan solas
      return Array.from({ length: n }, (_, b) => models.filter((_, i) => i % n === b).map((m) => m.id));
    },
    [models],
  );

  const classify = useCallback(async (text: string, onlyIds?: string[][]) => {
    const q = text.trim();
    if (!q) return;
    const id = ++run.current;
    const fresh = !onlyIds;
    setAsked(q);
    setStatus('classifying');
    if (fresh) { setScores({}); setAnswered(0); setElapsed(null); setExpanded(false); setShift(0); }
    setFailed(0);
    const t0 = performance.now();
    const todo = onlyIds ?? batches;
    const lost: string[][] = [];

    // Todas las tandas salen a la vez; cada una que vuelve es una oleada. La que falla se
    // vuelve a pedir sola, con espera creciente: cuando por fin vuelve, sus modelos se suman
    // al top y la fila se reacomoda. Solo si agota los intentos queda para el botón manual.
    await Promise.all(todo.map(async (ids) => {
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        if (run.current !== id) return; // el usuario ya preguntó otra cosa
        try {
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea: q, ids }),
            signal: AbortSignal.timeout(12_000),
          });
          if (!res.ok) throw new Error(String(res.status));
          const { scores: s } = (await res.json()) as { scores: Record<string, number> };
          if (run.current !== id) return;
          setScores((prev) => ({ ...prev, ...s }));
          setAnswered((n) => n + Object.keys(s).length);
          return;
        } catch {
          if (attempt < RETRIES - 1) await sleep(500 * 2 ** attempt + Math.random() * 400); // jitter: que no vuelvan todas juntas
        }
      }
      lost.push(ids);
    }));

    if (run.current !== id) return;
    setElapsed(performance.now() - t0);
    setFailed(lost.length);
    pending.current = lost;
    setStatus(lost.length === 0 ? 'done' : lost.length === todo.length && fresh ? 'error' : 'partial');
  }, [batches]);

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  // Los filtros son atributos duros (Chip Huyen): solo se aplican donde hay datos.
  const cap = PRICE_STEPS[maxPrice], floor = SPEED_STEPS[minSpeed];
  const winners = useMemo(() => {
    // Con un filtro activo, un modelo sin ese dato no pasa: no podemos garantizar que lo cumpla.
    const passes = (m: Model) => {
      if (cap !== Infinity && (m.price === null || m.price > cap)) return false;
      if (floor > 0 && (m.speed === null || m.speed < floor)) return false;
      return true;
    };
    return Object.entries(scores)
      .filter(([id, p]) => p >= THRESHOLD && passes(byId.get(id)!))
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id)!);
  }, [scores, byId, cap, floor]);

  const rowModels = winners.slice(0, MAX_ROW);
  // Ancho de la fila en unidades del mundo, con media ficha de margen a cada lado.
  const rowSpan = (rowModels.length - 1) * ROW_GAP + ROW_MARGIN * 2;
  const scrollable = rowSpan > world.w;
  const rowStart = scrollable ? -world.w / 2 + ROW_MARGIN : -((rowModels.length - 1) * ROW_GAP) / 2;
  const minShift = scrollable ? world.w - rowSpan : 0;
  const plotted = useMemo(() => winners.filter((m) => m.hasData).slice(0, MAX_CHART), [winners]);
  const loose = useMemo(() => winners.filter((m) => !m.hasData).slice(0, MAX_LOOSE), [winners]);
  const best = useMemo(() => new Set(frontier(plotted).map((m) => m.id)), [plotted]);
  // Se puede agrandar mientras clasifica: las fichas que llegan después aterrizan en el gráfico.
  const inChart = expanded && plotted.length > 0;
  const hoveredRow = hovered ? rowModels.find((m) => m.id === hovered) : undefined;

  // Destino de cada ficha elegida, en fracciones de pantalla.
  const targets = useMemo(() => {
    const t: Record<string, Target> = {};
    if (inChart) {
      // Agrandado: las fichas reemplazan a los logos del gráfico, en sus mismas coordenadas.
      plotted.forEach((m) => { t[m.id] = { ...chartPos(m, BIG), scale: 0.58 }; });
      // Los sin benchmark no tienen coordenadas: van al margen.
      loose.forEach((m, k) => { t[m.id] = { ...marginPos(k), scale: 0.46 }; });
    } else {
      // Si la fila no entra (celular), arranca pegada a la izquierda y se desliza con `shift`.
      rowModels.forEach((m, i) => { t[m.id] = { fx: 0.5 + (rowStart + i * ROW_GAP + Math.max(minShift, shift)) / world.w, fy: ROW_Y }; });
    }
    return t;
  }, [inChart, plotted, loose, rowModels, world.w, rowStart, shift, minShift]);

  // Arrastre horizontal de la fila: el dedo mueve `shift`, las fichas y las etiquetas lo siguen.
  const onRowDown = (e: React.PointerEvent) => {
    if (!scrollable) return;
    drag.current = { x: e.clientX, from: shift, moved: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current!;
      const dx = ((ev.clientX - d.x) / window.innerWidth) * world.w;
      if (Math.abs(ev.clientX - d.x) > 6) { d.moved = true; setDragging(true); }
      setShift(Math.min(0, Math.max(minShift, d.from + dx)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(false);
      setTimeout(() => { drag.current = null; }, 0); // el click que sigue al arrastre se descarta
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    if (status === 'idle') return;
    setToast(true);
    if (status !== 'done') return;
    const t = setTimeout(() => setToast(false), 4500);
    return () => clearTimeout(t);
  }, [status]);

  const onViewport = useCallback((w: number, h: number) => setWorld({ w, h }), []);
  const pick = useCallback((m: Model) => window.open(m.url, '_blank', 'noopener'), []);
  const total = models.length;
  const labelY = ROW_Y * 100 + (0.62 / world.h) * 100;
  const settled = status === 'done' || status === 'partial';

  return (
    <main className={inChart && COMPACT ? 'mesa enfocada' : 'mesa'}>
      <Pile models={models} targets={targets} onPick={pick} onHover={setHovered} hovered={hovered} onViewport={onViewport} />

      <header className="encabezado">
        <p className="marca">¿Qué modelo uso?</p>
        <div className="fuente">
          <p className="nota">{total} modelos · clasifica <a href="https://typesafe.ai/blog/introducing-system-one-models-and-jev" target="_blank" rel="noopener">Jev</a> · benchmarks de <a href="https://artificialanalysis.ai/" target="_blank" rel="noopener">Artificial Analysis</a></p>
          <p className={toast ? 'aviso visible' : 'aviso'} aria-live="polite">
            {status === 'classifying' && (
              <span className="pensando">
                <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
                jev está pensando · {answered} / {total}
                <span className="progreso" aria-hidden="true" style={{ '--p': answered / total } as React.CSSProperties} />
              </span>
            )}
            {status === 'done' && <>{total} clasificados en {fmt((elapsed ?? 0) / 1000, 1)} s</>}
            {status === 'partial' && (
              <>{answered} de {total} · {failed} {failed === 1 ? 'tanda' : 'tandas'} sin respuesta ·{' '}
                <button type="button" className="accion" onClick={() => classify(asked, pending.current)}>reintentar</button></>
            )}
            {status === 'error' && <>jev no respondió · <button type="button" className="accion" onClick={() => classify(asked)}>reintentar</button></>}
          </p>
        </div>
      </header>

      <form className="burbuja" onSubmit={(e) => { e.preventDefault(); classify(idea); }}>
        <label htmlFor="idea" className="sr">Qué querés construir</label>
        <input
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="¿Qué querés construir?"
          autoComplete="off"
          maxLength={300}
          autoFocus
        />
        <button type="submit" aria-label="Clasificar" disabled={!idea.trim() || status === 'classifying'}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.6 10.2c3.9-.3 8.2-.2 12.4 0M11.3 5.4c1.6 1.5 3.2 3 4.9 4.6-1.7 1.5-3.4 3-5 4.4" /></svg>
        </button>
      </form>

      <div className="controles">
        <div className="opciones">
          {status === 'idle' ? (
            <Typewriter items={EXAMPLES} onPick={(ex) => { setIdea(ex); classify(ex); }} />
          ) : (
            <p className="ejemplos">
              {winners.length === 0 && settled && <span>ninguno supera 0,5 · probá describir la tarea central</span>}
            </p>
          )}
          <button type="button" className="accion" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '− filtros' : '+ filtros'}
          </button>
        </div>
        {showFilters && (
          <div className="filtros">
            <label>
              <span>Costo máx.</span>
              <input type="range" min={0} max={PRICE_STEPS.length - 1} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
              <output>{cap === Infinity ? 'sin límite' : `USD ${fmt(cap, cap < 1 ? 1 : 0)} / M`}</output>
            </label>
            <label>
              <span>Velocidad mín.</span>
              <input type="range" min={0} max={SPEED_STEPS.length - 1} value={minSpeed} onChange={(e) => setMinSpeed(Number(e.target.value))} />
              <output>{floor === 0 ? 'cualquiera' : `${floor} tok/s`}</output>
            </label>
          </div>
        )}
      </div>

      {/* Franja para deslizar la fila con el dedo (solo si no entra): cubre las fichas 3D,
          que están en el canvas y no reciben el gesto. */}
      {!inChart && scrollable && (
        <div className="fila-arrastre" onPointerDown={onRowDown}
          style={{ top: `${(ROW_Y - 0.75 / world.h) * 100}%`, height: `${(1.5 / world.h) * 100}%` }} />
      )}
      {/* Etiquetas: mismas coordenadas que las fichas. */}
      {!inChart && (
        <ol className={dragging ? 'fila arrastrando' : 'fila'} aria-label="Modelos que sirven" onPointerDown={onRowDown}
          onClickCapture={(e) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}>
          {rowModels.map((m, i) => (
            <li key={m.id} style={{
              left: `${targets[m.id].fx * 100}%`, top: `${labelY}%`, width: `${(ROW_GAP / world.w) * 100}%`,
              '--fibron': FIBRONES[i % FIBRONES.length], '--i': i,
            } as React.CSSProperties}>
              <a href={m.url} target="_blank" rel="noopener" aria-describedby={hovered === m.id ? 'ayuda-confianza' : undefined}
                onMouseEnter={() => setHovered(m.id)} onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(m.id)} onBlur={() => setHovered(null)}>
                <span className="rango">{String(i + 1).padStart(2, '0')}</span>
                <span className="nombre" title={m.name}>{shortName(m)}</span>
                {/* La etiqueta va pegada a la esquina de la ficha, como un precio en un objeto. */}
                <span className="conf etiqueta" style={{ left: `calc(50% + ${(0.34 / world.w) * 100}vw)`, top: `${-(1.12 / world.h) * 100}vh` }}>
                  {Math.round(scores[m.id] * 100)}<small>%</small>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {/* Bordes que se desvanecen: la fila se esconde detrás del papel, del lado donde queda más. */}
      {!inChart && scrollable && (
        <>
          <div className={shift < -0.05 ? 'fila-borde izq visible' : 'fila-borde izq'}
            style={{ top: `${(ROW_Y - 0.85 / world.h) * 100}%`, height: `${(1.9 / world.h) * 100}%` }} />
          <div className={Math.max(minShift, shift) > minShift + 0.05 ? 'fila-borde der visible' : 'fila-borde der'}
            style={{ top: `${(ROW_Y - 0.85 / world.h) * 100}%`, height: `${(1.9 / world.h) * 100}%` }} />
        </>
      )}

      {/* Ayuda de la confianza: aparece sobre la ficha que tiene el mouse encima. El gráfico,
          con el mismo `hovered`, marca dónde cae ese modelo. */}
      {!inChart && hoveredRow && (
        <div id="ayuda-confianza" role="tooltip" className="ayuda" key={hoveredRow.id}
          style={{
            left: `${targets[hoveredRow.id].fx * 100}%`, top: `${(ROW_Y - 0.95 / world.h) * 100}%`,
            '--fibron': FIBRONES[rowModels.indexOf(hoveredRow) % FIBRONES.length], // el mismo color que su etiqueta
          } as React.CSSProperties}>
          <span className="ayuda-cifra">{Math.round(scores[hoveredRow.id] * 100)}<small>%</small></span>
          <span className="ayuda-texto">confianza de Jev</span>
        </div>
      )}

      {/* Aparece con el primer elegido que tenga benchmark, sin esperar a que vuelvan todas las tandas. */}
      {plotted.length > 0 && (
        <CostChart models={plotted} loose={loose} best={best} expanded={inChart} onToggle={() => setExpanded(!expanded)}
          hovered={hovered} onHover={setHovered} />
      )}
    </main>
  );
}
