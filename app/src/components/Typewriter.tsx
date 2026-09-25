import { useEffect, useState } from 'react';

/** Sugerencias que se escriben, se borran y se reescriben debajo de la burbuja.
 *  Click en la que se está escribiendo: la usa. */
export default function Typewriter({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  const [k, setK] = useState(0);
  const [n, setN] = useState(0);
  const [erasing, setErasing] = useState(false);
  const text = items[k % items.length];

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setN(text.length); return; }
    let delay: number;
    if (!erasing && n < text.length) delay = 38 + Math.random() * 45; // teclear, con ritmo humano
    else if (!erasing) delay = 1700; // queda escrita un momento
    else if (n > 0) delay = 18; // borrar es más rápido que escribir
    else delay = 350;
    const t = setTimeout(() => {
      if (!erasing && n < text.length) setN(n + 1);
      else if (!erasing) setErasing(true);
      else if (n > 0) setN(n - 1);
      else { setErasing(false); setK(k + 1); }
    }, delay);
    return () => clearTimeout(t);
  }, [n, erasing, text, k]);

  return (
    <p className="maquina">
      <span className="maquina-prefijo">probá con</span>
      <button type="button" onClick={() => onPick(text)} aria-label={`Usar la sugerencia: ${text}`}>
        {text.slice(0, n)}
        <span className="cursor" aria-hidden="true" />
      </button>
    </p>
  );
}
