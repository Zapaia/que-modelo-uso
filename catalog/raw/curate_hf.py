import json, re, os, urllib.request, collections
exec(open("raw/fetch_hf.py").read().split("JUNK =")[0])   # reusa get()
sel=json.load(open("raw/layer2_selection.json"))

MIRRORS={"autogluon/chronos-2","autogluon/chronos-bolt-small","autogluon/chronos-2-small","argmaxinc/whisperkit-coreml"}
out=[]; per=collections.Counter(); openmed=collections.Counter()
for s in sel:
    org=s["id"].split("/")[0]
    if s["id"] in MIRRORS: continue
    if org=="OpenMed":
        if openmed[s["group"]]>=1: continue
        openmed[s["group"]]+=1
    if per[(s["group"],org)]>=2: continue
    per[(s["group"],org)]+=1
    out.append(s)
print("tras dedup:",len(out),"(de",len(sel),")")

# Referentes de dominio que la búsqueda por palabra no trae
CURATED=[
 ("protein","facebook/esm2_t33_650M_UR50D"),("protein","facebook/esmfold_v1"),
 ("genomics","InstaDeepAI/nucleotide-transformer-v2-500m-multi-species"),
 ("biomedical-text","microsoft/BioGPT-Large"),("biomedical-text","stanford-crfm/BioMedLM"),
 ("earth-observation","ibm-nasa-geospatial/Prithvi-EO-2.0-300M"),("earth-observation","ibm-nasa-geospatial/Prithvi-EO-2.0-600M"),
 ("weather","microsoft/aurora"),("weather","ibm-nasa-geospatial/Prithvi-WxC-1.0-2300M"),
 ("chemistry","ibm/MoLFormer-XL-both-10pct"),
 ("speech-to-text","openai/whisper-large-v3"),
 ("medical-vision","microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"),
]
have={s["id"] for s in out}
for group,mid in CURATED:
    if mid in have: continue
    m=get(f"https://huggingface.co/api/models/{mid}")
    if not m or "id" not in m: print("  NO EXISTE:",mid); continue
    lic=next((t.split(":",1)[1] for t in m.get("tags",[]) if t.startswith("license:")),None)
    s={"id":m["id"],"group":group,"pipeline_tag":m.get("pipeline_tag"),"downloads":m.get("downloads"),"likes":m.get("likes"),
       "license":lic,"gated":bool(m.get("gated")),"official_url":f"https://huggingface.co/{m['id']}",
       "source_url":f"https://huggingface.co/{m['id']}/blob/main/README.md","curated":True}
    fn="raw/readmes/"+s["id"].replace("/","__")+".md"
    txt=get(f"https://huggingface.co/{s['id']}/raw/main/README.md",raw=True) or ""
    open(fn,"w").write(re.sub(r"^---.*?---\s*","",txt,flags=re.S)[:7000]); s["readme_chars"]=os.path.getsize(fn)
    org=s["id"].split("/")[0]
    a=get(f"https://huggingface.co/api/organizations/{org}/avatar") or get(f"https://huggingface.co/api/users/{org}/avatar") or {}
    s["image"]=a.get("avatarUrl"); out.append(s); print("  +",mid,f"({m.get('downloads')} descargas, README {s['readme_chars']} chars)")
json.dump(out,open("raw/layer2_selection.json","w"),indent=1)
print("TOTAL capa 2 final:",len(out),"| README <300 chars:",[s["id"] for s in out if s["readme_chars"]<300])
