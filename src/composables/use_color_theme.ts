import { inject } from 'vue';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';

export interface ColorTheme {
    id: string;
    label_key: string;
    vars: Record<string, string>;
}

export const themes: ColorTheme[] = [
    {
        id: 'default',
        label_key: 'theme.default',
        vars: {
            '--color-text': '#000',
            '--color-text-secondary': '#888',
            '--color-text-muted': '#999',
            '--color-primary': '#90f',
            '--color-primary-hover': '#c8f',
            '--color-primary-active': '#60a',
            '--color-primary-bg': '#daf',
            '--color-category': '#f90',
            '--color-category-hover': '#fd9',
            '--color-category-bg': '#feb',
            '--color-accent': '#06c',
            '--color-accent-hover': '#08e',
            '--color-accent-active': '#048',
            '--color-accent-bg': '#cdf',
            '--color-danger': '#c00',
            '--color-success': '#080',
            '--color-border': '#999',
            '--color-border-light': '#ddd',
            '--color-border-subtle': '#eee',
            '--color-bg': '#fff',
            '--color-bg-secondary': '#f8f8f8',
            '--color-bg-hover': '#e8e8e8',
            '--color-bg-active': '#d0d0d0',
            '--color-tree-hover': '#cff',
            '--color-tree-analyzed': '#eee',
            '--color-tree-analyzed-hover': '#bee',
            '--color-selected': '#cfc',
            '--color-selected-hover': '#afa',
            '--color-shadow': 'rgba(0,0,0,0.15)',
            '--color-overlay': 'rgba(0,0,0,0.35)',
        },
    },
    {
        id: 'dark',
        label_key: 'theme.dark',
        vars: {
            '--color-text': '#cdd6f4',
            '--color-text-secondary': '#6c7086',
            '--color-text-muted': '#6c7086',
            '--color-primary': '#c8a0ff',
            '--color-primary-hover': '#b388ff',
            '--color-primary-active': '#b388ff',
            '--color-primary-bg': '#3b2a5e',
            '--color-category': '#ffb347',
            '--color-category-hover': '#ffa01a',
            '--color-category-bg': '#4a3520',
            '--color-accent': '#89b4fa',
            '--color-accent-hover': '#9fc4ff',
            '--color-accent-active': '#6a9fd8',
            '--color-accent-bg': '#2a3a5e',
            '--color-danger': '#f38ba8',
            '--color-success': '#a6e3a1',
            '--color-border': '#585b70',
            '--color-border-light': '#45475a',
            '--color-border-subtle': '#313244',
            '--color-bg': '#1e1e2e',
            '--color-bg-secondary': '#2a2a3d',
            '--color-bg-hover': '#35354a',
            '--color-bg-active': '#404060',
            '--color-tree-hover': '#252540',
            '--color-tree-analyzed': '#272738',
            '--color-tree-analyzed-hover': '#2a3840',
            '--color-selected': '#2a4a2a',
            '--color-selected-hover': '#3a6a3a',
            '--color-shadow': 'rgba(0,0,0,0.4)',
            '--color-overlay': 'rgba(0,0,0,0.6)',
        },
    },
    {
        id: 'high-contrast',
        label_key: 'theme.high-contrast',
        vars: {
            '--color-text': '#000',
            '--color-text-secondary': '#555',
            '--color-text-muted': '#666',
            '--color-primary': '#50f',
            '--color-primary-hover': '#70f',
            '--color-primary-active': '#50f',
            '--color-primary-bg': '#d0b0ff',
            '--color-category': '#e65c00',
            '--color-category-hover': '#ff7b00',
            '--color-category-bg': '#ffe0b0',
            '--color-accent': '#06c',
            '--color-accent-hover': '#07e',
            '--color-accent-active': '#035',
            '--color-accent-bg': '#cdf',
            '--color-danger': '#c00',
            '--color-success': '#080',
            '--color-border': '#000',
            '--color-border-light': '#000',
            '--color-border-subtle': '#ccc',
            '--color-bg': '#fff',
            '--color-bg-secondary': '#e8e8e8',
            '--color-bg-hover': '#d0d0d0',
            '--color-bg-active': '#bbb',
            '--color-tree-hover': '#cff',
            '--color-tree-analyzed': '#eee',
            '--color-tree-analyzed-hover': '#bee',
            '--color-selected': '#cfc',
            '--color-selected-hover': '#afa',
            '--color-shadow': 'rgba(0,0,0,0.3)',
            '--color-overlay': 'rgba(0,0,0,0.5)',
        },
    },
    {
        id: 'high-contrast-dark',
        label_key: 'theme.high-contrast-dark',
        vars: {
            '--color-text': '#fff',
            '--color-text-secondary': '#bbb',
            '--color-text-muted': '#888',
            '--color-primary': '#b366ff',
            '--color-primary-hover': '#d499ff',
            '--color-primary-active': '#fff',
            '--color-primary-bg': '#4a0072',
            '--color-category': '#ff8c00',
            '--color-category-hover': '#ffaa33',
            '--color-category-bg': '#5c3300',
            '--color-accent': '#66b3ff',
            '--color-accent-hover': '#88ccff',
            '--color-accent-active': '#4499ee',
            '--color-accent-bg': '#1a3a5e',
            '--color-danger': '#ff4444',
            '--color-success': '#44cc44',
            '--color-border': '#666',
            '--color-border-light': '#555',
            '--color-border-subtle': '#333',
            '--color-bg': '#0d0d0d',
            '--color-bg-secondary': '#1a1a1a',
            '--color-bg-hover': '#2a2a2a',
            '--color-bg-active': '#3a3a3a',
            '--color-tree-hover': '#1a2a3a',
            '--color-tree-analyzed': '#1a1a2a',
            '--color-tree-analyzed-hover': '#1a2a3a',
            '--color-selected': '#1a3a1a',
            '--color-selected-hover': '#2a4a2a',
            '--color-shadow': 'rgba(0,0,0,0.5)',
            '--color-overlay': 'rgba(0,0,0,0.7)',
        },
    },
];

export function apply_color_theme(theme_id: string): void {
    const theme = themes.find((t) => t.id === theme_id) ?? themes[0];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) {
        root.style.setProperty(key, value);
    }
}

export function use_color_theme() {
    const settings = inject(SETTINGS_KEY)!;

    function init_theme() {
        apply_color_theme(settings.color_scheme ?? 'default');
    }

    function set_theme(id: string) {
        settings.color_scheme = id;
        apply_color_theme(id);
    }

    return { init_theme, set_theme, themes };
}
