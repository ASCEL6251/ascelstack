// @ts-check
import { defineConfig } from 'astro/config';
import clerk from '@clerk/astro';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://ascelstack.com',
  output: 'static',
  adapter: cloudflare(),
  integrations: [clerk()],
});
