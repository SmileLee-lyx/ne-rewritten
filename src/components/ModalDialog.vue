<script setup lang="ts">
defineProps<{
    show: boolean;
    title?: string;
}>();

const emit = defineEmits<{
    close: [];
}>();

function on_overlay(e: MouseEvent) {
    if (e.target === e.currentTarget) emit('close');
}

function on_keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('close');
}
</script>

<template>
    <Teleport to="body">
        <div v-if="show" class="modal-overlay" @mousedown="on_overlay" @keydown="on_keydown" tabindex="-1">
            <div class="modal-dialog" @mousedown.stop>
                <div v-if="title" class="modal-header">
                    <span class="modal-title">{{ title }}</span>
                    <button class="modal-close" @mousedown="emit('close')">✕</button>
                </div>
                <div class="modal-body">
                    <slot />
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
}
.modal-dialog {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    min-width: 300px;
    max-width: 95vw;
    max-height: 85vh;
    overflow-y: auto;
}
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
}
.modal-title {
    font-weight: 600;
    font-size: 16px;
}
.modal-close {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    color: #999;
    padding: 0 4px;
}
.modal-close:hover {
    color: #333;
}
.modal-body {
    padding: 16px;
}
</style>
