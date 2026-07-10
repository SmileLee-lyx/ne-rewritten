<script setup lang="ts">
import { inject } from 'vue';
import ModalDialog from './ModalDialog.vue';
import { use_expand_dialog } from '@/composables/use_expand_dialog.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import type { Settings } from '@/core/settings.ts';

defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: [] }>();
const settings = inject(SETTINGS_KEY)! as Settings;
const t = inject(I18N_KEY)!;
const ed = use_expand_dialog();

function on_keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const saved = ed.save_settings();
        if (saved) settings.expand = saved;
        ed.confirm_and_fill();
    }
}

function on_fill() {
    const saved = ed.save_settings();
    if (saved) settings.expand = saved;
    ed.confirm_and_fill();
}
</script>

<template>
    <ModalDialog :show="show" :title="t('expand.title')" @close="emit('close')">
        <div class="expand-form" @keydown="on_keydown">
            <div class="expand-row">
                <input
                    type="text"
                    class="expand-text-input"
                    spellcheck="false"
                    :placeholder="t('expand.text')"
                    v-model="ed.input_text.value"
                />
            </div>
            <div class="expand-row">
                <label
                    >{{ t('expand.fs-index') }}
                    <input type="number" v-model.number="ed.FS_index.value" min="1" />
                </label>
                <label
                    >{{ t('expand.notation') }}
                    <select v-model="ed.notation_id.value">
                        <option v-for="n in ed.notation_options.value" :key="n.id" :value="n.id">
                            {{ n.simple_name ?? n.name }}
                        </option>
                    </select>
                </label>
                <label
                    >{{ t('expand.equiv') }}
                    <select v-model="ed.notation_equiv.value">
                        <option value="">{{ t('equiv.none') }}</option>
                        <option v-for="k in ed.equiv_options.value" :key="k" :value="k">{{ k }}</option>
                    </select>
                </label>
                <label
                    >{{ t('expand.fs-variant') }}
                    <select v-model="ed.variant.value">
                        <option value="FS_short">{{ t('fs-variant.short') }}</option>
                        <option value="FS">{{ t('fs-variant.normal') }}</option>
                        <option value="FS_alter">{{ t('fs-variant.alternative') }}</option>
                    </select>
                </label>
            </div>
            <div class="expand-row expand-preview">
                <div v-if="ed.preview_status.value === 'none'" class="expand-preview-hint">
                    {{ t('expand.preview-hint') }}
                </div>
                <div v-else-if="ed.preview_status.value === 'ok'">
                    <div class="expand-preview-result">{{ ed.preview.value }}</div>
                    <div class="expand-preview-hint">{{ t('expand.preview-hint') }}</div>
                </div>
                <div v-else-if="ed.preview_status.value === 'error-parse'" class="expand-preview-error">
                    {{ t('expand.error-parse') }}
                </div>
                <div v-else-if="ed.preview_status.value === 'error-no-from-display'" class="expand-preview-error">
                    {{ t('expand.error-no-from-display', { name: ed.preview.value! }) }}
                </div>
                <div v-else-if="ed.preview_status.value === 'error-fs'" class="expand-preview-error">
                    {{ t('expand.error-fs') }}
                </div>
            </div>
            <div class="expand-row expand-buttons">
                <button
                    type="button"
                    @mousedown="on_fill"
                    :disabled="ed.preview_status.value !== 'ok'"
                    class="expand-btn"
                >
                    {{ t('expand.fill') }}
                </button>
                <button type="button" @mousedown="emit('close')" class="expand-btn">
                    {{ t('expand.cancel') }}
                </button>
            </div>
        </div>
    </ModalDialog>
</template>

<style scoped>
.expand-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 500px;
}
.expand-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.expand-text-input {
    flex: 1;
    font-family: inherit;
    font-size: 14px;
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
}
.expand-row label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
}
.expand-row select,
.expand-row input[type='number'] {
    font-family: inherit;
    font-size: 13px;
    padding: 2px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
}
.expand-preview {
    border: 1px solid var(--color-border-light);
    border-radius: 4px;
    padding: 8px 12px;
    min-height: 40px;
    font-family: inherit;
    font-size: 14px;
    background: var(--color-bg-secondary);
    width: 100%;
    box-sizing: border-box;
    word-break: break-all;
}
.expand-preview-hint {
    color: var(--color-success);
    font-family: inherit;
    margin-top: 4px;
}
.expand-preview-result {
    color: var(--color-text);
}
.expand-preview-error {
    color: var(--color-danger);
    font-family: inherit;
}
.expand-buttons {
    justify-content: flex-end;
}
.expand-btn {
    font-family: inherit;
    font-size: 13px;
    padding: 4px 16px;
    border: 1px solid var(--color-text-secondary);
    border-radius: 4px;
    background: var(--color-bg);
    cursor: pointer;
}
.expand-btn:hover {
    background: var(--color-bg-hover);
}
.expand-btn:disabled {
    color: var(--color-text-muted);
    border-color: var(--color-border-light);
    cursor: default;
}
</style>
