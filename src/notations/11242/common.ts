import { seriesText } from './text.ts';
import type { NotationDisplaySpec, TextSpec } from '@/notation-definition.ts';

export class ResourceLimit extends Error {
    constructor(message = seriesText('error.budget')) {
        super(message);
        this.name = 'ResourceLimit';
    }
}

export function budget(ms = 250, maxWork = 2_000_000) {
    const start = Date.now();
    let work = 0;
    return () => {
        if (++work > maxWork || ((work & 255) === 0 && Date.now() - start > ms)) throw new ResourceLimit();
    };
}

export function natural(n: number, maximum = Number.MAX_SAFE_INTEGER): number {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(seriesText('error.natural'));
    if (n > maximum) throw new ResourceLimit();
    return n;
}

export const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const textHtml = (value: string) =>
    `<span style="font-family:inherit;white-space:nowrap">${escapeHtml(value)}</span>`;
export const textLatex = (value: string) => '\\text{' + value.replace(/[\\{}_^%#$&]/g, (c) => '\\' + c) + '}';
export function textDisplay<T>(
    name: TextSpec,
    plain: (expr: T) => string,
    parse?: (text: string) => T,
): NotationDisplaySpec<T> {
    return {
        name,
        plain,
        html: (expr) => textHtml(plain(expr)),
        latex: (expr) => textLatex(plain(expr)),
        ...(parse ? { from_display: parse } : {}),
    };
}
export const countText = (values: (bigint | null)[]) =>
    values.map((v) => (v === null ? '?' : String(v))).join(',') || '0';

export function lex<T>(a: T[], b: T[], compare: (a: T, b: T) => number): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const c = compare(a[i], b[i]);
        if (c) return c;
    }
    return Math.sign(a.length - b.length);
}

/** A timeout leaves exact completed columns intact; it never supplies an approximate value. */
export function partialCounts<T>(columns: T[][], calculate: (j: number) => bigint): (bigint | null)[] {
    const values = columns.map((col) => (col.length ? null : 1n)) as (bigint | null)[];
    try {
        for (let j = 0; j < columns.length; j++) values[j] = calculate(j);
    } catch (error) {
        if (!(error instanceof ResourceLimit)) throw error;
    }
    return values;
}
