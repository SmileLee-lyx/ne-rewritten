import {
    boolean_compare,
    type DiagramControl,
    lex_compare,
    lex_compare_by,
    type NotationDefinition,
    number_compare,
} from '@/utils.ts';
import type { Diagram } from '@/core/diagram_types';
import { Y_FS_variants } from '@/notations/FS_util.ts';
import { draw_mountain_diagram, type MountainDiagramData } from '@/notations/draw_mountain_util.ts';

/** Bashicu 矩阵表达式：number[][]，其中 [[Infinity]] 表示极限。 */
export type Expr = number[][];

/** 判断表达式是否表示极限（[[Infinity]]）。 */
export function is_infinity(a: Expr): boolean {
    return ('' + a).startsWith('Infinity');
}

export function is_limit(a: Expr): boolean {
    return a.length > 0 && a[a.length - 1].length > 0;
}

/** 矩阵比较：先处理 Infinity，再按字典序逐列比较。 */
export function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }
    return lex_compare(a, b, lex_compare_by(number_compare));
}

/** 矩阵显示为字符串。空列显示为 (0)。 */
export function display(a: Expr): string {
    if (is_infinity(a)) return 'Limit';
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
    return is_infinity(a) || (a.length > 0 && a[a.length - 1][0] > 0);
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

function infinity_FS(n: number): Expr {
    return [[], Array.from({ length: n + 1 }, () => 1)];
}

/** 基础数列展开缓存。 */
interface MountainData {
    m: Expr;
    M: number[][];
    P: number[][];
}

/**
 * 计算山脉图数值矩阵。
 * mountain[i][j] = up + left，其中 up 是上一行的值，left 是父节点的值。
 * 底部行 (j=0) 即为 0Y 序列。
 * 值为 0 的 BM 行已被省略，绘制山脉图时补充完整。
 */
function compute_mountain(m: Expr): MountainData {
    const P = parents(m);
    const h = Math.max(...m.map((col) => col.length));
    const diagram_rows = h + 1;
    const M: number[][] = [];
    for (let i = 0; i < m.length; i++) {
        M.push([]);
        for (let j = diagram_rows - 1; j >= 0; j--) {
            if (j >= P[i].length || P[i][j] < 0) {
                M[i][j] = 1;
            } else {
                const up = M[i][j + 1] ?? 1;
                const left = M[P[i][j]][j] ?? 1;
                M[i][j] = up + left;
            }
        }
    }
    return { m, M, P };
}

/**
 * 将 Bashicu 矩阵转换为 0-Y 数列。
 * 用于显示等价表示。
 */
export function convert_to_0Y(m: Expr): number[] {
    return compute_mountain(m).M.map((col) => col[0]);
}

export function display_0Y(m: Expr): string {
    return is_infinity(m) ? '1,ω' : convert_to_0Y(m).join(',');
}

export function compute_0Y_mountain(seq: number[]): MountainData {
    const P: number[][] = Array.from({ length: seq.length }, () => []);
    const M: number[][] = Array.from({ length: seq.length }, (_, i) => [seq[i]]);
    const m: Expr = Array.from({ length: seq.length }, (_) => []);

    for (let j = 0; ; j++) {
        let has_next = false;
        for (let i = 0; i < seq.length; i++) {
            if (M[i][j] === 1) {
                M[i].push(1);
            } else {
                let p = j === 0 ? i - 1 : P[i][j - 1];
                while (p >= 0) {
                    if (M[i][j] > M[p][j]) break;
                    p = j === 0 ? p - 1 : P[p][j - 1];
                }
                if (p >= 0) {
                    P[i].push(p);
                    M[i].push(M[i][j] - M[p][j]);
                    m[i].push((m[p][j] ?? 0) + 1);
                    has_next = true;
                } else {
                    throw new Error('Illegal 0Y sequence: ' + seq);
                }
            }
        }
        if (!has_next) break;
    }
    return { M, P, m };
}

export function from_display_0Y(str: string): Expr {
    if (str === 'Limit' || str === '1,ω' || str === '1,w') return [[Infinity]];
    const result = str.split(',').map((s) => parseInt(s.trim(), 10));
    if (result.find(Number.isNaN) !== undefined) throw new Error('Illegal omega-Y sequence');
    return compute_0Y_mountain(result).m;
}

export interface DiagramData {
    current_equiv: '0Y' | 'BMS' | undefined;
    invert_vertical?: boolean;
}

/** 计算层：将 BM 的 Expr 转为 MountainDiagramData。 */
function compute_bm_mountain_diagram(
    m: Expr,
    current_equiv: DiagramData['current_equiv'] & string,
): MountainDiagramData {
    const { M, P } = compute_mountain(m);
    const h = M[0].length - 1; // 行数 - 1

    const line_height = 40;

    const sorted_verticals: (string | undefined)[] = [];
    const heights: number[] = [];
    for (let vj = 0; vj <= h; vj++) {
        sorted_verticals.push(undefined);
        heights.push(vj * line_height); // 统一行高，与 MN 一致
    }

    const entries: (string | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: h + 1 }, () => undefined),
    );
    const left_legs: ([number, number] | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: h + 1 }, () => undefined),
    );

    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j <= h; j++) {
            const val = current_equiv === '0Y' ? M[i][j] : ((m[i] ?? [])[j] ?? 0);
            entries[i][j] = '' + val;
        }
        // left legs: 从上方元素 (j+1) 指向其父项
        for (let j = 0; j < P[i].length; j++) {
            if (P[i][j] >= 0 && j + 1 <= h) {
                left_legs[i][j + 1] = [P[i][j], j];
            }
        }
    }

    return { sorted_verticals, heights, line_heights: [], entries, left_legs };
}

const draw_diagram_control_BM: DiagramControl<Expr, DiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (m: Expr, _data: DiagramData): Diagram | undefined => {
        if (is_infinity(m) || m.length === 0) return undefined;
        const mountain = compute_bm_mountain_diagram(m, _data.current_equiv ?? 'BMS');
        return draw_mountain_diagram(mountain, { WV: 0, invert_vertical: _data.invert_vertical ?? false });
    },
    handle_action: (data: DiagramData, action): DiagramData | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'down') return { ...data, invert_vertical: true };
            if (action.direction === 'up') return { ...data, invert_vertical: false };
        }
        return null;
    },
};

const draw_diagram_control_0Y: DiagramControl<Expr, DiagramData> = {
    ...draw_diagram_control_BM,
    draw_diagram: (m: Expr, _data: DiagramData): Diagram | undefined => {
        if (is_infinity(m) || m.length === 0) return undefined;
        const mountain = compute_bm_mountain_diagram(m, _data.current_equiv ?? '0Y');
        return draw_mountain_diagram(mountain, { WV: 0, invert_vertical: _data.invert_vertical ?? false });
    },
};

export const BM4: NotationDefinition<Expr> = {
    id: 'bm4',
    name: 'Bashicu matrix (BMS)',
    simple_name: 'BMS',
    display: { plain: display, from_display },
    display_equiv: {
        '0Y': {
            plain: display_0Y,
            from_display: from_display_0Y,
        },
    },
    is_limit: matrix_is_limit,
    compare,
    draw_diagram: draw_diagram_control_BM,

    ...Y_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),

    init: () => [[[Infinity]], []],

    debug: { compute_0Y_mountain },
};

export const seq_0Y: NotationDefinition<Expr> = {
    id: '0y',
    name: '0-Y sequence',
    simple_name: '0Y',
    display: { plain: display_0Y, from_display: from_display_0Y },
    display_equiv: {
        BMS: {
            plain: display,
            from_display,
        },
    },
    is_limit: matrix_is_limit,
    compare,
    draw_diagram: draw_diagram_control_0Y,

    ...Y_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),

    init: () => [[[Infinity]], []],
};
