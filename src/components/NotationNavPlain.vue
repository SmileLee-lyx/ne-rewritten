<script setup lang="ts">
import { computed, inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { is_extra_generated, list_notations } from '@/core/registry.ts';

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const ui = use_ui_states();

const all = computed(() => {
    const notations = list_notations();
    if (ui.configMode.value) return notations;
    return notations.filter((n) => !is_extra_generated(n.id) && !settings.hidden_notations.includes(n.id));
});

function get_name(n: (typeof all.value)[number]): string {
    if (settings.notation_name_mode === 'simple' && n.simple_name) return n.simple_name;
    return n.name;
}

function toggle_hidden(id: string) {
    const idx = settings.hidden_notations.indexOf(id);
    if (idx >= 0) {
        settings.hidden_notations = settings.hidden_notations.filter((x) => x !== id);
    } else {
        settings.hidden_notations = [...settings.hidden_notations, id];
    }
}
</script>

<template>
    <div class="nav-plain">
        <button
            v-for="n in all"
            :key="n.id"
            class="nav-btn"
            :class="{
                'nav-btn--current': n.id === settings.current_notation_id,
                'nav-btn--hidden': settings.hidden_notations.includes(n.id),
            }"
            @mousedown.prevent="settings.current_notation_id = n.id"
        >
            <label v-if="ui.configMode.value" class="nav-chk" @mousedown.prevent.stop>
                <input
                    type="checkbox"
                    :checked="settings.hidden_notations.includes(n.id)"
                    @change="toggle_hidden(n.id)"
                />
            </label>
            <span v-if="settings.notation_name_mode === 'full' && n.simple_name" class="nav-btn-stack">
                <span :class="{ active: !ui.isFlashing.value || !ui.flashShowSimple.value }">{{ n.name }}</span>
                <span :class="{ active: ui.isFlashing.value && ui.flashShowSimple.value }">{{ n.simple_name }}</span>
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
    border: 2px solid var(--color-primary);
    border-radius: 10px;
    font-size: 20px;
    font-family: inherit;
    cursor: pointer;
    background: var(--color-primary-bg);
    color: var(--color-text);
}

.nav-btn:hover {
    background: var(--color-primary-hover);
}

button.nav-btn--current {
    background: var(--color-primary-active);
    color: var(--color-bg);
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
