# Cómo escribir cada descripción (para subagentes)

Cada descripción la va a leer **Jev**, un clasificador que decide si un modelo sirve para la idea de proyecto que escribe un usuario (ej. "app para investigar biología", "transcribir reuniones"). Jev lee literal: gana con hechos concretos de tarea, dominio y límites; pierde con marketing.

## Regla de oro
**Solo lo que dice la fuente.** Nunca inventes capacidades, benchmarks, números, idiomas ni tamaños. Si la fuente no lo dice, no lo pongas. Los únicos límites que podés agregar sin que estén escritos son los que se siguen directo de la tarea o modalidad (un modelo de voz a texto no genera imágenes).

## Formato del campo `description`
En **inglés**, 50 a 100 palabras, prosa plana, en este orden:
1. Qué es, en una oración (tipo de modelo y quién lo hizo).
2. `Best at:` las tareas concretas que hace bien.
3. `Domains:` dominios o industrias, si la fuente los menciona.
4. `Typical uses:` 2 a 4 casos de uso concretos de producto.
5. `Not suited for:` 1 a 3 cosas que no hace.

Prohibido: "state-of-the-art", "powerful", "cutting-edge", "best-in-class", superlativos y cualquier número de benchmark.

## Salida
Escribí UN archivo JSON (el que te indiquen) con un array. Un objeto por modelo, en el mismo orden de entrada:

```json
{
  "id": "<id exacto de entrada>",
  "description": "<50-100 palabras>",
  "source_url": "<URL exacta de la página de la que sacaste los hechos>",
  "official_url": "<página oficial del modelo>",
  "confidence": "high | low",
  "notes": "<vacío, o por qué confidence es low>"
}
```

- `confidence: low` si la fuente era muy pobre o tuviste que deducir mucho.
- Si no encontrás ninguna fuente real para un modelo, igual incluí el objeto con `description: ""` y `confidence: "low"`. No lo rellenes de memoria.
- El JSON tiene que ser válido. Verificalo leyéndolo de nuevo después de escribirlo.
