<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { get_notation, list_notations } from '@/core/registry';
import type { TreeNode } from '@/core/tree';
import { init_dataset } from '@/core/tree';
import NotationTree from '@/components/NotationTree.vue';
import { focus_node, focus_node_input, get_last_focus } from '@/composables/use_focus_tracker.ts';
import { export_analysis, import_analysis } from '@/core/analysis';
import { download_buffer, export_to_xlsx, import_from_xlsx } from '@/core/xlsx_io';
import { resolve_display } from '@/utils';
import { use_diagram } from '@/composables/use_diagram.ts';
import DiagramViewer from '@/components/DiagramViewer.vue';
import HotkeyDialog from '@/components/HotkeyDialog.vue';

const settings = inject(SETTINGS_KEY)!;
const { diagram, visible, pos_x, pos_y, hide } = use_diagram();
const settings_collapsed = ref(true);
const is_flashing = ref(false);
const flash_show_simple = ref(false);
let flash_timer: ReturnType<typeof setInterval> | null = null;

function start_flash() {
    is_flashing.value = true;
    flash_show_simple.value = false;
    flash_timer = setInterval(() => {
        flash_show_simple.value = !flash_show_simple.value;
    }, 800);
}

function stop_flash() {
    is_flashing.value = false;
    if (flash_timer !== null) {
        clearInterval(flash_timer);
        flash_timer = null;
    }
}

watch(
    () => settings.font_family,
    (v) => {
        document.body.style.fontFamily = v + ', sans-serif';
    },
    { immediate: true },
);
const font_options = ['Comic Sans MS', 'Consolas', 'Microsoft YaHei UI'];

const notations = list_notations();

const trees: Map<string, TreeNode<unknown>> = reactive(new Map());

function get_or_create_tree(id: string): TreeNode<unknown> | null {
    let root = trees.get(id);
    if (!root) {
        const n = get_notation(id);
        if (!n) return null;
        root = reactive(init_dataset(n));
        trees.set(id, root);
    }
    return root;
}

const current_id = computed(() => settings.current_notation_id);
const root = computed(() => get_or_create_tree(current_id.value));
const notation = computed(() => get_notation(current_id.value));
const equiv_options = computed(() => {
    const n = notation.value;
    return n?.display_equiv ? Object.keys(n.display_equiv) : [];
});

const tier_names = ['small', 'single', 'double', 'triple', 'quadruple', 'quintuple', 'sextuple', 'septuple', 'octuple'];

const tier_name = computed(() => {
    const t = settings.tier;
    if (0 <= t && t <= 7) return tier_names[t] + ' expansion';
    return t + '-fold expansion';
});

const file_input = ref<HTMLInputElement>();
const show_hotkeys = ref(false);

const ANALYSIS_STORAGE_PREFIX = 'ne-analysis-';
let auto_save_timer: ReturnType<typeof setInterval> | null = null;
let save_indicator_timer: ReturnType<typeof setInterval> | null = null;

const last_save_time = ref(Date.now());
const save_indicator = ref('');

function update_save_indicator() {
    const elapsed = Math.floor((Date.now() - last_save_time.value) / 1000);
    if (elapsed < 60) save_indicator.value = elapsed + 's';
    else save_indicator.value = Math.floor(elapsed / 60) + 'm' + (elapsed % 60) + 's';
}

function save_analysis() {
    const n = notation.value;
    const r = root.value;
    if (!n || !r) return;
    const entries = export_analysis(r);
    localStorage.setItem(ANALYSIS_STORAGE_PREFIX + n.id, JSON.stringify(entries));
    last_save_time.value = Date.now();
    update_save_indicator();
}

function load_analysis(id: string, r: TreeNode<unknown>) {
    const n = get_notation(id);
    if (!n) return;
    const raw = localStorage.getItem(ANALYSIS_STORAGE_PREFIX + id);
    if (!raw) return;
    try {
        const entries: any[] = JSON.parse(raw);
        import_analysis(r, entries, n as any, settings.variant, settings.max_find_fs);
    } catch {
        /* ignore corrupt data */
    }
}

watch(root, (r, old) => {
    if (r && r !== old) load_analysis(current_id.value, r);
});
watch(
    () => settings.current_notation_id,
    () => {
        const r = root.value;
        if (r) load_analysis(current_id.value, r);
    },
);

function handle_reset() {
    const n = notation.value;
    if (!n || !confirm('Reset this notation? All expanded data will be lost.')) return;
    localStorage.removeItem(ANALYSIS_STORAGE_PREFIX + n.id);
    const root: TreeNode<unknown> = reactive(init_dataset(n));
    trees.set(n.id, root);
}

async function handle_export() {
    const n = notation.value;
    const r = root.value;
    if (!n || !r) return;
    const entries = export_analysis(r);
    const equiv_name = settings.equiv_active[n.id];
    const disp =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name]).plain
            : resolve_display(n.display).plain;
    const buf = await export_to_xlsx(entries, disp);
    download_buffer(buf, `${n.id}_analysis.xlsx`);
}

async function handle_import() {
    file_input.value?.click();
}

async function on_file_selected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const n = notation.value;
    const r = root.value;
    if (!n || !r) return;
    const equiv_name = settings.equiv_active[n.id];
    const disp_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!disp_spec.from_display) return;

    const buf = await file.arrayBuffer();
    const entries = await import_from_xlsx(buf, disp_spec.from_display);
    const matched = import_analysis(r, entries, n as any, settings.variant, settings.max_find_fs);
    if (matched.length > 0) {
        const last = matched[matched.length - 1];
        const ed = (last.extraData ??= {}) as any;
        ed.focus_on_mounted = true;
    }
    input.value = '';
}

const find_input = ref<HTMLInputElement>();

function handle_find() {
    const n = notation.value;
    const r = root.value;
    const val = find_input.value?.value;
    if (!n || !r || !val) return;
    const equiv_name = settings.equiv_active[n.id];
    const disp_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!disp_spec.from_display) return;
    try {
        const expr = disp_spec.from_display(val);
        const matched = import_analysis(r, [{ expr, analysis: [] }], n as any, settings.variant, settings.max_find_fs);
        if (matched.length > 0) {
            focus_node_input(matched[0] as any);
        }
    } catch (_) {}
}

function on_find_keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handle_find();
    }
}

function on_global_keydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !['c', 'v', 'a', 'x', 'z', 'r'].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
    if (e.key.toLowerCase() === 'r' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const path = get_last_focus();
        if (path) focus_node(path);
    }
    if (e.key.toLowerCase() === 's' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handle_export();
    }
    if (e.key.toLowerCase() === 'l' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handle_import();
    }
}

onMounted(() => {
    document.addEventListener('keydown', on_global_keydown);
    auto_save_timer = setInterval(save_analysis, 30000);
    window.addEventListener('beforeunload', save_analysis);
    update_save_indicator();
    save_indicator_timer = setInterval(update_save_indicator, 1000);
    const r = root.value;
    if (r) load_analysis(current_id.value, r);
});
onUnmounted(() => {
    document.removeEventListener('keydown', on_global_keydown);
    if (auto_save_timer !== null) clearInterval(auto_save_timer);
    if (save_indicator_timer !== null) clearInterval(save_indicator_timer);
    window.removeEventListener('beforeunload', save_analysis);
});
</script>

<template>
    <div>
        <div class="tab">
            <button
                v-for="n in notations"
                :key="n.id"
                :disabled="n.id === settings.current_notation_id"
                @mousedown="settings.current_notation_id = n.id"
            >
                <span v-if="n.simple_name && settings.notation_name_mode === 'full'" class="tab-stack">
                    <span :class="{ active: !is_flashing || !flash_show_simple }">{{ n.name }}</span>
                    <span :class="{ active: is_flashing && flash_show_simple }">{{ n.simple_name }}</span>
                </span>
                <span v-else>{{ settings.notation_name_mode === 'simple' ? (n.simple_name ?? n.name) : n.name }}</span>
            </button>
        </div>

        <div class="settings-box">
            <div class="toolbar">
                <div class="toolbar-row">
                    <span
                        style="margin-right: 8px"
                        @mouseenter="settings.notation_name_mode === 'full' && start_flash()"
                        @mouseleave="stop_flash"
                    >
                        Notation name:
                        <button
                            class="toggle-btn"
                            @mousedown="
                                settings.notation_name_mode = settings.notation_name_mode === 'full' ? 'simple' : 'full'
                            "
                        >
                            {{ settings.notation_name_mode }}
                        </button>
                    </span>
                </div>
                <div class="toolbar-row">
                    <label>
                        Navigate to:
                        <input ref="find_input" type="text" @keydown="on_find_keydown" />
                        <button @mousedown.prevent="handle_find">Find</button>
                    </label>
                    <label>
                        max FS:
                        <input
                            type="number"
                            min="1"
                            max="9999"
                            v-model.number="settings.max_find_fs"
                            style="width: 60px; vertical-align: middle"
                        />
                    </label>
                </div>
                <div class="toolbar-row">
                    <label>
                        FS variant:
                        <select v-model="settings.variant" @mousedown.stop>
                            <option value="FS">normal</option>
                            <option value="FS_alter">alternative</option>
                            <option value="FS_short">short</option>
                        </select>
                    </label>
                </div>
                <div class="toolbar-row">
                    <button class="reset-btn" @mousedown="handle_reset">Reset</button>
                    <button @mousedown="handle_export">Export</button>
                    <button @mousedown="handle_import">Import</button>
                    <button @mousedown="save_analysis">Save</button>
                    <button @mousedown="show_hotkeys = true">Hotkeys</button>
                    <input
                        ref="file_input"
                        type="file"
                        accept=".xlsx"
                        style="display: none"
                        @change="on_file_selected"
                    />
                </div>
                <div v-if="!settings_collapsed && equiv_options.length > 0" class="toolbar-row">
                    <label>
                        Equivalent notation:
                        <select
                            :value="settings.equiv_active[current_id] ?? ''"
                            @mousedown.stop
                            @change="
                                (e: any) => {
                                    settings.equiv_active = {
                                        ...settings.equiv_active,
                                        [current_id]: (e.target as HTMLSelectElement).value || undefined,
                                    };
                                }
                            "
                        >
                            <option value="">(none)</option>
                            <option v-for="k in equiv_options" :key="k" :value="k">
                                {{ k }}
                            </option>
                        </select>
                    </label>
                    <label style="margin-left: 8px" v-if="settings.equiv_active[current_id]">
                        <input
                            type="checkbox"
                            :checked="settings.equiv_hide_original[current_id] ?? true"
                            @change="
                                (e: any) => {
                                    settings.equiv_hide_original = {
                                        ...settings.equiv_hide_original,
                                        [current_id]: (e.target as HTMLInputElement).checked,
                                    };
                                }
                            "
                        />
                        Hide original
                    </label>
                </div>
                <div v-if="!settings_collapsed" class="toolbar-row">
                    <span style="margin-right: 8px">
                        Display:
                        <button
                            class="toggle-btn"
                            @mousedown="settings.display_html_mode = !settings.display_html_mode"
                        >
                            {{ settings.display_html_mode ? 'html' : 'plain' }}
                        </button>
                    </span>
                    <span>
                        Tier:
                        <button class="tier-btn" @mousedown="settings.tier = Math.max(settings.tier - 1, 0)">
                            <span class="tier-icon">−</span>
                        </button>
                        {{ tier_name }}
                        <button class="tier-btn" @mousedown="settings.tier = settings.tier + 1">
                            <span class="tier-icon">+</span>
                        </button>
                    </span>
                </div>
                <div v-if="!settings_collapsed" class="toolbar-row">
                    <span style="margin-right: 8px">
                        Analysis input:
                        <button class="toggle-btn" @mousedown="settings.show_input = !settings.show_input">
                            {{ settings.show_input ? 'show' : 'hide' }}
                        </button>
                    </span>
                    <label v-if="settings.show_input">
                        Input width:
                        <input
                            type="range"
                            min="60"
                            max="600"
                            v-model.number="settings.input_width"
                            style="vertical-align: middle"
                        />
                        {{ settings.input_width }}px
                    </label>
                    <label>
                        <input type="checkbox" v-model="settings.use_delete_to_clear" />
                        Use 'Delete' key to clear analysis
                    </label>
                </div>
                <div v-if="!settings_collapsed" class="toolbar-row">
                    <label>
                        Font:
                        <select v-model="settings.font_family" @mousedown.stop>
                            <option v-for="f in font_options" :key="f" :value="f">
                                {{ f }}
                            </option>
                        </select>
                    </label>
                </div>
            </div>
            <button class="collapse-btn" @mousedown="settings_collapsed = !settings_collapsed">
                {{ settings_collapsed ? '▼ More' : '▲ Less' }}
            </button>
        </div>

        <div v-if="root && notation" class="preview-container">
            <NotationTree :root="root" :notation="notation as any" :tier="settings.tier" />
        </div>
        <div v-else>No notation selected</div>
        <div
            v-if="visible && diagram"
            class="diagram-floating"
            :style="{ left: pos_x + 'px', top: pos_y + 'px' }"
            @mousedown.stop
        >
            <button class="diagram-close" @mousedown.stop="hide">✕</button>
            <DiagramViewer :diagram="diagram" />
        </div>
        <div v-if="save_indicator" class="save-indicator">saved {{ save_indicator }} ago</div>
        <HotkeyDialog :show="show_hotkeys" @close="show_hotkeys = false" />
    </div>
</template>

<style>
.tab > button {
    padding: 0 6px 2px;
    border: 2px solid #90f;
    border-radius: 10px;
    background-color: #daf;
    font-size: 20px;

    font-family: inherit;
}

.tab > button[disabled] {
    background-color: #60a;
    color: #fff;
}

.tab-stack {
    display: inline-grid;
}
.tab-stack > * {
    grid-area: 1 / 1;
    opacity: 0;
    transition: opacity 0.6s;
    pointer-events: none;
}
.tab-stack > .active {
    opacity: 1;
}

.settings-box {
    border: 2px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px 4px;
    margin: 8px 0;
}

.collapse-btn {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 2px 0;
    border: none;
    border-top: 1px solid #eee;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: #888;
    font-family: inherit;
}

.collapse-btn:hover {
    color: #333;
}

.toolbar {
    margin: 6px 0;
}

.toolbar-row {
    margin: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.toolbar-sep {
    width: 1px;
    height: 1.2em;
    background: #ccc;
}

.toolbar button {
    padding: 2px 10px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    border: 1px solid #bbb;
    border-radius: 5px;
    background: #f8f8f8;
    cursor: pointer;
    font-size: 14px;

    min-width: 4ch;
}

.toolbar button:hover {
    background: #e8e8e8;
}

.toolbar button:active {
    background: #d0d0d0;
}

.reset-btn {
    color: #c00;
}

.reset-btn:hover {
    background: #fdd !important;
}

.tier-icon {
    display: inline-block;
}

.toolbar .tier-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: sans-serif;
    font-size: 16px;
    min-width: 0;
    line-height: 1;
    box-sizing: border-box;
}

.nowrap {
    white-space: nowrap;
}

.preview-container {
    margin: 20px 0;
}

.shown-item {
    position: relative;
    cursor: pointer;
    min-height: 1.25em;
}

.shown-item:hover {
    background-color: #cff;
}

.shown-item.analyzed {
    background-color: #eee;
}

.shown-item.analyzed:hover {
    background-color: #bee;
}

.shown-item > span:empty::before {
    content: '(empty)';
    color: #999;
}

.expr-display {
    font-family: 'Comic Sans MS', sans-serif;
}

.expr-display.shifted {
    margin-left: 12px;
    color: #666;
}

.expr-display.equiv {
}

.tooltip {
    display: inline-block;
    position: absolute;
    z-index: 1073741824;
    bottom: 100%;
    padding: 8px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    text-align: left;
    line-height: 1.4;
}

ul {
    list-style: none;
    padding-left: 0;
    margin: 0;
}

.tree-children {
    padding-left: 24px;
    position: relative;
}

.tree-item {
    position: relative;
}

.tree-item::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 0;
    bottom: 0;
    border-left: 1px solid #ddd;
}

.tree-item:last-child::before {
    border-left: none;
}

.tree-item::after {
    content: '';
    position: absolute;
    left: -16px;
    top: 0.6em;
    width: 14px;
    border-bottom: 1px solid #ddd;
}

.tree-item:last-child::after {
    width: 14px;
}

.tree-children > .tree-item:last-child::before {
    border-left: 1px solid #ddd;
}

.tree-children > .tree-item:only-child::before {
    border-left: 1px solid #ddd;
}

.fold-icon {
    display: inline-block;
    width: 1em;
    cursor: pointer;
    user-select: none;
    font-size: 0.75em;
    color: #888;
    vertical-align: middle;
}

.fold-icon--spacer {
    cursor: default;
    visibility: hidden;
}

.fold-icon:hover {
    color: #333;
}

.toolbar input[type='text'],
.tree-item input[type='text'] {
    font-family: inherit;
    padding: 2px 8px;
    height: 24px;
    border: 1px solid #bbb;
    border-radius: 5px;
    font-size: 14px;
    line-height: 1.4;
    box-sizing: border-box;
    background: #fff;
}

.toolbar input[type='text']:focus,
.tree-item input[type='text']:focus {
    outline: none;
    border-color: #7af;
    box-shadow: 0 0 0 2px rgba(100, 160, 255, 0.25);
}

.input-resize {
    display: inline-block;
    overflow: hidden;
    resize: horizontal;
    min-width: 60px;
    max-width: 600px;
    vertical-align: middle;
}

.input-resize.input-hidden {
    display: none;
}

.tree-item input[type='text'] {
    width: 100%;
    margin: 0;
}

body {
    font-family: 'Comic Sans MS', sans-serif;
}

.toolbar select {
    padding: 2px 6px;
    height: 24px;
    border: 1px solid #bbb;
    border-radius: 5px;
    background: #f8f8f8;
    cursor: pointer;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
    text-align: center;
    text-align-last: center;
    -webkit-appearance: none;
    appearance: none;
}

.toolbar select:hover {
    background: #e8e8e8;
}

body::after {
    content: '';
    display: block;
    height: 100vh;
}

.diagram-floating {
    position: fixed;
    z-index: 9999;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px;
}

.save-indicator {
    position: fixed;
    left: 8px;
    bottom: 8px;
    font-size: 12px;
    color: #888;
    background: rgba(255, 255, 255, 0.85);
    padding: 2px 8px;
    border-radius: 4px;
    z-index: 9999;
    pointer-events: none;
}

.diagram-close {
    position: absolute;
    top: 2px;
    right: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: #999;
    line-height: 1;
    padding: 0 4px;
}

.diagram-close:hover {
    color: #333;
}
</style>
