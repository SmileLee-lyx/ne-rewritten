<script setup lang="ts">
import { inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import ModalDialog from './ModalDialog.vue';

defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    close: [];
}>();

const t = inject(I18N_KEY)!;

const global_hotkeys = [
    { keys: 'Ctrl+R', desc_key: 'hotkey.focus-last' },
    { keys: 'Ctrl+S', desc_key: 'hotkey.export' },
    { keys: 'Ctrl+L', desc_key: 'hotkey.import' },
];

const input_hotkeys = [
    { keys: 'Enter', desc_key: 'hotkey.expand-0' },
    { keys: 'Shift+Enter', desc_key: 'hotkey.expand-1' },
    { keys: 'Ctrl+E', desc_key: 'hotkey.expand-analysis' },
    { keys: 'Ctrl+D', desc_key: 'hotkey.debug-log' },
    { keys: 'Ctrl+H', desc_key: 'hotkey.toggle-children' },
    { keys: '↑ / ↓', desc_key: 'hotkey.move-inputs' },
    { keys: 'Ctrl+↑ / ↓', desc_key: 'hotkey.diagram-ops' },
    { keys: 'Delete', desc_key: 'hotkey.delete-clear' },
];
</script>

<template>
    <ModalDialog :show="show" :title="t('hotkey.title')" @close="emit('close')">
        <div class="hotkey-section">
            <div class="hotkey-section-title">{{ t('hotkey.global') }}</div>
            <table class="hotkey-table">
                <tr v-for="hk in global_hotkeys" :key="hk.keys">
                    <td class="hotkey-keys">
                        <kbd>{{ hk.keys }}</kbd>
                    </td>
                    <td class="hotkey-desc">{{ t(hk.desc_key) }}</td>
                </tr>
            </table>
        </div>
        <div class="hotkey-section">
            <div class="hotkey-section-title">{{ t('hotkey.input') }}</div>
            <table class="hotkey-table">
                <tr v-for="hk in input_hotkeys" :key="hk.keys">
                    <td class="hotkey-keys">
                        <kbd>{{ hk.keys }}</kbd>
                    </td>
                    <td class="hotkey-desc">{{ t(hk.desc_key) }}</td>
                </tr>
            </table>
        </div>
    </ModalDialog>
</template>

<style scoped>
.hotkey-table {
    border-collapse: collapse;
}
.hotkey-table td {
    padding: 6px 12px;
}
.hotkey-keys {
    white-space: nowrap;
    text-align: right;
}
.hotkey-desc {
    color: #555;
}
.hotkey-section + .hotkey-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;
}
.hotkey-section-title {
    font-weight: 600;
    font-size: 13px;
    color: #666;
    margin-bottom: 4px;
    padding: 0 12px;
}
kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 12px;
    font-family: Consolas, monospace;
    background: #f4f4f4;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 1px 0 #bbb;
}
</style>
