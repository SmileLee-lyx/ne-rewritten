import type { NotationDefinition } from '@/notation-definition.ts';
import type { Settings } from '@/core/settings.ts';

/** 保留键: 与记号上的裸字段同名, 缺省时由裸字段充当该变体。 */
const RESERVED_KEYS = ['FS', 'FS_alter', 'FS_short'] as const;

/** 记号上的裸字段(只有保留键有)。 */
function bare_FS<T>(notation: NotationDefinition<T>, key: string): ((expr: T, index: number) => T) | undefined {
    if (key === 'FS') return notation.FS;
    if (key === 'FS_alter') return notation.FS_alter;
    if (key === 'FS_short') return notation.FS_short;
    return undefined;
}

/**
 * 该记号实际存在的变体 id: 保留键(有裸字段或表项)在前, `FS_equiv` 的自定义键随后。
 * 没有的变体不会出现在列表里(下拉中直接不显示)。
 */
export function list_FS_variants<T>(notation: NotationDefinition<T>): string[] {
    const ids: string[] = [];
    for (const key of RESERVED_KEYS) {
        if (notation.FS_equiv?.[key] ?? bare_FS(notation, key)) ids.push(key);
    }
    for (const key of Object.keys(notation.FS_equiv ?? {})) {
        if (!ids.includes(key)) ids.push(key);
    }
    return ids;
}

/** 默认变体: lnz-1(`FS_short`)优先, 不存在时回退短展开(`FS`)。 */
export function default_FS_variant<T>(notation: NotationDefinition<T>): string {
    return list_FS_variants(notation).includes('FS_short') ? 'FS_short' : 'FS';
}

/** 当前变体 id: 取该记号记住的选择, 无记录或记录已失效时用默认。 */
export function active_FS_variant<T>(settings: Settings, notation: NotationDefinition<T>): string {
    const chosen = settings.FS_active[notation.id];
    return chosen && list_FS_variants(notation).includes(chosen) ? chosen : default_FS_variant(notation);
}

/**
 * 取基本列函数: 变体表 → 同名裸字段 → 默认变体。
 * 显式给出却不存在的 id(老存档、脚本改过)一律回退默认并打印一次警告。
 */
export function resolve_FS<T>(notation: NotationDefinition<T>, id?: string): (expr: T, index: number) => T {
    if (id) {
        const found = notation.FS_equiv?.[id] ?? bare_FS(notation, id);
        if (found) return found;
        console.warn(`展开变体 '${id}' 在记号 '${notation.id}' 上不存在, 已回退默认变体。`);
    }
    const key = default_FS_variant(notation);
    return notation.FS_equiv?.[key] ?? bare_FS(notation, key) ?? notation.FS;
}

/** 变体在下拉中的显示名: 三个保留键走 i18n, 自定义变体直接显示字段名。 */
export function FS_variant_label(id: string, t: (key: string) => string): string {
    if (id === 'FS') return t('fs-variant.normal');
    if (id === 'FS_alter') return t('fs-variant.alternative');
    if (id === 'FS_short') return t('fs-variant.short');
    return id;
}
