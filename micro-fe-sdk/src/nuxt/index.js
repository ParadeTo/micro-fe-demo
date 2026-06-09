import { defineNuxtModule } from '@nuxt/kit';

export default defineNuxtModule({
  meta: { name: 'micro-fe-sdk', configKey: 'microFe' },
  defaults: { vendorsUrl: '/shared/vendors.js' },
  setup(options, nuxt) {
    nuxt.options.app.head.script ??= [];
    nuxt.options.app.head.script.unshift({ src: options.vendorsUrl });
  },
});
