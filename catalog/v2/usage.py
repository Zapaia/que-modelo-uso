"""Mide cuánto consumió un subagente, a partir de su transcripción JSONL.

Uso:  python3 usage.py <output_file del subagente> [otro ...]

El registro guarda cada herramienta como una línea aparte: se agrupa por id de mensaje
para contar llamadas reales al modelo. "arranque" es el contexto de la primera llamada
(lo que carga el subagente antes de hacer nada); se vuelve a leer en cada llamada.
Referencia del 24/9 con general-purpose: arranque 62k, E07 8 llamadas / 0,76 M,
E03 21 llamadas / 2,06 M.
"""
import json, sys
from collections import OrderedDict

for path in sys.argv[1:]:
    msgs = OrderedDict()
    for line in open(path):
        if not line.strip(): continue
        r = json.loads(line); m = r.get("message") or {}
        if r.get("type") != "assistant" or not m.get("id"): continue
        u = m.get("usage", {})
        d = msgs.setdefault(m["id"], {"tools": 0})
        d["ctx"] = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        d["tools"] += sum(1 for c in m.get("content", []) if isinstance(c, dict) and c.get("type") == "tool_use")
    v = list(msgs.values())
    print(f"{path.split('/')[-1]}: {len(v)} llamadas, entrada total {sum(x['ctx'] for x in v) / 1e6:.2f} M, "
          f"arranque {v[0]['ctx'] // 1000}k, final {v[-1]['ctx'] // 1000}k, herramientas por llamada {[x['tools'] for x in v]}")
