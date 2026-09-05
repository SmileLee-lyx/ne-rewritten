import {
    compare,
    display,
    display_simple,
    expand as BM_expand,
    Expr,
    from_display,
    from_display_simple,
    INFINITY,
    infinity_FS,
    is_infinity,
    is_limit,
    parents,
} from '@/notations/BM-like/BM.ts';

import { NotationCategoryDefinition, NotationDefinition } from '@/notation-definition.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';
import { bind3 } from '@/utils.ts';

function ascension_thresholds(P: number[][], r: number, roots: number[], b: number): number[] {
    const result = Array<number>(P.length).fill(0);

    result[r] = b;
    for (let i = r + 1; i < P.length; i++) {
        if (roots.includes(i)) {
            result[i] = b;
        } else {
            let threshold = 0;
            while (threshold < P[i].length && threshold < b && threshold < result[P[i][threshold]]) threshold++;
            result[i] = threshold;
        }
    }

    return result;
}

function ascension_vector(m: Expr, r: number, b: number): number[] {
    const right = m.length - 1;
    return Array.from({ length: b }, (_, i) => m[right][i] - (m[r][i] ?? 0));
}

function ascend_vector(col: number[], V: number[], A: number, w: number): number[] {
    return Array.from({ length: Math.max(col.length, A) }, (_, j) => (col[j] ?? 0) + w * (V[j] ?? 0) * (j < A ? 1 : 0));
}

function compute_expansion(m: Expr, r: number, V: number[], A: number[], index: number, shorter: boolean): Expr {
    const right = m.length - 1;

    const result = m.slice(0, right);
    for (let w = 1; w <= index + 1; ++w) {
        if (shorter && w > index) break;
        for (let i = r; i < right; ++i) {
            result.push(ascend_vector(m[i], V, A[i], w));
            if (w > index) break;
        }
    }
    return result;
}

function extend(m: Expr, r: number, V: number[], A: number[]): Expr {
    const right = m.length - 1;

    const res = compute_expansion(m, r, V, A, 1, true);
    res.push(ascend_vector(m[right], V, A[right], 1));
    return res;
}

function BHM_expand(m: Expr, index: number, shorter: boolean): Expr {
    const right = m.length - 1;
    if (right < 0) return [];
    const top = m[right].length - 1;
    if (top < 0) return m.slice(0, -1);

    const P = parents(m);

    const special_root = P[P[right][top]][top] ?? -1;
    const roots: number[] = [];
    for (let i = right; (i = top > 0 ? P[i][top - 1] : i - 1) > special_root;) {
        if ((P[i][top] ?? -1) === special_root) roots.push(i);
    }

    const A: number[][] = [];
    for (let r of roots) {
        A[r] = ascension_thresholds(P, r, roots, top);
    }

    const V: number[][] = [];
    for (let r of roots) {
        V[r] = ascension_vector(m, r, top);
    }

    const threshold = extend(m, roots[0], V[roots[0]], A[roots[0]]);
    let ri = roots.findIndex((r) => compare(extend(m, r, V[r], A[r]), threshold) < 0);
    if (ri === -1) ri = roots.length;
    let r_actual = roots[ri - 1];
    return compute_expansion(m, r_actual, V[r_actual], A[r_actual], index, shorter);
}

export const BHM: NotationDefinition<Expr> = {
    id: 'bhm',
    name: 'Bashicu hyper matrix',
    simple_name: 'BHM',
    category_id: 'category-bm-like',
    display: {
        plain: display,
        from_display,
    },
    display_equiv: {
        simple: {
            plain: display_simple,
            from_display: from_display_simple,
            name: { id: 'display.simple' },
        },
    },
    is_limit: is_limit,
    compare: compare,
    ...sequence_FS_variants(BHM_expand, is_infinity, infinity_FS, is_limit, display),
    credit_text_id: 'credit.bashicu',

    init: () => [INFINITY(), []],
};

function BM_BHM_expand(m: Expr, index: number, n: number, shorter: boolean): Expr {
    const right = m.length - 1;
    if (right < 0) return [];
    const top = m[right].length - 1;
    if (top < 0) return m.slice(0, -1);

    if (top < n) return BM_expand(m, index, shorter);
    return BHM_expand(m, index, shorter);
}

export function BM_BHM(n: number): NotationDefinition<Expr> {
    return {
        id: n + '-bm-bhm',
        name: 'BMS(' + n + ' rows) + BHM',
        simple_name: n + 'BM-BHM',
        category_id: 'category-bm-bhm',
        display: {
            plain: display,
            from_display,
        },
        display_equiv: {
            simple: {
                plain: display_simple,
                from_display: from_display_simple,
                name: { id: 'display.simple' },
            },
        },
        is_limit: is_limit,
        compare: compare,
        ...sequence_FS_variants(bind3(BM_BHM_expand, n), is_infinity, infinity_FS, is_limit, display),
        credit_text_id: 'credit.bashicu',

        init: () => [INFINITY(), [[], Array<number>(n + 2).fill(1)], []],
    };
}

export const category_BM_BHM: NotationCategoryDefinition = {
    id: 'category-bm-bhm',
    name: 'BMS(n rows) + BHM',
    simple_name: 'nBM-BHM',
    parent_id: 'category-bm-like',
    generator: { start: 1, initial: 3, create: BM_BHM },
};
