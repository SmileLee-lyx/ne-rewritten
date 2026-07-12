import { NotationCategoryDefinition } from '@/core/notation_category.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { index_of_first } from '@/utils.ts';

// ========== RegisterError ==========

export class RegisterError extends Error {
    readonly id: string;

    constructor(id: string, message?: string) {
        super(message ?? `Item '${id}' is already registered.`);
        this.name = 'RegisterError';
        this.id = id;
    }
}

// ========== Category registry ==========

const category_defs = new Map<string, NotationCategoryDefinition>();
const root_items: { kind: 'category' | 'notation'; id: string }[] = [];
const category_items = new Map<string, { kind: 'category' | 'notation'; id: string }[]>();

function add_item(cat_id: string | undefined, kind: 'category' | 'notation', id: string): void {
    const list = cat_id ? (category_items.get(cat_id) ?? []) : root_items;
    list.push({ kind, id });
    if (cat_id && !category_items.has(cat_id)) {
        category_items.set(cat_id, list);
    }
}

export function register_category(cat: NotationCategoryDefinition): void {
    if (category_defs.has(cat.id) || map.has(cat.id)) {
        throw new RegisterError(cat.id, `Category '${cat.id}' conflicts with an existing item.`);
    }
    if (cat.parent_id !== undefined && !category_defs.has(cat.parent_id)) {
        throw new RegisterError(cat.id, `Parent category '${cat.parent_id}' not found for '${cat.id}'.`);
    }
    category_defs.set(cat.id, cat);
    add_item(cat.parent_id, 'category', cat.id);
}

export function get_category(id: string): NotationCategoryDefinition | undefined {
    return category_defs.get(id);
}

export function get_root_items(): { kind: 'category' | 'notation'; id: string }[] {
    return root_items;
}

export function get_category_children(id: string): { kind: 'category' | 'notation'; id: string }[] {
    return category_items.get(id) ?? [];
}

export function get_category_ancestors(category_id: string): string[] {
    const ancestors: string[] = [];
    let current: string | undefined = category_id;
    while (current) {
        ancestors.unshift(current);
        const cat = category_defs.get(current);
        current = cat?.parent_id;
    }
    return ancestors;
}

// ========== Notation registry ==========

const map = new Map<string, NotationDefinition<any>>();

/** 内部注册：不校验 generator 限制（供 init_generator / increment 使用） */
function _register_notation<T>(notation: NotationDefinition<T>): void {
    if (notation.category_id !== undefined && !category_defs.has(notation.category_id)) {
        throw new RegisterError(
            notation.id,
            `Category '${notation.category_id}' not found for notation '${notation.id}'.`,
        );
    }
    if (category_defs.has(notation.id)) {
        throw new RegisterError(
            notation.id,
            `A category with id '${notation.id}' already exists; cannot register as notation.`,
        );
    }
    if (map.has(notation.id)) {
        throw new RegisterError(notation.id, `Notation '${notation.id}' is already registered.`);
    }
    map.set(notation.id, notation);
    add_item(notation.category_id, 'notation', notation.id);
}

export function register_notation<T>(notation: NotationDefinition<T>): void {
    if (notation.category_id !== undefined) {
        const cat = category_defs.get(notation.category_id);
        if (cat?.generator) {
            throw new RegisterError(
                notation.id,
                `Cannot directly register '${notation.id}' under generator category '${cat.id}'. ` +
                    `Use init_generator instead.`,
            );
        }
    }
    _register_notation(notation);
}

export function get_notation(id: string): NotationDefinition<unknown> | undefined {
    return map.get(id);
}

export function list_notations(): NotationDefinition<unknown>[] {
    return Array.from(map.values());
}

export function unregister_notation(id: string): string[] {
    const notation = get_notation(id);
    if (!notation) return [];
    map.delete(id);
    const list = notation.category_id ? (category_items.get(notation.category_id) ?? root_items) : root_items;
    const idx = list.findIndex((item) => item.id === id);
    if (idx !== -1) list.splice(idx, 1);
    return [id];
}

export function unregister_category(id: string): string[] {
    const cat = category_defs.get(id);
    if (!cat) return [];
    const removed: string[] = [];

    // recursively unregister children
    const children = category_items.get(id) ?? [];
    for (const child of children) {
        if (child.kind === 'category') {
            removed.push(...unregister_category(child.id));
        } else {
            removed.push(...unregister_notation(child.id));
        }
    }

    category_defs.delete(id);
    category_items.delete(id);

    // remove from parent's child list
    const parent_list = cat.parent_id ? (category_items.get(cat.parent_id) ?? root_items) : root_items;
    const idx = parent_list.findIndex((item) => item.id === id);
    if (idx !== -1) parent_list.splice(idx, 1);

    removed.unshift(id);
    return removed;
}

export function unregister_item(id: string): string[] {
    if (category_defs.has(id)) return unregister_category(id);
    if (map.has(id)) return unregister_notation(id);
    return [];
}

// ========== Generator ==========

let gen_state: Record<string, number> = {};

/** 由外部（main.ts）在 settings 就绪后调用，注入持久化的 state。 */
export function set_generator_state(state: Record<string, number>): void {
    gen_state = state;
}

export function get_generator_state(): Record<string, number> {
    return gen_state;
}

// Generator 变更监听器（供 UI 层订阅）
type Listener = () => void;
const change_listeners = new Set<Listener>();

export function on_registry_change(listener: Listener): void {
    change_listeners.add(listener);
}

export function remove_registry_change_listener(listener: Listener): void {
    change_listeners.delete(listener);
}

export function notify_change(): void {
    for (const listener of change_listeners) {
        listener();
    }
}

export function is_extra_generated(id: string): boolean {
    const notation = get_notation(id);
    if (!notation?.category_id) return false;
    const cat = get_category(notation.category_id);
    if (!cat?.generator) return false;
    const items = get_category_children(notation.category_id);
    const idx = index_of_first(items, (item) => item.id === id);
    if (idx === -1) return false;
    return idx >= cat.generator.initial - cat.generator.start + 1;
}

export function init_generator(cat: NotationCategoryDefinition): void {
    const gen = cat.generator;
    if (!gen) throw new Error(`Category '${cat.id}' has no generator.`);
    const cur = gen_state[cat.id] ?? gen.initial;
    for (let n = gen.start; n <= cur; n++) {
        _register_notation(gen.create(n));
    }
    gen_state[cat.id] = cur;
}

export function generator_current(cat_id: string): number {
    const cat = category_defs.get(cat_id);
    if (!cat?.generator) return 0;
    return gen_state[cat_id] ?? cat.generator.initial;
}

export function generator_can_increment(cat_id: string): boolean {
    const cat = category_defs.get(cat_id);
    return cat?.generator !== undefined;
}

export function generator_can_decrement(cat_id: string): boolean {
    const cat = category_defs.get(cat_id);
    if (!cat?.generator) return false;
    return generator_current(cat_id) > cat.generator.initial;
}

export function generator_increment(cat_id: string): string | null {
    const cat = category_defs.get(cat_id);
    if (!cat?.generator) return null;
    const cur = gen_state[cat_id] ?? cat.generator.initial;
    const next_n = cur + 1;
    const notation = cat.generator.create(next_n);
    _register_notation(notation);
    gen_state[cat_id] = next_n;
    notify_change();
    return notation.id;
}

export function generator_decrement(cat_id: string): void {
    const cat = category_defs.get(cat_id);
    if (!cat?.generator) return;
    const cur = gen_state[cat_id] ?? cat.generator.initial;
    if (cur <= cat.generator.initial) return;
    // 从注册表中移除最后一个记号（不删除内存中的树和 localStorage 分析数据）
    const items = get_category_children(cat_id);
    const last_id = items.length > 0 ? items[items.length - 1].id : undefined;
    if (last_id) unregister_notation(last_id);
    gen_state[cat_id] = cur - 1;
    notify_change();
}
