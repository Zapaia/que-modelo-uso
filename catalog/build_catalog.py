"""Valida las descripciones de los subagentes y arma catalog.json.

Uso:  python3 build_catalog.py            -> valida + arma
      python3 build_catalog.py --check-urls  -> además verifica que los links respondan
"""
import json, glob, re, sys, urllib.request, concurrent.futures as cf

BANNED = re.compile(r"state[- ]of[- ]the[- ]art|cutting[- ]edge|best[- ]in[- ]class|powerful|revolutionary|world[- ]class", re.I)
NUMBERY = re.compile(r"\b\d+(\.\d+)?\s?%|\bscore[sd]? (of )?\d|\bMMLU\b|\bHumanEval\b|\bSWE-bench\b", re.I)

def load(pattern):
    rows = {}
    for f in sorted(glob.glob(pattern)):
        try:
            for r in json.load(open(f)): rows[r["id"]] = r
        except Exception as e:
            print(f"  ✗ {f}: JSON inválido ({e})")
    return rows

def check(entry, expected_ids, layer):
    problems = []
    d = (entry.get("description") or "").strip()
    words = len(d.split())
    if not d: problems.append("descripción vacía")
    elif words < 35 or words > 130: problems.append(f"{words} palabras")
    if d and "Best at" not in d: problems.append("falta 'Best at'")
    if d and "Not suited for" not in d: problems.append("falta 'Not suited for'")
    if BANNED.search(d): problems.append("marketing: " + BANNED.search(d).group(0))
    if NUMBERY.search(d): problems.append("número/benchmark: " + NUMBERY.search(d).group(0))
    for k in ("source_url", "official_url"):
        if not str(entry.get(k, "")).startswith("http"): problems.append(f"sin {k}")
    return problems

def url_ok(u):
    try:
        req = urllib.request.Request(u, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r: return r.status < 400
    except urllib.error.HTTPError as e:
        if e.code in (405, 400):   # no acepta HEAD: probar GET
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r: return r.status < 400
            except urllib.error.HTTPError as e2: return e2.code in (401, 403, 429)
            except Exception: return False
        return e.code in (401, 403, 429)   # existe pero pide login, bloquea bots o limita   # existe pero pide login o no acepta HEAD
    except Exception:
        return False

def main():
    L1sel = {m["id"]: m for m in json.load(open("raw/layer1_selection.json"))}
    L2sel = {m["id"]: m for m in json.load(open("raw/layer2_selection.json"))}
    imgs = json.load(open("raw/layer1_creator_images.json"))
    AA = {a["slug"]: a for a in json.load(open("raw/artificialanalysis.json"))["data"]}
    aamap = json.load(open("raw/aa_mapping.json"))
    def num(x):  # Artificial Analysis usa 0 cuando no midió: eso es "sin dato", no gratis ni instantáneo
        return x if isinstance(x, (int, float)) and x > 0 else None
    D1, D2 = load("descriptions/out/L1_*.json"), load("descriptions/out/L2_*.json")

    catalog, report = [], {"ok": 0, "flagged": [], "missing": []}
    for layer, sel, D in ((1, L1sel, D1), (2, L2sel, D2)):
        for mid, m in sel.items():
            e = D.get(mid)
            if not e: report["missing"].append(mid); continue
            probs = check(e, sel, layer)
            if e.get("confidence") == "low": probs.append("confidence low: " + (e.get("notes") or "")[:80])
            if probs: report["flagged"].append((mid, probs))
            if not (e.get("description") or "").strip(): continue       # sin descripción no entra
            base = {"id": mid, "layer": layer, "description": e["description"].strip(),
                    "source_url": e["source_url"], "official_url": e["official_url"],
                    "confidence": e.get("confidence", "high")}
            if layer == 1:
                a = AA.get(aamap.get(mid) or "")
                base.update(name=m["name"], creator=m["creator"], image=imgs.get(m["creator"]),
                            aa_slug=a["slug"] if a else None,
                            quality=num(a["evaluations"].get("artificial_analysis_intelligence_index")) if a else None,
                            price=num(a["pricing"].get("price_1m_blended_3_to_1")) if a else None,
                            speed=num(a.get("median_output_tokens_per_second")) if a else None,
                            ttft=num(a.get("median_time_to_first_token_seconds")) if a else None)
            else:
                base.update(name=mid.split("/")[1], creator=mid.split("/")[0], image=m.get("image"),
                            task=m["group"], downloads=m["downloads"], license=m["license"])
            # "con datos" = puede ir al gráfico: necesita calidad y precio
            base["has_data"] = bool(base.get("quality") and base.get("price"))
            catalog.append(base); report["ok"] += 1

    if "--check-urls" in sys.argv:
        # Los links de Hugging Face salen de ids que devolvió su API: válidos por construcción,
        # y HF corta con 429 si se consultan en ráfaga. Se verifican solo los demás dominios.
        urls = sorted({u for c in catalog for u in (c["source_url"], c["official_url"]) if "huggingface.co" not in u})
        with cf.ThreadPoolExecutor(6) as ex: res = dict(zip(urls, ex.map(url_ok, urls)))
        bad = [u for u, ok in res.items() if not ok]
        print(f"\nLinks: {len(urls)-len(bad)}/{len(urls)} responden")
        for u in bad: print("  ✗", u)

    json.dump(catalog, open("catalog.json", "w"), indent=1, ensure_ascii=False)
    n1 = sum(c["layer"] == 1 for c in catalog); n2 = len(catalog) - n1
    hd = [c for c in catalog if c["has_data"]]
    print(f"con datos para el gráfico: {len(hd)} (calidad+precio) · con velocidad medida: {sum(1 for c in hd if c['speed'])}")
    print("capa 1 sin datos:", [c["id"] for c in catalog if c["layer"] == 1 and not c["has_data"]])
    print(f"\ncatalog.json: {len(catalog)} modelos (capa 1: {n1}, capa 2: {n2})")
    print(f"faltan (no entregados): {len(report['missing'])}", report["missing"][:10])
    print(f"con observaciones: {len(report['flagged'])}")
    for mid, p in report["flagged"]: print(f"  · {mid}: {'; '.join(p)}")

if __name__ == "__main__": main()
