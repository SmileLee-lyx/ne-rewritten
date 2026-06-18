import { lex_compare, type NotationDefinition, number_compare } from '@/utils';

export type Entry = [number, Expr];
export type Column = Entry[];
export type Expr = Column[];
export type Vertical = Expr[];

function entry_compare(e1: Entry, e2: Entry): number {
    if (e1[0] !== e2[0]) return number_compare(e1[0], e2[0]);
    return compare(e1[1], e2[1]);
}

function column_compare(c1: Column, c2: Column): number {
    return lex_compare(c1, c2, entry_compare);
}

export function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return lex_compare(v1, v2, compare);
}

/** 找首个 V[k] > pos 的 k，即覆盖位置 pos 的项下标。 */
function index_after(V: Vertical[], pos: Vertical): number {
    for (let k = 0; k < V.length; k++) {
        if (vertical_compare(V[k], pos) > 0) return k;
    }
    return V.length;
}

/**
 * 在列 p 的父链中，找覆盖位置 pos 的项所对应的父项。
 * 即返回 P[p][k] 其中 k 是首个 V[p][k] ≥ pos 的项。
 */
function vertical_parent(v: Vertical, Pi: [number, number][], Vi: Vertical[]): [number, number] | undefined {
    for (let k = 0; k < Vi.length; k++) {
        if (vertical_compare(Vi[k], v) >= 0) return Pi[k];
    }
    return undefined;
}

/** 序数加法：a + b。使用 CNF 截断规则。 */
function vertical_add(v1: Vertical, v2: Vertical): Vertical {
    if (v1.length === 0) return v2.slice();
    if (v2.length === 0) return v1.slice();
    const first2 = v2[0];
    let i = v1.length;
    while (i > 0 && compare(v1[i - 1], first2) < 0) i--;
    return v1.slice(0, i).concat(v2);
}

/**
 * 计算各列各项的父项 (col, entry_in_col)。
 *
 * 对列 i 的项 j，P(i,j) 必须是 i 的 (j-1)-祖先，
 * 故搜索从 P(i,j-1) 的列开始（j=0 时从 i-1 开始）。
 * 然后沿父链左查直至找到值更小的项。
 */
export function parents(m: Expr, V: Vertical[][]): [number, number][][] {
    const P: [number, number][][] = [];
    for (let i = 0; i < m.length; i++) {
        const Pi: [number, number][] = [];
        for (let j = 0; j < m[i].length; j++) {
            const [value] = m[i][j];
            const pos: Vertical = j === 0 ? [] : V[i][j - 1];
            let p = j === 0 ? i - 1 : Pi[j - 1][0];
            while (p >= 0) {
                if (m[p].length === 0) {
                    if (0 < value) {
                        Pi.push([p, 0]);
                        break;
                    }
                    p = -1;
                    break;
                }
                const j_p = j === 0 ? 0 : index_after(V[p], pos);
                if (j_p >= m[p].length) {
                    Pi.push([p, j_p]);
                    break;
                }
                const value_p = m[p][j_p][0];
                if (value_p < value) {
                    Pi.push([p, j_p]);
                    break;
                }
                const next = j === 0 ? [p - 1, 0] : vertical_parent(pos, P[p], V[p]);
                if (!next) {
                    p = -1;
                    break;
                }
                p = next[0];
            }
            if (p < 0) break;
        }
        P.push(Pi);
    }
    return P;
}

export function column_verticals(col: Column): Vertical[] {
    const result: Vertical[] = [];
    let acc: Vertical = [];
    for (const [, height_expr] of col) {
        acc = vertical_add(acc, [height_expr]);
        result.push(acc.slice());
    }
    return result;
}

/** 判断表达式是否表示 1（纯 ω-power ω^0）。即只有一个全零列。 */
function is_one(expr: Expr): boolean {
    return expr.length === 1 && expr[0].length === 0;
}

/** 在全零列处拆分表达式，返回各 ω 幂段。 */
function to_vertical(m: Expr): Vertical {
    const v: Vertical = [];
    let prev = 0;
    for (let i = 1; i <= m.length; i++) {
        if (i === m.length || m[i].length === 0) {
            v.push(m.slice(prev, i));
            prev = i;
        }
    }
    return v;
}

/** 展开极限列：将末项的高度展开，分解后替换末项。 */
function expand_limit(m: Expr, index: number, N: number): Expr {
    const col = m[N];
    const last_idx = col.length - 1;
    const [v, h] = col[last_idx];
    const new_h = TBM.FS(h, index);
    const segs = to_vertical(new_h);
    const result = m.slice();
    const new_entries: Entry[] = col.slice(0, last_idx);
    for (const seg of segs) new_entries.push([v, seg]);
    result[N] = new_entries;
    return result;
}

/**
 * 展开后继列：BM4 式 bad part 复制。
 *
 * 关键类型：
 *   j_max — 模板顶部位置 (Vertical)
 *   offset — 列式偏移量（[δ, 模板高度]）
 *   A[i]   — 列 i 的递增截止位置 (Vertical)
 *   copy_column(m[i], V[i], offset, A[i], w) — 仅需源列、源位置、偏移、阈值
 */
function expand_successor(m: Expr, index: number): Expr {
    const V = m.map(column_verticals);
    const P = parents(m, V);
    const N = m.length - 1;
    const r = P[N][m[N].length - 1][0];
    const result = m.slice(0, N);

    const j_max: Vertical = m[N].length > 1 ? V[N][m[N].length - 2] : [];

    const offset: Column = compute_offset(m, V, N, r);

    const A = ascending_threshold(V, P, r, j_max);

    for (let w = 1; w <= index; w++) {
        for (let i = r; i < N; i++) {
            result.push(copy_column(m[i], offset, A[i], w));
        }
    }
    return result;
}

/** 计算偏移列：offset[j] = [δ, template_h] */
function compute_offset(m: Expr, V: Vertical[][], N: number, r: number): Column {
    const off: Column = [];
    for (let j = 0; j < m[N].length; j++) {
        const pos: Vertical = j === 0 ? [] : V[N][j - 1];
        const j_r = index_after(V[r], pos);
        const delta = m[N][j][0] - (j_r < m[r].length ? m[r][j_r][0] : 0);
        off.push([delta, m[N][j][1]]);
    }
    return off;
}

/**
 * 计算 A[i]：递增截止位置 (Vertical)。
 * A[r] = j_max；对 i > r，逐项检查 i 自身的 entry：
 *   pos = V[i][j-1]（entry j 的起始位置）
 *   若父链经 r 且在 A[col_p] 内 → 继续；否则 A[i] = pos。
 *   全部通过 → A[i] = j_max。
 */
export function ascending_threshold(V: Vertical[][], P: [number, number][][], r: number, j_max: Vertical): Vertical[] {
    const A: Vertical[] = [];
    for (let i = 0; i < V.length; i++) {
        if (i < r) {
            A.push([]);
            continue;
        }
        if (i === r) {
            A.push(j_max);
            continue;
        }
        let found: Vertical | undefined;
        for (let j = 0; j < V[i].length; j++) {
            const pos: Vertical = j === 0 ? [] : V[i][j - 1];
            const [col_p] = P[i][j];
            if (col_p < r) {
                found = pos;
                break;
            }
            if (vertical_compare(pos, A[col_p]) >= 0) {
                found = pos;
                break;
            }
            let new_pos = V[i][j];
            if (vertical_compare(new_pos, A[col_p]) >= 0) {
                found = A[col_p];
                break;
            }
        }
        A.push(found ?? V[i][V[i].length - 1]);
    }
    return A;
}

/**
 * 两列之和：双指针消去法。
 *
 * 每次取两列当前项 (n^a, C) + (m^b, D)：
 *   1. 结果项 = ((m+n)^(min(a,b)), 后续)
 *   2. 若 a = b → 两项都消耗，递归计算 (C+D)
 *   3. 若 a < b → 消耗 a 项 (C + ((m+n)^b, D))
 *   4. 若 a > b → 消耗 b 项 (((m+n)^a, C) + D)
 *
 * 实现为双指针：ai, bi 分别指向 a, b 的当前项。
 * 每步取高度较小者，高度相等则两项同时消耗。
 */
export function column_add(a: Column, b: Column): Column {
    const res: Column = [];
    let ai = 0,
        bi = 0;
    while (ai < a.length || bi < b.length) {
        if (ai >= a.length) {
            res.push([b[bi][0], b[bi][1]]);
            bi++;
        } else if (bi >= b.length) {
            res.push([a[ai][0], a[ai][1]]);
            ai++;
        } else {
            const ea = a[ai],
                eb = b[bi];
            const cmp = compare(ea[1], eb[1]);
            const h = cmp < 0 ? ea[1] : eb[1];
            res.push([ea[0] + eb[0], h]);
            if (cmp <= 0) ai++;
            if (cmp >= 0) bi++;
        }
    }
    return res;
}

/**
 * 截断：在 j_max 处截断原列。
 *
 * 等同于 column_add(col, [[1,h] for h in v])，即把 j_max 看作全 1 向量，
 * 与 col 按 add 的消去规则配对；一侧耗尽即停止。
 */
export function column_truncate(col: Column, j_max: Vertical): Column {
    const res: Column = [];
    let ci = 0,
        vi = 0;
    while (ci < col.length && vi < j_max.length) {
        const e = col[ci];
        const vh = j_max[vi];
        const cmp = compare(e[1], vh);
        const h = cmp < 0 ? e[1] : vh;
        res.push([e[0], h]);
        if (cmp <= 0) ci++;
        if (cmp >= 0) vi++;
    }
    return res;
}

export function column_mul(col: Column, w: number): Column {
    return col.map(([v, e]) => [v * w, e]);
}

/**
 * 单列复制：copy_column(col_i, offset, A_i, w) =
 *   column_add(col_i, column_mul(truncate(offset, A_i), w))
 */
function copy_column(col_i: Column, offset: Column, A_i: Vertical, w: number): Column {
    return column_add(col_i, column_mul(column_truncate(offset, A_i), w));
}

export function expand(m: Expr, index: number): Expr {
    if (m.length === 0) return m;
    const N = m.length - 1;
    const last_col = m[N];
    if (last_col.length === 0) return m.slice(0, N);
    const [, last_height] = last_col[last_col.length - 1];
    if (is_one(last_height)) {
        return expand_successor(m, index);
    } else {
        return expand_limit(m, index, N);
    }
}

export function is_infinite(a: Expr): boolean {
    return a.length > 0 && a[0].length > 0 && a[0][0][0] === Infinity;
}

const ONE: Expr = [[]];
const OMEGA: Expr = [[], [[1, ONE]]];

function sep_display(s: Expr, html: boolean): string | undefined {
    if (s.length === 1) return undefined;
    if (compare(s, OMEGA) === 0) return 'ω';
    return display(s, html);
}

function entry_display([v, s]: Entry, html: boolean): string {
    let sd = sep_display(s, html);
    if (sd === undefined) return '' + v;
    if (html) return v + '<sup>' + sd + '</sup>';
    return v + '^' + sd;
}

function column_display(col: Column, html: boolean): string {
    return '(' + col.map((e) => entry_display(e, html)).join(',') + ')';
}

export function display(m: Expr, html: boolean = false): string {
    if (is_infinite(m)) return 'Limit';
    return m.map((col) => column_display(col, html)).join('');
}

export function from_display(str: string): Expr {
    throw new Error('TODO');
}

function Limit(index: number): Expr {
    if (index === 0) return [[]];
    return [[], [[1, Limit(index - 1)]]];
}

export const TBM: NotationDefinition<Expr> = {
    id: 'tbm',
    name: 'Transfinite Bashicu matrix (TBMS)',
    simple_name: 'TBMS',
    display: {
        plain: (m) => display(m, false),
        html: (m) => display(m, true),
        from_display,
    },
    is_limit: (m) => {
        if (is_infinite(m)) return true;
        if (m.length === 0) return false;
        return m[m.length - 1].length > 0;
    },
    compare,

    FS: (m, index) => {
        if (is_infinite(m)) {
            return Limit(index);
        }
        if (m.length === 0) return m;
        return expand(m, index);
    },

    init: (): Expr[] => {
        const entry: Entry = [Infinity, []];
        return [[[entry]]];
    },
};
