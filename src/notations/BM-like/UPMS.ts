import {
    compare,
    display,
    display_as_0Y,
    display_simple,
    Expr,
    from_display,
    from_display_as_0Y,
    from_display_simple,
    INFINITY,
    infinity_FS,
    is_infinity,
    is_limit,
    normalize,
    parents,
    standardize,
} from '@/notations/BM-like/BM.ts';
import { sequence_FS_variants0 } from '@/notations/notation_utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { bind3, boolean_compare, lex_compare, lex_compare_by, number_compare, tuple_lex_compare_by } from '@/utils.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';

interface Context {
    m: Expr;
    colCount: number;
    rowCount: number;
    P: number[][];
}

function make_context(matrix: Expr): Context {
    const m = standardize(matrix);
    const colCount = m.length;
    const rowCount = colCount === 0 ? 0 : m[0].length;
    const P = parents(m);
    return { m, colCount, rowCount, P };
}

function is_ancestor(ctx: Context, jCol: number, target: number, b: number): boolean {
    let current: number | undefined = jCol;
    while (current >= target) {
        if (current === target) return true;
        current = ctx.P[current][b];
        if (current === undefined) break;
    }
    return false;
}

function last_column_is_zero(matrix: Expr): boolean {
    if (matrix.length === 0) return true;
    const last = matrix[matrix.length - 1];
    for (let r = 0; r < last.length; r++) {
        if (last[r] !== 0) return false;
    }
    return true;
}

function find_LNZ_index(matrix: Expr): number {
    if (matrix.length === 0) return -1;
    const last_col = matrix[matrix.length - 1];
    for (let r = last_col.length - 1; r >= 0; r--) {
        if (last_col[r] !== 0) return r;
    }
    return -1;
}

function find_bad_root(ctx: Context) {
    const lastCol = ctx.colCount - 1;
    const t = find_LNZ_index(ctx.m);
    if (t === -1) return null;
    const rootCol: number | undefined = ctx.P[lastCol][t];
    if (rootCol === undefined) return null;
    return { r: rootCol, t };
}

function compute_delta(ctx: Context, rootCol: number, t: number): number[] {
    const lastCol = ctx.colCount - 1;
    const delta = new Array(ctx.rowCount);
    for (let r = 0; r < ctx.rowCount; r++) delta[r] = r >= t ? 0 : ctx.m[lastCol][r] - ctx.m[rootCol][r];
    return delta;
}

type MarkedMatrix = [boolean, number][][];

function compare_marked_matrix(a: MarkedMatrix, b: MarkedMatrix) {
    return lex_compare(a, b, lex_compare_by(tuple_lex_compare_by([boolean_compare, number_compare])));
}

function compute_UPMS_verification_roots(ctx: Context, rootCol: number, t: number, bm_threshold: number = 1): number[] {
    const m = ctx.m;
    const alpha = ctx.colCount - 1;
    const y = rootCol;
    const height = ctx.rowCount;
    const P = ctx.P;

    const vr = Array<number>(alpha).fill(0);

    function get_VR(c: number, row: number): boolean {
        return row < vr[c];
    }

    function get_base(c: number, k: number): number[] {
        return Array.from({ length: k + 2 }, (_, r) => m[c][r] + (r <= k ? 1 : 0));
    }

    const transformed_X_value = (source: number, row: number, iCol: number, k: number): [boolean, number] => {
        let value = m[source][row];
        let mark = row < k && get_VR(source, row);
        if (mark) value -= m[iCol][row];
        return [mark, value];
    };

    const transformed_Y_value = (source: number, row: number, jCol: number, k: number): [boolean, number] => {
        let value = m[source][row];
        let mark = false;
        if (row < k) {
            const colIsJ = source === jCol;
            const containsJ = is_ancestor(ctx, source, jCol, row);
            if (colIsJ || containsJ) {
                mark = true;
                value -= m[jCol][row];
            }
        }
        return [mark, value];
    };

    function compute_transformed_X(c: number, k: number): MarkedMatrix | null {
        let u: number | undefined = undefined;
        const base = get_base(c, k);
        for (let candidate = c + 1; candidate <= alpha; candidate++) {
            if (lex_compare(m[candidate], base, number_compare) < 0) {
                u = candidate;
                break;
            }
        }
        if (u === undefined) return null;
        const result: MarkedMatrix = [];
        for (let l = c; l < u; l++) {
            result.push(Array.from({ length: height }, (_, row) => transformed_X_value(l, row, c, k)));
        }
        return result;
    }

    function compute_transformed_Y(k: number): MarkedMatrix {
        let a: number | undefined = alpha;
        while (a !== undefined && m[a][k] !== m[y][k] + 1) a = P[a][k];
        if (a === undefined) a = alpha;
        const result: MarkedMatrix = [];
        for (let l = a; l <= alpha; l++) {
            result.push(Array.from({ length: height }, (_, row) => transformed_Y_value(l, row, a, k)));
        }
        return result;
    }

    for (let row = 0; row < t; row++) {
        for (let col = y; col < alpha; col++) {
            if (col === y || row === 0) {
                vr[col]++;
                continue;
            }
            if (vr[col] !== row) {
                // vr[col] += 0;
                continue;
            }
            const parent = P[col][row];
            if (parent === undefined || parent < y || !get_VR(parent, row)) {
                // vr[col] += 0;
                continue;
            }
            if (parent !== y || row < bm_threshold) {
                vr[col]++;
                continue;
            }
            let higher_parent_escapes_bad_root = false;
            for (let vRow = row + 1; vRow < t - 1; vRow++) {
                if (P[col][vRow] !== y) {
                    higher_parent_escapes_bad_root = true;
                    break;
                }
            }
            if (higher_parent_escapes_bad_root) {
                // vr[col] += 0;
                continue;
            }
            const transformed_X = compute_transformed_X(col, row);
            if (transformed_X === null) {
                vr[col]++;
                continue;
            }
            const transformed_Y = compute_transformed_Y(row);
            const cmp = compare_marked_matrix(transformed_X, transformed_Y);
            if (cmp >= 0) vr[col]++;
        }
    }
    return vr;
}

function expand(matrix: Expr, index: number, bm_threshold: number = 1): Expr {
    const ctx = make_context(matrix);
    const m = ctx.m;
    const n = Math.max(0, Math.floor(index));
    if (m.length === 0) return [];
    if (last_column_is_zero(m)) return m.slice(0, -1);
    const badRoot = find_bad_root(ctx);
    if (badRoot === null) return [];
    const { r, t } = badRoot;
    const alpha = ctx.colCount - 1;
    const delta = compute_delta(ctx, r, t);
    const vr = compute_UPMS_verification_roots(ctx, r, t, bm_threshold);
    const result: Expr = [...m.slice(0, alpha)];
    for (let w = 1; w <= n; w++) {
        for (let j = r; j < alpha; j++) {
            let result_col = [...m[j]];
            for (let k = 0; k < vr[j]; k++) result_col[k] += delta[k] * w;
            result.push(result_col);
        }
    }
    return normalize(result);
}

export const UPMS: NotationDefinition<Expr> = {
    id: 'upms',
    name: 'Unupgrading projection matrix system',
    simple_name: 'UPMS',
    category_id: 'category-bm-like',
    display: { plain: display, from_display },
    display_equiv: {
        UP0Y: {
            plain: display_as_0Y,
            from_display: from_display_as_0Y,
        },
        simple: {
            plain: display_simple,
            from_display: from_display_simple,
            name_id: 'display.simple',
        },
    },
    is_limit,
    compare,
    ...sequence_FS_variants0(expand, is_infinity, infinity_FS, is_limit, display),
    credit_text_id: 'credit.test-alpha0',

    init: () => [INFINITY(), []],

    debug: { expandUPMS: expand },
};

function partial_UPMS(n: number): NotationDefinition<Expr> {
    return {
        id: 'upms-partial-' + n,
        name: 'BMS(' + n + ' rows) + UPMS',
        simple_name: '(>' + n + ')-UPMS',
        category_id: 'category-upms-partial',
        display: { plain: display, from_display },
        display_equiv: {
            ['(>' + n + ')-UP0Y']: {
                plain: display_as_0Y,
                from_display: from_display_as_0Y,
            },
            simple: {
                plain: display_simple,
                from_display: from_display_simple,
                name_id: 'display.simple',
            },
        },
        is_limit,
        compare,
        ...sequence_FS_variants0(bind3(expand, n), is_infinity, infinity_FS, is_limit, display),
        credit_text_id: 'credit.test-alpha0',

        init: () => [INFINITY(), [[], Array<number>(n + 3).fill(1)], []],

        debug: { expandUPMS: expand },
    };
}

export const category_partial_UPMS: NotationCategoryDefinition = {
    id: 'category-upms-partial',
    name: 'BMS(n rows) + UPMS',
    simple_name: '(>n)-UPMS',
    parent_id: 'category-bm-like',
    generator: { start: 2, initial: 3, create: partial_UPMS },
};
