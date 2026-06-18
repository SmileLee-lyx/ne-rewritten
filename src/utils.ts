/** 数字比较：相等 → 0，小于 → -1，大于 → 1。 */
export function number_compare(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
}

/** 字典序比较（通用）。 */
export function lex_compare<T>(a: T[], b: T[], cmp: (a: T, b: T) => number): number {
    let len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const result = cmp(a[i], b[i]);
        if (result !== 0) return result;
    }
    return number_compare(a.length, b.length);
}

import type { Diagram } from './core/diagram_types';

/** 深度克隆（支持数组和普通对象）。 */
export function deepcopy<T>(obj: T): T {
    if (!obj) return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'string') return obj;
    if (Array.isArray(obj)) {
        const result: any = Array.from({ length: obj.length });
        for (let i = 0, len = obj.length; i < len; i++) {
            if (i in obj) result[i] = deepcopy(obj[i]);
        }
        return result;
    } else {
        const result: any = {};
        for (const key in obj) {
            result[key] = deepcopy((obj as any)[key]);
        }
        return result;
    }
}

export type NotationDisplay<T> = (a: T) => string;

export type NotationDisplaySpec<T> =
    | NotationDisplay<T>
    | {
          plain: NotationDisplay<T>;
          html?: NotationDisplay<T>;
          from_display?: (str: string) => T;
      };

export function resolve_display<T>(spec: NotationDisplaySpec<T>): {
    plain: NotationDisplay<T>;
    html: NotationDisplay<T>;
    from_display?: (str: string) => T;
} {
    if (typeof spec === 'function') {
        return { plain: spec, html: spec };
    }
    return {
        plain: spec.plain,
        html: spec.html ?? spec.plain,
        from_display: spec.from_display,
    };
}

export interface NotationDefinition<T> {
    id: string;
    name: string;
    simple_name?: string;
    display: NotationDisplaySpec<T>;
    display_equiv?: Record<string, NotationDisplaySpec<T>>;
    is_limit: (a: T) => boolean;
    compare: (a: T, b: T) => number;
    FS: (a: T, index: number) => T;
    FS_alter?: (a: T, index: number) => T;
    FS_short?: (a: T, index: number) => T;
    draw_diagram?: DiagramControl<T, any>;
    init: () => T[];
}

export type DiagramAction = {
    type: 'scroll';
    direction: 'up' | 'down' | 'left' | 'right';
    step: number;
};

export interface DiagramControl<T, DataType> {
    default_data: DataType;
    draw_diagram: (expr: T, data: DataType) => Diagram | undefined;
    handle_action?: (data: DataType, action: DiagramAction) => DataType | null;
}

export function create_FS_variants<T>(
    expand_longer: (seq: T[], index: number) => T[],
    is_infinite: (seq: T[]) => boolean,
    Limit: (index: number) => T[],
    is_limit: (seq: T[]) => boolean,
    display: (seq: T[]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[], index: number) => T[]> {
    const data: Record<string, T[][]> = {};
    const data_short: Record<string, boolean> = {};

    const core = {
        FS: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand_longer(seq, index));
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const result = core.FS(seq, index);
            return result.slice(0, result.length - 1);
        },
        FS_short: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            if (index === 1) {
                const result = core.FS(seq, 1);
                return result.slice(0, seq.length);
            }
            const data_key = display(seq);
            const d = data_short[data_key];
            if (d === undefined) {
                data_short[data_key] = core.FS_alter(seq, 1).length === seq.length;
            }
            return core.FS_alter(seq, index - (data_short[data_key] ? 0 : 1));
        },
    };
    return core;
}

export function create_FS_variants_provided<T>(
    expand: (seq: T[], index: number, shorter: boolean) => T[],
    is_infinite: (seq: T[]) => boolean,
    Limit: (index: number) => T[],
    is_limit: (seq: T[]) => boolean,
    display: (seq: T[]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[], index: number) => T[]> {
    const data: Record<string, T[][]> = {};
    const data_alter: Record<string, T[][]> = {};
    const data_short: Record<string, boolean> = {};

    const core = {
        FS: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand(seq, index, false));
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data_alter[data_key] === undefined) data_alter[data_key] = [];
            else if (data_alter[data_key][index] !== undefined) return data_alter[data_key][index];
            return (data_alter[data_key][index] = expand(seq, index, true));
        },
        FS_short: (seq: T[], index: number): T[] => {
            if (!seq.length) return [];
            if (is_infinite(seq)) return Limit(index);
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            if (index === 1) {
                const result = core.FS(seq, 1);
                return result.slice(0, seq.length);
            }
            const data_key = display(seq);
            const d = data_short[data_key];
            if (d === undefined) {
                data_short[data_key] = core.FS_alter(seq, 1).length === seq.length;
            }
            return core.FS_alter(seq, index - (data_short[data_key] ? 0 : 1));
        },
    };
    return core;
}

export function index_of_first<T>(array: T[], predicate: (_: T) => boolean): number {
    return array.findIndex(predicate);
}

export function index_of_last<T>(array: T[], predicate: (_: T) => boolean): number {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i])) return i;
    }
    return -1;
}
