<script setup lang="ts">
import ModalDialog from './ModalDialog.vue';

defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    close: [];
}>();

const global_hotkeys = [
    { keys: 'Ctrl+R', desc: 'Focus last focused input' },
    { keys: 'Ctrl+S', desc: 'Export analysis to xlsx' },
    { keys: 'Ctrl+L', desc: 'Import analysis from xlsx' },
];

const input_hotkeys = [
    { keys: 'Enter', desc: 'Expand current expression (tier 0)' },
    { keys: 'Shift+Enter', desc: 'Expand current expression (tier 1)' },
    { keys: 'Ctrl+H', desc: 'Hide/show children' },
    { keys: '↑ / ↓', desc: 'Move between inputs' },
    { keys: 'Ctrl+↑ / ↓', desc: 'Diagram operations' },
    { keys: 'Delete', desc: 'Clear analysis text (toggle in settings)' },
];
</script>

<template>
    <ModalDialog :show="show" title="Keyboard Shortcuts" @close="emit('close')">
        <div class="hotkey-section">
            <div class="hotkey-section-title">Global</div>
            <table class="hotkey-table">
                <tr v-for="hk in global_hotkeys" :key="hk.keys">
                    <td class="hotkey-keys">
                        <kbd>{{ hk.keys }}</kbd>
                    </td>
                    <td class="hotkey-desc">{{ hk.desc }}</td>
                </tr>
            </table>
        </div>
        <div class="hotkey-section">
            <div class="hotkey-section-title">Input focus</div>
            <table class="hotkey-table">
                <tr v-for="hk in input_hotkeys" :key="hk.keys">
                    <td class="hotkey-keys">
                        <kbd>{{ hk.keys }}</kbd>
                    </td>
                    <td class="hotkey-desc">{{ hk.desc }}</td>
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
