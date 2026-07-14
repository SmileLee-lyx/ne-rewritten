<script setup lang="ts">
import { inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { themes, use_color_theme } from '@/composables/use_color_theme.ts';
import ModalDialog from './ModalDialog.vue';

const t = inject(I18N_KEY)!;
const settings = inject(SETTINGS_KEY)!;
const ui = use_ui_states();
const { set_theme } = use_color_theme();

function select(id: string) {
    set_theme(id);
}
</script>

<template>
    <ModalDialog :show="ui.showColorTheme.value" :title="t('toolbar.theme')" @close="ui.showColorTheme.value = false">
        <div class="theme-grid">
            <button
                v-for="th in themes"
                :key="th.id"
                class="theme-card"
                :class="{ 'theme-card--active': settings.color_scheme === th.id }"
                :style="th.vars as any"
                @mousedown="select(th.id)"
            >
                <div class="theme-preview">
                    <div class="preview-notations">
                        <div class="preview-notation">ω</div>
                        <div class="preview-category">BM-like</div>
                    </div>
                    <div class="preview-notations">
                        <div class="preview-notation preview-notation--current">BMS</div>
                        <div class="preview-notation">UPMS</div>
                    </div>
                    <div class="preview-buttons">
                        <button class="preview-btn preview-btn--danger">{{ t('toolbar.reset') }}</button>
                        <button class="preview-btn">{{ t('toolbar.save') }}</button>
                        <button class="preview-btn preview-btn--tips">{{ t('toolbar.tips') }}</button>
                    </div>
                    <div class="preview-text">1,4,6,4</div>
                    <div class="preview-text preview-text--orig">(0)(1,1,1)(2,1)(1,1,1)</div>
                    <div class="preview-empty">(empty)</div>
                </div>
                <div class="theme-label">{{ t(th.label_key) }}</div>
            </button>
        </div>
    </ModalDialog>
</template>

<style scoped>
.theme-grid {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding: 8px 0;
}

.theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border: 2px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg);
    cursor: pointer;
    font-family: inherit;
    /* 继承主题变量到预览子元素 */
    font-size: 13px;
    min-width: 180px;
}

.theme-card:hover {
    border-color: var(--color-accent);
}

.theme-card--active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary-bg), var(--color-bg) 70%);
    box-shadow: 0 0 0 1px var(--color-primary);
}

.theme-preview {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 4px;
    border-radius: 6px;
    background: var(--color-bg);
}

.preview-category {
    display: inline-block;
    padding: 0 6px 2px;
    border: 2px solid var(--color-category);
    border-radius: 10px;
    background: var(--color-category-bg);
    color: var(--color-text);
    font-size: 13px;
    width: fit-content;
}

.preview-notation {
    display: inline-block;
    padding: 0 6px 2px;
    border: 2px solid var(--color-primary);
    border-radius: 10px;
    background: var(--color-primary-bg);
    color: var(--color-text);
    font-size: 13px;
    width: fit-content;
}

.preview-notations {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.preview-notation--current {
    background: var(--color-primary-active);
    color: var(--color-bg);
}

.preview-text {
    color: var(--color-text);
    font-size: 12px;
    word-break: break-all;
    text-align: left;
}

.preview-text--orig {
    color: var(--color-text-muted);
    margin-left: 12px;
}

.preview-empty {
    color: var(--color-text-muted);
    font-size: 12px;
    text-align: left;
}

.preview-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.preview-btn {
    padding: 1px 8px;
    height: 20px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
}

.preview-btn--danger {
    color: var(--color-danger);
}

.preview-btn--tips {
    color: var(--color-accent);
    font-weight: 600;
}

.theme-label {
    font-size: 13px;
    color: var(--color-text);
    white-space: nowrap;
}
</style>
