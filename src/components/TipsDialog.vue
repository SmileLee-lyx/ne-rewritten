<script setup lang="ts">
import { inject } from 'vue';
import ModalDialog from './ModalDialog.vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';

defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: [] }>();
const t = inject(I18N_KEY)!;
</script>

<template>
    <ModalDialog :show="show" :title="t('toolbar.tips')" @close="emit('close')">
        <div class="tips-content">
            <p class="tips-intro">{{ t('tips.intro') }}</p>

            <div class="tips-section">
                <div class="tips-section-title">{{ t('tips.features') }}</div>
                <ol class="tips-list">
                    <li v-html="t('tips.f1')" />
                    <li v-html="t('tips.f2')" />
                    <li v-html="t('tips.f3')" />
                    <li v-html="t('tips.f4')" />
                    <li v-html="t('tips.f5')" />
                </ol>
            </div>

            <div class="tips-section">
                <div class="tips-section-title">{{ t('tips.faq') }}</div>
                <ol class="tips-list">
                    <li v-html="t('tips.q1')" />
                    <li v-html="t('tips.q2')" />
                    <li v-html="t('tips.q3')" />
                    <li v-html="t('tips.q4')" />
                </ol>
            </div>
        </div>
    </ModalDialog>
</template>

<style scoped>
.tips-content {
    max-width: 520px;
    line-height: 1.7;
    font-size: 14px;
    color: var(--color-text);
}
.tips-intro {
    margin: 0 0 16px;
    color: var(--color-text);
}
.tips-section {
    margin-bottom: 16px;
}
.tips-section:last-child {
    margin-bottom: 0;
}
.tips-section-title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 8px;
    color: var(--color-text);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--color-border-subtle);
}
.tips-list {
    margin: 0;
    padding-left: 20px;
}
.tips-list li {
    margin-bottom: 6px;
}
.tips-list li:last-child {
    margin-bottom: 0;
}
.tips-content :deep(kbd) {
    display: inline-block;
    padding: 2px 6px;
    font-size: 12px;
    font-family: Consolas, monospace;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--color-border);
}
</style>
