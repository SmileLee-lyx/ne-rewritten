<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
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

const props = defineProps<{
    currentNotationId: string;
    notationNameMode: 'full' | 'simple';
    isFlashing: boolean;
    flashShowSimple: boolean;
    configMode: boolean;
    hiddenNotations: string[];
}>();

const emit = defineEmits<{
    selectNotation: [id: string];
    toggleHidden: [id: string];
}>();

const t = inject(I18N_KEY)!;

// 当前导航路径（category id 列表，从根到当前层）
const nav_path = ref<string[]>([]);

onMounted(() => {
    const notation = get_notation(props.currentNotationId);
    nav_path.value = notation?.category_id ? get_category_ancestors(notation.category_id) : [];
});

watch(
    () => props.currentNotationId,
    () => {
        const notation = get_notation(props.currentNotationId);
        nav_path.value = notation?.category_id ? get_category_ancestors(notation.category_id) : [];
    },
);

function navigate(id: string) {
    const notation = get_notation(id);
    if (notation) {
        // 计算祖先链
        if (notation.category_id) {
            nav_path.value = get_category_ancestors(notation.category_id);
        } else {
            nav_path.value = [];
        }
        emit('selectNotation', id);
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
        if (props.notationNameMode === 'simple' && notation.simple_name) {
            return notation.simple_name;
        }
        return notation.name;
    }
    const cat = get_category(id);
    return cat?.name ?? id;
}

function get_simple_name(id: string): string | undefined {
    return get_notation(id)?.simple_name;
}

const rev = ref(0);
watch(
    () => registry_version.value,
    () => {
        rev.value++;
    },
);

const levels = computed(() => {
    void rev.value; // 依赖 version 变化
    const result: string[][] = [[]];
    for (let i = 1; i <= nav_path.value.length; i++) {
        result.push(nav_path.value.slice(0, i));
    }
    return result;
});

function level_items(path: string[]): { kind: 'category' | 'notation'; id: string }[] {
    const items = path.length === 0 ? get_root_items() : get_category_children(path[path.length - 1]);
    if (props.configMode) return items; // 配置模式下全部显示
    return items.filter((item) => {
        if (item.kind === 'notation') {
            const notation = get_notation(item.id);
            // generator 类别下的记号始终显示
            if (notation?.category_id && get_category(notation.category_id)?.generator) return true;
        }
        return !props.hiddenNotations.includes(item.id);
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

/** 当前行（level 对应的子项行）的父 category 是否有 generator */
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
                    'nav-btn--current': item.kind === 'notation' && item.id === currentNotationId,
                    'nav-btn--hidden': hiddenNotations.includes(item.id) && showCheckbox(item),
                }"
                @mousedown.prevent="navigate(item.id)"
            >
                <label v-if="configMode && showCheckbox(item)" class="nav-chk" @mousedown.prevent.stop>
                    <input
                        type="checkbox"
                        :checked="hiddenNotations.includes(item.id)"
                        @change="emit('toggleHidden', item.id)"
                    />
                </label>
                <span v-if="notationNameMode === 'full' && get_simple_name(item.id)" class="nav-btn-stack">
                    <span :class="{ active: !isFlashing || !flashShowSimple }">{{ get_name(item.id) }}</span>
                    <span :class="{ active: isFlashing && flashShowSimple }">{{ get_simple_name(item.id) }}</span>
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
    border-top: 2px solid #ccc;
}

.nav-btn {
    padding: 0 6px 2px;
    border: 2px solid #90f;
    border-radius: 10px;
    font-size: 20px;
    font-family: inherit;
    cursor: pointer;
    background: #daf;
}

.nav-btn:hover {
    background: #c8f;
}

.nav-btn--notation.nav-btn--current {
    background: #60a;
    color: #fff;
}

.nav-btn--category {
    border-color: #f90;
    background: #feb;
}

.nav-btn--category:hover {
    background: #fd9;
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
    border-color: #90f;
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
