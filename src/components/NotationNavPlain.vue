<script setup lang="ts">
import { computed, inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { get_notation, is_extra_generated, list_notations } from '@/core/registry.ts';

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const ui = use_ui_states();

const all = computed(() => {
    ui.registry_notifier.listen();
    const notations = list_notations();
    if (ui.config_mode.value) return notations;
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

interface EquivItem {
    id: string;
    label: string;
}

const equiv_items = computed<EquivItem[]>(() => {
    const notation = get_notation(settings.current_notation_id);
    if (!notation?.display_equiv) return [];
    return Object.keys(notation.display_equiv).map((id) => {
        const spec = notation.display_equiv![id];
        const name_id = typeof spec !== 'function' && spec.name_id ? spec.name_id : undefined;
        return { id, label: name_id ? t(name_id) : id };
    });
});

const orig_label = computed(() => {
    const notation = get_notation(settings.current_notation_id);
    if (!notation) return t('equiv.default');
    const name_id =
        typeof notation.display !== 'function' && notation.display.name_id ? notation.display.name_id : undefined;
    return name_id ? t(name_id) : t('equiv.default');
});

function set_equiv(name: string | undefined) {
    settings.equiv_active = {
        ...settings.equiv_active,
        [settings.current_notation_id]: name,
    };
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
            <label v-if="ui.config_mode.value" class="nav-chk" @mousedown.prevent.stop>
                <input
                    type="checkbox"
                    :checked="settings.hidden_notations.includes(n.id)"
                    @change="toggle_hidden(n.id)"
                />
            </label>
            <span v-if="settings.notation_name_mode === 'full' && n.simple_name" class="nav-btn-stack">
                <span :class="{ active: !ui.is_flashing.value || !ui.flash_show_simple.value }">{{ n.name }}</span>
                <span :class="{ active: ui.is_flashing.value && ui.flash_show_simple.value }">{{ n.simple_name }}</span>
            </span>
            <span v-else>{{ get_name(n) }}</span>
        </button>
    </div>
    <div v-if="equiv_items.length > 0" class="nav-plain nav-plain--equiv">
        <button
            class="nav-btn nav-btn--equiv"
            :class="{ 'nav-btn--current': !settings.equiv_active[settings.current_notation_id] }"
            @mousedown.prevent="set_equiv(undefined)"
        >
            {{ orig_label }}
        </button>
        <button
            v-for="item in equiv_items"
            :key="item.id"
            class="nav-btn nav-btn--equiv"
            :class="{ 'nav-btn--current': settings.equiv_active[settings.current_notation_id] === item.id }"
            @mousedown.prevent="set_equiv(item.id)"
        >
            {{ item.label }}
        </button>
    </div>
</template>

<style scoped>
.nav-plain {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.nav-plain + .nav-plain--equiv {
    border-top: 2px solid var(--color-border);
    padding-top: 4px;
    margin-top: 4px;
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

.nav-btn--equiv {
    border-color: var(--color-accent);
    background: var(--color-accent-bg);
}

.nav-btn--equiv:hover {
    background: var(--color-accent-hover);
}

button.nav-btn--equiv.nav-btn--current {
    background: var(--color-accent-active);
    color: var(--color-bg);
}
</style>
