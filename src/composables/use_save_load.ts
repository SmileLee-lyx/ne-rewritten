import type { Ref } from 'vue';
import { computed, inject, type InjectionKey, reactive, ref, watch } from 'vue';
import { get_notation } from '@/core/registry.ts';
import { init_dataset, type TreeNode } from '@/core/tree.ts';
import {
    expand_all_pending,
    export_analysis,
    import_analysis,
    parse_analysis_entries,
    stringify_analysis_entries,
} from '@/core/analysis.ts';
import type { NotationDefinition } from '@/notation-definition.ts';
import { resolve_display } from '@/notation-definition.ts';
import { download_buffer, export_to_xlsx, import_from_xlsx } from '@/core/xlsx_io.ts';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { create_t } from '@/composables/use_i18n.ts';
import { use_ui_states } from '@/composables/use_ui_states.ts';
import { active_FS_variant } from '@/core/fs_variants.ts';

export interface SaveLoadInstance {
    trees: Map<string, TreeNode<unknown>>;
    notation: Ref<NotationDefinition<unknown> | undefined>;
    root: Ref<TreeNode<unknown> | null>;
    last_save_time: Ref<number>;
    save_indicator: Ref<string>;
    save_analysis: () => void;
    load_analysis: (id: string, r: TreeNode<unknown>) => void;
    handle_reset: () => void;
    /** 彻底移除某记号的树数据: 内存 trees 条目 + localStorage 自动保存的分析(供删除变体等 UI 路径调用)。 */
    remove_notation_data: (id: string) => void;
    handle_export: () => Promise<void>;
    handle_import: () => Promise<void>;
    init: () => void;
    dispose: () => void;
}

export const SAVE_LOAD_KEY: InjectionKey<SaveLoadInstance> = Symbol('save_load');

const ANALYSIS_STORAGE_PREFIX = 'ne-analysis-';

export function use_save_load(trees: Map<string, TreeNode<any>>) {
    const settings = inject(SETTINGS_KEY)!;
    const ui = use_ui_states();

    const current_id = computed(() => settings.current_notation_id);
    const notation = computed<NotationDefinition<any> | undefined>(() => {
        ui.registry_notifier.listen(); // registry 变化(如 reload_all)时重新解析当前记号
        return get_notation(current_id.value);
    });
    const root = computed<TreeNode<any> | null>(() => {
        let r = trees.get(current_id.value);
        if (!r) {
            const n = notation.value;
            if (!n) return null;
            r = reactive(init_dataset(n));
            trees.set(current_id.value, r);
        }
        return r;
    });

    const last_save_time = ref(Date.now());
    const save_indicator = ref('');

    let auto_save_timer: ReturnType<typeof setInterval> | null = null;
    let save_indicator_raf: number | null = null;

    function update_save_indicator() {
        const elapsed = Math.floor((Date.now() - last_save_time.value) / 1000);
        if (elapsed < 60) save_indicator.value = elapsed + 's';
        else save_indicator.value = Math.floor(elapsed / 60) + 'm' + (elapsed % 60) + 's';
        save_indicator_raf = requestAnimationFrame(update_save_indicator);
    }

    function save_analysis() {
        const n = notation.value;
        const r = root.value;
        if (!n || !r) return;
        const entries = export_analysis(r);
        localStorage.setItem(ANALYSIS_STORAGE_PREFIX + n.id, stringify_analysis_entries(entries));
        last_save_time.value = Date.now();
        update_save_indicator();
    }

    function load_analysis(id: string, r: TreeNode<any>) {
        const n = get_notation(id);
        if (!n) return;
        const raw = localStorage.getItem(ANALYSIS_STORAGE_PREFIX + id);
        if (!raw) return;
        try {
            const entries: any[] = parse_analysis_entries(raw);
            import_analysis(r, entries, n);
        } catch (e) {
            console.error('load_analysis: corrupt saved analysis for ' + id + ' (ignored):', e);
        }
    }

    function remove_notation_data(id: string) {
        trees.delete(id);
        localStorage.removeItem(ANALYSIS_STORAGE_PREFIX + id);
    }

    function handle_reset() {
        const n = notation.value;
        if (!n) return;
        localStorage.removeItem(ANALYSIS_STORAGE_PREFIX + n.id);
        const new_root: TreeNode<any> = reactive(init_dataset(n));
        trees.set(n.id, new_root);
    }

    async function handle_export() {
        const n = notation.value;
        const r = root.value;
        if (!n || !r) return;
        const entries = export_analysis(r);
        const equiv_name = settings.equiv_active[n.id];
        const display_fn =
            equiv_name && n.display_equiv?.[equiv_name]
                ? resolve_display(n.display_equiv[equiv_name]).plain
                : resolve_display(n.display).plain;
        const buf = await export_to_xlsx(entries, display_fn);
        download_buffer(buf, `${n.id}_analysis.xlsx`);
    }

    async function handle_import() {
        const el = document.createElement('input');
        el.type = 'file';
        el.accept = '.xlsx';
        el.style.display = 'none';
        el.addEventListener('change', async (e: Event) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            const n = notation.value;
            const r = root.value;
            if (!n || !r) return;
            const equiv_name = settings.equiv_active[n.id];
            const display_spec =
                equiv_name && n.display_equiv?.[equiv_name]
                    ? resolve_display(n.display_equiv[equiv_name])
                    : resolve_display(n.display);
            if (!display_spec.from_display) {
                console.error('import: current notation (or active equivalence) has no from_display; aborted.');
                return;
            }
            const buf = await file.arrayBuffer();
            const entries = await import_from_xlsx(buf, display_spec.from_display);
            const { matched, not_found } = import_analysis(r, entries, n);
            if ((entries as any).skipped?.length || not_found.length > 0) {
                console.error(
                    `import: ${(entries as any).skipped?.length ?? 0} row(s) failed to parse, ${not_found.length} entry(ies) not located.`,
                );
                alert(create_t(settings.language)('import.error'));
            }
            if (settings.expand_all_on_import) {
                expand_all_pending(r, n, active_FS_variant(settings, n));
            }
            if (matched.length > 0) {
                const last = matched[matched.length - 1];
                const ed = (last.extraData ??= {}) as any;
                ed.focus_on_mounted = true;
            }
            document.body.removeChild(el);
        });
        document.body.appendChild(el);
        el.click();
    }

    // 初始化加载当前记号的分析
    function init_load() {
        const r = root.value;
        if (r) load_analysis(current_id.value, r);
    }

    // onMounted: 启动自动保存与指示器
    function init() {
        auto_save_timer = setInterval(save_analysis, 30000);
        window.addEventListener('beforeunload', save_analysis);
        save_indicator_raf = requestAnimationFrame(update_save_indicator);
        init_load();
    }

    // onUnmounted: 清理
    function dispose() {
        if (auto_save_timer !== null) clearInterval(auto_save_timer);
        if (save_indicator_raf !== null) cancelAnimationFrame(save_indicator_raf);
        window.removeEventListener('beforeunload', save_analysis);
    }

    // 树创建或切换时自动加载分析
    watch(root, (r, old) => {
        if (r && r !== old) load_analysis(current_id.value, r);
    });

    return {
        trees,
        notation,
        root,
        last_save_time,
        save_indicator,
        save_analysis,
        load_analysis,
        handle_reset,
        remove_notation_data,
        handle_export,
        handle_import,
        init,
        dispose,
    } satisfies SaveLoadInstance;
}
