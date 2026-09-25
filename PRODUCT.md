# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Astro (elegido con el criterio de Ramiro: "la tecnología más actualizada, con más soporte y más liviana; que se vea totalmente fluido y lindo"). Astro tiene adaptador oficial para Cloudflare Workers, que es el runtime de Webflow Cloud, y no envía JavaScript salvo en las islas interactivas. La escena es una isla de React con Three.js (React Three Fiber) y física 3D (Rapier). Deploy: Webflow Cloud.

## Users
Developers y builders que tienen una idea de proyecto y no saben qué modelo de IA usar entre miles. En la demo: el jurado de ingenieros de Webflow del Nerdearla App Showcase, probándola una o pocas veces.

## Product Purpose
Pasar de una idea escrita en una frase al modelo correcto en segundos. El usuario escribe qué quiere construir; de un montón de modelos se levantan los que sirven, rankeados, y los que tienen datos públicos se ubican en un gráfico costo vs. calidad. Éxito: que la primera búsqueda funcione y que el momento de ver los modelos clasificados en segundos impacte.

## Positioning
La clasificación la hace Jev, un modelo de decisión que evalúa cada modelo del catálogo contra la idea en paralelo, en uno o dos segundos. No es un buscador por palabras ni un chat que opina: cada modelo recibe una probabilidad de encaje contra su descripción curada.

## Operating Context
Una sola pantalla. Demo pública en una URL de Webflow Cloud, usada por pocas personas. La lógica de selección sigue a Chip Huyen (AI Engineering, cap. 4): atributos duros, información pública, balance calidad/costo/latencia.

## Capabilities and Constraints
- Catálogo estático de 243 modelos (`catalog/v2/catalog_v2.json`): 48 LLMs generales (36 con calidad y precio de Artificial Analysis), 138 modelos especializados de Hugging Face y 57 modelos de tareas específicas, la mayoría por API (voz, imagen, video, música, embeddings, OCR y moderación, 3D, series temporales). Los especializados no tienen benchmark.
- Jev vía Vercel AI Gateway, en tandas chicas (~19 preguntas) en paralelo con reintentos. Latencia medida: primera tanda ~0,5 s, catálogo completo ~1,5 s cuando el servicio no está saturado.
- Filtros manuales: costo máximo y velocidad, en el navegador.
- Switch "incluir modelos sin datos": suma modelos recomendados solo por encaje semántico, marcados como menos confiables; nunca van al gráfico.
- Click en un modelo levantado: abre su página oficial.
- Infraestructura de demo: un solo usuario. Caché y alta concurrencia quedan fuera de alcance.

## Brand Commitments
- Mundo visual de la página 100 Bucket List de ramirozapaia.com: papel con grano real, tinta, grafito para lo provisional, un solo acento cobalto y marcadores pastel ("fibrones") que marcan lo que cambió de estado.
- Composición del demo de Jev en Twitter: de un montón en el piso, los que cumplen la consulta son atraídos al centro y quedan en fila.
- Cada modelo es un objeto 3D definido por el logo de su creador, de tamaño estandarizado. No una moneda literal.
- El levantamiento es el protagonista. El gráfico se arma aparte, no sincronizado.

## Evidence on Hand
- `catalog/v2/catalog_v2.json`: 243 fichas con vocabulario cerrado, con fuentes y link oficial verificados.
- Números de Artificial Analysis (índice de inteligencia, precio combinado, velocidad). Atribución obligatoria: "Datos de benchmark: Artificial Analysis".
- No hay testimonios, usuarios ni métricas de uso: no se inventan.

## Product Principles
- Mostrar solo lo que hay: un modelo sin números no se grafica; un resultado parcial se muestra como parcial.
- La velocidad es el argumento: nada debe tapar el momento en que los modelos se levantan.
- Cada recomendación es trazable: fuente y página oficial a un click.
