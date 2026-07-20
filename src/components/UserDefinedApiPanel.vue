<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import ModalDialog from './ModalDialog.vue';
import API_MD from '@/assets/api.md?raw';
import API_TS from '@/assets/api.ts?raw';

const t = inject(I18N_KEY)!;
const ui = use_ui_states();

type Tab = 'md' | 'ts';
const active_tab = ref<Tab>('md');

const html = computed(() => {
    // render LaTeX math before markdown, so that math delimiters don't get mangled
    const with_math = API_MD.replace(/\$\$([\s\S]*?)\$\$/g, (_, math: string) => {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    }).replace(/\$([^$\n]+?)\$/g, (_, math: string) => {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    });
    return marked(with_math);
});

let editor_view: EditorView | null = null;
const editor_ref = ref<HTMLDivElement | null>(null);

function init_editor() {
    if (!editor_ref.value) return;
    if (editor_view) {
        editor_view.destroy();
        editor_view = null;
    }

    editor_view = new EditorView({
        state: EditorState.create({
            doc: API_TS,
            extensions: [
                lineNumbers(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                keymap.of(defaultKeymap),
                javascript(),
                EditorView.editable.of(false),
                EditorView.theme({
                    '&': {
                        width: '100%',
                        height: '480px',
                        maxWidth: '100%',
                        minWidth: '100%',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                    },
                    '.cm-scroller': {
                        overflow: 'auto',
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: '100%',
                    },
                    '.cm-content': {
                        minWidth: '0',
                    },
                    '.cm-gutters': {
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                    },
                }),
            ],
        }),
        parent: editor_ref.value,
    });
}

watch(active_tab, () => {
    if (active_tab.value === 'ts') {
        // wait for DOM update then init
        requestAnimationFrame(() => init_editor());
    }
});

onMounted(() => {
    if (active_tab.value === 'ts') {
        requestAnimationFrame(() => init_editor());
    }
});

onUnmounted(() => {
    if (editor_view) {
        editor_view.destroy();
        editor_view = null;
    }
});

function download() {
    const content = active_tab.value === 'md' ? API_MD : API_TS;
    const filename = active_tab.value === 'md' ? 'api.md' : 'api.ts';
    const type = active_tab.value === 'md' ? 'text/markdown' : 'text/typescript';
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
</script>

<template>
    <ModalDialog :show="ui.show_api_doc.value" title="API 文档" @close="ui.show_api_doc.value = false">
        <div class="api-tabs">
            <button
                class="api-tab"
                :class="{ 'api-tab--active': active_tab === 'md' }"
                @mousedown.prevent="active_tab = 'md'"
            >
                api.md
            </button>
            <button
                class="api-tab"
                :class="{ 'api-tab--active': active_tab === 'ts' }"
                @mousedown.prevent="active_tab = 'ts'"
            >
                api.ts
            </button>
        </div>
        <div v-if="active_tab === 'md'" class="api-content" v-html="html" />
        <div v-else ref="editor_ref" class="api-editor"></div>
        <button class="api-download" @mousedown="download">
            {{ active_tab === 'md' ? '下载 api.md' : '下载 api.ts' }}
        </button>
    </ModalDialog>
</template>

<style scoped>
:deep(.modal-dialog) {
    width: 640px !important;
    min-width: 640px !important;
    max-width: 640px !important;
}

:deep(.modal-body) {
    padding: 0;
    overflow: hidden;
}

.api-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border-subtle);
}

.api-tab {
    flex: 1;
    padding: 8px;
    border: none;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
}

.api-tab--active {
    background: var(--color-bg);
    color: var(--color-text);
    font-weight: 600;
}

.api-tab:not(:last-child) {
    border-right: 1px solid var(--color-border-subtle);
}

.api-content {
    width: 640px;
    height: 480px;
    overflow-y: auto;
    overflow-x: hidden;
    word-break: break-word;
    padding: 8px;
    box-sizing: border-box;
    color: var(--color-text);
    font-size: 14px;
    line-height: 1.6;
}

.api-content :deep(h1),
.api-content :deep(h2),
.api-content :deep(h3) {
    margin: 0.8em 0 0.4em;
}

.api-content :deep(p) {
    margin: 0.4em 0;
}

.api-content :deep(code) {
    background: var(--color-bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
}

.api-content :deep(pre) {
    background: var(--color-bg-secondary);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
}

.api-editor {
    width: 640px;
    height: 480px;
}

.api-download {
    display: block;
    margin: 12px auto 0;
    padding: 4px 16px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
}

.api-download:hover {
    background: var(--color-bg-hover);
}
</style>
