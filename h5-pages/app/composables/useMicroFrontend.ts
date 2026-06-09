import { onMounted, onBeforeUnmount } from 'vue';

interface MicroFrontendOptions {
  name: string;
  entry: string;
  container: string;
  props?: Record<string, unknown>;
}

export function useMicroFrontend(opts: MicroFrontendOptions) {
  if (!import.meta.client) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any = null;

  onMounted(async () => {
    const { MicroApp } = await import('micro-fe-sdk');
    app = new MicroApp({
      name: opts.name,
      entry: opts.entry,
      container: opts.container,
      props: opts.props ?? {},
    });
    await app.mount();
  });

  onBeforeUnmount(async () => {
    await app?.unmount();
    app = null;
  });
}
