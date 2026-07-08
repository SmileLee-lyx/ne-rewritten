<script setup lang="ts">
import { computed, inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { list_notations, is_extra_generated } from '@/core/registry.ts';

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

const all = computed(() => {
    const notations = list_notations();
    if (props.configMode) return notations; // 配置模式全部显示
    return notations.filter((n) => !is_extra_generated(n.id) && !props.hiddenNotations.includes(n.id));
});

function get_name(n: (typeof all.value)[number]): string {
    if (props.notationNameMode === 'simple' && n.simple_name) return n.simple_name;
    return n.name;
}
</script>

<template>
    <div class="nav-plain">
        <button
            v-for="n in all"
            :key="n.id"
            class="nav-btn"
            :class="{
                'nav-btn--current': n.id === currentNotationId,
                'nav-btn--hidden': hiddenNotations.includes(n.id),
            }"
            @mousedown.prevent="emit('selectNotation', n.id)"
        >
            <label v-if="configMode" class="nav-chk" @mousedown.prevent.stop>
                <input type="checkbox" :checked="hiddenNotations.includes(n.id)" @change="emit('toggleHidden', n.id)" />
            </label>
            <span v-if="notationNameMode === 'full' && n.simple_name" class="nav-btn-stack">
                <span :class="{ active: !isFlashing || !flashShowSimple }">{{ n.name }}</span>
                <span :class="{ active: isFlashing && flashShowSimple }">{{ n.simple_name }}</span>
            </span>
            <span v-else>{{ get_name(n) }}</span>
        </button>
    </div>
</template>

<style scoped>
.nav-plain {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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

.nav-btn--current {
    background: #60a;
    color: #fff;
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
