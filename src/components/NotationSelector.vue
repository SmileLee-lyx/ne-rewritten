<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { build_categories, type NotationCategory } from '@/core/notation_categories';
import { get_notation, list_notations } from '@/core/registry';
import ModalDialog from './ModalDialog.vue';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: [] }>();

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;

// 临时状态（reactive，确保 UI 即时响应）
const temp_shown = ref<string[]>([]);
const temp_hidden = ref<string[]>([]);

function init() {
    temp_shown.value = [...settings.shown_notations];
    temp_hidden.value = [...settings.hidden_notations];
}

// 判断记号当前是否显示
function is_shown(id: string): boolean {
    return temp_shown.value.includes(id);
}

// 切换记号的显隐
function toggle(id: string) {
    const shown = temp_shown.value;
    const hidden = temp_hidden.value;
    const idx_shown = shown.indexOf(id);
    if (idx_shown >= 0) {
        shown.splice(idx_shown, 1);
        if (!hidden.includes(id)) hidden.push(id);
    } else {
        const idx_hidden = hidden.indexOf(id);
        if (idx_hidden >= 0) hidden.splice(idx_hidden, 1);
        if (!shown.includes(id)) shown.push(id);
    }
}

// 选中分类下所有记号
function select_all(cat: NotationCategory) {
    const shown = temp_shown.value;
    const hidden = temp_hidden.value;
    for (const id of cat.notation_ids) {
        if (!shown.includes(id)) shown.push(id);
        const idx_h = hidden.indexOf(id);
        if (idx_h >= 0) hidden.splice(idx_h, 1);
    }
}

// 取消选中分类下所有记号
function deselect_all(cat: NotationCategory) {
    const shown = temp_shown.value;
    const hidden = temp_hidden.value;
    for (const id of cat.notation_ids) {
        const idx_s = shown.indexOf(id);
        if (idx_s >= 0) shown.splice(idx_s, 1);
        if (!hidden.includes(id)) hidden.push(id);
    }
}

function confirm() {
    settings.shown_notations = [...temp_shown.value];
    settings.hidden_notations = [...temp_hidden.value];
    emit('close');
}

function cancel() {
    emit('close');
}

// 右侧排序：拖动
let drag_idx: number | null = null;

function on_drag_start(i: number) {
    drag_idx = i;
}

function on_drag_over(e: DragEvent, i: number) {
    e.preventDefault();
    if (drag_idx === null || drag_idx === i) return;
    const shown = temp_shown.value;
    const item = shown.splice(drag_idx, 1)[0];
    shown.splice(i, 0, item);
    drag_idx = i;
}

function on_drag_end() {
    drag_idx = null;
}

function on_wheel(e: WheelEvent) {
    if (drag_idx === null) return;
    const target = e.currentTarget as HTMLElement;
    target.scrollBy({ top: e.deltaY, behavior: 'auto' });
}

const categories = build_categories();
const expanded_cats = ref<Set<string>>(new Set());

function toggle_cat(id: string) {
    const s = expanded_cats.value;
    if (s.has(id)) s.delete(id);
    else s.add(id);
}

function restore_default() {
    const order = list_notations().map((n) => n.id);
    const known = new Set(order);
    temp_shown.value = temp_shown.value.filter((id) => known.has(id));
    temp_hidden.value = temp_hidden.value.filter((id) => known.has(id));
    temp_shown.value.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// 在打开时初始化
watch(
    () => props.show,
    (v) => {
        if (v) {
            init();
        }
    },
);
</script>

<template>
    <ModalDialog :show="show" title="Config Notations" @close="cancel">
        <div class="nota-selector">
            <div class="nota-left">
                <div v-for="cat in categories" :key="cat.id" class="cat-block">
                    <div class="cat-header" @click="toggle_cat(cat.id)">
                        <span class="cat-arrow">{{ expanded_cats.has(cat.id) ? '▼' : '▶' }}</span>
                        <span class="cat-name">{{ cat.name }}</span>
                        <button class="cat-select-all" @click.stop="select_all(cat)" :title="t('selector.select-all')">
                            +
                        </button>
                        <button
                            class="cat-deselect-all"
                            @click.stop="deselect_all(cat)"
                            :title="t('selector.deselect-all')"
                        >
                            −
                        </button>
                    </div>
                    <div v-if="expanded_cats.has(cat.id)" class="cat-entries">
                        <label v-for="id in cat.notation_ids" :key="id" class="cat-entry">
                            <input type="checkbox" :checked="is_shown(id)" @change="toggle(id)" />
                            {{ get_notation(id)?.simple_name ?? get_notation(id)?.name ?? '[' + id + ']?' }}
                        </label>
                    </div>
                </div>
            </div>
            <div class="nota-right" @wheel="on_wheel">
                <div class="nota-right-title">
                    {{ t('selector.order') }}
                    <button class="default-order-btn" @mousedown="restore_default">
                        {{ t('selector.default-order') }}
                    </button>
                </div>
                <div class="nota-sort-list">
                    <div
                        v-for="(id, idx) in temp_shown"
                        :key="id"
                        class="nota-sort-item"
                        draggable="true"
                        @dragstart="on_drag_start(idx)"
                        @dragover="on_drag_over($event, idx)"
                        @dragend="on_drag_end"
                    >
                        <span class="drag-handle">⠿</span>
                        {{ get_notation(id)?.simple_name ?? get_notation(id)?.name ?? '[' + id + ']?' }}
                    </div>
                    <div v-if="temp_shown.length === 0" class="nota-sort-empty">
                        {{ t('selector.empty') }}
                    </div>
                </div>
            </div>
        </div>
        <div class="nota-buttons">
            <button @mousedown="confirm">{{ t('selector.confirm') }}</button>
            <button @mousedown="cancel">{{ t('selector.cancel') }}</button>
        </div>
    </ModalDialog>
</template>

<style scoped>
.nota-selector {
    display: flex;
    gap: 16px;
    min-height: 400px;
    min-width: 700px;
}

.nota-left {
    flex: 1;
    border: 1px solid #ddd;
    padding: 8px;
    overflow-y: auto;
    max-height: 400px;
    min-width: 0;
}

.nota-right {
    flex: 1;
    border: 1px solid #ddd;
    padding: 8px;
    overflow-y: auto;
    max-height: 400px;
    min-width: 200px;
}

.nota-right-title {
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.default-order-btn {
    font-size: 11px;
    border: 1px solid #aaa;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    padding: 2px 8px;
    font-weight: normal;
}

.default-order-btn:hover {
    background: #f0f0f0;
}

.cat-item {
    margin: 2px 0;
}

.cat-header {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    user-select: none;
}

.cat-header:hover {
    background: #f0f0f0;
}

.cat-arrow {
    width: 16px;
    font-size: 10px;
    color: #888;
}

.cat-name {
    flex: 1;
    font-weight: 500;
}

.cat-select-all,
.cat-deselect-all {
    border: 1px solid #ccc;
    background: #fff;
    cursor: pointer;
    width: 22px;
    height: 22px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.cat-select-all:hover,
.cat-deselect-all:hover {
    background: #e8e8e8;
}

.cat-children {
    margin-left: 16px;
}

.cat-child {
    margin: 4px 0;
}

.cat-entries {
    margin-left: 20px;
    display: flex;
    flex-direction: column;
}

.cat-entry {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
}

.cat-entry:hover {
    background: #f5f5f5;
}

.cat-entry input {
    margin: 0;
}

.nota-sort-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.nota-sort-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: grab;
    background: #fff;
    font-size: 13px;
}

.nota-sort-item:hover {
    background: #f9f9f9;
}

.nota-sort-item:active {
    cursor: grabbing;
}

.drag-handle {
    color: #aaa;
    font-size: 14px;
}

.nota-sort-empty {
    color: #aaa;
    padding: 20px;
    text-align: center;
}

.nota-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
}

.nota-buttons button {
    padding: 6px 20px;
    border: 1px solid #888;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
}

.nota-buttons button:hover {
    background: #f0f0f0;
}
</style>
