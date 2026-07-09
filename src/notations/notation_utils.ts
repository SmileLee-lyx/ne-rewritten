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
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand_longer(seq, index));
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const result = core.FS(seq, index);
            return result.slice(0, result.length - 1);
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
            const d = data_short[data_key];
            if (d === undefined) {
                data_short[data_key] = core.FS_alter(seq, 1).length !== seq.length;
            }
            return core.FS_alter(seq, index - (data_short[data_key] ? 1 : 0));
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
            return core.FS(seq, index - (d ? 2 : 1));
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
            return (data[data_key][index] = expand(seq, index, false));
        },
        FS_alter: (seq: T[], index: number): T[] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data_alter[data_key] === undefined) data_alter[data_key] = [];
            else if (data_alter[data_key][index] !== undefined) return data_alter[data_key][index];
            return (data_alter[data_key][index] = expand(seq, index, true));
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
                d = data_short[data_key] = core.FS_alter(seq, 1).length !== seq.length;
            }
            return core.FS_alter(seq, index - (d ? 1 : 0));
        },
    };
    return core;
}

export function MN_FS_variants<T>(
    expand: (seq: T[][], index: number, shorter: boolean) => T[][],
    is_infinity: (seq: T[][]) => boolean,
    infinity_FS: (index: number) => T[][],
    is_limit: (seq: T[][]) => boolean,
    display: (seq: T[][]) => string,
): Record<'FS' | 'FS_alter' | 'FS_short', (seq: T[][], index: number) => T[][]> {
    const data: Record<string, T[][][]> = {};
    const data_alter: Record<string, T[][][]> = {};
    const data_short: Record<string, [boolean, boolean]> = {};

    const core = {
        FS: (seq: T[][], index: number): T[][] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data[data_key] === undefined) data[data_key] = [];
            else if (data[data_key][index] !== undefined) return data[data_key][index];
            return (data[data_key][index] = expand(seq, index, false));
        },
        FS_alter: (seq: T[][], index: number): T[][] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            if (data_alter[data_key] === undefined) data_alter[data_key] = [];
            else if (data_alter[data_key][index] !== undefined) return data_alter[data_key][index];
            return (data_alter[data_key][index] = expand(seq, index, true));
        },
        FS_short: (seq: T[][], index: number): T[][] => {
            if (is_infinity(seq)) return infinity_FS(index);
            if (!seq.length) return [];
            if (!is_limit(seq)) return seq.slice(0, seq.length - 1);
            if (index === 0) return seq.slice(0, seq.length - 1);
            const data_key = display(seq);
            let d = data_short[data_key];
            if (d === undefined) {
                let target = core.FS_alter(seq, 1);
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
                    return core.FS_alter(seq, 1).slice(0, seq.length);
                } else current++;
            }
            return core.FS_alter(seq, 1 + index - current);
        },
    };
    return core;
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
