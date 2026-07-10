<script setup lang="ts">
import { inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';

const t = inject(I18N_KEY)!;
const settings = inject(SETTINGS_KEY)!;
const ui = use_ui_states();

function unhide_all() {
    settings.hidden_notations = [];
}
</script>

<template>
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
</template>

<style scoped>
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
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 14px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 2px 12px var(--color-shadow);
    font-family: inherit;
    white-space: nowrap;
}

.config-bar button {
    padding: 5px 14px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
}

.config-bar button:hover {
    background: var(--color-bg-hover);
}

.config-bar .ms-btn-confirm {
    color: var(--color-accent);
    font-weight: 600;
}
</style>
