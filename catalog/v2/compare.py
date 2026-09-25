"""Compara la descripción vieja (prosa) contra la ficha v2 (JSON) en Jev.

Uso:  python3 compare.py out/E00_test.json

Para cada idea manda dos pedidos con los mismos modelos: uno con `description` y otro
con la ficha. Misma pregunta que la app. Imprime la probabilidad de cada modelo en las
dos versiones. La key se lee de app/.dev.vars y nunca se imprime.
"""
import json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KEY = next(l.split("=", 1)[1].strip() for l in open(ROOT / "app/.dev.vars") if l.startswith("AI_GATEWAY_API_KEY="))
URL = "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
QUESTION = "Would the model described in `model` perform the core task of the product described in `idea`?"
IDEAS = [
    "chatbot barato que responda al toque",
    "transcribir las reuniones de mi equipo",
    "app para investigar biología",
    "buscador semántico de documentos internos",
    "generar imágenes para mi tienda online",
    "predecir ventas del mes que viene",
    "autocompletar código en mi editor",
    "clasificar tickets de soporte por tema",
]


NOTE = "The idea may be written in Spanish or another language; that says nothing about the language of the product's data or users."
VOCAB = json.load(open(Path(__file__).parent / "VOCAB.json"))


def with_defs(card):
    """Pega la definición del vocabulario a kind e interaction: Jev solo ve lo que le mandamos."""
    c = dict(card)
    c["kind"] = f"{card['kind']}: {VOCAB['kind'].get(card['kind'], '')}"
    c["interaction"] = f"{card['interaction']}: {VOCAB['interaction'].get(card['interaction'], '')}"
    return c


def ask(idea, models, note=False):
    ins = lambda m: {"question": QUESTION, **({"note": NOTE} if note else {}), "model": m}
    questions = {f"m{i}": {"type": "noul", "instructions": ins(m)} for i, m in enumerate(models)}
    body = json.dumps({"model": "typesafe-ai/jev", "state": {"idea": idea}, "questions": questions}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for _ in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ans = json.load(r)["answers"]
                return [ans[f"m{i}"]["noul"] for i in range(len(models))]
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503): raise
            time.sleep(2)
    raise RuntimeError("Jev no respondió")


def main(path):
    new = json.load(open(path))
    old = {m["id"]: m for m in json.load(open(ROOT / "catalog/catalog.json"))}
    rows = [r for r in new if r["id"] in old]
    v1 = [{"name": old[r["id"]]["name"], "description": old[r["id"]]["description"]} for r in rows]
    v2 = [{"name": r["name"], **r["card"]} for r in rows]
    v2d = [{"name": r["name"], **with_defs(r["card"])} for r in rows]
    short = [r["id"].split("/")[-1][:26] for r in rows]
    for idea in IDEAS:
        a, b, c, d = ask(idea, v1), ask(idea, v2), ask(idea, v2, note=True), ask(idea, v2d)
        print(f"\n## {idea}")
        print(f"{'modelo':28} {'viejo':>6} {'nuevo':>6} {'+nota':>6} {'+def':>6}")
        for n, w, x, y, z in sorted(zip(short, a, b, c, d), key=lambda t: -t[2]):
            print(f"{n:28} {w:6.2f} {x:6.2f} {y:6.2f} {z:6.2f}")


if __name__ == "__main__":
    main(sys.argv[1])
