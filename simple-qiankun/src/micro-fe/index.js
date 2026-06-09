import { MicroFrontend } from './app-manager.js';

const microFrontend = new MicroFrontend();

export const registerMicroApps = microFrontend.registerMicroApps.bind(microFrontend);
export const start = microFrontend.start.bind(microFrontend);
export const prefetchApps = microFrontend.prefetchApps.bind(microFrontend);

export { MicroFrontend };
