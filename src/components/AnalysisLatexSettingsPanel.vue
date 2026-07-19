<script setup lang="ts">
import { inject } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import ModalDialog from './ModalDialog.vue';

const t = inject(I18N_KEY)!;
const settings = inject(SETTINGS_KEY)!;
const ui = use_ui_states();
</script>

<template>
    <ModalDialog
        :show="ui.show_latex_analysis.value"
        :title="t('latex-analysis.title')"
        @close="ui.show_latex_analysis.value = false"
    >
        <div class="las-list">
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.subscript_bracket" />
                <span>{{ t('latex-analysis.subscript-bracket') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_p" />
                <span>{{ t('latex-analysis.map-p') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_w" />
                <span>{{ t('latex-analysis.map-w') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_e" />
                <span>{{ t('latex-analysis.map-e') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_f" />
                <span>{{ t('latex-analysis.map-f') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_l" />
                <span>{{ t('latex-analysis.map-l') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.map_W" />
                <span>{{ t('latex-analysis.map-W') }}</span>
            </label>
            <label class="las-item">
                <input type="checkbox" v-model="settings.latex_analysis.psi_subscript" />
                <span>{{ t('latex-analysis.psi-subscript') }}</span>
            </label>
        </div>
    </ModalDialog>
</template>

<style scoped>
.las-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 280px;
}

.las-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--color-text);
    font-size: 14px;
}

.las-item input[type='checkbox'] {
    margin: 0;
    width: 16px;
    height: 16px;
    cursor: pointer;
}
</style>
