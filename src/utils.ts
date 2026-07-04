export type Comparator<T> = (a: T, b: T) => number;

export function number_compare(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
}

export function boolean_compare(a: boolean, b: boolean): number {
    return (a ? 1 : 0) - (b ? 1 : 0);
}

export function compare_ignore<T>(_a: T, _b: T): number {
    return 0;
}

/** 字典序比较（通用）。 */
export function lex_compare<T>(a: T[], b: T[], cmp: Comparator<T>): number {
    let len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const result = cmp(a[i], b[i]);
        if (result !== 0) return result;
    }
    return number_compare(a.length, b.length);
}

export function lex_compare_by<T>(cmp: Comparator<T>): Comparator<T[]> {
    return (a, b) => lex_compare(a, b, cmp);
}

export function anti_lex_compare<T>(a: T[], b: T[], cmp: Comparator<T>): number {
    if (a.length !== b.length) return number_compare(a.length, b.length);
    let len = a.length;
    for (let i = len - 1; i >= 0; i--) {
        const result = cmp(a[i], b[i]);
        if (result !== 0) return result;
    }
    return 0;
}

export function anti_lex_compare_by<T>(cmp: Comparator<T>): Comparator<T[]> {
    return (a, b) => anti_lex_compare(a, b, cmp);
}

export function tuple_lex_compare<T extends any[]>(a: T, b: T, cmp: { [i in keyof T]: Comparator<T[i]> }): number;

export function tuple_lex_compare(a: any[], b: any[], cmp: Comparator<any>[]): number {
    for (let i = 0; i < cmp.length; i++) {
        const result = cmp[i](a[i], b[i]);
        if (result !== 0) return result;
    }
    return 0;
}

export function tuple_lex_compare_by<T extends any[]>(cmp: { [i in keyof T]: Comparator<T[i]> }): Comparator<T> {
    return (a, b) => tuple_lex_compare(a, b, cmp);
}

export function object_lex_compare<T extends object, K extends keyof T>(
    a: T,
    b: T,
    cmp: { [i in K]: Comparator<T[i]> },
    order: K[],
): number {
    for (let key of order) {
        const result = cmp[key](a[key], b[key]);
        if (result !== 0) return result;
    }
    return 0;
}

export function object_lex_compare_by<T extends object, K extends keyof T>(
    cmp: { [i in K]: Comparator<T[i]> },
    order: K[],
): Comparator<T> {
    return (a, b) => object_lex_compare(a, b, cmp, order);
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

    /** Debug helpers — not consumed by the app but accessible at runtime. */
    debug?: Record<string, any>;
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

/** 以 display 为键的集合，实现值语义去重。 */
export class DisplaySet<T> {
    private _map: Map<string, T>;
    private readonly _display: (value: T) => string;

    constructor(display: (value: T) => string, items?: T[]) {
        this._display = display;
        this._map = new Map();
        if (items) {
            for (const item of items) {
                this.add(item);
            }
        }
    }

    add(value: T): this {
        this._map.set(this._display(value), value);
        return this;
    }

    has(value: T): boolean {
        return this._map.has(this._display(value));
    }

    delete(value: T): boolean {
        return this._map.delete(this._display(value));
    }

    values(): T[] {
        return Array.from(this._map.values());
    }

    get size(): number {
        return this._map.size;
    }

    forEach(callback: (value: T) => void): void {
        this._map.forEach((value) => callback(value));
    }

    [Symbol.iterator](): Iterator<T> {
        return this._map.values();
    }
}

/** 以 display 为键的映射，实现值语义键比较。 */
export class DisplayMap<T, V> {
    private _map: Map<string, [T, V]>;
    private readonly _display: (key: T) => string;

    constructor(display: (key: T) => string, entries?: [T, V][]) {
        this._display = display;
        this._map = new Map();
        if (entries) {
            for (const [key, value] of entries) {
                this.set(key, value);
            }
        }
    }

    set(key: T, value: V): this {
        this._map.set(this._display(key), [key, value]);
        return this;
    }

    get(key: T): V | undefined {
        return this._map.get(this._display(key))?.[1];
    }

    has(key: T): boolean {
        return this._map.has(this._display(key));
    }

    delete(key: T): boolean {
        return this._map.delete(this._display(key));
    }

    entries(): [T, V][] {
        return Array.from(this._map.values());
    }

    values(): V[] {
        return Array.from(this._map.values()).map(([, v]) => v);
    }

    keys(): T[] {
        return Array.from(this._map.values()).map(([k]) => k);
    }

    get size(): number {
        return this._map.size;
    }

    forEach(callback: (value: V, key: T) => void): void {
        this._map.forEach(([k, v]) => callback(v, k));
    }
}
