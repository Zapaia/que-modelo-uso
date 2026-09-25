# Arma la capa 2: modelos especializados de Hugging Face + model cards + avatares
import json, re, time, urllib.request, urllib.parse, os
def get(url, raw=False):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"nerdearla-app/0.1"}), timeout=30) as r:
                b=r.read(); return b.decode("utf-8","ignore") if raw else json.loads(b)
        except Exception as e:
            if i==2: return None
            time.sleep(2)

JUNK = re.compile(r"(gguf|gptq|awq|exl2|mlx|onnx|int4|int8|4bit|8bit|fp8|bnb|quant|-q\d|lora|adapter|merge|test|tiny-random|dummy)", re.I)

# (etiqueta de grupo, parámetros de búsqueda, cuántos)
QUERIES = [
 ("speech-to-text",        {"pipeline_tag":"automatic-speech-recognition"}, 7),
 ("text-to-speech",        {"pipeline_tag":"text-to-speech"}, 6),
 ("audio-classification",  {"pipeline_tag":"audio-classification"}, 4),
 ("text-to-audio",         {"pipeline_tag":"text-to-audio"}, 4),
 ("image-classification",  {"pipeline_tag":"image-classification"}, 5),
 ("object-detection",      {"pipeline_tag":"object-detection"}, 5),
 ("image-segmentation",    {"pipeline_tag":"image-segmentation"}, 5),
 ("depth-estimation",      {"pipeline_tag":"depth-estimation"}, 3),
 ("text-to-image",         {"pipeline_tag":"text-to-image"}, 6),
 ("image-to-text",         {"pipeline_tag":"image-to-text"}, 5),
 ("text-to-video",         {"pipeline_tag":"text-to-video"}, 4),
 ("video-classification",  {"pipeline_tag":"video-classification"}, 3),
 ("embeddings",            {"pipeline_tag":"sentence-similarity"}, 7),
 ("reranking",             {"search":"reranker"}, 4),
 ("translation",           {"pipeline_tag":"translation"}, 5),
 ("summarization",         {"pipeline_tag":"summarization"}, 4),
 ("ner",                   {"pipeline_tag":"token-classification"}, 5),
 ("text-classification",   {"pipeline_tag":"text-classification"}, 5),
 ("zero-shot",             {"pipeline_tag":"zero-shot-classification"}, 4),
 ("time-series",           {"pipeline_tag":"time-series-forecasting"}, 5),
 ("document-qa",           {"pipeline_tag":"document-question-answering"}, 3),
 ("table-qa",              {"pipeline_tag":"table-question-answering"}, 3),
 ("ocr",                   {"search":"ocr"}, 4),
 ("biomedical-text",       {"search":"biomed"}, 5),
 ("clinical",              {"search":"clinical"}, 4),
 ("protein",               {"search":"protein"}, 5),
 ("genomics",              {"search":"dna"}, 4),
 ("chemistry",             {"search":"chem"}, 4),
 ("legal",                 {"search":"legal"}, 4),
 ("finance",               {"search":"finbert"}, 3),
 ("earth-observation",     {"search":"satellite"}, 4),
 ("weather",               {"search":"weather"}, 3),
 ("code-embeddings",       {"search":"codebert"}, 3),
 ("math",                  {"search":"math"}, 3),
 ("safety-moderation",     {"search":"toxic"}, 3),
]
seen=set(); sel=[]
for group, params, n in QUERIES:
    q={"sort":"downloads","direction":"-1","limit":"60", **params}
    rows=get("https://huggingface.co/api/models?"+urllib.parse.urlencode(q)) or []
    picked=0
    for m in rows:
        mid=m["id"]
        if mid in seen or JUNK.search(mid) or m.get("private") or m.get("downloads",0)<500: continue
        seen.add(mid); picked+=1
        lic=next((t.split(":",1)[1] for t in m.get("tags",[]) if t.startswith("license:")), None)
        sel.append({"id":mid,"group":group,"pipeline_tag":m.get("pipeline_tag"),"downloads":m.get("downloads"),
                    "likes":m.get("likes"),"license":lic,"gated":bool(m.get("gated")),
                    "official_url":f"https://huggingface.co/{mid}",
                    "source_url":f"https://huggingface.co/{mid}/blob/main/README.md"})
        if picked>=n: break
    print(f"{group:<22} {picked}/{n}  " + ", ".join(s["id"] for s in sel[-picked:])[:160])

# Model cards y avatares
os.makedirs("raw/readmes",exist_ok=True)
avatars={}
for s in sel:
    fn="raw/readmes/"+s["id"].replace("/","__")+".md"
    if not os.path.exists(fn):
        txt=get(f"https://huggingface.co/{s['id']}/raw/main/README.md", raw=True) or ""
        txt=re.sub(r"^---.*?---\s*","",txt,flags=re.S)     # saca el frontmatter YAML
        open(fn,"w").write(txt[:7000])
    s["readme_chars"]=os.path.getsize(fn)
    org=s["id"].split("/")[0]
    if org not in avatars:
        a=get(f"https://huggingface.co/api/organizations/{org}/avatar") or get(f"https://huggingface.co/api/users/{org}/avatar") or {}
        avatars[org]=a.get("avatarUrl")
    s["image"]=avatars[org]
json.dump(sel,open("raw/layer2_selection.json","w"),indent=1)
print("\nTOTAL capa 2:",len(sel),"| sin README útil (<300 chars):",sum(1 for s in sel if s["readme_chars"]<300),"| sin imagen:",sum(1 for s in sel if not s["image"]))
