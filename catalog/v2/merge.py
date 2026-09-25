"""Junta las fichas v2 con el catálogo actual y escribe el catálogo nuevo.

Uso:  python3 merge.py            -> escribe catalog_v2.json y lo copia a la app

- Modelos que ya estaban: se les agrega `card` (la ficha) y se conservan sus números de
  Artificial Analysis, logo y links. `description` queda como la oración `what`.
- Modelos nuevos (archivos N*.json): entran como capa 3, sin benchmark.
El catálogo viejo no se toca: la app vuelve atrás con git si hace falta.
"""
import json, glob, shutil
from pathlib import Path

HERE = Path(__file__).parent
OLD = json.load(open(HERE.parent / "catalog.json"))
APP = HERE.parents[1] / "app/src/data/catalog.json"
# El logo local no vive en catalog.json: se deriva de la imagen con el mapa de la app.
LOGO_MAP = json.load(open(HERE.parents[1] / "app/src/lib/logo-map.json"))
CREATOR_ALIAS = {"stability-ai": "stabilityai", "bria": "briaai", "bytedance": "bytedance-seed"}


def load(pattern):
    rows = []
    for f in sorted(glob.glob(str(HERE / "out" / pattern))):
        rows += json.load(open(f))
    return rows


def main():
    cards = {r["id"]: r for r in load("E*.json")}
    fresh = load("N*.json")
    out, missing = [], []
    for m in OLD:
        r = cards.get(m["id"])
        if not r:
            missing.append(m["id"])
            out.append({**m, "logo": LOGO_MAP.get(m.get("image"))})
            continue
        out.append({**m, "logo": LOGO_MAP.get(m.get("image")), "card": r["card"], "description": r["card"]["what"],
                    "official_url": r.get("official_url") or m["official_url"],
                    "source_url": (r.get("sources") or [m["source_url"]])[0]})
    known = {m["id"] for m in out}
    for r in fresh:
        if r["id"] in known:
            print(f"  repetido, se saltea: {r['id']}")
            continue
        known.add(r["id"])
        out.append({
            "id": r["id"], "layer": 3, "name": r["name"], "creator": r.get("creator_slug") or r["id"].split("/")[0],
            "card": r["card"], "description": r["card"]["what"],
            "official_url": r["official_url"], "source_url": r["sources"][0], "hf_org": r.get("hf_org"),
            "image": None, "aa_slug": None, "quality": None, "price": None, "speed": None, "ttft": None,
            "has_data": False, "logo": None,
        })
    # Modelos nuevos sin imagen: heredan el logo de su creador si otro modelo ya lo tiene.
    # Se compara sin mayúsculas (HF usa "Salesforce", la ficha "salesforce") y con alias
    # para las empresas que en Hugging Face tienen otro nombre.
    by_creator = {}
    for m in out:
        if m.get("logo"): by_creator.setdefault(m["creator"].lower(), m["logo"])
    for m in out:
        if not m.get("logo"):
            c = m["creator"].lower()
            m["logo"] = by_creator.get(CREATOR_ALIAS.get(c, c))
    json.dump(out, open(HERE / "catalog_v2.json", "w"), ensure_ascii=False)
    shutil.copy(HERE / "catalog_v2.json", APP)
    print(f"{len(out)} modelos ({len(out) - len(OLD)} nuevos). Sin ficha v2 todavía: {len(missing)}")
    for i in missing: print(f"  sin ficha: {i}")


if __name__ == "__main__":
    main()
