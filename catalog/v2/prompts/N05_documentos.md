Base: /Users/ramiro/Ramiro/03-Areas/hackathon/webflow-nerdearla-sep26/proyecto/catalog/v2/
- Reglas: INSTRUCTIONS.md y VOCAB.json. Ejemplo aprobado de modelos nuevos: out/N00_voz.json.
- No repitas lo que ya está en catalog_index.txt.
- Hoy es 2026-09-24: verificá nombre y versión vigente de cada modelo en docs oficiales; descartá lo reemplazado o sin API pública oficial / pesos abiertos.
- **Uno por línea de producto** (el principal vigente), priorizando lo que más usan los desarrolladores.
- Campos extra en cada objeto: `id` (`<creador>/<modelo>` en minúsculas con guiones, nombre oficial de API si existe), `layer`: 3, `creator_slug`, `hf_org` (verificada abriendo https://huggingface.co/<org>, o null), `official_url`, `sources` (solo URLs oficiales que abriste).
- Salida: out/N05_documentos.json. Validador: `python3 validate.py out/N05_documentos.json` desde la base.
- Al final: qué elegiste, qué descartaste y por qué (pocas líneas).

Grupo asignado: **OCR y documentos** + **moderación y guardrails** por API. OCR/documentos: Mistral OCR, Google Document AI, Azure AI Document Intelligence, AWS Textract, LlamaParse/Reducto u otros de uso masivo. Moderación: OpenAI moderation, Google (Perspective o equivalente vigente), Llama Guard o ShieldGemma si no están en el índice. 7 a 10 modelos.
