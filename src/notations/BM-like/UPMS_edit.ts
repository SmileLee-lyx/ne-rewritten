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
import { sequence_FS_variants } from '@/notations/notation_utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { bind3, boolean_compare, lex_compare, lex_compare_by, number_compare, tuple_lex_compare_by } from '@/utils.ts';

interface Context {
    m: Expr;
    col_count: number;
    row_count: number;
    parent_matrix: number[][];
}

function make_context(matrix: Expr): Context {
    const m = standardize(matrix);
    const col_count = m.length;
    const row_count = col_count === 0 ? 0 : m[0].length;
    const parent_matrix = parents(m);
    return { m, col_count, row_count, parent_matrix };
}

function is_ancestor(ctx: Context, source_col: number, target: number, row: number): boolean {
    let current: number | undefined = source_col;
    while (current >= target) {
        if (current === target) return true;
        current = ctx.parent_matrix[current][row];
        if (current === undefined) break;
    }
    return false;
}

function last_column_is_zero(matrix: Expr): boolean {
    if (matrix.length === 0) return true;
    const last = matrix[matrix.length - 1];
    for (let row = 0; row < last.length; row++) {
        if (last[row] !== 0) return false;
    }
    return true;
}

function find_lnz_index(matrix: Expr): number {
    if (matrix.length === 0) return -1;
    const last_col = matrix[matrix.length - 1];
    for (let row = last_col.length - 1; row >= 0; row--) {
        if (last_col[row] !== 0) return row;
    }
    return -1;
}

function find_bad_root(ctx: Context) {
    const last_col = ctx.col_count - 1;
    const t = find_lnz_index(ctx.m);
    if (t === -1) return null;
    const root_col: number | undefined = ctx.parent_matrix[last_col][t];
    if (root_col === undefined) return null;
    return { r: root_col, t };
}

function compute_delta(ctx: Context, root_col: number, t: number): number[] {
    const last_col = ctx.col_count - 1;
    const delta = new Array(ctx.row_count);
    for (let row = 0; row < ctx.row_count; row++)
        delta[row] = row >= t ? 0 : ctx.m[last_col][row] - ctx.m[root_col][row];
    return delta;
}

type MarkedMatrix = [boolean, number][][];

function compare_marked_matrix(a: MarkedMatrix, b: MarkedMatrix) {
    return lex_compare(a, b, lex_compare_by(tuple_lex_compare_by([boolean_compare, number_compare])));
}

function compute_verification_roots(ctx: Context, root_col: number, t: number, bm_threshold: number = 1): number[] {
    const m = ctx.m;
    const alpha = ctx.col_count - 1;
    const y = root_col;
    const height = ctx.row_count;
    const parent_matrix = ctx.parent_matrix;

    // 末列也可能进入 X，比较时需要它在较低行的提升标记。
    const vr = Array<number>(ctx.col_count).fill(0);

    function get_vr(col: number, row: number): boolean {
        return row < vr[col];
    }

    function get_base(col: number, row: number): number[] {
        return Array.from({ length: row + 2 }, (_, k) => m[col][k] + (k <= row ? 1 : 0));
    }

    const transformed_x_value = (source: number, row: number, x_start: number, k: number): [boolean, number] => {
        let value = m[source][row];
        const mark = row < k && get_vr(source, row);
        if (mark) value -= m[x_start][row];
        return [mark, value];
    };

    const transformed_y_value = (source: number, row: number, y_start: number, k: number): [boolean, number] => {
        let value = m[source][row];
        let mark = false;
        if (row < k) {
            const is_start = source === y_start;
            const contains_start = is_ancestor(ctx, source, y_start, row);
            if (is_start || contains_start) {
                mark = true;
                value -= m[y_start][row];
            }
        }
        return [mark, value];
    };

    function compute_transformed_x(col: number, row: number): MarkedMatrix {
        // 没有截断点时，X 包含末列，仍需参与比较。
        let end = alpha + 1;
        const base = get_base(col, row);
        for (let candidate = col + 1; candidate <= alpha; candidate++) {
            if (lex_compare(m[candidate], base, number_compare) < 0) {
                end = candidate;
                break;
            }
        }
        const result: MarkedMatrix = [];
        for (let source = col; source < end; source++) {
            result.push(Array.from({ length: height }, (_, k) => transformed_x_value(source, k, col, row)));
        }
        return result;
    }

    function compute_transformed_y(row: number): MarkedMatrix {
        let start: number | undefined = alpha;
        while (start !== undefined && m[start][row] !== m[y][row] + 1) start = parent_matrix[start][row];
        if (start === undefined) start = alpha;
        const result: MarkedMatrix = [];
        for (let source = start; source <= alpha; source++) {
            result.push(Array.from({ length: height }, (_, k) => transformed_y_value(source, k, start, row)));
        }
        return result;
    }

    for (let row = 0; row < t; row++) {
        for (let col = y; col <= alpha; col++) {
            if (col === y || row === 0) {
                vr[col]++;
                continue;
            }
            if (vr[col] !== row) continue;
            const parent = parent_matrix[col][row];
            if (parent === undefined || parent < y || !get_vr(parent, row)) continue;
            if (parent !== y || row < bm_threshold) {
                vr[col]++;
                continue;
            }
            let higher_parent_escapes_bad_root = false;
            for (let higher_row = row + 1; higher_row <= t; higher_row++) {
                if (parent_matrix[col][higher_row] !== y) {
                    higher_parent_escapes_bad_root = true;
                    break;
                }
            }
            if (higher_parent_escapes_bad_root) continue;
            const transformed_x = compute_transformed_x(col, row);
            const transformed_y = compute_transformed_y(row);
            if (compare_marked_matrix(transformed_x, transformed_y) >= 0) {
                vr[col]++;
            } else {
                // 按列从左到右处理：X 内尚未处理的列在这一行全部不提升。
                // 保留已通过的较低行，并在 X 的右边界恢复判定。
                col += transformed_x.length - 1;
            }
        }
    }
    return vr;
}

function expand(matrix: Expr, index: number, bm_threshold: number = 1, shorter: boolean = true): Expr {
    const ctx = make_context(matrix);
    const m = ctx.m;
    const n = Math.max(0, Math.floor(index));
    if (m.length === 0) return [];
    if (last_column_is_zero(m)) return m.slice(0, -1);
    const bad_root = find_bad_root(ctx);
    if (bad_root === null) return [];
    const { r, t } = bad_root;
    const alpha = ctx.col_count - 1;
    const delta = compute_delta(ctx, r, t);
    const vr = compute_verification_roots(ctx, r, t, bm_threshold);
    const result: Expr = [...m.slice(0, alpha)];
    for (let copy = 1; copy <= n + 1; copy++) {
        if (shorter && copy > n) break;

        const delta_copy = delta.map((x, j) => (j < vr[m.length - 1] ? x * copy : x));

        for (let col = r; col < alpha; col++) {
            const result_col = [...m[col]];
            for (let row = 0; row < vr[col]; row++) result_col[row] += delta_copy[row];
            result.push(result_col);
            if (copy > n) break;
        }
    }
    return normalize(result);
}

export const UPMS_EDIT: NotationDefinition<Expr> = {
    id: 'upms-edit',
    name: 'Unupgrading projection matrix system (edit)',
    simple_name: 'UPMS (edit)',
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
            name: { id: 'display.simple' },
        },
    },
    is_limit,
    compare,
    ...sequence_FS_variants(bind3(expand, 1), is_infinity, infinity_FS, is_limit, display),
    credit_text_id: 'credit.test-alpha0',

    init: () => [INFINITY(), []],

    debug: { expand_upms: expand },
};
