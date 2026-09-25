Base: /Users/ramiro/Ramiro/03-Areas/hackathon/webflow-nerdearla-sep26/proyecto/catalog/v2/
- Reglas: INSTRUCTIONS.md y VOCAB.json. Ejemplo aprobado de modelos nuevos: out/N00_voz.json.
- No repitas lo que ya está en catalog_index.txt.
- Hoy es 2026-09-24: verificá nombre y versión vigente de cada modelo en docs oficiales; descartá lo reemplazado o sin API pública oficial / pesos abiertos.
- **Uno por línea de producto** (el principal vigente), priorizando lo que más usan los desarrolladores.
- Campos extra en cada objeto: `id` (`<creador>/<modelo>` en minúsculas con guiones, nombre oficial de API si existe), `layer`: 3, `creator_slug`, `hf_org` (verificada abriendo https://huggingface.co/<org>, o null), `official_url`, `sources` (solo URLs oficiales que abriste).
- Salida: out/N01_imagen.json. Validador: `python3 validate.py out/N01_imagen.json` desde la base.
- Al final: qué elegiste, qué descartaste y por qué (pocas líneas).

Grupo asignado: **generación y edición de imágenes** por API (text-to-image e image editing: edición por instrucciones, inpainting, quitar fondo). Candidatos: OpenAI (modelo de imagen de la API), Google Imagen, Black Forest Labs (FLUX por API, incluida la línea de edición), Ideogram, Recraft, Midjourney (solo si hoy tiene API pública oficial), Stability AI (API), Adobe Firefly (API), Bria (API), ByteDance Seedream. 8 a 10 modelos.
