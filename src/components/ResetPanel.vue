<script setup lang="ts">
import { inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SAVE_LOAD_KEY } from '@/composables/use_save_load.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import ModalDialog from './ModalDialog.vue';

const t = inject(I18N_KEY)!;
const save_load = inject(SAVE_LOAD_KEY)!;
const ui = use_ui_states();

function do_reset() {
    save_load.handle_reset();
    ui.show_reset.value = false;
}
</script>

<template>
    <ModalDialog :show="ui.show_reset.value" :title="t('reset.title')" @close="ui.show_reset.value = false">
        <p class="reset-message">{{ t('reset.message') }}</p>
        <div class="reset-buttons">
            <button class="reset-btn-cancel" @mousedown="ui.show_reset.value = false">{{ t('reset.cancel') }}</button>
            <button class="reset-btn-confirm" @mousedown="do_reset">{{ t('reset.confirm') }}</button>
        </div>
    </ModalDialog>
</template>

<style scoped>
.reset-message {
    color: var(--color-text);
    font-size: 14px;
    margin: 0 0 16px;
    line-height: 1.5;
}

.reset-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.reset-btn-confirm {
    padding: 6px 16px;
    border: 1px solid var(--color-danger);
    border-radius: 5px;
    background: var(--color-danger);
    color: var(--color-bg);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
}

.reset-btn-confirm:hover {
    opacity: 0.85;
}

.reset-btn-cancel {
    padding: 6px 16px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
}

.reset-btn-cancel:hover {
    background: var(--color-bg-hover);
}
</style>
