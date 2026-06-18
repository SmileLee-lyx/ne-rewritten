import { lex_compare, type NotationDefinition, number_compare } from '@/utils.ts';

/** Bashicu 矩阵表达式：number[][]，其中 [[Infinity]] 表示极限。 */
export type Expr = number[][];

/** 判断表达式是否表示极限（[[Infinity]]）。 */
export function is_infinite(a: Expr): boolean {
    return ('' + a).startsWith('Infinity');
}

/** 矩阵比较：先处理 Infinity，再按字典序逐列比较。 */
export function compare(a: Expr, b: Expr): number {
    if (is_infinite(a) && is_infinite(b)) return 0;
    if (is_infinite(a)) return 1;
    if (is_infinite(b)) return -1;
    return lex_compare(a, b, (ca, cb) => lex_compare(ca, cb, number_compare));
}

/** 矩阵显示为字符串。空列显示为 (0)。 */
export function display(a: Expr): string {
    if (is_infinite(a)) return 'Limit';
    return a.map((col) => '(' + (col.length > 0 ? col.map((e) => '' + e).join(',') : '0') + ')').join('');
}

/**
 * 解析 display 的输出，恢复为矩阵。
 * 采用递归向下风格，内部 parse_column / parse_expression 返回 [result, end]。
 */
export function from_display(s: string): Expr {
    if (s === 'Limit') return [[Infinity]];
    s = s.trim();
    if (s === '') return [];

    function error(): never {
        throw new Error(`Illegal input string: ${s}`);
    }

    function skip_spaces(i: number): number {
        while (i < s.length && s[i] === ' ') i++;
        return i;
    }

    function parse_column(start: number): [number[], number] {
        if (s[start] !== '(') error();
        let i = skip_spaces(start + 1);

        if (i < s.length && s[i] === ')') return [[], i + 1];

        const col: number[] = [];
        while (i < s.length) {
            i = skip_spaces(i);

            if (i < s.length && s[i] >= '0' && s[i] <= '9') {
                let num = 0;
                while (i < s.length && s[i] >= '0' && s[i] <= '9') {
                    num = num * 10 + (s.charCodeAt(i) - 48);
                    i++;
                }
                col.push(num);
                i = skip_spaces(i);
                if (i < s.length && s[i] === ',') {
                    i++;
                } else if (i < s.length && s[i] === ')') {
                    i++;
                    break;
                } else {
                    error();
                }
            } else {
                error();
            }
        }
        return [col, i];
    }

    function parse_expression(start: number): [Expr, number] {
        const result: Expr = [];
        let i = start;
        while (i < s.length) {
            i = skip_spaces(i);
            if (i >= s.length || s[i] !== '(') break;
            const [col, end] = parse_column(i);
            result.push(col);
            i = end;
        }
        return [result, i];
    }

    const [result, end] = parse_expression(0);
    if (end !== s.length) error();
    return normalize(result);
}

/** 判断矩阵是否为极限（无限或最后一列首行非零）。 */
export function matrix_is_limit(a: Expr): boolean {
    return is_infinite(a) || (a.length > 0 && a[a.length - 1][0] > 0);
}

/** 返回每列末尾不含 0 的标准形式。 */
function normalize(m: Expr): Expr {
    return m.map((col) => {
        let end = col.length;
        while (end > 0 && col[end - 1] === 0) end--;
        return col.slice(0, end);
    });
}

/**
 * 计算矩阵每列每行的父节点索引。
 * 返回 P[i][j] 表示第 i 列第 j 行的父节点所在列号。
 */
function parents(m: Expr): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < m.length; i++) {
        result.push([]);
        for (let j = 0; j < m[i].length; j++) {
            let p: number | undefined = i;
            while (true) {
                p = j > 0 ? result[p!][j - 1] : p! - 1;
                if (p < 0) p = undefined;
                if (p === undefined) break;
                if ((m[p][j] ?? 0) < m[i][j]) break;
            }
            if (p !== undefined) result[i].push(p);
            else break;
        }
    }
    return result;
}

/**
 * 计算各列的阈值 A[i]。
 * 一项在复制时递增当且仅当它的祖先项经过根列。
 * A[i] 是列 i 中首个祖先链不经过根列的行号（0-based）。
 *
 * 判定：行 j 的祖先不经过根列，当 P[i][j] 无定义、
 * P[i][j] < r、或其自身的该行已不递增。
 */
function ascending_threshold(P: number[][], r: number, j_max: number): number[] {
    const result: number[] = [];
    result[r] = j_max;

    for (let i = r + 1; i < P.length; i++) {
        let result_i: number | undefined;
        for (let j = 0; j < j_max; j++) {
            const pij = P[i][j];
            if (pij === undefined || pij < r || j >= result[pij]) {
                result_i = j;
                break;
            }
        }
        result[i] = result_i ?? j_max;
    }

    return result;
}

/** BM4 展开算法。展开结果自动标准化。 */
function expand(m: Expr, index: number): Expr {
    if (m.length === 0) return m;

    const rightmost = m.length - 1;
    const col_last = m[rightmost];
    const height = col_last.length - 1;
    let topmost = height;
    for (; topmost >= 0; --topmost) {
        if (col_last[topmost] > 0) break;
    }

    let result = m.slice(0, rightmost);
    if (topmost < 0) return result;

    const P = parents(m);
    const r = P[rightmost][topmost];
    const A = ascending_threshold(P, r, topmost);
    const col_r = m[r];
    const offset = Array.from({ length: topmost }, (_, j) => col_last[j] - (col_r[j] ?? 0));

    for (let w = 1; w <= index; ++w) {
        for (let i = r; i < rightmost; ++i) {
            result.push(
                Array.from({ length: Math.max(m[i].length, A[i]) }, (_, y) => {
                    const val = m[i][y] ?? 0;
                    return y < A[i] ? val + offset[y] * w : val;
                }),
            );
        }
    }

    return result;
}

/**
 * 将 Bashicu 矩阵转换为 0-Y 数列。
 * 用于显示等价表示。
 */
export function convert_to_0Y(m: Expr): number[] {
    const P = parents(m);
    const mountain: number[][] = [];
    for (let i = 0; i < m.length; i++) {
        mountain.push([]);
        for (let j = P[i].length - 1; j >= 0; j--) {
            const up = mountain[i][j + 1] ?? 1;
            const left = mountain[P[i][j]][j] ?? 1;
            mountain[i][j] = up + left;
        }
    }
    return mountain.map((col) => col[0] ?? 1);
}

/** 基础数列展开缓存。 */
const data: Record<string, Expr[]> = {};

export const BM4: NotationDefinition<Expr> = {
    id: 'bm4',
    name: 'Bashicu matrix (BMS)',
    simple_name: 'BMS',
    display: { plain: display, from_display },
    display_equiv: {
        '0Y': (m) => (is_infinite(m) ? '1,ω' : '' + convert_to_0Y(m)),
    },
    is_limit: matrix_is_limit,
    compare,

    FS: (m, index) => {
        if (is_infinite(m)) return [[], Array(index + 1).fill(1)];
        if (m.length === 0) return [];

        const data_key = display(m);
        if (!data[data_key]) data[data_key] = [];
        else if (data[data_key][index] !== undefined) return data[data_key][index];

        return (data[data_key][index] = expand(m, index));
    },

    init: () => [[[Infinity]], []],
};
