import type { CSSProperties } from 'react';
import type { Model } from './types';

/* Paso 2 de Chip Huyen: "mapear los modelos en los ejes costo-performance y elegir
   el que más rinde por tu plata". Precio en escala logarítmica (va de centavos a
   decenas de dólares), calidad lineal (índice de inteligencia de Artificial Analysis). */
const PRICE_LO = 0.05, PRICE_HI = 40, Q_HI = 60;
const PRICE_TICKS = [0.1, 1, 10];
const Q_TICKS = [20, 40, 60];

/** Una caja en fracciones de pantalla: x0/x1 de izquierda a derecha, y0/y1 de arriba abajo. */
export interface Rect { x0: number; x1: number; y0: number; y1: number }

/* El mismo gráfico en dos tamaños. En chico vive debajo de la fila; agrandado, al centro.
   Dentro de la caja, el área de datos deja margen para los números de los ejes. */
/** Celular (mismo corte que el montón): el gráfico agrandado entra en modo foco, con el
 *  resto de la interfaz escondida, y los sin benchmark van debajo en vez de al costado. */
export const COMPACT = window.matchMedia('(max-width: 640px)').matches;
// En el celular la vista previa se estira a lo ancho: sin títulos de eje ni leyenda, entra.
export const SMALL: Rect = COMPACT
  ? { x0: 0.08, x1: 0.92, y0: 0.575, y1: 0.745 }
  : { x0: 0.4, x1: 0.6, y0: 0.585, y1: 0.745 };
export const BIG: Rect = COMPACT
  ? { x0: 0.08, x1: 0.95, y0: 0.1, y1: 0.6 }
  : { x0: 0.22, x1: 0.7, y0: 0.3, y1: 0.76 };
const PAD = { l: 0.1, r: 0.03, t: 0.05, b: 0.12 }; // fracciones de la caja

const inner = (r: Rect) => {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  return { x0: r.x0 + w * PAD.l, x1: r.x1 - w * PAD.r, y0: r.y0 + h * PAD.t, y1: r.y1 - h * PAD.b };
};
const px = (price: number, a: number, b: number) =>
  a + ((Math.log(Math.min(Math.max(price, PRICE_LO), PRICE_HI)) - Math.log(PRICE_LO)) / (Math.log(PRICE_HI) - Math.log(PRICE_LO))) * (b - a);
const qy = (q: number, a: number, b: number) => b - (Math.min(q, Q_HI) / Q_HI) * (b - a);

/** Dónde va un modelo dentro de la caja, en fracciones de pantalla. */
export function chartPos(m: Model, r: Rect) {
  const i = inner(r);
  return { fx: px(m.price!, i.x0, i.x1), fy: qy(m.quality!, i.y0, i.y1) };
}

/** Frontera de Pareto: los modelos que ningún otro supera en calidad por el mismo
 *  precio o menos. Devuelta ordenada por precio, que es como se dibuja. */
export function frontier(models: Model[]) {
  const sorted = [...models].sort((a, b) => a.price! - b.price! || b.quality! - a.quality!);
  const out: Model[] = [];
  let bestQ = -Infinity;
  for (const m of sorted) if (m.quality! > bestQ) { out.push(m); bestQ = m.quality!; }
  return out;
}

/** Lugar de cada modelo sin benchmark en el margen del gráfico grande. La columna de
 *  nombres HTML del margen usa el mismo paso vertical. */
export const MARGIN = COMPACT
  ? { fx: 0.1, fy0: BIG.y1 + 0.2, step: 0.05 }
  : { fx: BIG.x1 + 0.035, fy0: BIG.y0 + 0.14, step: 0.062 };
// En el celular, dos columnas debajo del gráfico; en escritorio, una columna al margen.
export const marginPos = (k: number) => COMPACT
  ? { fx: MARGIN.fx + (k % 2) * 0.46, fy: MARGIN.fy0 + Math.floor(k / 2) * MARGIN.step }
  : { fx: MARGIN.fx, fy: MARGIN.fy0 + k * MARGIN.step };

const priceLabel = (p: number) => (p < 1 ? p.toString().replace('.', ',') : String(p));
const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: n < 1 ? 2 : 1 });
const shortName = (m: Model) => m.name.replace(/^[^:]+:\s*/, '');

interface Props {
  models: Model[]; // con datos: van en el plano
  loose: Model[]; // sin benchmark: van al margen
  best: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  hovered: string | null; // modelo con el mouse encima, en la fila o en el gráfico
  onHover: (id: string | null) => void;
}

/**
 * El gráfico costo vs. calidad. Un solo componente que cambia de caja: todas sus
 * coordenadas están en fracciones de pantalla, las mismas que usa la escena 3D, así
 * que al agrandarse las fichas aterrizan exactamente sobre sus puntos.
 */
export function CostChart({ models, loose, best, expanded, onToggle, hovered, onHover }: Props) {
  const r = expanded ? BIG : SMALL;
  const i = inner(r);
  // Coordenadas locales de la caja (0..100) para el SVG y las etiquetas.
  const lx = (fx: number) => ((fx - r.x0) / (r.x1 - r.x0)) * 100;
  const ly = (fy: number) => ((fy - r.y0) / (r.y1 - r.y0)) * 100;
  const f = frontier(models).map((m) => chartPos(m, r));
  const d = f.map((p, k) => `${k ? 'L' : 'M'}${lx(p.fx)},${ly(p.fy)}`).join(' ');
  const box: CSSProperties = {
    left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`,
    width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%`,
  };

  const cls = expanded ? 'grafico grande' : 'grafico';
  // Dónde cae el modelo marcado: sus coordenadas locales, para las guías hasta cada eje.
  const hm = hovered ? models.find((m) => m.id === hovered) : undefined;
  const hp = hm && chartPos(hm, r);

  return (
    <>
      {/* Capa de fondo, debajo de la escena 3D: la grilla, los ejes y el fibrón quedan
          apoyados en la hoja y las fichas pasan por encima, como objetos sobre el papel. */}
      <div className={`${cls} fondo`} style={box} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {Q_TICKS.map((q) => {
            const y = ly(qy(q, i.y0, i.y1));
            return <line key={q} className="grilla" x1={lx(i.x0)} x2={lx(i.x1)} y1={y} y2={y} />;
          })}
          <path className="eje" d={`M${lx(i.x0)},${ly(i.y0)} L${lx(i.x0)},${ly(i.y1)} L${lx(i.x1)},${ly(i.y1)}`} />
          {/* key por tamaño: al cambiar de caja, el fibrón se vuelve a pasar */}
          {f.length > 1 && <path key={String(expanded)} className="frontera-trazo" d={d} pathLength={1} />}
          {hp && (
            <path key={hm!.id} className="guia"
              d={`M${lx(i.x0)},${ly(hp.fy)} L${lx(hp.fx)},${ly(hp.fy)} L${lx(hp.fx)},${ly(i.y1)}`} />
          )}
        </svg>
      </div>

    <figure className={cls} style={box}>
      {/* Cada eje con su nombre, al lado de sus números. */}
      <span className="eje-titulo x" style={{ left: `${lx(i.x1)}%`, top: `${ly(i.y1)}%` }}>costo · USD por millón de tokens →</span>
      <span className="eje-titulo y" style={{ left: `${lx(i.x0)}%`, top: `${ly(i.y1)}%` }}>calidad · índice AA →</span>

      {PRICE_TICKS.map((p) => (
        <span key={p} className="tick x" style={{ left: `${lx(px(p, i.x0, i.x1))}%`, top: `${ly(i.y1)}%` }}>{priceLabel(p)}</span>
      ))}
      {Q_TICKS.map((q) => (
        <span key={q} className="tick y" style={{ left: `${lx(i.x0)}%`, top: `${ly(qy(q, i.y0, i.y1))}%` }}>{q}</span>
      ))}

      {/* Los valores del modelo marcado, escritos sobre cada eje. */}
      {hp && (
        <>
          <span className="valor x" style={{ left: `${lx(hp.fx)}%`, top: `${ly(i.y1)}%` }}>USD {num(hm!.price!)}</span>
          <span className="valor y" style={{ left: `${lx(i.x0)}%`, top: `${ly(hp.fy)}%` }}>{num(hm!.quality!)}</span>
        </>
      )}

      {/* En chico, los modelos son logos. Agrandado, los reemplazan las fichas 3D. */}
      <ol className="puntos-logo" aria-label="Modelos por costo y calidad">
        {models.map((m) => {
          const p = chartPos(m, r);
          return (
            <li key={m.id} className={[best.has(m.id) && 'mejor', hovered === m.id && 'marcado', p.fx > 0.7 && 'derecha'].filter(Boolean).join(' ')} style={{ left: `${lx(p.fx)}%`, top: `${ly(p.fy)}%` }}>
              <a href={m.url} target="_blank" rel="noopener" title={m.name} aria-label={`${m.name}: calidad ${m.quality}, USD ${m.price} por millón de tokens`}
                onMouseEnter={() => onHover(m.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(m.id)} onBlur={() => onHover(null)}>
                {m.logo ? <img src={m.logo} alt="" /> : <span className="sin-logo" />}
                <span className="nombre-punto">{shortName(m)}</span>
              </a>
            </li>
          );
        })}
      </ol>

      {/* Margen: los sin benchmark, al costado del plano, como una nota al margen de la hoja. */}
      {expanded && loose.length > 0 && (
        <>
          {!COMPACT && <div className="margen-regla" style={{ left: `${lx(MARGIN.fx - 0.022)}%`, top: `${ly(MARGIN.fy0 - 0.1)}%`, height: `${((loose.length * MARGIN.step + 0.06) / (r.y1 - r.y0)) * 100}%` }} />}
          <p className="margen-titulo" style={{ left: `${lx(MARGIN.fx - 0.014)}%`, top: `${ly(MARGIN.fy0 - (COMPACT ? 0.085 : 0.1))}%` }}>
            Sin benchmark público
            <span>Jev los recomienda; no hay costo ni calidad medidos.</span>
          </p>
          <ol className="margen" aria-label="Modelos sin benchmark público">
            {loose.map((m, k) => (
              <li key={m.id} style={{ left: `${lx(marginPos(k).fx + 0.03)}%`, top: `${ly(marginPos(k).fy)}%` }}>
                <a href={m.url} target="_blank" rel="noopener" title={m.name}>{shortName(m)}</a>
              </li>
            ))}
          </ol>
        </>
      )}

      <figcaption>
        <span className="mejor-leyenda">lo mejor por tu plata</span>
        <button type="button" className="agrandar" onClick={onToggle} aria-expanded={expanded}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {expanded
              ? <path d="M6.5 2.5v4h-4M9.5 13.5v-4h4M6.5 6.5 2 2M9.5 9.5 14 14" />
              : <path d="M2.5 6.5v-4h4M13.5 9.5v4h-4M2.5 2.5 7 7M13.5 13.5 9 9" />}
          </svg>
          {expanded ? 'achicar' : 'agrandar'}
        </button>
      </figcaption>
    </figure>
    </>
  );
}

