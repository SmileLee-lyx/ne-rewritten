/// <reference types="vite/client" />
// noinspection JSUnusedGlobalSymbols

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

interface Window {
    notations: Record<string, unknown>;
}
