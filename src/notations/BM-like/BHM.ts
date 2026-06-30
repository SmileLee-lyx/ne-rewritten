import {
    compare,
    display,
    Expr,
    from_display as from_display_BM,
    is_infinity,
    matrix_is_limit,
} from '@/notations/BM-like/BM.ts';
import type { NotationDefinition } from '@/utils.ts';

const data: Record<string, Expr[]> = {};

function expand(m: Expr, index: number): Expr {
    function parent(x: number, y: number, cache: Record<string, number>): number {
        const str = x + ',' + y;
        if (cache[str] !== undefined) return cache[str];
        let p: number;
        for (p = x; (p = y ? parent(p, y - 1, cache) : p - 1) >= 0;) {
            if (m[p][y] < m[x][y]) break;
        }
        return (cache[str] = p);
    }

    function ascending(r: number, x: number, y: number, cache: Record<string, boolean>, roots: number[]): boolean {
        const str = r + ',' + x + ',' + y;
        if (cache[str] !== undefined) return cache[str];
        return (cache[str] =
            r <= x && (roots.includes(x) || ascending(r, parent(x, y, parent_cache), y, cache, roots)));
    }

    function delta(r: number, LNZ: number) {
        return m[r].map((value, y) => (y < LNZ ? child[y] - value : 0));
    }

    function expansion(
        r: number,
        n: number,
        LNZ: number,
        parent_cache: Record<string, number>,
        ascend_cache: Record<string, boolean>,
        roots: number[],
    ) {
        const ss = m.slice(0, end_col);
        const del_r = delta(r, LNZ);
        for (let a = 1; a <= n; ++a) {
            for (let x = r; x < end_col; ++x) {
                ss.push(
                    ss[x].map((value, y) => value + a * del_r[y] * (ascending(r, x, y, ascend_cache, roots) ? 1 : 0)),
                );
            }
        }
        return ss;
    }

    function expansion_append(
        r: number,
        LNZ: number,
        parent_cache: Record<string, number>,
        ascend_cache: Record<string, boolean>,
        roots: number[],
    ) {
        const del_r = delta(r, LNZ);
        const res = expansion(r, 1, LNZ, parent_cache, ascend_cache, roots);
        res.push(
            m[end_col].map((value, y) => value + del_r[y] * (ascending(r, end_col, y, ascend_cache, roots) ? 1 : 0)),
        );
        return res;
    }

    const end_col = m.length - 1;
    const result = m.slice(0, end_col);
    const child = m[end_col];
    const y_max = child.length - 1;
    let LNZ = y_max;
    for (; LNZ >= 0; --LNZ) {
        if (child[LNZ] > 0) break;
    }
    if (LNZ < 0) return result;

    const parent_cache: Record<string, number> = {};
    const ascend_cache: Record<string, boolean> = {};
    const special_root = parent(parent(end_col, LNZ, parent_cache), LNZ, parent_cache);
    const roots: number[] = [];
    for (let n = end_col; (n = LNZ ? parent(n, LNZ - 1, parent_cache) : n - 1) > special_root;) {
        if (parent(n, LNZ, parent_cache) === special_root) roots.push(n);
    }
    const threshold = expansion_append(roots[0], LNZ, parent_cache, ascend_cache, roots);
    let n = roots.findIndex((r) => compare(expansion_append(r, LNZ, parent_cache, ascend_cache, roots), threshold) < 0);
    if (n === -1) n = roots.length;
    let res = expansion(roots[n - 1], index, LNZ, parent_cache, ascend_cache, roots);
    if (y_max > 0 && res.every((col) => col[y_max] === 0)) res = res.map((col) => col.slice(0, y_max));
    return res;
}

function from_display(str: string): Expr {
    return from_display_BM(str, true);
}

export const BHM: NotationDefinition<Expr> = {
    id: 'bhm',
    name: 'Bashicu hyper matrix (BHM)',
    simple_name: 'BHM',
    display: { plain: display, from_display },
    is_limit: matrix_is_limit,
    compare: compare,
    FS: (m: Expr, index: number) => {
        if (is_infinity(m)) return [Array(index + 1).fill(0), Array(index + 1).fill(1)];
        if (m.length === 0) return [];
        const key = display(m);
        if (!data[key]) data[key] = [];
        else if (data[key][index] !== undefined) return data[key][index];
        return (data[key][index] = expand(m, index));
    },
    init: () => [[[Infinity]], []],
};
