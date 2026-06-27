import { index_of_last, lex_compare, type NotationDefinition, number_compare, tuple_lex_compare } from '@/utils.ts';

export type ExprData<Data> = [Data, ExprData<Data>][];
export type Expr = ExprData<number[]>;
export type Column = Expr[number];

function INFINITY(): Expr {
    return [[[Infinity]]] as any;
}

function ZERO_COLUMN(n: number): Column {
    return [Array.from({ length: n }, () => 0), []];
}

function is_infinity(e: Expr): boolean {
    return '' + e === '' + Infinity;
}

function infinity_FS(index: number, n: number): Expr {
    let result: Expr = [];
    for (let i = index; i > 0; i--) {
        result = [[Array.from({ length: n }, () => i), result]];
    }
    return [ZERO_COLUMN(n), ...result];
}

function is_zero_column(c: Column): boolean {
    return c[0].every((x) => x === 0) && c[1].length === 0;
}

function is_one_column(c: Column): boolean {
    let n = c[0].length;
    return n === 0 ? c[1].length === 1 : c[0][0] === 1 && c[0].slice(1).every((x) => x === 0) && c[1].length === 0;
}

function column_display(c: Column): string {
    let result_list = [...c[0].map((x) => '' + x), display(c[1], false)];
    while (result_list.length > 0 && result_list[result_list.length - 1] === '0') result_list.pop();
    return '(' + result_list.join(',') + ')';
}

function display(e: Expr, top_level: boolean = true): string {
    if (is_infinity(e)) return 'Limit';

    if (!top_level) {
        if (e.every(is_zero_column)) {
            return '' + e.length;
        }
        if (e.length === 2 && is_zero_column(e[0]) && is_one_column(e[1])) {
            return 'ω';
        }
    }

    return e.map(column_display).join('');
}

function is_limit(e: Expr): boolean {
    return is_infinity(e) || (e.length > 0 && !is_zero_column(e[e.length - 1]));
}

function column_compare(a: Column, b: Column): number {
    return tuple_lex_compare(a, b, [(x, y) => lex_compare(x, y, number_compare), compare]);
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

type ColumnParents = number[];

function compute_parents(
    e: Expr,
    n: number,
    stack: Column[] = [],
    parent_stack: ColumnParents[] = [],
): ExprData<ColumnParents> {
    const lS0 = stack.length;
    let result: ExprData<ColumnParents> = [];
    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = stack.length;
        stack.push(e[i]);
        let result_i: ColumnParents = Array.from({ length: n + 1 }, () => -1);
        parent_stack.push(result_i);
        for (let j = 0; j < n; j++) {
            let p = iS;
            while (p >= 0) {
                if (stack[p][0][j] < col[0][j]) break;
                p = j === 0 ? p - 1 : parent_stack[p][j - 1];
            }
            if (p < 0) break;
            result_i[j] = p;
        }
        let p = iS;
        while (p >= 0) {
            if (compare(stack[p][1], col[1]) < 0) break;
            p = n === 0 ? p - 1 : parent_stack[p][n - 1];
        }
        result_i[n] = p;

        result[i] = [result_i, compute_parents(col[1], n, stack, parent_stack)];
    }
    stack.splice(lS0);
    parent_stack.splice(lS0);
    return result;
}

function compute_tail_layer(e: Expr): number {
    if (e.length === 0 || is_zero_column(e[e.length - 1])) return -1;
    let current = e,
        layer = 0;
    while (true) {
        let right = current.length - 1;
        if (current[right][1].length === 0) {
            return layer;
        }
        if (!is_limit(current[right][1])) {
            return layer;
        }
        current = current[right][1];
        layer++;
    }
}

function compute_root_layer(e: Expr, r: number): [number, number] {
    let layer = 0;
    let len = e.length;
    let current = e;
    while (len <= r) {
        layer++;
        let right = current.length - 1;
        current = current[right][1];
        len += current.length;
    }
    return [layer, r - (len - current.length)];
}

function root(e: Expr, P: ExprData<ColumnParents>): [r: number, b: number] | undefined {
    if (e.length === 0 || is_zero_column(e[e.length - 1])) return undefined;

    let current_P = P;
    let tail_layer = compute_tail_layer(e);
    for (let k = 0; k < tail_layer; k++) {
        let right = current_P.length - 1;
        current_P = current_P[right][1];
    }
    let right = current_P.length - 1;
    let b = index_of_last(current_P[right][0], (x) => x >= 0);
    let r = current_P[right][0][b];
    return [r, b];
}

function ascension_vector(e: Expr, r: number, b: number): number[] {
    let stack: Column[] = [...e];

    let current = e;
    let tail_layer = compute_tail_layer(e);
    for (let k = 0; k < tail_layer; k++) {
        let right = current.length - 1;
        current = current[right][1];
        stack.push(...current);
    }

    let e_r = stack[r];
    let e_right = stack[stack.length - 1];
    return Array.from({ length: b }, (_, j) => e_right[0][j] - e_r[0][j]);
}

function ascension_thresholds(
    e: Expr,
    P: ExprData<ColumnParents>,
    r: number | undefined,
    b: number,
    thresholds_stack: (number | undefined)[] = [],
): ExprData<number | undefined> {
    if (r === undefined) {
        return e.map((col) => [undefined, ascension_thresholds(col[1], [], undefined, b, [])]);
    }
    const lS0 = thresholds_stack.length;
    const result: ExprData<number | undefined> = [];

    for (let i = 0; i < e.length; i++) {
        const col = e[i];
        const iS = thresholds_stack.length;

        if (iS < r && i !== e.length - 1) {
            thresholds_stack.push(undefined);
            result[i] = [undefined, ascension_thresholds(col[1], [], undefined, b, [])];
        } else {
            let Ai: number | undefined = undefined;
            if (iS === r) {
                Ai = b;
            } else if (iS > r) {
                Ai = 0;
                while (P[i][0][Ai] >= r && thresholds_stack[P[i][0][Ai]]! > Ai) Ai++;
            }
            thresholds_stack.push(Ai);
            result[i] = [Ai, ascension_thresholds(col[1], P[i][1], r, b, thresholds_stack)];
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
    tail_layer: number | undefined,
    A: ExprData<number | undefined>,
    V: number[],
    w: number,
): Expr {
    let result: Expr = [];
    for (let i = 0; i < e.length; i++) {
        if (tail_layer === 0 && i === e.length - 1) {
            result.push(...tail);
        } else {
            const col = e[i];
            const Ai = A[i][0];

            const new_col_lower = ascend_vector(col[0], Ai ?? 0, V, w);
            const new_tail_layer = i !== e.length - 1 || tail_layer === undefined ? undefined : tail_layer - 1;
            result[i] = [new_col_lower, ascend_replace(col[1], tail, new_tail_layer, A[i][1], V, w)];
        }
    }
    return result;
}

function FS(e: Expr, index: number, n: number): Expr {
    if (is_infinity(e)) return infinity_FS(index, n);
    if (e.length === 0) return e;
    if (!is_limit(e)) return e.slice(0, -1);

    const P = compute_parents(e, n);
    const [r, b] = root(e, P)!;
    const t_layer = compute_tail_layer(e);
    const [r_layer, ri] = compute_root_layer(e, r);
    const A = ascension_thresholds(e, P, r, b);
    const V = ascension_vector(e, r, b);

    let current = e,
        current_A = A;
    for (let k = 0; k < r_layer; k++) {
        const right = current.length - 1;
        current = current[right][1];
        current_A = current_A[right][1];
    }
    const copy_part: Expr = current.slice(ri);
    const copy_part_A: ExprData<number | undefined> = current_A.slice(ri);
    for (let k = r_layer; k < t_layer; k++) {
        const right = current.length - 1;
        current = current[right][1];
        current_A = current_A[right][1];
    }
    const right = current.length - 1;
    const tail_top = current[right][1].slice(0, -1);
    const tail_top_A = current_A[right][1].slice(0, -1);

    let result: Expr = [];
    for (let w = index; w > 0; w--) {
        result = ascend_replace(copy_part, result, t_layer - r_layer, copy_part_A, V, w);
        if (b === n) {
            result[0][1] = ascend_replace(tail_top, [], undefined, tail_top_A, V, w - 1);
        }
    }
    result = ascend_replace(e, result, t_layer, A, V, 0);
    return result;
}

export function BT_Minus1_Y_nSS(n: number): NotationDefinition<Expr> {
    return {
        id: 'bt--1y-' + (n + 1) + 'ss',
        name: 'BT(-1)Y-' + (n + 1) + 'SS',

        display: { plain: display },
        is_limit: (e) => is_limit(e),
        compare,
        FS: (e, index) => FS(e, index, n),

        init: () => [INFINITY(), []],
    };
}
