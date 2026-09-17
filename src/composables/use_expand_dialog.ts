import { computed, ref, watch } from 'vue';
import { get_notation, list_notations } from '@/core/registry.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import type { ExpandSettings } from '@/core/settings.ts';
import { focus_node, get_last_focus } from '@/composables/use_focus_tracker.ts';
import { resolve_display, resolve_name } from '@/notation-definition.ts';
import { default_FS_variant, list_FS_variants, resolve_FS } from '@/core/fs_variants.ts';

const visible = ref(false);
const input_text = ref('');
const FS_index = ref(1);
const notation_id = ref('');
const notation_equiv = ref<string | undefined>(undefined);
/** 对话框内的试展开变体: 每次 open() 时取该记号当前的变体(FS_active), 不单独记忆。 */
const variant = ref<string>('FS_short');
const preview = ref<string | null>(null);
const preview_status = ref<'none' | 'ok' | 'error-parse' | 'error-no-from-display' | 'error-fs'>('none');

const _ui = use_ui_states();

const notation_options = computed(() => {
    _ui.registry_notifier.listen();
    return list_notations();
});
const equiv_options = computed(() => {
    const n = get_notation(notation_id.value);
    return n?.display_equiv ? Object.keys(n.display_equiv) : [];
});
/** 试展开所选记号可用的变体(没有的变体不列出)。 */
const variant_options = computed(() => {
    const n = get_notation(notation_id.value);
    return n ? list_FS_variants(n) : [];
});

function run_core() {
    const n = get_notation(notation_id.value);
    if (!n) {
        preview_status.value = 'error-no-from-display';
        preview.value = notation_id.value || 'unknown';
        return;
    }

    const equiv_name = notation_equiv.value;
    const display_spec =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);

    if (!display_spec.from_display) {
        preview_status.value = 'error-no-from-display';
        preview.value = resolve_name(n.name) ?? n.id;
        return;
    }

    let expr: any;
    try {
        expr = display_spec.from_display(input_text.value);
    } catch {
        preview_status.value = 'error-parse';
        preview.value = null;
        return;
    }

    let result: any;
    try {
        // 变体不存在时 resolve_FS 回退默认(与展开器的行为一致)
        const fs_fn = resolve_FS(n, variant.value);
        result = fs_fn(expr, FS_index.value);
    } catch {
        preview_status.value = 'error-fs';
        preview.value = null;
        return;
    }

    const result_display_data =
        equiv_name && n.display_equiv?.[equiv_name]
            ? resolve_display(n.display_equiv[equiv_name])
            : resolve_display(n.display);
    try {
        preview.value = result_display_data.plain(result);
        preview_status.value = 'ok';
    } catch {
        preview_status.value = 'error-fs';
        preview.value = null;
    }
}

watch([input_text, FS_index, notation_id, notation_equiv, variant], () => {
    if (visible.value) run_core();
});

/** 变体不属于当前记号时回到该记号的默认变体(下拉里不会留下不存在的选项)。 */
function clamp_variant() {
    const n = get_notation(notation_id.value);
    if (!n) return;
    if (!list_FS_variants(n).includes(variant.value)) variant.value = default_FS_variant(n);
}
watch(notation_id, clamp_variant);

export function use_expand_dialog() {
    function open(text: string, current_variant: string, expand_settings?: ExpandSettings) {
        input_text.value = text;
        if (expand_settings) {
            FS_index.value = expand_settings.FS_index;
            notation_id.value = expand_settings.notation_id || 'omega';
            notation_equiv.value = expand_settings.notation_equiv;
        } else if (!notation_id.value) {
            notation_id.value = 'omega';
        }
        // 变体不单独记忆: 打开时直接取该记号当前的变体(对话框内改动只影响本次试展开)
        variant.value = current_variant;
        clamp_variant();
        preview.value = null;
        preview_status.value = 'none';
        visible.value = true;
        window.setTimeout(() => run_core());
        window.setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>('.expand-text-input');
            el?.focus();
        });
    }

    function close() {
        visible.value = false;
        const path = get_last_focus();
        if (path) focus_node(path);
    }

    function save_settings(): ExpandSettings | null {
        if (!notation_id.value) return null;
        return {
            FS_index: FS_index.value,
            notation_id: notation_id.value,
            notation_equiv: notation_equiv.value,
        };
    }

    function confirm_and_fill() {
        if (preview_status.value !== 'ok' || preview.value === null) return;
        const path = get_last_focus();
        if (!path) return;
        const el = document.querySelector<HTMLInputElement>(`[data-tree-path="${path}"]`);
        if (!el) return;
        el.value = preview.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
        close();
    }

    return {
        visible,
        input_text,
        FS_index,
        notation_id,
        notation_equiv,
        variant,
        preview,
        preview_status,
        notation_options,
        equiv_options,
        variant_options,
        open,
        close,
        save_settings,
        confirm_and_fill,
    };
}
