<script setup lang="ts">
import { inject, onMounted, onUnmounted, provide, reactive, watch } from 'vue';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { get_notation } from '@/core/registry.ts';
import type { TreeNode } from '@/core/tree.ts';
import { focus_node, get_last_focus } from '@/composables/use_focus_tracker.ts';
import NotationTree from '@/components/NotationTree.vue';

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
import SettingsBar from '@/components/SettingsBar.vue';
import { use_multi_select } from '@/composables/use_multi_select.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { SAVE_LOAD_KEY, use_save_load } from '@/composables/use_save_load.ts';

const settings = inject(SETTINGS_KEY)!;
const t = (key: string, params?: Record<string, string>) => create_t(settings.language)(key, params);
provide(I18N_KEY, t);

const { diagram, visible, pos_x, pos_y, hide } = use_diagram();
const latex_state = use_latex();
const expand_dialog_state = use_expand_dialog();
const multi_select = use_multi_select();
const ui = use_ui_states();

const save_load = use_save_load(reactive(new Map()));
provide(SAVE_LOAD_KEY, save_load);
const { trees, notation, root, save_indicator } = save_load;

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

watch(
    () => settings.current_notation_id,
    () => {
        multi_select.clear();
    },
);

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
        save_load.handle_export();
    }
    if (e.key.toLowerCase() === 'l' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        save_load.handle_import();
    }
}

onMounted(() => {
    document.addEventListener('keydown', on_global_keydown);
    save_load.init();
    (window as any).debug_compare_order = debug_compare_order;
});
onUnmounted(() => {
    document.removeEventListener('keydown', on_global_keydown);
    save_load.dispose();
});

function collect_nodes<T>(node: TreeNode<T>): T[] {
    const result: T[] = [];
    const children = node.children;
    for (const child of children) {
        result.push(child.expr);
        result.push(...collect_nodes(child));
    }
    return result;
}

function debug_compare_order(notation_id?: string) {
    const n = notation_id ?? notation.value?.id;
    const r = n ? trees.get(n) : root.value;
    if (!r) return console.warn('No tree found');
    const notation_def = get_notation(n!);
    if (!notation_def?.compare) return console.warn('No compare function for', n);
    const compare = notation_def.compare;

    const nodes = collect_nodes(r);

    const errors: string[] = [];
    let count = 0;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const cmp = compare(nodes[i], nodes[j]);
            count++;
            if (count % 100 === 0)
                console.log(`  progress: ${count} pairs checked, ${errors.length} error(s) found...`);
            if (cmp <= 0) {
                errors.push(
                    `node[${i}] < node[${j}] should be positive (later in pre-order = smaller), but compare returned ${cmp}`,
                );
            }
        }
    }
    if (errors.length === 0) {
        console.log(
            `✓ ${nodes.length} nodes, ${(nodes.length * (nodes.length - 1)) / 2} pairs — all strictly decreasing in pre-order.`,
        );
    } else {
        console.error(`✗ ${errors.length} ordering violation(s):`, errors.slice(0, 10));
        if (errors.length > 10) console.error(`  ... and ${errors.length - 10} more`);
    }
}
</script>

<template>
    <div>
        <NotationNav v-if="settings.nav_mode === 'grouped'" />
        <NotationNavPlain v-else />

        <SettingsBar />

        <div v-if="root && notation" class="preview-container">
            <NotationTree :root="root" :notation="notation" :tier="settings.tier" />
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
        <HotkeyDialog :show="ui.showHotkeys.value" @close="ui.showHotkeys.value = false" />
        <ExpandDialog :show="expand_dialog_state.visible.value" @close="expand_dialog_state.close()" />
        <TipsDialog :show="ui.showTips.value" @close="ui.showTips.value = false" />
        <MultiSelectBar />
        <Teleport to="body">
            <div v-if="ui.configMode.value" class="config-bar">
                <button class="ms-btn" @mousedown.stop="unhide_all">
                    {{ t('config-display.unhide-all') }}
                </button>
                <button class="ms-btn ms-btn-confirm" @mousedown.stop="ui.setConfigMode(false)">
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
