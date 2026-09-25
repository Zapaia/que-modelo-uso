"""Valida las fichas v2 que escriben los subagentes.

Uso:  python3 validate.py out/E00_test.json [out/otro.json ...]
      python3 validate.py --urls out/*.json   -> además abre cada fuente

Revisa lo que Jev necesita que sea parejo en todo el catálogo: vocabulario cerrado,
largos, sin números ni marketing, y fuentes que existen.
"""
import json, re, sys, urllib.request, concurrent.futures as cf
from pathlib import Path

HERE = Path(__file__).parent
VOCAB = json.load(open(HERE / "VOCAB.json"))
KINDS, MODS = set(VOCAB["kind"]), set(VOCAB["modality"])
INTERACTIONS, ACCESS = set(VOCAB["interaction"]), set(VOCAB["access"])

BANNED = re.compile(r"state[- ]of[- ]the[- ]art|cutting[- ]edge|best[- ]in[- ]class|powerful|revolutionary|world[- ]class|industry[- ]leading|unparalleled|seamless", re.I)
# Números que Jev lee mal: tamaños, porcentajes, cantidades, precios, latencias, años.
NUMBERY = re.compile(r"\b\d[\d.,]*\s?(%|[BMK]\b|billion|million|thousand|parameters|params|languages|tokens|ms\b|milliseconds|seconds|x\b|hours|minutes|USD|\$)|\$\s?\d|\b(19|20)\d\d\b", re.I)

LIMITS = {"best_at": (2, 5), "product_uses": (2, 4), "domains": (1, 4), "not_for": (2, 3)}


def words(s): return len(s.split())


def check(card):
    p = []
    what = card.get("what", "")
    if not what: p.append("falta what")
    elif words(what) > 22: p.append(f"what largo ({words(what)} palabras)")
    if card.get("kind") not in KINDS: p.append(f"kind fuera del vocabulario: {card.get('kind')!r}")
    for f in ("input", "output"):
        v = card.get(f)
        if not isinstance(v, list) or not v: p.append(f"{f} vacío")
        else:
            bad = [x for x in v if x not in MODS]
            if bad: p.append(f"{f} fuera del vocabulario: {bad}")
    if card.get("interaction") not in INTERACTIONS: p.append(f"interaction fuera del vocabulario: {card.get('interaction')!r}")
    if card.get("access") not in ACCESS: p.append(f"access fuera del vocabulario: {card.get('access')!r}")
    for f, (lo, hi) in LIMITS.items():
        v = card.get(f)
        if not isinstance(v, list) or not (lo <= len(v) <= hi): p.append(f"{f}: {0 if not isinstance(v, list) else len(v)} ítems (va {lo}-{hi})")
        elif f in ("best_at", "product_uses", "not_for"):
            long_ = [x for x in v if words(x) > 12]
            if long_: p.append(f"{f} con ítems largos: {long_}")
    text = " ".join(str(x) for x in [what, *card.get("best_at", []), *card.get("product_uses", []), *card.get("not_for", [])])
    if BANNED.search(text): p.append("marketing: " + BANNED.search(text).group(0))
    if NUMBERY.search(text): p.append("número: " + NUMBERY.search(text).group(0))
    return p


def url_ok(u):
    try:
        req = urllib.request.Request(u, method="GET", headers={"User-Agent": "Mozilla/5.0 catalog-check"})
        with urllib.request.urlopen(req, timeout=15) as r: return r.status < 400, r.status
    except urllib.error.HTTPError as e:
        return e.code in (401, 403, 429), e.code  # cerrado o con límite: existe
    except Exception as e:
        return False, type(e).__name__


def main(paths, urls):
    total = bad = 0
    all_urls = set()
    for path in paths:
        rows = json.load(open(path))
        print(f"\n{path}: {len(rows)} fichas")
        for r in rows:
            total += 1
            p = check(r.get("card", {}))
            if not r.get("sources"): p.append("sin sources")
            if not r.get("official_url"): p.append("sin official_url")
            all_urls.update(r.get("sources", []) + [r.get("official_url")] if r.get("official_url") else r.get("sources", []))
            if p:
                bad += 1
                print(f"  ✗ {r.get('id')}: " + "; ".join(p))
    print(f"\n{total - bad}/{total} fichas sin observaciones")
    if urls:
        with cf.ThreadPoolExecutor(8) as ex:
            for u, (ok, code) in zip(sorted(all_urls), ex.map(url_ok, sorted(all_urls))):
                if not ok: print(f"  ✗ link {code}: {u}")
        print(f"{len(all_urls)} links revisados")


if __name__ == "__main__":
    args = sys.argv[1:]
    main([a for a in args if a != "--urls"], "--urls" in args)
