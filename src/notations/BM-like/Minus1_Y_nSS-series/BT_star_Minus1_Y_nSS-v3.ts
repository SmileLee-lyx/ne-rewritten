import { column_display as BM_column_display } from '@/notations/BM-like/BM.ts';
import {
    boolean_compare,
    index_of_last,
    lex_compare,
    lex_compare_by,
    number_compare,
    object_lex_compare,
    tuple_lex_compare,
    tuple_lex_compare_by,
} from '@/utils.ts';
import { NotationCategoryDefinition, NotationDefinition } from '@/notation-definition.ts';

export type ExprData<Data extends object> = ColumnData<Data>[];
export type ColumnData<Data extends object> = Data & { higher: ExprData<Data>[] };
export type Expr = ExprData<{ lower: number[] }>;
export type Column = ColumnData<{ lower: number[] }>;

const INFINITY: Expr = Infinity as any;

function ZERO_COLUMN(n: number): Column {
    return { lower: Array.from({ length: n }, () => 0), higher: [] };
}

function is_infinity(e: Expr): boolean {
    return e === INFINITY;
}

function infinity_FS(index: number, n: number): Expr {
    let result: Expr = [];
    for (let i = index; i > 0; i--) {
        result = [
            {
                lower: Array.from({ length: n }, (_, j) => i),
                higher: [result],
            },
        ];
    }
    return [ZERO_COLUMN(n), ...result];
}

function is_zero_column(c: Column): boolean {
    return c.lower.every((x) => x === 0) && c.higher.length === 0;
}

function top_display(e: Expr, html: boolean): string {
    if (e.length === 0) return html ? '∗' : '*';
    let d_e = display(e, html);
    return html ? '∗<sup>' + d_e + '</sup>' : '*^' + d_e;
}

function column_display(c: Column, html: boolean): string {
    if (c.higher.length === 0) return BM_column_display(c.lower);
    let result_list: string[] = [];
    for (let x of c.lower) result_list.push('' + x);
    for (let x of c.higher) result_list.push(top_display(x, html));
    return '(' + result_list + ')';
}

function display(e: Expr, html: boolean): string {
    if (is_infinity(e)) return 'Limit';

    return e.map((c) => column_display(c, html)).join('');
}

function is_limit(e: Expr): boolean {
    return is_infinity(e) || (e.length > 0 && !is_zero_column(e[e.length - 1]));
}

function column_compare(a: Column, b: Column): number {
    return object_lex_compare(
        a,
        b,
        {
            lower: lex_compare_by(number_compare),
            higher: lex_compare_by(compare),
        },
        ['lower', 'higher'],
    );
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

type ColumnParents = { parents: number[] };
type Parents = ExprData<ColumnParents>;

function compute_lower_parents(e: Expr, n: number, stack: Column[] = [], parent_stack: number[][] = []): Parents {
    const lS0 = stack.length;
    let result: Parents = [];
    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = stack.length;
        stack.push(e[i]);
        let result_i: number[] = Array.from({ length: n + 1 }, () => -1);
        parent_stack.push(result_i);
        for (let j = 0; j < n; j++) {
            let p = iS;
            while (p >= 0) {
                if (stack[p].lower[j] < col.lower[j]) break;
                p = j === 0 ? p - 1 : parent_stack[p][j - 1];
            }
            if (p < 0) break;
            result_i[j] = p;
        }

        result[i] = {
            parents: result_i,
            higher: col.higher.map((x: Expr): ExprData<ColumnParents> =>
                compute_lower_parents(x, n, stack, parent_stack),
            ),
        };
    }
    stack.splice(lS0);
    parent_stack.splice(lS0);
    return result;
}

type ColumnThreshold = { threshold: number };
type Thresholds = ExprData<ColumnThreshold>;

function empty_ascension_thresholds(e: Expr): Thresholds {
    return e.map((col: Column): ColumnData<ColumnThreshold> => ({
        threshold: 0,
        higher: col.higher.map(empty_ascension_thresholds),
    }));
}

function ascension_thresholds(
    e: Expr,
    P: ExprData<ColumnParents>,
    r: number,
    b: number,
    thresholds_stack: number[] = [],
): Thresholds {
    const lS0 = thresholds_stack.length;
    const result: Thresholds = [];

    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = thresholds_stack.length;

        if (iS < r && i !== e.length - 1) {
            thresholds_stack.push(0);
            result[i] = { threshold: 0, higher: col.higher.map(empty_ascension_thresholds) };
        } else {
            let Ai: number = 0;
            if (iS === r) {
                Ai = b;
            } else if (iS > r) {
                while (P[i].parents[Ai] >= r && thresholds_stack[P[i].parents[Ai]] > Ai) Ai++;
            }
            thresholds_stack.push(Ai);
            result[i] = {
                threshold: Ai,
                higher: col.higher.map((x: Expr, ix: number) =>
                    ascension_thresholds(x, P[i].higher[ix], r, b, thresholds_stack),
                ),
            };
        }
    }

    thresholds_stack.splice(lS0);
    return result;
}

type HeightColumn = { lower: number[]; threshold: number };
type Height = ExprData<HeightColumn>;

function to_height(base: number[], current: Expr, AT: Thresholds, n: number): Height {
    const result: Height = [];

    for (let i = 0; i < current.length; i++) {
        const { lower: col, higher: col_children } = current[i];
        const { threshold: A_col, higher: A_children } = AT[i];
        const result_i_lower: number[] = Array.from({ length: n }, (_, j) => (j < A_col ? col[j] - base[j] : col[j]));
        const result_i_higher = Array.from({ length: col_children.length }, (_, j) =>
            to_height(base, col_children[j], A_children[j], n),
        );
        result.push({ lower: result_i_lower, threshold: A_col, higher: result_i_higher });
    }

    return result;
}

function compute_vertical(col: Column, n: number): Vertical {
    const [P] = compute_lower_parents([col], n);
    const [AT] = ascension_thresholds([col], [P], 0, n);
    return Array.from({ length: col.higher.length }, (_, i) => to_height(col.lower, col.higher[i], AT.higher[i], n));
}

function from_height(base: number[], height: Height, n: number): Expr {
    const result: Expr = [];

    for (let i = 0; i < height.length; i++) {
        const { lower: col, threshold: A_col, higher: col_children } = height[i];
        const result_i_lower: number[] = Array.from({ length: n }, (_, j) => (j < A_col ? col[j] + base[j] : col[j]));
        const result_i_higher = Array.from({ length: col_children.length }, (_, j) =>
            from_height(base, col_children[j], n),
        );
        result.push({ lower: result_i_lower, higher: result_i_higher });
    }

    return result;
}

function height_column_compare(a: Height[number], b: Height[number]): number {
    return tuple_lex_compare(
        [a.lower.map((x, ix): [number, boolean] => [x, ix < a.threshold]), a.higher] as const,
        [b.lower.map((x, ix): [number, boolean] => [x, ix < b.threshold]), b.higher] as const,
        [lex_compare_by(tuple_lex_compare_by([number_compare, boolean_compare])), lex_compare_by(height_compare)],
    );
}

function height_compare(a: Height, b: Height): number {
    return lex_compare(a, b, height_column_compare);
}

type Vertical = Height[];

function vertical_compare(a: Vertical, b: Vertical): number {
    return lex_compare(a, b, height_compare);
}

function compute_top_parents(
    e: Expr,
    P: Parents,
    n: number,
    parent_stack: number[][] = [],
    vertical_stack: Vertical[] = [],
    outer_stack: number[] = [],
) {
    const lS0 = parent_stack.length;
    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const Pi = P[i];
        const iS = parent_stack.length;
        parent_stack.push(P[i].parents);

        const [{ higher: AT }] = ascension_thresholds([col], [Pi], iS, n, Array<number>(iS).fill(0));
        const vertical: Vertical = col.higher.map((col_top, j) => to_height(col.lower, col_top, AT[j], n));
        vertical_stack.push(vertical);

        let p = iS;
        while (p >= 0) {
            if (!outer_stack.includes(p) && vertical_compare(vertical_stack[p], vertical) < 0) break;
            p = parent_stack[p][n - 1];
        }
        Pi.parents[n] = p;

        outer_stack.push(iS);
        for (let j = 0; j < col.higher.length; j++) {
            compute_top_parents(col.higher[j], Pi.higher[j], n, parent_stack, vertical_stack, outer_stack);
        }
        outer_stack.pop();
    }
    parent_stack.splice(lS0);
    vertical_stack.splice(lS0);
}

function compute_parents(e: Expr, n: number) {
    const P = compute_lower_parents(e, n);
    compute_top_parents(e, P, n);
    return P;
}

function next_layer<T extends object>(current: ExprData<T>): ExprData<T> {
    const right = current.length - 1;
    const higher_right = current[right].higher.length - 1;
    return current[right].higher[higher_right];
}

function skip_layer<T extends object>(current: ExprData<T>, layer: number): ExprData<T> {
    for (let i = 0; i < layer; i++) current = next_layer(current);
    return current;
}

function compute_tail(e: Expr): [t: number, t_layer: number] {
    if (e.length === 0 || is_zero_column(e[e.length - 1])) return [-1, -1];
    let current = e,
        layer = 0,
        len = 0;
    while (true) {
        let right = current.length - 1;
        let higher_right = current[right].higher.length - 1;
        if (higher_right === -1) return [len + right, layer];
        if (current[right].higher[higher_right].length === 0) return [len + right, layer];
        len += current.length;
        layer++;
        current = next_layer(current);
    }
}

function compute_root_layer(e: Expr, r: number): [r_layer: number, r_index: number] {
    let layer = 0;
    let len = 0;
    let current = e;
    while (len + current.length <= r) {
        layer++;
        len += current.length;
        current = next_layer(current);
    }
    return [layer, r - len];
}

function root(e: Expr, P: Parents, t_layer: number): [r: number, b: number] | undefined {
    if (e.length === 0 || is_zero_column(e[e.length - 1])) return undefined;

    let tail_P = skip_layer(P, t_layer);

    let right = tail_P.length - 1;
    let b = index_of_last(tail_P[right].parents, (x) => x >= 0);
    let r = tail_P[right].parents[b];
    return [r, b];
}

function ascension_vector(e: Expr, b: number, r_layer: number, r_index: number, t_layer: number): number[] {
    const r_e = skip_layer(e, r_layer);
    const t_e = skip_layer(r_e, t_layer - r_layer);

    const col_r = r_e[r_index].lower;
    const col_t = t_e[t_e.length - 1].lower;

    return Array.from({ length: b }, (_, j) => col_t[j] - col_r[j]);
}

function ascend_vector(v: number[], A: number, V: number[], w: number): number[] {
    return v.map((x, i) => x + (i < A ? V[i] * w : 0));
}

function is_special(e: Expr, tail_layer: number): boolean {
    if (tail_layer === 0) return false;
    if (tail_layer > 1) return is_special(skip_layer(e, tail_layer - 1), 1);

    const tail = e[e.length - 1];
    const next = next_layer(e);
    const next_tail = next[next.length - 1];
    if (next_tail.higher.length > 0) return false;
    if (index_of_last(next_tail.lower, (x: number) => x > 0) !== 0) return false;
    return next_tail.lower[0] === tail.lower[0] + 1;
}

function FS_special(e: Expr, tail_layer: number, index: number): Expr {
    const right = e.length - 1;
    const higher_right = e[right].higher.length - 1;

    if (tail_layer === 1) {
        let vert_right = e[right].higher[higher_right].length - 1;
        let new_vert = e[right].higher[higher_right].slice(0, vert_right);
        return [
            ...e.slice(0, right),
            {
                lower: e[right].lower,
                higher: [...e[right].higher.slice(0, higher_right), ...Array.from({ length: index }, () => new_vert)],
            },
        ];
    }
    return [
        ...e.slice(0, right),
        {
            lower: e[right].lower,
            higher: [
                ...e[right].higher.slice(0, higher_right),
                FS_special(e[right].higher[higher_right], tail_layer - 1, index),
            ],
        },
    ];
}

function ascend_replace(
    e: Expr,
    tail: Expr,
    tail_layer: number | undefined,
    A: Thresholds,
    V: number[],
    w: number,
    critical_vert: Vertical,
): Expr {
    let result: Expr = [];
    for (let i = 0; i < e.length; i++) {
        if (tail_layer === 0 && i === e.length - 1) {
            result.push(...tail);
        } else {
            const col = e[i];
            const Ai = A[i].threshold;
            const higher_right = col.higher.length - 1;

            const new_col_lower = ascend_vector(col.lower, Ai ?? 0, V, w);
            const new_tail_layer = i !== e.length - 1 || tail_layer === undefined ? undefined : tail_layer - 1;

            const n = col.lower.length;

            const col_vertical = compute_vertical(col, n);

            let m = 0;
            while (m < col_vertical.length && m < critical_vert.length) {
                if (m === col_vertical.length - 1 && new_tail_layer !== undefined) break;
                const cmp = height_compare(col_vertical[m], critical_vert[m]);
                if (cmp > 0) break;
                if (cmp < 0) {
                    if (new_tail_layer !== undefined) m = col_vertical.length - 1;
                    else m = col_vertical.length;
                    break;
                }
                m++;
            }

            const new_higher = col_vertical.slice(0, m).map((x) => from_height(new_col_lower, x, n));
            for (let j = m; j < col_vertical.length; j++) {
                let new_term = ascend_replace(
                    col.higher[j],
                    tail,
                    j === higher_right ? new_tail_layer : undefined,
                    A[i].higher[j],
                    V,
                    w,
                    critical_vert,
                );
                // if (j === m) {
                //     while (new_higher.length > 0 && compare(new_higher[new_higher.length - 1], new_term) < 0) new_higher.pop();
                // }
                new_higher.push(new_term);
            }

            result[i] = {
                lower: new_col_lower,
                higher: new_higher,
            };
        }
    }
    return result;
}

function expand(e: Expr, index: number, n: number, lnz_m1: boolean): Expr {
    if (is_infinity(e)) return infinity_FS(index, n);
    if (e.length === 0) return e;
    if (!is_limit(e)) return e.slice(0, -1);

    const P = compute_parents(e, n);
    const [t, t_layer] = compute_tail(e);
    const [r, b] = root(e, P, t_layer)!;
    if (is_special(e, t_layer)) return FS_special(e, t_layer, index);
    const [r_layer, r_index] = compute_root_layer(e, r);
    const A = ascension_thresholds(e, P, r, b);
    const V = ascension_vector(e, b, r_layer, r_index, t_layer);

    const copy_part = skip_layer(e, r_layer).slice(r_index);
    const copy_part_A = skip_layer(A, r_layer).slice(r_index);
    const e_t = skip_layer(e, t_layer);
    const tail_right = e_t.length - 1;
    const tail = e_t[tail_right];

    const critical_vert = compute_vertical(tail, n).slice(0, -1);

    let result: Expr = [];

    if (lnz_m1 && index > 0) {
        // 1: cut tail; 2: lnz-1; 3+: normal expansion.
        const skip_2: boolean = copy_part.length === 1 || (copy_part.length === 2 && r_layer === t_layer);
        // if copy part is a single column, then [2] = [3], so skip [2].
        let skip_1: boolean;
        if (b === n) skip_1 = true;
        else {
            const root_column = copy_part[0];
            if (b === n - 1) skip_1 = root_column.higher.length === 0;
            else skip_1 = root_column.lower[b + 1] === 0;
        }
        // if ascended root column coincides with stripped tail, e.g. (1,1)(2,2), [1] = [2].

        if (!skip_1 && index > 0) {
            if (index === 1) {
                if (b === n) {
                    result = [
                        {
                            lower: tail.lower,
                            higher: tail.higher.slice(0, -1),
                        },
                    ];
                } else {
                    result = [
                        {
                            lower: tail.lower.map((x, ix) => (ix === b ? x - 1 : x)),
                            higher: [],
                        },
                    ];
                }
            }
            index--;
        }
        if (!skip_2 && index > 0) {
            if (index === 1) {
                result = ascend_replace([copy_part[0]], [], undefined, [copy_part_A[0]], V, 1, []);
                if (b === n) {
                    result[0].higher = critical_vert.map((x) => from_height(result[0].lower, x, n));
                }
            }
            index--;
        }
    }

    for (let w = index; w > 0; w--) {
        result = ascend_replace(copy_part, result, t_layer - r_layer, copy_part_A, V, w, critical_vert);
        if (b === n) {
            result[0].higher = critical_vert.map((x) => from_height(result[0].lower, x, n));
        }
    }
    result = ascend_replace(e, result, t_layer, A, V, 0, []);
    return result;
}

function FS(n: number): (e: Expr, index: number) => Expr {
    return (e, index) => expand(e, index, n, false);
}

function FS_short(n: number): (e: Expr, index: number) => Expr {
    return (e, index) => expand(e, index, n, true);
}

function from_display(s: string, n: number): Expr {
    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_number(): number {
        skip_spaces();
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_higher(): Expr {
        if (i >= s.length || (s[i] !== '*' && s[i] !== '∗')) error();
        i++;
        skip_spaces();
        if (i < s.length && s[i] === '^') {
            i++;
            return parse_expr();
        }
        return [];
    }

    function parse_column(): Column {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;

        const numbers: number[] = [];
        const higher: Expr[] = [];

        skip_spaces();
        while (i < s.length && s[i] !== ')' && s[i] >= '0' && s[i] <= '9' && numbers.length < n) {
            numbers.push(parse_number());
            skip_spaces();
            if (i < s.length && s[i] === ',') i++;
            skip_spaces();
        }

        while (i < s.length && s[i] !== ')') {
            skip_spaces();
            if (s[i] === '*' || s[i] === '∗') {
                if (numbers.length !== n) error();
                higher.push(parse_higher());
            } else {
                error();
            }
            skip_spaces();
            if (i < s.length && s[i] === ',') i++;
        }

        if (i >= s.length) error();
        i++;

        const arr = numbers.slice(0, n);
        while (arr.length < n) arr.push(0);
        return { lower: arr, higher };
    }

    function parse_expr(): Expr {
        const result: Expr = [];
        skip_spaces();
        while (i < s.length && s[i] === '(') {
            result.push(parse_column());
            skip_spaces();
        }
        return result;
    }

    skip_spaces();
    if (i + 5 <= s.length && s.substring(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY;
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

export const category_bm_bt_star_minus1_y_nss_v3: NotationCategoryDefinition = {
    id: 'category-bm-bt-star-minus1-y-nss-v3',
    name: "weak Bubby3's Transfinite* -1Y-nSS (v3)",
    simple_name: 'weak BT*nSS',
    parent_id: 'category-minus1-y-nss-series',
    generator: { start: 1, initial: 3, create: (n) => BT_star_Minus1_Y_nSS_v3(n) },
};

export function BT_star_Minus1_Y_nSS_v3(n: number): NotationDefinition<Expr> {
    return {
        id: 'bt*--1y-' + (n + 1) + 'ss-v3',
        category_id: 'category-bm-bt-star-minus1-y-nss-v3',
        name: 'weak BT*' + (n + 1) + 'SS',

        display: {
            plain: (e) => display(e, false),
            html: (e) => display(e, true),
            from_display: (s) => from_display(s, n),
        },
        is_limit: (e) => is_limit(e),
        compare,
        FS: FS(n),
        FS_short: FS_short(n),

        credit_text_id: 'credit.asheep-v2v3',

        init: () => [INFINITY, []],
    };
}
