<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { get_notation } from '@/core/registry.ts';
import type { TreeNode } from '@/core/tree.ts';
import { init_dataset } from '@/core/tree.ts';
import NotationTree from '@/components/NotationTree.vue';
import { focus_node, focus_node_input, get_last_focus } from '@/composables/use_focus_tracker.ts';
import { export_analysis, import_analysis } from '@/core/analysis.ts';
import { download_buffer, export_to_xlsx, import_from_xlsx } from '@/core/xlsx_io.ts';

import { use_diagram } from '@/composables/use_diagram.ts';
import DiagramViewer from '@/components/DiagramViewer.vue';
import HotkeyDialog from '@/components/HotkeyDialog.vue';
import TipsDialog from '@/components/TipsDialog.vue';
import { create_t, I18N_KEY } from '@/composables/use_i18n.ts';
import ExpandDialog from '@/components/ExpandDialog.vue';
import { use_expand_dialog } from '@/composables/use_expand_dialog.ts';
import { use_latex } from '@/composables/use_latex.ts';
import LaTeXViewer from '@/components/LaTeXViewer.vue';
import MultiSelectBar from '@/components/MultiSelectBar.vue';
import NotationNav from '@/components/NotationNav.vue';
import NotationNavPlain from '@/components/NotationNavPlain.vue';
import { resolve_display } from '@/notation-definition.ts';
import { use_multi_select } from '@/composables/use_multi_select.ts';

const settings = inject(SETTINGS_KEY)!;
const t = (key: string, params?: Record<string, string>) => create_t(settings.language)(key, params);
provide(I18N_KEY, t);
const {
    diagram,
    visible,
    pos_x,
    pos_y,
    show: show_diagram,
    hide,
    dispatch_action: dispatch_diagram_action,
} = use_diagram();
const latex_state = use_latex();
const expand_dialog_state = use_expand_dialog();
const multi_select = use_multi_select();
const config_mode = ref(false);
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

function toggle_hidden(id: string) {
    const idx = settings.hidden_notations.indexOf(id);
    if (idx >= 0) {
        settings.hidden_notations = settings.hidden_notations.filter((x) => x !== id);
    } else {
        settings.hidden_notations = [...settings.hidden_notations, id];
    }
}

function unhide_all() {
    settings.hidden_notations = [];
}

watch(
    () => settings.font_family,
    (v) => {
        document.body.style.fontFamily = v + ', sans-serif';
    },
    { immediate: true },
);
const font_options = ['Comic Sans MS', 'Consolas', 'Microsoft YaHei UI'];

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

const tier_name = computed(() => {
    const ti = settings.tier;
    const key = 'tier.' + ti;
    const label = t(key);
    if (label !== key) return label;
    return ti + '-fold expansion';
});

const file_input = ref<HTMLInputElement>();
const show_hotkeys = ref(false);
const show_tips = ref(false);

function toggle_diagram() {
    settings.show_diagram = !settings.show_diagram;
    if (settings.show_diagram) settings.show_latex = false;
}

function toggle_latex() {
    settings.show_latex = !settings.show_latex;
    if (settings.show_latex) settings.show_diagram = false;
}

const DISPLAY_MODES = ['plain', 'html', 'latex'] as const;

function toggle_display_mode() {
    const idx = DISPLAY_MODES.indexOf(settings.display_mode);
    settings.display_mode = DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length];
}

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
        multi_select.clear();
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
    const display_fn =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name]).plain
            : resolve_display(n.display).plain;
    const buf = await export_to_xlsx(entries, display_fn);
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
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!display_spec.from_display) return;

    const buf = await file.arrayBuffer();
    const entries = await import_from_xlsx(buf, display_spec.from_display);
    const matched = import_analysis(r, entries, n as any, settings.variant, settings.max_find_fs);

    if ((entries as any).skipped?.length || matched.length !== entries.length) {
        alert(t('import.error'));
    }

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
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!display_spec.from_display) return;
    try {
        const expr = display_spec.from_display(val);
        const matched = import_analysis(r, [{ expr, analysis: [] }], n as any, settings.variant, settings.max_find_fs);
        if (matched.length > 0) {
            focus_node_input(matched[0] as any);
        } else {
            alert(t('import.error'));
        }
    } catch {
        alert(t('import.error'));
    }
}

function on_find_input() {
    const n = notation.value;
    const val = find_input.value?.value;
    if (!n || !val) {
        hide();
        return;
    }
    const dc = n.draw_diagram;
    if (!dc || !settings.show_diagram) return;
    const equiv_name = settings.equiv_active[n.id];
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!display_spec.from_display) return;
    try {
        const expr = display_spec.from_display(val);
        const el = find_input.value;
        if (!el) return;
        const r = el.getBoundingClientRect();
        show_diagram(dc, expr, r.left, 60 + r.height, equiv_name ?? undefined);
    } catch {
        hide();
    }
}

function on_find_focus(e: FocusEvent) {
    const el = e.target as HTMLInputElement;
    const r = el.getBoundingClientRect();
    const target_scroll = r.top + window.scrollY - 60;
    window.scrollTo({ top: target_scroll, behavior: 'smooth' });
    on_find_input();
}

function on_find_keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handle_find();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({ type: 'scroll', direction: 'up', step: 1 });
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({ type: 'scroll', direction: 'down', step: 1 });
    } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({ type: 'scroll', direction: 'left', step: 1 });
    } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        dispatch_diagram_action({ type: 'scroll', direction: 'right', step: 1 });
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
        <NotationNav
            v-if="settings.nav_mode === 'grouped'"
            :current-notation-id="settings.current_notation_id"
            :notation-name-mode="settings.notation_name_mode"
            :is-flashing="is_flashing"
            :flash-show-simple="flash_show_simple"
            :config-mode="config_mode"
            :hidden-notations="settings.hidden_notations"
            @select-notation="(id: string) => (settings.current_notation_id = id)"
            @toggle-hidden="toggle_hidden"
        />
        <NotationNavPlain
            v-else
            :current-notation-id="settings.current_notation_id"
            :notation-name-mode="settings.notation_name_mode"
            :is-flashing="is_flashing"
            :flash-show-simple="flash_show_simple"
            :config-mode="config_mode"
            :hidden-notations="settings.hidden_notations"
            @select-notation="(id: string) => (settings.current_notation_id = id)"
            @toggle-hidden="toggle_hidden"
        />

        <div class="settings-box">
            <div class="toolbar">
                <div class="toolbar-row">
                    <span
                        style="margin-right: 8px"
                        @mouseenter="settings.notation_name_mode === 'full' && start_flash()"
                        @mouseleave="stop_flash"
                    >
                        {{ t('notation-name.mode-label') }}
                        <button
                            class="toggle-btn"
                            @mousedown="
                                settings.notation_name_mode = settings.notation_name_mode === 'full' ? 'simple' : 'full'
                            "
                        >
                            {{ t('notation-name.' + settings.notation_name_mode) }}
                        </button>
                    </span>
                    <span style="margin-left: 12px">
                        {{ t('config-display.label') }}
                        <button class="toggle-btn" @mousedown="config_mode = !config_mode">
                            {{ t('config-display.configure') }}
                        </button>
                    </span>
                    <span style="margin-left: 12px">
                        {{ t('nav-mode.label') }}
                        <button
                            class="toggle-btn"
                            @mousedown="settings.nav_mode = settings.nav_mode === 'grouped' ? 'flat' : 'grouped'"
                        >
                            {{ t('nav-mode.' + settings.nav_mode) }}
                        </button>
                    </span>
                </div>
                <div class="toolbar-row">
                    <label class="find-label">
                        {{ t('find-notation.label') }}
                        <input
                            ref="find_input"
                            type="text"
                            spellcheck="false"
                            @focus="on_find_focus"
                            @input="on_find_input"
                            @keydown="on_find_keydown"
                        />
                        <button @mousedown.prevent="handle_find">{{ t('find-notation.find') }}</button>
                    </label>
                    <label>
                        {{ t('find-notation.max-fs') }}
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
                        {{ t('fs-variant.label') }}
                        <select v-model="settings.variant" @mousedown.stop>
                            <option value="FS">{{ t('fs-variant.normal') }}</option>
                            <option value="FS_alter">{{ t('fs-variant.alternative') }}</option>
                            <option value="FS_short">{{ t('fs-variant.short') }}</option>
                        </select>
                    </label>
                </div>
                <div class="toolbar-row">
                    <button class="reset-btn" @mousedown="handle_reset">{{ t('toolbar.reset') }}</button>
                    <button @mousedown="handle_export">{{ t('toolbar.export') }}</button>
                    <button @mousedown="handle_import">{{ t('toolbar.import') }}</button>
                    <button @mousedown="save_analysis">{{ t('toolbar.save') }}</button>
                    <button @mousedown="show_hotkeys = true">{{ t('toolbar.hotkeys') }}</button>
                    <button class="toolbar-btn-tips" @mousedown="show_tips = true">{{ t('toolbar.tips') }}</button>
                    <input
                        ref="file_input"
                        type="file"
                        accept=".xlsx"
                        style="display: none"
                        @change="on_file_selected"
                    />
                </div>
                <div class="toolbar-row">
                    <label v-if="notation?.draw_diagram">
                        <input type="checkbox" :checked="settings.show_diagram" @change="toggle_diagram" />
                        {{ t('diagram.show') }}
                    </label>
                    <label>
                        <input type="checkbox" :checked="settings.show_latex" @change="toggle_latex" />
                        {{ t('latex.show') }}
                    </label>
                </div>
                <div v-if="!settings_collapsed && equiv_options.length > 0" class="toolbar-row">
                    <label>
                        {{ t('equiv.label') }}
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
                            <option value="">{{ t('equiv.none') }}</option>
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
                        {{ t('equiv.hide-original') }}
                    </label>
                </div>
                <div v-if="!settings_collapsed" class="toolbar-row">
                    <span style="margin-right: 8px">
                        {{ t('display.label') }}
                        <button class="toggle-btn" @mousedown="toggle_display_mode">
                            {{ t('display.' + settings.display_mode) }}
                        </button>
                    </span>
                    <span>
                        {{ t('tier.label') }}
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
                        {{ t('analysis-input.label') }}
                        <button class="toggle-btn" @mousedown="settings.show_input = !settings.show_input">
                            {{ settings.show_input ? t('analysis-input.show') : t('analysis-input.hide') }}
                        </button>
                    </span>
                    <label v-if="settings.show_input">
                        {{ t('analysis-input.width') }}
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
                        {{ t('analysis-input.use-delete') }}
                    </label>
                </div>
                <div v-if="!settings_collapsed" class="toolbar-row">
                    <label>
                        {{ t('font.label') }}
                        <select v-model="settings.font_family" @mousedown.stop>
                            <option v-for="f in font_options" :key="f" :value="f">
                                {{ f }}
                            </option>
                        </select>
                    </label>
                    <label style="margin-left: 8px">
                        {{ t('language.label') }}
                        <select v-model="settings.language" @mousedown.stop>
                            <option value="zh">中文</option>
                            <option value="en">English</option>
                        </select>
                    </label>
                </div>
            </div>
            <button class="collapse-btn" @mousedown="settings_collapsed = !settings_collapsed">
                {{ settings_collapsed ? t('settings.more') : t('settings.less') }}
            </button>
        </div>

        <div v-if="root && notation" class="preview-container">
            <NotationTree :root="root" :notation="notation as any" :tier="settings.tier" />
            <div v-if="notation.credit_text_id" class="credit-line">{{ t(notation.credit_text_id) }}</div>
        </div>
        <div v-else>{{ t('notation-tree.empty') }}</div>
        <div
            v-if="visible && diagram"
            class="diagram-floating"
            :style="{ left: pos_x + 'px', top: pos_y + 'px' }"
            @mousedown.stop
        >
            <button class="diagram-close" @mousedown.stop="hide">✕</button>
            <DiagramViewer :diagram="diagram" />
        </div>
        <div
            v-if="latex_state.visible.value && latex_state.latex.value"
            class="diagram-floating"
            :style="{ left: latex_state.pos_x.value + 'px', top: latex_state.pos_y.value + 'px' }"
            @mousedown.stop
        >
            <button class="diagram-close" @mousedown.stop="latex_state.hide()">✕</button>
            <LaTeXViewer :latex="latex_state.latex.value" />
        </div>
        <div v-if="save_indicator" class="save-indicator">
            {{ t('autosave.last-save', { time: save_indicator }) }}
        </div>
        <HotkeyDialog :show="show_hotkeys" @close="show_hotkeys = false" />
        <ExpandDialog :show="expand_dialog_state.visible.value" @close="expand_dialog_state.close()" />
        <TipsDialog :show="show_tips" @close="show_tips = false" />
        <MultiSelectBar />
        <Teleport to="body">
            <div v-if="config_mode" class="config-bar">
                <button class="ms-btn" @mousedown.stop="unhide_all">
                    {{ t('config-display.unhide-all') }}
                </button>
                <button class="ms-btn ms-btn-confirm" @mousedown.stop="config_mode = false">
                    {{ t('config-display.confirm') }}
                </button>
            </div>
        </Teleport>
    </div>
</template>

<style>
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

.toolbar-row > span,
.toolbar-row > label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 24px;
}

.toolbar-row input[type='checkbox'] {
    margin: 0;
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
    vertical-align: middle;

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

.toolbar-btn-tips {
    color: #06c !important;
    font-weight: 600;
}
.toolbar-btn-tips:hover {
    background: #e0ecff !important;
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

.credit-line {
    text-align: center;
    margin-top: 1.5em;
    color: #888;
    font-size: 13px;
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

.shown-item.selected {
    background-color: #cfc !important;
}

.shown-item.selected:hover {
    background-color: #afa !important;
}

.shown-item > span:empty::before {
    content: '(empty)';
    color: #999;
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
    vertical-align: middle;
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

.config-bar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: #fff;
    color: #333;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    font-family: inherit;
    white-space: nowrap;
}

.config-bar button {
    padding: 5px 14px;
    border: 1px solid #bbb;
    border-radius: 5px;
    background: #f8f8f8;
    color: #333;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
}

.config-bar button:hover {
    background: #e8e8e8;
}

.config-bar .ms-btn-confirm {
    color: #06c;
    font-weight: 600;
}
</style>
