Base: /Users/ramiro/Ramiro/03-Areas/hackathon/webflow-nerdearla-sep26/proyecto/catalog/v2/
- Reglas: INSTRUCTIONS.md y VOCAB.json. Ejemplo aprobado de modelos nuevos: out/N00_voz.json.
- No repitas lo que ya está en catalog_index.txt.
- Hoy es 2026-09-24: verificá nombre y versión vigente de cada modelo en docs oficiales; descartá lo reemplazado o sin API pública oficial / pesos abiertos.
- **Uno por línea de producto** (el principal vigente), priorizando lo que más usan los desarrolladores.
- Campos extra en cada objeto: `id` (`<creador>/<modelo>` en minúsculas con guiones, nombre oficial de API si existe), `layer`: 3, `creator_slug`, `hf_org` (verificada abriendo https://huggingface.co/<org>, o null), `official_url`, `sources` (solo URLs oficiales que abriste).
- Salida: out/N03_musica.json. Validador: `python3 validate.py out/N03_musica.json` desde la base.
- Al final: qué elegiste, qué descartaste y por qué (pocas líneas).

Grupo asignado: **música, efectos de sonido y audio** (no voz hablada, ya cubierta) + **separación y limpieza de audio** si hay modelos de uso masivo. Candidatos: ElevenLabs (música y efectos), Google Lyria, Stability AI Stable Audio (API), Suno y Udio (solo con API pública oficial), y separación de fuentes / reducción de ruido muy usados. `kind` music generation o audio generation, modalidad `audio`. 4 a 7 modelos.
