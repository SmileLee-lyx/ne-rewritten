import { Comparator } from '@/utils.ts';

export function Y_FS_variants<T>(
    expand_longer: (seq: T[], index: number) => T[],
    is_infinity: (seq: T[]) => boolean,
    infinity_FS: (index: number) => T[],
    is_limit: (seq: T[]) => boolean,
    display: (seq: T[]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[], index: number) => T[]> {
    const data: Record<string, T[][]> = {};
    const data_short: Record<string, boolean> = {};

    const core = {
        FS: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const result = core.FS_alter(seq, index);
            return result.slice(0, result.length - 1);
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand_longer(seq, index));
        },
        FS_short: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            if (index === 1) {
                const result = core.FS_alter(seq, 1);
                return result.slice(0, seq.length);
            }
            const data_key = display(seq);
            const d = data_short[data_key];
            if (d === undefined) {
                data_short[data_key] = core.FS(seq, 1).length !== seq.length;
            }
            return core.FS(seq, index - (data_short[data_key] ? 1 : 0));
        },
    };
    return core;
}

export function sequence_FS_variants0<T>(
    expand: (seq: T[], index: number) => T[],
    is_infinity: (seq: T[]) => boolean,
    infinity_FS: (index: number) => T[],
    is_limit: (seq: T[]) => boolean,
    display: (seq: T[]) => string,
): Record<'FS' | 'FS_short', (seq: T[], index: number) => T[]> {
    const data: Record<string, T[][]> = {};
    const data_short: Record<string, boolean> = {};

    const core = {
        FS: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand(seq, index));
        },
        FS_short: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            if (index === 1) {
                const result = core.FS(seq, 1);
                return result.slice(0, seq.length);
            }
            const data_key = display(seq);
            let d = data_short[data_key];
            if (d === undefined) {
                d = data_short[data_key] = core.FS(seq, 0).length !== seq.length;
            }
            return core.FS(seq, index - (d ? 1 : 0));
        },
    };
    return core;
}

export function sequence_FS_variants<T>(
    expand: (seq: T[], index: number, shorter: boolean) => T[],
    is_infinity: (seq: T[]) => boolean,
    infinity_FS: (index: number) => T[],
    is_limit: (seq: T[]) => boolean,
    display: (seq: T[]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[], index: number) => T[]> {
    const data: Record<string, T[][]> = {};
    const data_alter: Record<string, T[][]> = {};
    const data_short: Record<string, boolean> = {};

    const core = {
        FS: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand(seq, index, true));
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data_alter[data_key] === undefined) data_alter[data_key] = [];
            else if (data_alter[data_key][index] !== undefined) return data_alter[data_key][index];
            return (data_alter[data_key][index] = expand(seq, index, false));
        },
        FS_short: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            if (index === 1) {
                const result = core.FS_alter(seq, 1);
                return result.slice(0, seq.length);
            }
            const data_key = display(seq);
            let d = data_short[data_key];
            if (d === undefined) {
                d = data_short[data_key] = core.FS(seq, 1).length !== seq.length;
            }
            return core.FS(seq, index - (d ? 1 : 0));
        },
    };
    return core;
}

/**
 * MN 系列的基本列: FS / FS_alter / FS_short 与 sequence_FS_variants 完全一致(同一实现),
 * 原先 MN 专属的 lnz-1(第 1 项改用截断)现在作为额外变体 FS_equiv.fast 保留。
 */
export function MN_FS_variants<T>(
    expand: (seq: T[][], index: number, shorter: boolean) => T[][],
    is_infinity: (seq: T[][]) => boolean,
    infinity_FS: (index: number) => T[][],
    is_limit: (seq: T[][]) => boolean,
    display: (seq: T[][]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[][], index: number) => T[][]> & {
    FS_equiv: { fast: (seq: T[][], index: number) => T[][] };
} {
    const base = sequence_FS_variants<T[]>(expand, is_infinity, infinity_FS, is_limit, display);
    const data_short: Record<string, [boolean, boolean]> = {};

    /** 原 MN 的 lnz-1: 与 FS_short 的区别是第 1 项用"末列去掉最后一个元素"的截断。 */
    const fast = (seq: T[][], index: number): T[][] => {
        if (is_infinity(seq)) return infinity_FS(index);
        if (!seq.length) return [];
        if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
        if (index === 0) return seq.slice(0, seq.length - 1);
        const data_key = display(seq);
        let d = data_short[data_key];
        if (d === undefined) {
            let target = base.FS(seq, 1);
            d = data_short[data_key] = [
                target[seq.length - 1].length !== seq[seq.length - 1].length - 1,
                target.length !== seq.length,
            ];
        }
        let current = 1;
        if (d[0]) {
            if (index === current) {
                let result = seq.slice();
                result[result.length - 1] = result[result.length - 1].slice();
                result[result.length - 1].pop();
                return result;
            } else current++;
        }
        if (d[1]) {
            if (index === current) {
                return base.FS(seq, 1).slice(0, seq.length);
            } else current++;
        }
        return base.FS(seq, 1 + index - current);
    };

    return { ...base, FS_equiv: { fast } };
}

export function merge_sum(terms: string[]): string {
    let result: string[] = [];
    let i = 0;
    while (i < terms.length) {
        let j = i + 1;
        let t = terms[i];
        while (j < terms.length && terms[j] === t) j++;
        if (j === i + 1) {
            result.push(terms[i]);
        } else {
            let count = j - i;
            if (t === '1') result.push('' + count);
            else result.push(t + count);
        }
        i = j;
    }
    return result.join('+');
}

export function FS_default_LNZ_variant<T>(
    expand: (expr: T, index: number) => T,
    compare: Comparator<T>,
    is_infinity: (expr: T) => boolean,
    infinity_FS: (index: number) => T,
    is_limit: (expr: T) => boolean,
    display: (expr: T) => string,
): Record<'FS' | 'FS_short', (expr: T, index: number) => T> {
    const data: Record<string, T[]> = {};
    const data_short: Record<string, [boolean, T]> = {};
    const data_lnz: Record<string, T> = {};

    const core = {
        FS: (expr: T, index: number): T => {
            if (is_infinity(expr)) return infinity_FS(index);
            if (!is_limit(expr)) return expand(expr, 0);
            const data_key = display(expr);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand(expr, index));
        },
        FS_short: (expr: T, index: number): T => {
            if (is_infinity(expr)) return infinity_FS(index);
            if (!is_limit(expr) || index === 0) return expand(expr, 0);
            const data_key = display(expr);
            let d = data_short[data_key];
            if (d === undefined) {
                const truncate = core.FS(expr, 0);
                const FS1 = core.FS(expr, 1);
                let result = FS1;
                while (true) {
                    const result_truncate = core.FS(result, 0);
                    if (compare(result_truncate, truncate) <= 0) break;
                    result = result_truncate;
                }
                d = data_short[data_key] = [compare(result, FS1) !== 0, result];
            }
            if (index === 1) return d[1];
            return core.FS(expr, index - (d[0] ? 1 : 0));
        },
    };
    return core;
}
