import { index_of_last, lex_compare, lex_compare_by, number_compare, object_lex_compare } from '@/utils.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type ExprCompact = [number[], number, ExprCompact[]][];

export type ExprData<Data extends object> = ColumnData<Data>[];
export type ColumnData<Data extends object> = Data & { higher: ExprData<Data>[] };

export type Expr = ExprData<{ lower: number[]; mark: number }>;
export type Column = Expr[number];

function compactify(e: Expr): ExprCompact {
    if (is_infinity(e)) return INFINITY_compact();
    return e.map(({ lower, mark, higher }) => [lower, mark, higher.map(compactify)]);
}

function decompactify(e: ExprCompact): Expr {
    if (is_infinity(e)) return INFINITY();
    return e.map((col) => ({ lower: col[0], mark: col[1], higher: col[2].map(decompactify) }));
}

function INFINITY(): Expr {
    return Infinity as any;
}

function INFINITY_compact(): ExprCompact {
    return Infinity as any;
}

function is_infinity(e: Expr | ExprCompact): boolean {
    return '' + e === '' + Infinity;
}

function ZERO_COLUMN(n: number): Column {
    return { lower: Array.from({ length: n }, () => 0), mark: 0, higher: [] };
}

function infinity_FS(index: number, n: number): Expr {
    let result: Expr = [];
    for (let i = index; i > 0; i--) {
        result = [{ lower: Array.from({ length: n }, () => i), mark: i, higher: [result] }];
    }
    return [ZERO_COLUMN(n), ...result];
}

function is_zero_column(col: Column): boolean {
    return col.lower.every((x) => x === 0) && col.higher.length === 0;
}

function top_display(e: Expr, u: number, html: boolean, use_sc: boolean): string {
    if (e.length === 0) return '' + u;
    let d_e = display(e, html, use_sc);
    return html ? '' + u + '<sup>' + d_e + '</sup>' : '' + u + '^' + d_e;
}

function column_display(col: Column, html: boolean, use_sc: boolean): string {
    if (col.higher.length > 0) {
        let higher_display = col.higher.map((x) => top_display(x, col.mark, html, use_sc));

        if (use_sc) {
            return '(' + col.lower + ';' + higher_display + ')';
        } else {
            let j = col.lower.length;
            if (col.higher[0].length > 0) {
                j = index_of_last(col.lower, (x) => x !== col.mark) + 1;
            }
            return '(' + [...col.lower.slice(0, j), ...higher_display].join(',') + ')';
        }
    } else {
        let j = index_of_last(col.lower, (x) => x > 0) + 1;
        return '(' + col.lower.slice(0, j) + ')';
    }
}

function display(e: Expr, html: boolean, separate: boolean): string {
    if (is_infinity(e)) return 'Limit';

    return e.map((c: Column) => column_display(c, html, separate)).join('');
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
            mark: number_compare,
            higher: lex_compare_by(compare),
        },
        ['lower', 'mark', 'higher'],
    );
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

function remove_base(e: Expr, base: number): Expr {
    function expr_remove_base(a: Expr): Expr {
        return a.map(col_remove_base);
    }

    function col_remove_base(col: Column): Column {
        return {
            lower: col.lower.map((x, i) => (i === 0 ? x - base : x)),
            mark: col.mark,
            higher: col.higher.map(expr_remove_base),
        };
    }

    return expr_remove_base(e);
}

function higher_remove_base(c: Column): Expr[] {
    return c.higher.map((x: Expr) => remove_base(x, c.lower[0] + 1));
}

function is_one_line_column(c: Column, value: number): boolean {
    return c.lower[0] === value && c.lower.slice(1).every((x) => x === 0) && c.higher.length === 0;
}

/**
 * 例子中, n = 2.
 *
 * lower: ≤ n 行的常规展开. 不包括 star 展开. 例: ()(1,1,1)(2,2) => ()(1,1,1)(2,1,1)(3,1,1)...
 * higher: 第 n+1 行为后继时的常规展开. 不包括 mark 展开. 例: ()(1,1,1)(2,2,1) => ()(1,1,1)(2,2)(3,3,1)(4,4)...
 * star: LNZ 恰为一行, 其父项为直接外部项. 进行 star 展开. 例: ()(1,1,1^(2)) => ()(1,1,1,1,...)
 * mark: mark > 1 且父项为某个 mark 更低的外部项. 需要补项展开. 不包括 mark* 展开. 例: ()(1,1,1^(2,2,2,2)) => ()(1,1,1^(2,2,2)(3,3,2)...)
 * mark*: mark > 1 且第 n+1 行为 1 时的展开, 此时父项为某个外部项. 进行 φ 型展开. 例: ()(1,1,1^(2,2,2)) => ()(1,1,1^(2,2,1^(3,3,1^...)))
 * undefine: 空列. 只会在顶层出现.
 */
type ExpansionType = 'lower' | 'higher' | 'star' | 'mark' | 'mark*' | undefined;

type ColumnParents = {
    entry_parents: number[];
    type: ExpansionType;
    is_tail: boolean;
};

function compute_parents(
    e: Expr,
    n: number,
    column_stack: Column[] = [],
    parent_stack: ColumnParents[] = [],
    outer_stack: number[] = [],
): ExprData<ColumnParents> {
    const lS0 = column_stack.length;
    let result: ExprData<ColumnParents> = [];

    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = column_stack.length;
        column_stack.push(e[i]);
        let result_i: ColumnParents = {
            entry_parents: Array.from({ length: n + 1 }, () => -1),
            type: undefined,
            is_tail: false,
        };
        parent_stack.push(result_i);
        for (let j = 0; j < n; j++) {
            let p = iS;
            while (p >= 0) {
                if (column_stack[p].lower[j] < col.lower[j]) break;
                p = j === 0 ? p - 1 : parent_stack[p].entry_parents[j - 1];
            }
            if (p < 0) break;
            result_i.entry_parents[j] = p;
        }
        // block for local variables
        {
            let p = iS;
            while (p >= 0) {
                if (column_stack[p].mark < col.mark && outer_stack.includes(p)) {
                    result_i.type = 'mark';
                    if (col.higher.length === 1 && col.higher[0].length === 0) {
                        result_i.type = 'mark*';
                    }
                    break;
                } else if (
                    column_stack[p].mark <= col.mark &&
                    !outer_stack.includes(p) &&
                    lex_compare(higher_remove_base(column_stack[p]), higher_remove_base(col), compare) < 0
                ) {
                    result_i.type = 'higher';
                    break;
                }
                p = parent_stack[p].entry_parents[n - 1];
            }
            result_i.entry_parents[n] = p;
            if (p < 0) {
                if (lS0 > 0 && is_one_line_column(col, column_stack[lS0 - 1].lower[0] + 1)) {
                    result_i.type = 'star';
                } else {
                    result_i.type = 'lower';
                }
                result_i.is_tail = true;
            } else {
                const higher_right = col.higher.length - 1;
                if (col.higher[higher_right].length === 0) result_i.is_tail = true;
            }
        }

        outer_stack.push(iS);
        result[i] = {
            ...result_i,
            higher: col.higher.map((x) => compute_parents(x, n, column_stack, parent_stack, outer_stack)),
        };
        outer_stack.pop();
    }
    column_stack.splice(lS0);
    parent_stack.splice(lS0);
    return result;
}

function get_right_higher<Data extends object>(e: ExprData<Data>): ExprData<Data> {
    const right = e.length - 1;
    let higher_right = e[right].higher.length - 1;
    return e[right].higher[higher_right];
}

function skip_to_layer<Data extends object>(e: ExprData<Data>, layer: number): ExprData<Data> {
    let current = e;
    for (let k = 0; k < layer; k++) current = get_right_higher(current);
    return current;
}

function compute_tail_info(P: ExprData<ColumnParents>): [t_layer: number, type: ExpansionType] {
    let current_P = P,
        layer = 0;
    while (true) {
        const right = current_P.length - 1;
        if (current_P[right].is_tail) return [layer, current_P[right].type];
        current_P = get_right_higher(current_P);
        layer++;
    }
}

function root(P: ExprData<ColumnParents>, t_layer: number): [r: number, b: number] | undefined {
    let current_P = P;
    for (let k = 0; k < t_layer; k++) {
        let right = current_P.length - 1;
        let higher_right = current_P[right].higher.length - 1;
        current_P = current_P[right].higher[higher_right];
    }
    let right = current_P.length - 1;
    let b = index_of_last(current_P[right].entry_parents, (x) => x >= 0);
    let r = current_P[right].entry_parents[b];
    return [r, b];
}

function compute_root_layer(e: Expr, r: number): [number, number] {
    let layer = 0;
    let len = e.length;
    let current = e;
    while (len <= r) {
        layer++;
        current = get_right_higher(current);
        len += current.length;
    }
    return [layer, r - (len - current.length)];
}

function ascension_vector(e: Expr, r: number, b: number, t_layer: number): number[] {
    let stack: Column[] = [...e];

    let current = e;
    for (let k = 0; k < t_layer; k++) {
        let right = current.length - 1;
        let higher_right = current[right].higher.length - 1;
        current = current[right].higher[higher_right];
        stack.push(...current);
    }

    let e_r = stack[r];
    let e_right = stack[stack.length - 1];
    return Array.from({ length: b }, (_, j) => e_right.lower[j] - e_r.lower[j]);
}

function undefined_AT(e: Expr): ExprData<{}> {
    return e.map((col) => ({ higher: col.higher.map(undefined_AT) }));
}

type ColumnThreshold = { threshold?: number };

function ascension_thresholds(
    e: Expr,
    P: ExprData<ColumnParents>,
    r: number | undefined,
    b: number,
    thresholds_stack: (number | undefined)[] = [],
): ExprData<{ threshold?: number }> {
    if (r === undefined) {
        return undefined_AT(e);
    }
    const lS0 = thresholds_stack.length;
    const result: ExprData<ColumnThreshold> = [];

    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = thresholds_stack.length;

        if (iS < r && i !== e.length - 1) {
            thresholds_stack.push(undefined);
            result[i] = { higher: col.higher.map(undefined_AT) };
        } else {
            let Ai: number | undefined = undefined;
            if (iS === r) {
                Ai = b;
            } else if (iS > r) {
                Ai = 0;
                while (P[i].entry_parents[Ai] >= r && thresholds_stack[P[i].entry_parents[Ai]]! > Ai) Ai++;
            }
            thresholds_stack.push(Ai);
            result[i] = {
                threshold: Ai,
                higher: col.higher.map((x, ix) => ascension_thresholds(x, P[i].higher[ix], r, b, thresholds_stack)),
            };
        }
    }

    thresholds_stack.splice(lS0);
    return result;
}

function ascend_vector(v: number[], A: number, V: number[], w: number): number[] {
    return v.map((x, i) => x + (i < A ? V[i] * w : 0));
}

function ascend_replace(
    e: Expr,
    tail: Expr,
    t_layer: number | undefined,
    A: ExprData<ColumnThreshold>,
    V: number[],
    w: number,
): Expr {
    let result: Expr = [];
    for (let i = 0; i < e.length; i++) {
        if (t_layer === 0 && i === e.length - 1) {
            result.push(...tail);
        } else {
            const col = e[i];
            const Ai = A[i].threshold;
            const higher_right = col.higher.length - 1;

            const new_col_lower = ascend_vector(col.lower, Ai ?? 0, V, w);
            const new_tail_layer = i !== e.length - 1 || t_layer === undefined ? undefined : t_layer - 1;
            result[i] = {
                lower: new_col_lower,
                mark: col.mark,
                higher: col.higher.map((x, ix) =>
                    ascend_replace(x, tail, ix === higher_right ? new_tail_layer : undefined, A[i].higher[ix], V, w),
                ),
            };
            if (result[i].higher.length === 0) result[i].mark = 0;
        }
    }
    return result;
}

function FS_star(e: Expr, tail_layer: number, index: number): Expr {
    const right = e.length - 1;
    const higher_right = e[right].higher.length - 1;

    if (tail_layer === 1) {
        let vert_right = e[right].higher[higher_right].length - 1;
        let new_vert = e[right].higher[higher_right].slice(0, vert_right);
        return [
            ...e.slice(0, right),
            {
                lower: e[right].lower,
                mark: higher_right === 0 && index === 0 ? 0 : e[right].mark,
                higher: [...e[right].higher.slice(0, higher_right), ...Array.from({ length: index }, () => new_vert)],
            },
        ];
    }
    return [
        ...e.slice(0, right),
        {
            lower: e[right].lower,
            mark: e[right].mark,
            higher: [
                ...e[right].higher.slice(0, higher_right),
                FS_star(e[right].higher[higher_right], tail_layer - 1, index),
            ],
        },
    ];
}

function FS(e: Expr, index: number, n: number): Expr {
    if (is_infinity(e)) return infinity_FS(index, n);
    if (e.length === 0) return e;

    if (!is_limit(e)) return e.slice(0, -1);

    const P = compute_parents(e, n);
    const [t_layer, type] = compute_tail_info(P);

    if (type === undefined) return e.slice(0, -1);
    if (type === 'star') return FS_star(e, t_layer, index);

    const [r, b] = root(P, t_layer)!;
    const [r_layer, ri] = compute_root_layer(e, r);
    const V = ascension_vector(e, r, b, t_layer);
    const A = ascension_thresholds(e, P, r, b);

    let copy_part: Expr = skip_to_layer(e, r_layer).slice(ri);
    let copy_part_A: ExprData<ColumnThreshold> = skip_to_layer(A, r_layer).slice(ri);
    let diff_layer = t_layer - r_layer;
    if (type === 'mark') {
        const higher_right = copy_part[0].higher.length - 1;
        copy_part = [
            {
                lower: copy_part[0].lower,
                mark: 0,
                higher: [],
            },
            ...copy_part[0].higher[higher_right],
        ];
        copy_part_A = [
            {
                threshold: b,
                higher: [],
            },
            ...copy_part_A[0].higher[higher_right],
        ];
        diff_layer--;
    }
    const current = skip_to_layer(e, t_layer);
    const current_A = skip_to_layer(A, t_layer);
    const right = current.length - 1;
    const tail_top: Expr[] = current[right].higher.slice(0, -1);
    const tail_top_A: ExprData<ColumnThreshold>[] = current_A[right].higher.slice(0, -1);
    const tail_mark: number = tail_top.length === 0 ? 0 : current[right].mark;

    let result: Expr = [];
    for (let w = index; w > 0; w--) {
        result = ascend_replace(copy_part, result, diff_layer, copy_part_A, V, w);
        if (type === 'higher' || type === 'mark') {
            result[0].mark = tail_mark;
            result[0].higher = tail_top.map((x, ix) => ascend_replace(x, [], undefined, tail_top_A[ix], V, w - 1));
        }
    }
    result = ascend_replace(e, result, t_layer, A, V, 0);
    return result;
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

    function parse_column(): Column {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;

        const numbers: number[] = [];
        const higher: Expr[] = [];
        let mark: number | undefined;
        let in_higher = false;
        let expect_value = true;

        while (i < s.length && s[i] !== ')') {
            skip_spaces();
            if (i >= s.length) break;

            if (s[i] === ',' || s[i] === ';') {
                if (expect_value) error();
                if (s[i] === ';') {
                    if (numbers.length !== n) error();
                    in_higher = true;
                }
                i++;
                expect_value = true;
                continue;
            }

            if (!expect_value) error();
            const m = parse_number();

            skip_spaces();
            if (i < s.length && s[i] === '^') {
                in_higher = true;
                if (mark === undefined) {
                    mark = m;
                } else if (m !== mark) {
                    error();
                }
                i++;
                higher.push(parse_expr());
            } else if (in_higher || numbers.length >= n) {
                if (mark === undefined) {
                    mark = m;
                } else if (m !== mark) {
                    error();
                }
                higher.push([]);
            } else {
                numbers.push(m);
            }
            expect_value = false;
        }

        if (i >= s.length) error();
        i++;

        while (numbers.length < n) numbers.push(mark ?? 0);

        const final_mark = higher.length === 0 ? 0 : (mark ?? 0);
        if (higher.length > 0 && final_mark === 0) error();

        return { lower: numbers, mark: final_mark, higher };
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
        return INFINITY();
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

export const category_bm_btl_minus1_y_nss: NotationCategoryDefinition = {
    id: 'category-bm-btl-minus1-y-nss',
    name: "Asheep's Transfinite nSS",
    simple_name: 'ATnSS',
    parent_id: 'category-bm-like',
    generator: { start: 1, initial: 3, create: (n) => BTL_Minus1_Y_nSS(n) },
};
export function BTL_Minus1_Y_nSS(n: number): NotationDefinition<ExprCompact> {
    return {
        id: 'btl--1y-' + (n + 1) + 'ss',
        category_id: 'category-bm-btl-minus1-y-nss',
        name: 'AT' + (n + 1) + 'SS',

        display: {
            plain: (e) => display(decompactify(e), false, true),
            html: (e) => display(decompactify(e), true, true),
            from_display: (s) => compactify(from_display(s, n)),
        },
        display_equiv: {
            combined: {
                plain: (e) => display(decompactify(e), false, false),
                html: (e) => display(decompactify(e), true, false),
                from_display: (s) => compactify(from_display(s, n)),
                name_id: 'display.btl-m1y-nss-combined',
            },
        },
        is_limit: (e) => is_limit(decompactify(e)),
        compare: (a, b) => compare(decompactify(a), decompactify(b)),
        FS: (e, index) => compactify(FS(decompactify(e), index, n)),

        credit_text_id: 'credit.asheep',

        init: () => [INFINITY_compact(), []],
    };
}
