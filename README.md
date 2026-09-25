# ¿Qué modelo uso?

Type what you want to build. From a pile of 243 AI models, the ones that fit rise and line up in a row, classified in a couple of seconds by [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One model.

Built for the **Webflow × Nerdearla App Showcase** (September 2026). The interface is in Spanish.

## How it works

1. **The catalog.** 243 models in three layers: 48 general LLMs listed on OpenRouter, 36 of them with Artificial Analysis quality and price numbers; 138 specialized Hugging Face models; and 57 task-specific models, most of them served by API (speech, image, video, music, embeddings and rerankers, OCR and moderation, 3D, time series). Each one has a factual card with a closed vocabulary (kind, inputs and outputs, access, what it is best at, product uses, what it is not for), written only from its official sources.
2. **The question.** For every model, Jev gets one yes/no question: *"Would the model described in `model` perform the core task of the product described in `idea`?"* It returns a probability.
3. **The waves.** The catalog goes out in parallel batches of ~19 models (13 today; the count follows the catalog size) to `/api/match`. Each batch that comes back is one wave of tokens rising. The server retries 503/429 responses (honoring `retry-after`) inside a 10 s budget per batch, so a slow batch shows up as a partial result instead of a stuck counter.
4. **The row.** Models above 0.5 are ranked and the top 10 line up. Each one carries Jev's confidence.
5. **The chart.** Cost vs. quality for the risen models that have benchmark data, with the Pareto frontier ("lo mejor por tu plata") highlighted, following Chip Huyen's model-selection workflow. Enlarged, the 3D tokens land on their own points; models without public benchmarks go to the margin.
6. **Filters.** Max cost and min speed, applied instantly on the client. With a filter on, a model with no data for it does not pass.

## Stack

- [Astro](https://astro.build) 7 on the Cloudflare adapter (Webflow Cloud's runtime), `output: 'server'`
- React 19, three.js, React Three Fiber and Rapier physics for the pile
- Jev through Vercel AI Gateway (`POST /typesafe/v1/systemone`, model `typesafe-ai/jev`)

## Layout

```
app/       the Astro app (this is what Webflow Cloud deploys)
catalog/   how the catalog was built: selection scripts and build_catalog.py; v2/ holds the cards, their validator and merge.py
PRODUCT.md product and design context
```

## Run locally

```bash
cd app
pnpm install
echo "AI_GATEWAY_API_KEY=your-key" > .dev.vars
pnpm dev
```

`JEV_BASE_URL` and `JEV_MODEL` are optional and default to the Vercel AI Gateway endpoint and `typesafe-ai/jev`.

## Deploy

Webflow Cloud, with the app path set to `app/` and `AI_GATEWAY_API_KEY` as a secret environment variable.

## Data and credits

- Benchmark numbers (quality index, blended price, speed): [Artificial Analysis](https://artificialanalysis.ai/)
- LLM list: [OpenRouter](https://openrouter.ai/). Specialized models and most logos: [Hugging Face](https://huggingface.co/)
- Color brand icons for some creators: [LobeHub Icons](https://github.com/lobehub/lobe-icons) (MIT); a few more from the creators' Hugging Face avatars

The raw API dumps and model cards used to build the catalog are not committed. `catalog/build_catalog.py` expects them in `catalog/raw/`.
