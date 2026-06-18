/** 数字比较：相等 → 0，小于 → -1，大于 → 1。 */
export function number_compare(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
}

export function boolean_compare(a: boolean, b: boolean): number {
    return (a ? 1 : 0) - (b ? 1 : 0);
}

export function compare_ignore<T>(a: T, b: T): number {
    return 0;
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

export function anti_lex_compare<T>(a: T[], b: T[], cmp: (a: T, b: T) => number): number {
    if (a.length !== b.length) return number_compare(a.length, b.length);
    let len = a.length;
    for (let i = len - 1; i >= 0; i--) {
        const result = cmp(a[i], b[i]);
        if (result !== 0) return result;
    }
    return 0;
}

export function tuple_lex_compare<T extends any[]>(a: T, b: T, cmp: { [i in keyof T]: (a: T[i], b: T[i]) => number }): number;

export function tuple_lex_compare(a: any[], b: any[], cmp: ((a: any, b: any) => number)[]): number {
    for (let i = 0; i < cmp.length; i++) {
        const result = cmp[i](a[i], b[i]);
        if (result !== 0) return result;
    }
    return 0;
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

export function index_of_first<T>(array: T[], predicate: (_: T) => boolean): number {
    return array.findIndex(predicate);
}

export function index_of_last<T>(array: T[], predicate: (_: T) => boolean): number {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i])) return i;
    }
    return -1;
}
