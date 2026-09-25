// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',            // la página es liviana; /api/match corre en el Worker
  adapter: cloudflare(),
  integrations: [react()],
  security: { checkOrigin: false },
  env: {
    // Jev habla el protocolo de TypeSafe. URL y modelo son variables para poder
    // cambiar a Kev u otro clon sin tocar código.
    schema: {
      AI_GATEWAY_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      JEV_BASE_URL: envField.string({ context: 'server', access: 'public', default: 'https://ai-gateway.vercel.sh/typesafe' }),
      JEV_MODEL: envField.string({ context: 'server', access: 'public', default: 'typesafe-ai/jev' }),
    },
  },
});
