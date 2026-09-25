# Ficha v2 de cada modelo (instrucciones para subagentes)

Hoy es **2026-09-24**. Tu conocimiento puede estar desactualizado: **verificá todo en la web** (ficha oficial del modelo, docs de la API, blog de lanzamiento, paper). Nunca completes de memoria.

## Para qué es
Cada ficha la lee **Jev**, un clasificador rápido que recibe la idea de producto de un usuario ("app para transcribir reuniones", "chatbot barato para mi tienda") y decide, para cada modelo, si **puede hacer la tarea central de ese producto**. Jev:
- **lee literal**: responde lo que dice la ficha, no lo que un humano deduciría. Si un modelo no conversa, la ficha tiene que decirlo con esas palabras.
- **es malo con números**: nada de parámetros, benchmarks, precios, contextos en tokens, cantidad de idiomas ni fechas.
- **pierde precisión con ruido**: frases cortas y concretas, cero marketing ("powerful", "state-of-the-art", "cutting-edge", "best-in-class", "revolutionary", superlativos).

## Regla de oro
**Solo lo que dice una fuente oficial.** Si no lo encontrás, no lo pongas. Lo único que podés agregar sin fuente es lo que se sigue directo de la modalidad (un modelo de voz a texto no genera imágenes). Cada ficha lista en `sources` las URLs que realmente leíste (tienen que existir: abrilas con WebFetch).

Fuentes, en orden de preferencia: ficha del modelo en Hugging Face (`https://huggingface.co/<id>` o su `raw/main/README.md`), docs oficiales de la API del creador, blog o anuncio oficial, paper. Si la ficha de HF está cerrada (gated), usá el blog, las docs o el paper del creador. Agregadores y blogs de terceros no cuentan como fuente.

## La ficha
Un objeto JSON por modelo. Los campos `kind`, `input`, `output`, `interaction` y `access` usan **solo** los valores de `VOCAB.json` (copialos exactos, incluidas mayúsculas).

```json
{
  "id": "openai/whisper-large-v3",
  "name": "Whisper large-v3",
  "creator": "OpenAI",
  "card": {
    "what": "Open-weights speech-to-text model by OpenAI that transcribes and translates speech.",
    "kind": "speech-to-text",
    "input": ["speech"],
    "output": ["text"],
    "interaction": "task model",
    "access": "open weights",
    "languages": "multilingual",
    "best_at": ["transcribing recorded meetings, calls and interviews", "transcribing speech in many languages", "translating speech into English text"],
    "product_uses": ["meeting notes app", "subtitles for videos and podcasts", "voice search or voice notes"],
    "domains": ["general", "media"],
    "not_for": ["telling who spoke (no speaker labels)", "generating speech", "open-ended chat"]
  },
  "official_url": "https://huggingface.co/openai/whisper-large-v3",
  "sources": ["https://huggingface.co/openai/whisper-large-v3"],
  "notes": ""
}
```

### Campo por campo
- `what`: una oración, máximo 20 palabras: qué es y quién lo hizo. Sin números.
- `kind`: **uno** de `VOCAB.kind`, el que mejor describe su uso principal.
- `input` / `output`: listas de `VOCAB.modality`. Lo que recibe y lo que devuelve.
- `interaction`: **uno** de `VOCAB.interaction`. Clave para Jev:
  - Solo `chat and instructions` si de verdad sigue instrucciones abiertas o conversa (modelos instruct/chat).
  - Un modelo preentrenado que hay que ajustar (BERT, T5 base, encoders de dominio, LMs sin instruct) es `base model: needs fine-tuning`.
  - Un modelo que hace una sola cosa (NER, clasificador, detector, TTS) es `task model`.
- `access`: uno de `VOCAB.access`.
- `languages`: `"English"`, `"multilingual"`, o hasta 5 idiomas por nombre (`"English, French, German"`). Sin contar.
- `best_at`: 2 a 5 tareas concretas, cada una de 3 a 10 palabras, empezando con verbo en gerundio.
- `product_uses`: 2 a 4 **productos** que un desarrollador podría construir con él (así escribe el usuario: "app para…", "bot que…"). Concretos, no genéricos.
- `domains`: 1 a 4 palabras cortas (`general`, `medicine`, `biology`, `finance`, `legal`, `software`, `media`, `retail`, `science`, `education`, `customer support`, `geospatial`…).
- `not_for`: 2 o 3 exclusiones **que alguien podría confundir**, sobre todo con productos parecidos. Ej.: un encoder biomédico → "open-ended chat or answering questions directly"; un modelo de texto a imagen → "editing an existing photo" si no lo hace. Nada obvio de otra modalidad si no hay confusión posible.
- **Reglas que salieron de la tanda de prueba** (medidas con Jev):
  - `not_for` es solo para lo que el modelo **no puede hacer**. Las advertencias que se resuelven con ingeniería normal (textos largos que se parten en pedazos, límites de uso, latencia) **no** van: Jev las lee como exclusiones y descarta el modelo para productos donde sí sirve.
  - El idioma va **solo** en `languages`, nunca en `not_for`.
  - `speech` es voz humana hablada; `audio` es música, sonidos o audio general. Un TTS devuelve `speech`; un generador de música, `audio`.
- `official_url`: la página oficial del modelo para el usuario (la de HF para modelos abiertos, la de docs o anuncio para APIs).
- `notes`: vacío, o una línea si algo no se pudo verificar.

## Salida
Escribí **un solo archivo JSON** en la ruta que te indiquen: un array con una ficha por modelo, en el mismo orden de la entrada. Validá que el JSON parsee antes de terminar. Al final respondé en 3 líneas: cuántas fichas, cuáles tuvieron dudas y por qué.
