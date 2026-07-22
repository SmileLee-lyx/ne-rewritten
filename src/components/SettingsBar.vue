<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { I18N_KEY } from '@/composables/use_i18n.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { SAVE_LOAD_KEY } from '@/composables/use_save_load.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { use_diagram } from '@/composables/use_diagram.ts';
import { import_analysis } from '@/core/analysis.ts';
import { resolve_display } from '@/notation-definition.ts';
import { focus_node_input } from '@/composables/use_focus_tracker.ts';
import { reload_all } from '@/core/user_defined_notation.ts';

const settings = inject(SETTINGS_KEY)!;
const t = inject(I18N_KEY)!;
const save_load = inject(SAVE_LOAD_KEY)!;
const ui = use_ui_states();
const { notation, root } = save_load;
const { hide, show: show_diagram, dispatch_action } = use_diagram();

const settings_collapsed = ref(true);
const find_input = ref<HTMLInputElement>();
const font_options = ['Comic Sans MS', 'Consolas', 'Microsoft YaHei UI'];
const DISPLAY_MODES = ['plain', 'html', 'latex'] as const;

// 用户记号恢复：页面加载时不自动加载，等用户确认后再执行
const user_scripts_recovered = ref(false);
const has_pending_scripts = computed(
    () => !user_scripts_recovered.value && settings.user_scripts.some((s) => s.enabled),
);

function resume_scripts(): void {
    reload_all(settings.user_scripts);
    user_scripts_recovered.value = true;
    ui.registry_notifier.notify();
}

function disable_all(): void {
    for (const sc of settings.user_scripts) {
        sc.enabled = false;
    }
    settings.user_scripts = [...settings.user_scripts];
    user_scripts_recovered.value = true;
}

interface EquivOption {
    id: string;
    label: string;
}

const equiv_options = computed<EquivOption[]>(() => {
    const n = notation.value;
    if (!n?.display_equiv) return [];
    return Object.keys(n.display_equiv).map((id) => {
        const spec = n.display_equiv![id];
        const name_id = typeof spec !== 'function' && spec.name_id ? spec.name_id : undefined;
        return { id, label: name_id ? t(name_id) : id };
    });
});

const tier_name = computed(() => {
    const ti = settings.tier;
    const key = 'tier.' + ti;
    const label = t(key);
    if (label !== key) return label;
    return ti + '-fold expansion';
});

function toggle_diagram() {
    settings.show_diagram = !settings.show_diagram;
    if (settings.show_diagram) settings.show_latex = false;
}

function toggle_latex() {
    settings.show_latex = !settings.show_latex;
    if (settings.show_latex) settings.show_diagram = false;
}

function toggle_display_mode() {
    const idx = DISPLAY_MODES.indexOf(settings.display_mode);
    settings.display_mode = DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length];
}

function handle_find() {
    const n = notation.value;
    const r = root.value;
    const val = find_input.value?.value;
    if (!n || !r || !val) return;
    const equiv_name = settings.equiv_active[n.id];
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!display_spec.from_display) return;
    try {
        const expr = display_spec.from_display(val);
        const matched = import_analysis(r, [{ expr, analysis: [] }], n, settings.variant, settings.max_find_fs);
        if (matched.length > 0) {
            focus_node_input(matched[0]);
        } else {
            alert(t('import.error'));
        }
    } catch {
        alert(t('import.error'));
    }
}

function on_find_input() {
    const n = notation.value;
    const val = find_input.value?.value;
    if (!n || !val) {
        hide();
        return;
    }
    const dc = n.draw_diagram;
    if (!dc || !settings.show_diagram) return;
    const equiv_name = settings.equiv_active[n.id];
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    if (!display_spec.from_display) return;
    try {
        const expr = display_spec.from_display(val);
        const el = find_input.value;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        show_diagram(dc, expr, rect.left, 60 + rect.height, equiv_name ?? undefined);
    } catch {
        hide();
    }
}

function on_find_focus(e: FocusEvent) {
    const el = e.target as HTMLInputElement;
    const rect = el.getBoundingClientRect();
    const target_scroll = rect.top + window.scrollY - 60;
    window.scrollTo({ top: target_scroll, behavior: 'smooth' });
    on_find_input();
}

function on_find_keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handle_find();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        dispatch_action({ type: 'scroll', direction: 'up', step: 1 });
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        dispatch_action({ type: 'scroll', direction: 'down', step: 1 });
    } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        dispatch_action({ type: 'scroll', direction: 'left', step: 1 });
    } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        dispatch_action({ type: 'scroll', direction: 'right', step: 1 });
    }
}
</script>

<template>
    <div class="settings-box">
        <div class="toolbar">
            <div class="toolbar-row">
                <span
                    style="margin-right: 8px"
                    @mouseenter="settings.notation_name_mode === 'full' && ui.start_flash()"
                    @mouseleave="ui.stop_flash"
                >
                    {{ t('notation-name.mode-label') }}
                    <button
                        class="toggle-btn"
                        @mousedown="
                            settings.notation_name_mode = settings.notation_name_mode === 'full' ? 'simple' : 'full'
                        "
                    >
                        {{ t('notation-name.' + settings.notation_name_mode) }}
                    </button>
                </span>
                <span style="margin-left: 12px">
                    {{ t('config-display.label') }}
                    <button class="toggle-btn" @mousedown="ui.toggle_config_mode()">
                        {{ t('config-display.configure') }}
                    </button>
                </span>
                <span style="margin-left: 12px">
                    {{ t('nav-mode.label') }}
                    <button
                        class="toggle-btn"
                        @mousedown="settings.nav_mode = settings.nav_mode === 'grouped' ? 'flat' : 'grouped'"
                    >
                        {{ t('nav-mode.' + settings.nav_mode) }}
                    </button>
                </span>
            </div>
            <div class="toolbar-row">
                <label class="find-label">
                    {{ t('find-notation.label') }}
                    <input
                        ref="find_input"
                        type="text"
                        spellcheck="false"
                        @focus="on_find_focus"
                        @input="on_find_input"
                        @keydown="on_find_keydown"
                    />
                    <button @mousedown.prevent="handle_find">{{ t('find-notation.find') }}</button>
                </label>
                <label>
                    {{ t('find-notation.max-fs') }}
                    <input
                        type="number"
                        min="1"
                        max="9999"
                        v-model.number="settings.max_find_fs"
                        style="width: 60px; vertical-align: middle"
                    />
                </label>
            </div>
            <div class="toolbar-row">
                <label>
                    {{ t('fs-variant.label') }}
                    <select v-model="settings.variant" @mousedown.stop>
                        <option value="FS">{{ t('fs-variant.normal') }}</option>
                        <option value="FS_alter">{{ t('fs-variant.alternative') }}</option>
                        <option value="FS_short">{{ t('fs-variant.short') }}</option>
                    </select>
                </label>
                <span v-if="equiv_options.length > 0" style="margin-left: 8px">
                    <label>
                        {{ t('equiv.label') }}
                        <select
                            :value="settings.equiv_active[settings.current_notation_id] ?? ''"
                            @mousedown.stop
                            @change="
                                (e: any) => {
                                    settings.equiv_active = {
                                        ...settings.equiv_active,
                                        [settings.current_notation_id]:
                                            (e.target as HTMLSelectElement).value || undefined,
                                    };
                                }
                            "
                        >
                            <option value="">{{ t('equiv.default') }}</option>
                            <option v-for="k in equiv_options" :key="k.id" :value="k.id">
                                {{ k.label }}
                            </option>
                        </select>
                    </label>
                    <label style="margin-left: 8px" v-if="settings.equiv_active[settings.current_notation_id]">
                        <input
                            type="checkbox"
                            :checked="settings.equiv_hide_original[settings.current_notation_id] ?? true"
                            @change="
                                (e: any) => {
                                    settings.equiv_hide_original = {
                                        ...settings.equiv_hide_original,
                                        [settings.current_notation_id]: (e.target as HTMLInputElement).checked,
                                    };
                                }
                            "
                        />
                        {{ t('equiv.hide-original') }}
                    </label>
                </span>
            </div>
            <div class="toolbar-row">
                <label v-if="notation?.draw_diagram">
                    <input type="checkbox" :checked="settings.show_diagram" @change="toggle_diagram" />
                    {{ t('diagram.show') }}
                </label>
                <label>
                    <input type="checkbox" :checked="settings.show_latex" @change="toggle_latex" />
                    {{ t('latex.show') }}
                </label>
                <button @mousedown="ui.show_latex_analysis.value = true">{{ t('latex-analysis.title') }}</button>
            </div>
            <div class="toolbar-row">
                <button class="reset-btn" @mousedown="ui.show_reset.value = true">{{ t('toolbar.reset') }}</button>
                <button @mousedown="save_load.handle_export()">{{ t('toolbar.export') }}</button>
                <button @mousedown="save_load.handle_import()">{{ t('toolbar.import') }}</button>
                <button @mousedown="save_load.save_analysis()">{{ t('toolbar.save') }}</button>
                <button @mousedown="ui.show_hotkeys.value = true">{{ t('toolbar.hotkeys') }}</button>
                <button class="toolbar-btn-tips" @mousedown="ui.show_tips.value = true">{{ t('toolbar.tips') }}</button>
                <button @mousedown="ui.show_color_theme.value = true">{{ t('toolbar.theme') }}</button>
            </div>
            <hr v-if="!settings_collapsed" class="toolbar-separator" />
            <div v-if="!settings_collapsed" class="toolbar-row">
                <span style="margin-right: 8px">
                    {{ t('display.label') }}
                    <button class="toggle-btn" @mousedown="toggle_display_mode">
                        {{ t('display.' + settings.display_mode) }}
                    </button>
                </span>
                <span>
                    {{ t('tier.label') }}
                    <button class="tier-btn" @mousedown="settings.tier = Math.max(settings.tier - 1, 0)">
                        <span class="tier-icon">−</span>
                    </button>
                    {{ tier_name }}
                    <button class="tier-btn" @mousedown="settings.tier = settings.tier + 1">
                        <span class="tier-icon">+</span>
                    </button>
                </span>
            </div>
            <div v-if="!settings_collapsed" class="toolbar-row">
                <span style="margin-right: 8px">
                    {{ t('analysis-input.label') }}
                    <button class="toggle-btn" @mousedown="settings.show_input = !settings.show_input">
                        {{ settings.show_input ? t('analysis-input.show') : t('analysis-input.hide') }}
                    </button>
                </span>
                <label v-if="settings.show_input">
                    {{ t('analysis-input.width') }}
                    <input
                        type="range"
                        min="60"
                        max="600"
                        v-model.number="settings.input_width"
                        style="vertical-align: middle"
                    />
                    {{ settings.input_width }}px
                </label>
                <label>
                    <input type="checkbox" v-model="settings.use_delete_to_clear" />
                    {{ t('analysis-input.use-delete') }}
                </label>
            </div>
            <div v-if="!settings_collapsed" class="toolbar-row">
                <label>
                    {{ t('font.label') }}
                    <select v-model="settings.font_family" @mousedown.stop>
                        <option v-for="f in font_options" :key="f" :value="f">
                            {{ f }}
                        </option>
                    </select>
                </label>
                <label style="margin-left: 8px">
                    {{ t('language.label') }}
                    <select v-model="settings.language" @mousedown.stop>
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                    </select>
                </label>
            </div>
            <div v-if="!settings_collapsed" class="toolbar-row">
                <span>{{ t('user-defined.label') }}</span>
                <template v-if="has_pending_scripts">
                    <button @mousedown="resume_scripts">{{ t('user-defined.resume') }}</button>
                    <button @mousedown="disable_all">{{ t('user-defined.disable-all') }}</button>
                </template>
                <template v-else>
                    <button @mousedown="ui.show_user_defined.value = true">{{ t('user-defined.configure') }}</button>
                </template>
            </div>
        </div>
        <button class="collapse-btn" @mousedown="settings_collapsed = !settings_collapsed">
            {{ settings_collapsed ? t('settings.more') : t('settings.less') }}
        </button>
    </div>
</template>

<style scoped>
.toolbar-separator {
    border: none;
    border-top: 2px solid var(--color-border);
    margin: 12px 0 8px;
}
</style>
