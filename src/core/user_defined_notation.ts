import type { NotationDefinition } from '@/notation-definition.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';
import {
    get_category_children,
    init_generator,
    notify_change,
    register_category,
    register_notation,
    unregister_item,
} from '@/core/registry.ts';
import type { UserScript } from '@/core/settings.ts';

// ============ Types ============

type CollectedItem =
    { kind: 'category'; def: NotationCategoryDefinition } | { kind: 'notation'; def: NotationDefinition<any> };

// ============ Module-level state ============

const user_registered_ids: Set<string> = new Set();
const script_warnings: Map<string, string[]> = new Map(); // file_name → failed_ids

// ============ Collect (dry-run register) ============

function collect_from(code: string): CollectedItem[] {
    const collected: CollectedItem[] = [];

    function fake_register_notation(def: NotationDefinition<any>) {
        collected.push({ kind: 'notation', def });
    }

    function fake_register_category(def: NotationCategoryDefinition) {
        collected.push({ kind: 'category', def });
    }

    // eslint-disable-next-line no-new-func
    const fn = new Function('register_notation', 'register_category', code);
    fn(fake_register_notation, fake_register_category);

    return collected;
}

// ============ Topological sort ============
// 稳定拓扑排序：仅在有依赖（parent_id / category_id）时调整顺序，其余保持原相对顺序。
// 依赖满足后，立即将暂存项按原序插入，确保先依赖的项不晚于后依赖的同类项。

function get_parent_id(item: CollectedItem): string | undefined {
    return item.kind === 'category' ? item.def.parent_id : item.def.category_id;
}

function topological_sort(items: CollectedItem[]): CollectedItem[] {
    const result: CollectedItem[] = [];
    const cat_ids = new Set<string>();
    const placed = new Set<string>();

    for (const item of items) {
        if (item.kind === 'category') cat_ids.add(item.def.id);
    }

    function dep_ready(id: string | undefined): boolean {
        return !id || !cat_ids.has(id) || placed.has(id);
    }

    const deferred: CollectedItem[] = [];

    function flush_deferred(): void {
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < deferred.length; i++) {
                if (dep_ready(get_parent_id(deferred[i]))) {
                    const item = deferred.splice(i, 1)[0];
                    result.push(item);
                    if (item.kind === 'category') placed.add(item.def.id);
                    changed = true;
                    i--;
                }
            }
        }
    }

    for (const item of items) {
        if (dep_ready(get_parent_id(item))) {
            result.push(item);
            if (item.kind === 'category') placed.add(item.def.id);
            flush_deferred(); // 刚放入的 category 可能解锁暂存项
        } else {
            deferred.push(item);
        }
    }

    // 剩余无法满足依赖的项追加到末尾
    result.push(...deferred);
    return result;
}

// ============ Reload ============

export interface ReloadResult {
    script_warnings: Map<string, string[]>;
}

export function reload_all(scripts: UserScript[]): ReloadResult {
    // 1. Unregister all previously registered items
    for (const id of user_registered_ids) {
        unregister_item(id);
    }
    user_registered_ids.clear();
    script_warnings.clear();

    // 2. Collect from all enabled scripts in order
    const all_collected: CollectedItem[] = [];
    const source_map = new Map<CollectedItem, string>(); // item → file_name
    const per_script_failures = new Map<string, string[]>();

    for (const script of scripts) {
        if (!script.enabled) continue;
        try {
            const items = collect_from(script.code);
            for (const item of items) {
                all_collected.push(item);
                source_map.set(item, script.file_name);
            }
        } catch (e: any) {
            const failures = per_script_failures.get(script.file_name) ?? [];
            failures.push(e.message ?? String(e));
            per_script_failures.set(script.file_name, failures);
        }
    }

    // 3. Topological sort
    const sorted = topological_sort(all_collected);

    // 4. Register
    for (const item of sorted) {
        try {
            if (item.kind === 'category') {
                register_category(item.def);
                user_registered_ids.add(item.def.id);
                // 自动初始化 generator category
                if (item.def.generator) {
                    init_generator(item.def);
                    for (const child of get_category_children(item.def.id)) {
                        user_registered_ids.add(child.id);
                    }
                }
            } else {
                register_notation(item.def);
                user_registered_ids.add(item.def.id);
            }
        } catch (e: any) {
            const file_name = source_map.get(item) ?? 'unknown';
            const failures = per_script_failures.get(file_name) ?? [];
            failures.push(item.def.id + ': ' + (e.message ?? String(e)));
            per_script_failures.set(file_name, failures);
        }
    }

    // Update module-level warnings
    for (const [file_name, failures] of per_script_failures) {
        script_warnings.set(file_name, failures);
    }

    // 通知 UI 层（registry_notifier）刷新
    notify_change();

    return { script_warnings: new Map(script_warnings) };
}

export function get_script_warnings(): Map<string, string[]> {
    return new Map(script_warnings);
}
