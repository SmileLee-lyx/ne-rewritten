<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import {
    drawSelection,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap, history } from '@codemirror/commands';
import { closeBrackets } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { get_script_warnings, reload_all } from '@/core/user_defined_notation.ts';
import type { UserScript } from '@/core/settings.ts';
import ModalDialog from './ModalDialog.vue';
import TEMPLATE_JS from '@/assets/template.js?raw';

const t = inject(I18N_KEY)!;
const settings = inject(SETTINGS_KEY)!;
const ui = use_ui_states();

const scripts = computed(() => settings.user_scripts);
const active_tab = ref(0);
const is_renaming = ref(false);
const rename_input = ref('');
const editor_ref = ref<HTMLDivElement | null>(null);
const show_delete_confirm = ref(false);
const delete_target_idx = ref(0);
const show_new_dialog = ref(false);
const new_script_name = ref('');
let editor_view: EditorView | null = null;

const current_script = computed<UserScript | undefined>(() => scripts.value[active_tab.value]);

const warnings = computed(() => {
    ui.registry_notifier.listen();
    return get_script_warnings();
});

function has_warning(file_name: string): boolean {
    return warnings.value.has(file_name);
}

function save_scripts(): void {
    settings.user_scripts = [...scripts.value];
}

function new_script(): void {
    sync_editor();
    const base = 'untitled';
    let n = 1;
    while (scripts.value.some((s) => s.file_name === `${base}_${n}`)) n++;
    new_script_name.value = `${base}_${n}`;
    show_new_dialog.value = true;
    nextTick(() => {
        const input = document.querySelector('.new-name-input') as HTMLInputElement;
        input?.focus();
        input?.select();
    });
}

function do_create_script(): void {
    const name = new_script_name.value.trim();
    if (!name) return;
    // 确保名称不重复
    let final_name = name;
    let n = 1;
    while (scripts.value.some((s) => s.file_name === final_name)) {
        final_name = `${name}_${n}`;
        n++;
    }
    const new_s: UserScript = { file_name: final_name, code: '', enabled: false };
    settings.user_scripts = [...scripts.value, new_s];
    active_tab.value = scripts.value.length - 1;
    show_new_dialog.value = false;
}

function sync_editor(): void {
    if (!current_script.value || !editor_view) return;
    current_script.value.code = editor_view.state.doc.toString();
}

function confirm_delete(idx: number): void {
    sync_editor();
    delete_target_idx.value = idx;
    show_delete_confirm.value = true;
}

function do_delete(): void {
    const idx = delete_target_idx.value;
    show_delete_confirm.value = false;
    if (scripts.value[idx]?.enabled) {
        scripts.value[idx].enabled = false;
    }
    const new_scripts = scripts.value.filter((_, i) => i !== idx);
    settings.user_scripts = new_scripts;
    if (active_tab.value >= new_scripts.length) active_tab.value = Math.max(0, new_scripts.length - 1);
    reload_all(settings.user_scripts);
}

function add_template(): void {
    sync_editor();
    const name = 'template';
    let final_name = name;
    let n = 1;
    while (scripts.value.some((s) => s.file_name === final_name)) {
        final_name = `${name}_${n}`;
        n++;
    }
    const new_s: UserScript = { file_name: final_name, code: TEMPLATE_JS, enabled: false };
    settings.user_scripts = [...scripts.value, new_s];
    active_tab.value = scripts.value.length - 1;
}

function start_rename(): void {
    if (!current_script.value) return;
    is_renaming.value = true;
    rename_input.value = current_script.value.file_name;
    nextTick(() => {
        const input = document.querySelector('.rename-input') as HTMLInputElement;
        input?.focus();
        input?.select();
    });
}

function finish_rename(): void {
    if (!is_renaming.value || !current_script.value) return;
    const new_name = rename_input.value.trim();
    if (new_name) {
        current_script.value.file_name = new_name;
        save_scripts();
    }
    is_renaming.value = false;
}

function toggle_enable(): void {
    const sc = current_script.value;
    if (!sc) return;
    sync_editor();
    sc.enabled = !sc.enabled;
    save_scripts();
    reload_all(settings.user_scripts);
}

function move_tab(from: number, to: number): void {
    if (to < 0 || to >= scripts.value.length) return;
    const arr = [...scripts.value];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    settings.user_scripts = arr;
    active_tab.value = to;
    reload_all(settings.user_scripts);
}

// Drag and drop
let drag_idx: number | null = null;

function on_dragstart(idx: number): void {
    drag_idx = idx;
}

function on_dragover(e: DragEvent, idx: number): void {
    e.preventDefault();
    if (drag_idx === null || drag_idx === idx) return;
}

function on_drop(idx: number): void {
    if (drag_idx === null || drag_idx === idx) return;
    move_tab(drag_idx, idx);
    drag_idx = null;
}

// File upload
function upload_file(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const code = reader.result as string;
            const file_name = file.name.replace(/\.js$/i, '');
            const new_s: UserScript = { file_name, code, enabled: false };
            settings.user_scripts = [...scripts.value, new_s];
            active_tab.value = scripts.value.length - 1;
        };
        reader.readAsText(file);
    };
    input.click();
}

// CodeMirror editor
// NOTE: CM6 的 Compartment 不能跨 EditorView 实例复用，所以每次创建独立的 Compartment。
// 所有保存逻辑集中到 init_editor_inner/init_editor：在销毁旧编辑器前自动保存内容到对应脚本。
// 这样 @click 里不再需要 sync_editor()，避免时序问题。

function init_editor(): void {
    if (!editor_ref.value) return;
    init_editor_inner(!(current_script.value?.enabled ?? false));
}

function init_editor_inner(editable: boolean): void {
    if (!editor_ref.value) return;
    if (editor_view) {
        editor_view.destroy();
        editor_view = null;
    }

    const doc_code = current_script.value?.code ?? '';

    // 每个 EditorView 实例使用独立的 Compartment
    const ec = new Compartment();

    editor_view = new EditorView({
        state: EditorState.create({
            doc: doc_code,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                history(),
                drawSelection(),
                highlightActiveLine(),
                indentOnInput(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                bracketMatching(),
                closeBrackets(),
                ec.of(EditorView.editable.of(editable)),
                keymap.of(defaultKeymap),
                javascript(),
                EditorView.theme({
                    '&': {
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: '100%',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)',
                    },
                    '.cm-scroller': { overflowX: 'auto', width: '100%', maxWidth: '100%', minWidth: '100%' },
                    '.cm-content': { minWidth: '0' },
                    '.cm-gutters': {
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                    },
                    '.cm-activeLineGutter': {
                        backgroundColor: 'var(--color-bg-hover)',
                    },
                    '.cm-activeLine': {
                        backgroundColor: 'var(--color-bg-active)',
                    },
                    '.cm-cursor': {
                        borderLeftColor: 'var(--color-text)',
                    },
                    '.cm-selectionBackground': {
                        backgroundColor: 'var(--color-primary-bg)',
                    },
                    '.cm-matchingBracket': {
                        backgroundColor: 'var(--color-selected)',
                        outline: 'none',
                    },
                    '.cm-nonmatchingBracket': {
                        border: '1px solid var(--color-danger)',
                    },
                }),
            ],
        }),
        parent: editor_ref.value,
    });
}

function set_editable(editable: boolean): void {
    if (!editor_view) return;
    init_editor_inner(editable);
}

// Tab 切换 —— 保存旧内容并重建编辑器
watch(current_script, (new_sc, old_sc) => {
    if (new_sc?.file_name !== old_sc?.file_name) {
        nextTick(() => {
            if (editor_view && old_sc) {
                old_sc.code = editor_view.state.doc.toString();
            }
            init_editor_inner(!(new_sc?.enabled ?? false));
        });
    }
});

// 启用/停用 —— 切换编辑器的可编辑状态
watch(
    () => current_script.value?.enabled,
    (enabled) => {
        if (enabled === undefined) return;
        nextTick(() => set_editable(!enabled));
    },
);

// Panel 打开时重建编辑器
watch(
    () => ui.show_user_defined.value,
    (show) => {
        if (show) nextTick(init_editor);
    },
);

// 打印脚本 warning
watch(warnings, (w) => {
    for (const [file, msgs] of w) {
        console.log(`[WARN] ${file}:`, msgs);
    }
});
</script>

<template>
    <ModalDialog
        :show="ui.show_user_defined.value"
        :title="t('user-defined.title')"
        @close="
            sync_editor();
            ui.show_user_defined.value = false;
        "
    >
        <div class="ud-layout">
            <!-- Left: tab list -->
            <div class="ud-tabs">
                <div
                    v-for="(sc, idx) in scripts"
                    :key="idx"
                    class="ud-tab"
                    :class="{ active: idx === active_tab, enabled: sc.enabled }"
                    draggable="true"
                    @dragstart="on_dragstart(idx)"
                    @dragover="on_dragover($event, idx)"
                    @drop="on_drop(idx)"
                    @click="active_tab = idx"
                >
                    <span
                        v-if="has_warning(sc.file_name)"
                        class="ud-warn"
                        :title="warnings.get(sc.file_name)?.join('\n')"
                        >⚠</span
                    >
                    <span class="ud-tab-name">{{ sc.file_name }}</span>
                    <span v-if="sc.enabled" class="ud-tab-status">{{ t('user-defined.enable') }}</span>
                </div>
                <button class="ud-btn ud-btn-new" @mousedown.prevent="new_script">{{ t('user-defined.new') }}</button>
            </div>

            <!-- Center: CodeMirror editor -->
            <div class="ud-editor-area">
                <div v-if="is_renaming" class="ud-rename-bar">
                    <input
                        class="rename-input"
                        v-model="rename_input"
                        @keydown.enter="finish_rename"
                        @keydown.escape="is_renaming = false"
                        @blur="finish_rename"
                    />
                </div>
                <div v-if="scripts.length > 0" ref="editor_ref" class="ud-cm-editor"></div>
                <div v-else class="ud-editor-empty">{{ t('user-defined.no-script') }}</div>
            </div>

            <!-- Right: buttons -->
            <div class="ud-buttons">
                <button class="ud-btn" :disabled="!current_script" @mousedown.prevent="toggle_enable">
                    {{ current_script?.enabled ? t('user-defined.disable') : t('user-defined.enable') }}
                </button>
                <button class="ud-btn" :disabled="!current_script" @mousedown.prevent="start_rename">
                    {{ t('user-defined.rename') }}
                </button>
                <button
                    class="ud-btn ud-btn-danger"
                    :disabled="!current_script"
                    @mousedown.prevent="confirm_delete(active_tab)"
                >
                    {{ t('user-defined.delete') }}
                </button>
                <button class="ud-btn" @mousedown.prevent="upload_file">
                    {{ t('user-defined.upload') }}
                </button>
                <button class="ud-btn" @mousedown.prevent="add_template">
                    {{ t('user-defined.template') }}
                </button>
            </div>
        </div>
    </ModalDialog>

    <ModalDialog :show="show_delete_confirm" :title="t('user-defined.delete')" @close="show_delete_confirm = false">
        <p class="delete-message">{{ t('user-defined.delete-confirm') }}</p>
        <div class="delete-buttons">
            <button class="delete-btn-cancel" @mousedown="show_delete_confirm = false">
                {{ t('user-defined.cancel') }}
            </button>
            <button class="delete-btn-confirm" @mousedown="do_delete">{{ t('user-defined.confirm-delete') }}</button>
        </div>
    </ModalDialog>

    <ModalDialog :show="show_new_dialog" :title="t('user-defined.new')" @close="show_new_dialog = false">
        <input
            class="new-name-input"
            v-model="new_script_name"
            @keydown.enter="do_create_script"
            @keydown.escape="show_new_dialog = false"
        />
        <div class="new-buttons">
            <button class="new-btn-cancel" @mousedown="show_new_dialog = false">{{ t('user-defined.cancel') }}</button>
            <button class="new-btn-confirm" @mousedown="do_create_script">{{ t('user-defined.create') }}</button>
        </div>
    </ModalDialog>
</template>

<style scoped>
.ud-layout {
    display: flex;
    gap: 12px;
    min-height: 400px;
    height: 60vh;
    min-width: 500px;
}

/* ---- Left tabs ---- */
.ud-tabs {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
    border-right: 1px solid var(--color-border-light);
    padding-right: 8px;
    overflow-y: auto;
}

.ud-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--color-text);
    user-select: none;
}

.ud-tab:hover {
    background: var(--color-bg-hover);
}

.ud-tab.active {
    background: var(--color-primary-bg);
    color: var(--color-text);
}

.ud-tab.enabled {
    opacity: 0.6;
}

.ud-tab-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ud-tab-status {
    font-size: 11px;
    color: var(--color-text-secondary);
}

.ud-warn {
    color: var(--color-danger);
    font-size: 14px;
}

/* ---- Editor ---- */
.ud-editor-area {
    flex: none;
    width: 500px;
    display: flex;
    flex-direction: column;
}

.ud-rename-bar {
    padding: 4px 0;
}

.rename-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    background: var(--color-bg);
    color: var(--color-text);
    outline: none;
    box-sizing: border-box;
}

.rename-input:focus {
    border-color: var(--color-accent);
}

.delete-message {
    color: var(--color-text);
    font-size: 14px;
    margin: 0 0 16px;
    line-height: 1.5;
}

.delete-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.delete-btn-confirm {
    padding: 6px 16px;
    border: 1px solid var(--color-danger);
    border-radius: 5px;
    background: var(--color-danger);
    color: var(--color-bg);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
}

.delete-btn-confirm:hover {
    opacity: 0.85;
}

.delete-btn-cancel {
    padding: 6px 16px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
}

.delete-btn-cancel:hover {
    background: var(--color-bg-hover);
}

.new-name-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    background: var(--color-bg);
    color: var(--color-text);
    outline: none;
    box-sizing: border-box;
    margin-bottom: 16px;
}

.new-name-input:focus {
    border-color: var(--color-accent);
}

.new-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.new-btn-confirm {
    padding: 6px 16px;
    border: 1px solid var(--color-accent);
    border-radius: 5px;
    background: var(--color-accent);
    color: var(--color-bg);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
}

.new-btn-confirm:hover {
    opacity: 0.85;
}

.new-btn-cancel {
    padding: 6px 16px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
}

.new-btn-cancel:hover {
    background: var(--color-bg-hover);
}

.ud-cm-editor {
    flex: 1;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
}

.ud-editor-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    font-size: 14px;
}

.ud-cm-editor :deep(.cm-editor) {
    height: 100%;
}

/* ---- Right buttons ---- */
.ud-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 80px;
}

.ud-btn {
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    text-align: center;
    white-space: nowrap;
}

.ud-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
}

.ud-btn:disabled {
    opacity: 0.4;
    cursor: default;
}

.ud-btn-danger {
    color: var(--color-danger);
    border-color: var(--color-danger);
}

.ud-btn-danger:hover:not(:disabled) {
    background: var(--color-danger);
    color: var(--color-bg);
}

.ud-btn-new {
    margin-top: 4px;
    border-style: dashed;
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.ud-btn-new:hover {
    background: var(--color-accent);
    color: var(--color-bg);
}
</style>
