<script setup lang="ts">
import { inject, ref } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { use_multi_select } from '@/composables/use_multi_select.ts';

const multi = use_multi_select();
const t = inject(I18N_KEY)!;
const show_manual = ref(false);

async function copy_to_clipboard() {
    try {
        await navigator.clipboard.writeText(multi.export_text.value);
    } catch {
        show_manual.value = true;
    }
}

function manual_copy() {
    show_manual.value = true;
}

function close_manual() {
    show_manual.value = false;
}

function close_bar() {
    multi.clear();
    show_manual.value = false;
}
</script>

<template>
    <Teleport to="body">
        <div v-if="multi.count.value > 0" class="multi-select-bar">
            <span class="multi-select-count">{{ t('multi-select.count', { n: '' + multi.count.value }) }}</span>
            <button class="ms-btn" @mousedown.stop="copy_to_clipboard">
                {{ t('multi-select.copy-to-clipboard') }}
            </button>
            <button class="ms-btn" @mousedown.stop="manual_copy">
                {{ t('multi-select.manual-copy') }}
            </button>
            <button class="ms-btn ms-btn-close" @mousedown.stop="close_bar">
                {{ t('multi-select.close') }}
            </button>
        </div>

        <div v-if="show_manual" class="ms-modal-overlay" @mousedown.self="close_manual">
            <div class="ms-modal" @mousedown.stop>
                <h3>{{ t('multi-select.manual-copy') }}</h3>
                <textarea class="ms-textarea" readonly :value="multi.export_text.value" @mousedown.stop></textarea>
                <button class="ms-btn" @mousedown.stop="close_manual">
                    {{ t('multi-select.close') }}
                </button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.multi-select-bar {
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

.multi-select-count {
    color: var(--color-text-secondary);
    margin-right: 4px;
}

.ms-btn {
    padding: 5px 14px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
}

.ms-btn:hover {
    background: var(--color-bg-hover);
}

.ms-btn-close {
    color: var(--color-danger);
}

.ms-btn-close:hover {
    background: #fdd;
}

.ms-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-modal-overlay);
}

.ms-modal {
    background: var(--color-bg);
    border-radius: 8px;
    padding: 20px;
    min-width: 400px;
    max-width: 80vw;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.ms-modal h3 {
    margin: 0;
    font-size: 16px;
}

.ms-textarea {
    width: 100%;
    min-height: 120px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    font-family: monospace;
    font-size: 13px;
    resize: vertical;
    box-sizing: border-box;
}
</style>
