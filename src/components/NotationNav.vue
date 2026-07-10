<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import {
    generator_can_decrement,
    generator_can_increment,
    generator_decrement,
    generator_increment,
    get_category,
    get_category_ancestors,
    get_category_children,
    get_notation,
    get_root_items,
    registry_version,
} from '@/core/registry.ts';

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const ui = use_ui_states();

// 当前导航路径（category id 列表，从根到当前层）
const nav_path = ref<string[]>([]);

onMounted(() => {
    const notation = get_notation(settings.current_notation_id);
    nav_path.value = notation?.category_id ? get_category_ancestors(notation.category_id) : [];
});

watch(
    () => settings.current_notation_id,
    (id) => {
        const notation = get_notation(id);
        nav_path.value = notation?.category_id ? get_category_ancestors(notation.category_id) : [];
    },
);

function navigate(id: string) {
    const notation = get_notation(id);
    if (notation) {
        if (notation.category_id) {
            nav_path.value = get_category_ancestors(notation.category_id);
        } else {
            nav_path.value = [];
        }
        settings.current_notation_id = id;
        return;
    }

    const cat = get_category(id);
    if (cat) {
        nav_path.value = get_category_ancestors(id);
    }
}

function get_name(id: string): string {
    const notation = get_notation(id);
    if (notation) {
        if (settings.notation_name_mode === 'simple' && notation.simple_name) {
            return notation.simple_name;
        }
        return notation.name;
    }
    const cat = get_category(id);
    if (!cat) return id;
    if (settings.notation_name_mode === 'simple' && cat.simple_name) return cat.simple_name;
    return cat.name;
}

function get_simple_name(id: string): string | undefined {
    return get_notation(id)?.simple_name ?? get_category(id)?.simple_name;
}

function toggle_hidden(id: string) {
    const idx = settings.hidden_notations.indexOf(id);
    if (idx >= 0) {
        settings.hidden_notations = settings.hidden_notations.filter((x) => x !== id);
    } else {
        settings.hidden_notations = [...settings.hidden_notations, id];
    }
}

const rev = ref(0);
watch(
    () => registry_version.value,
    () => {
        rev.value++;
    },
);

const levels = computed(() => {
    void rev.value;
    const result: string[][] = [[]];
    for (let i = 1; i <= nav_path.value.length; i++) {
        result.push(nav_path.value.slice(0, i));
    }
    return result;
});

function level_items(path: string[]): { kind: 'category' | 'notation'; id: string }[] {
    const items = path.length === 0 ? get_root_items() : get_category_children(path[path.length - 1]);
    if (ui.configMode.value) return items;
    return items.filter((item) => {
        if (item.kind === 'notation') {
            const notation = get_notation(item.id);
            if (notation?.category_id && get_category(notation.category_id)?.generator) return true;
        }
        return !settings.hidden_notations.includes(item.id);
    });
}

/** 配置模式下是否显示 checkbox（generator 子项始终不显示） */
function showCheckbox(item: { kind: 'category' | 'notation'; id: string }): boolean {
    if (item.kind === 'category') return true;
    const notation = get_notation(item.id);
    if (!notation?.category_id) return true;
    const cat = get_category(notation.category_id);
    return !cat?.generator;
}

function handle_increment(cat_id: string, e: MouseEvent) {
    e.stopPropagation();
    generator_increment(cat_id);
}

function handle_decrement(cat_id: string, e: MouseEvent) {
    e.stopPropagation();
    generator_decrement(cat_id);
}

function row_has_generator(level: string[]): boolean {
    if (level.length === 0) return false;
    return generator_can_increment(level[level.length - 1]);
}

function row_can_decrement(level: string[]): boolean {
    if (level.length === 0) return false;
    return generator_can_decrement(level[level.length - 1]);
}
</script>

<template>
    <div class="nav-area">
        <div class="nav-row" v-for="(level, row_idx) in levels" :key="'row-' + row_idx">
            <button
                v-for="item in level_items(level)"
                :key="item.id"
                class="nav-btn"
                :class="{
                    'nav-btn--notation': item.kind === 'notation',
                    'nav-btn--category': item.kind === 'category',
                    'nav-btn--current': item.kind === 'notation' && item.id === settings.current_notation_id,
                    'nav-btn--open': item.kind === 'category' && nav_path[level.length] === item.id,
                    'nav-btn--hidden': settings.hidden_notations.includes(item.id) && showCheckbox(item),
                }"
                @mousedown.prevent="navigate(item.id)"
            >
                <label v-if="ui.configMode.value && showCheckbox(item)" class="nav-chk" @mousedown.prevent.stop>
                    <input
                        type="checkbox"
                        :checked="settings.hidden_notations.includes(item.id)"
                        @change="toggle_hidden(item.id)"
                    />
                </label>
                <span v-if="settings.notation_name_mode === 'full' && get_simple_name(item.id)" class="nav-btn-stack">
                    <span :class="{ active: !ui.isFlashing.value || !ui.flashShowSimple.value }">{{
                        get_name(item.id)
                    }}</span>
                    <span :class="{ active: ui.isFlashing.value && ui.flashShowSimple.value }">{{
                        get_simple_name(item.id)
                    }}</span>
                </span>
                <span v-else>{{ get_name(item.id) }}</span>
            </button>
            <span v-if="row_has_generator(level)" class="gen-row-btns">
                <button class="nav-btn" @mousedown.prevent.stop="handle_increment(level[level.length - 1], $event)">
                    +
                </button>
                <button
                    v-if="row_can_decrement(level)"
                    class="nav-btn"
                    @mousedown.prevent.stop="handle_decrement(level[level.length - 1], $event)"
                >
                    −
                </button>
            </span>
        </div>
    </div>
</template>

<style scoped>
.nav-area {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.nav-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 4px;
    padding-bottom: 4px;
}

.nav-row + .nav-row {
    border-top: 2px solid var(--color-border);
}

.nav-btn {
    position: relative;
    padding: 0 6px 2px;
    border: 2px solid var(--color-primary);
    border-radius: 10px;
    font-size: 20px;
    font-family: inherit;
    cursor: pointer;
    background: var(--color-primary-bg);
    color: var(--color-text);
}

.nav-btn--open::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid var(--color-category);
}

.nav-btn:hover {
    background: var(--color-primary-hover);
}

button.nav-btn--notation.nav-btn--current {
    background: var(--color-primary-active);
    color: var(--color-bg);
}

.nav-btn--category {
    border-color: var(--color-category);
    background: var(--color-category-bg);
}

.nav-btn--category:hover {
    background: var(--color-category-hover);
}

.nav-btn-stack {
    display: inline-grid;
}

.nav-btn-stack > * {
    grid-area: 1 / 1;
    opacity: 0;
    transition: opacity 0.6s;
    pointer-events: none;
}

.nav-btn-stack > .active {
    opacity: 1;
}

.gen-row-btns {
    display: inline-flex;
    gap: 4px;
    margin-left: 8px;
    align-self: center;
}

.gen-row-btns .nav-btn {
    min-width: 28px;
    text-align: center;
    border-color: var(--color-primary);
    background: #e0c0ff;
}

.nav-chk {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    margin-right: 2px;
}

.nav-chk input {
    width: 14px;
    height: 14px;
    cursor: pointer;
    margin: 0;
}

.nav-btn--hidden {
    opacity: 0.4;
    filter: grayscale(0.6);
}
</style>
