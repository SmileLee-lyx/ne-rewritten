<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { use_mountain_panel } from '@/composables/use_mountain_panel.ts';
import { get_notation } from '@/core/registry.ts';
import { resolve_display, resolve_name } from '@/notation-definition.ts';
import { build_mountain_view, type MountainView } from '@/notations/mountain_view.ts';
import HtmlMountainView from '@/components/HtmlMountainView.vue';

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const panel = use_mountain_panel();

const parse_error = ref('');
const input_ref = ref<HTMLInputElement>();

const notation = computed(() => get_notation(panel.notation_id.value));

const notation_label = computed(() => {
    const n = notation.value;
    if (!n) return panel.notation_id.value;
    const spec = settings.notation_name_mode === 'simple' ? (n.simple_name ?? n.name) : n.name;
    return resolve_name(spec, t) ?? n.id;
});

function display_spec(equiv: string | undefined) {
    const n = notation.value;
    if (!n) return undefined;
    return resolve_display(equiv && n.display_equiv?.[equiv] ? n.display_equiv[equiv] : n.display);
}

/** 解析输入框内容得到的表达式(供切换输入等价表示时重新写出)。 */
const current_expr = ref<unknown>(undefined);
/** 解析出的表达式 + 绘图等价表示 → 山脉图结构。 */
const view = computed<MountainView | undefined>(() => {
    const n = notation.value;
    const spec = display_spec(panel.input_equiv.value);
    if (!n || !spec?.from_display) {
        parse_error.value = t('mountain.no-from-display');
        return undefined;
    }
    let expr: unknown;
    try {
        expr = spec.from_display(panel.text.value);
    } catch (e) {
        parse_error.value = e instanceof Error ? e.message : String(e);
        return undefined;
    }
    current_expr.value = expr;
    parse_error.value = '';
    if (!n.mountain_view) return undefined;
    const source = n.mountain_view(expr, { current_equiv: panel.draw_equiv.value });
    return source ? build_mountain_view(source) : undefined;
});

/** 切换输入等价表示:把当前表达式按新形式重写回输入框。 */
function on_input_equiv_change(e: Event) {
    const value = (e.target as HTMLSelectElement).value || undefined;
    panel.set_input_equiv(value, current_expr.value);
}

function on_close_key(e: KeyboardEvent) {
    if (e.key === 'Escape') panel.close();
}

watch(panel.visible, (v) => {
    parse_error.value = '';
    if (v) {
        window.addEventListener('keydown', on_close_key);
        // 打开时把焦点交给表达式输入框, 避免键盘仍落在被遮住的记号输入框上
        nextTick(() => input_ref.value?.focus());
    } else {
        window.removeEventListener('keydown', on_close_key);
    }
});

onUnmounted(() => window.removeEventListener('keydown', on_close_key));
</script>

<template>
    <Teleport to="body">
        <div
            v-if="panel.visible.value"
            class="mtn-overlay"
            tabindex="-1"
            @mousedown.self="panel.close()"
            @keydown="on_close_key"
        >
            <div class="mtn-panel" @mousedown.stop>
                <div class="mtn-head">
                    <span class="mtn-title">{{ notation_label }} · {{ t('mountain.panel') }}</span>
                    <button class="mtn-close" @mousedown.prevent="panel.close()">✕</button>
                </div>
                <div class="mtn-controls">
                    <label class="mtn-field mtn-field--grow">
                        {{ t('mountain.expression') }}
                        <input ref="input_ref" v-model="panel.text.value" class="mtn-input" spellcheck="false" />
                    </label>
                    <label class="mtn-field">
                        {{ t('mountain.input-equiv') }}
                        <select :value="panel.input_equiv.value ?? ''" @change="on_input_equiv_change">
                            <option value="">{{ t('equiv.default') }}</option>
                            <option v-for="key in Object.keys(notation?.display_equiv ?? {})" :key="key" :value="key">
                                {{ key }}
                            </option>
                        </select>
                    </label>
                    <label class="mtn-field">
                        {{ t('mountain.draw-equiv') }}
                        <select v-model="panel.draw_equiv.value">
                            <option :value="undefined">{{ t('equiv.default') }}</option>
                            <option v-for="key in Object.keys(notation?.display_equiv ?? {})" :key="key" :value="key">
                                {{ key }}
                            </option>
                        </select>
                    </label>
                </div>
                <div class="mtn-body">
                    <HtmlMountainView v-if="view" :view="view" />
                    <div v-else class="mtn-hint">
                        {{ parse_error ? t('mountain.parse-error') + ' ' + parse_error : t('mountain.none') }}
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.mtn-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100001;
}

.mtn-panel {
    display: flex;
    flex-direction: column;
    width: 92vw;
    height: 88vh;
    background: var(--color-bg);
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
    overflow: hidden;
}

.mtn-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border-subtle);
}

.mtn-title {
    font-weight: 600;
}

.mtn-close {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--color-text-muted);
}

.mtn-close:hover {
    color: var(--color-text);
}

.mtn-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid var(--color-border-subtle);
}

.mtn-field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.mtn-field--grow {
    flex: 1 1 320px;
}

.mtn-input {
    flex: 1 1 auto;
    min-width: 160px;
    font-family: Consolas, 'Courier New', monospace;
    padding: 3px 6px;
}

.mtn-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 10px 14px;
    display: flex;
}

.mtn-body > * {
    flex: 1 1 auto;
}

.mtn-hint {
    color: var(--color-text-muted);
    align-self: flex-start;
}
</style>
