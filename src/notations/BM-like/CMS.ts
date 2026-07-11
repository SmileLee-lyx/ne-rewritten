import { type NotationDefinition } from '@/notation-definition.ts';
import { compare, display, from_display, is_limit, normalize, standardize } from '@/notations/BM-like/BM.ts';

export const CMS: NotationDefinition<any> = {
    id: 'cms',
    name: 'Crane matrix system',
    simple_name: 'CMS',
    category_id: 'category-bm-like',
    display: {
        plain: display,
        from_display,
    },
    is_limit,
    compare,
    FS: (() => {
        var data: any = {},
            expand = (m1: any, FSterm: any) => {
                var parent = (m: any, cache: any, x: any, y: any): any => {
                        var str = x + ',' + y;
                        if (cache[str] !== undefined) return cache[str];
                        for (var p = x; (p = y ? parent(m, cache, p, y - 1) : p - 1) >= 0;) {
                            if (m[p][y] < m[x][y]) break;
                        }
                        return (cache[str] = p);
                    },
                    L = (m: any, cache: any, x1: any, x2: any): any => {
                        var x: any, y: any;
                        for (y = ymax; y >= 0; --y) {
                            if (!m[x2][y]) continue;
                            for (x = x2; x1 < x;) x = parent(m, cache, x, y);
                            if (x === x1) return y;
                        }
                        return -1;
                    },
                    ascending = (r: any, x: any, y: any): any => {
                        var str = r + ',' + x + ',' + y;
                        if (ascending_cache[str] !== undefined) return ascending_cache[str];
                        return (ascending_cache[str] =
                            r <= x && (r === x || ascending(r, parent(m1, m1cache, x, y), y)));
                    },
                    m1cache: any = {},
                    m2cache: any = {},
                    ascending_cache: any = {},
                    endcol = m1.length - 1,
                    m2 = m1.slice(0, endcol),
                    child = m1[endcol],
                    ymax = child.length - 1,
                    LNZ: any;
                for (LNZ = ymax; LNZ >= 0; --LNZ) {
                    if (child[LNZ] > 0) break;
                }
                if (LNZ < 0 || !FSterm) return m2;
                var BR = parent(m1, m1cache, endcol, LNZ),
                    BRcolumn = m1[BR],
                    offset = child.map((value: any, y: any) => (y < LNZ ? value - BRcolumn[y] : 0)),
                    offset_asc = Array(endcol)
                        .fill(0, BR)
                        .map((t: any, x: any) => offset.map((value: any, y: any) => (ascending(BR, x, y) ? value : 0))),
                    col: any,
                    n: any;
                for (n = 0; ++n <= FSterm;) {
                    for (col = BR; col < endcol; ++col) {
                        m2.push(m1[col].map((value: any, y: any) => value + offset_asc[col][y] * n));
                    }
                }
                for (col = endcol; BR < --col;) if (L(m1, m1cache, BR, col) > LNZ) break;
                if (col === BR) {
                    if (ymax > 0 && m2.every((column: any) => column[ymax] === 0))
                        m2 = m2.map((column: any) => column.slice(0, ymax));
                    return m2;
                }
                m2.push(child.map((value: any, y: any) => value + (y <= LNZ ? value - BRcolumn[y] : 0) * FSterm));
                var c = col,
                    c_ = c + (endcol - BR),
                    d = m2.length - 1,
                    D: any = [];
                for (col = endcol; col < d; ++col)
                    D.push(
                        m2[col].map((value: any, k: any) => {
                            if (k > LNZ) return value;
                            var u = 0,
                                ss = col,
                                nextss: any;
                            while (true) {
                                nextss = parent(m2, m2cache, ss, k);
                                if (nextss < endcol) break;
                                ++u;
                                ss = nextss;
                            }
                            if (L(m2, m2cache, ss, d) >= k - 1) return m2[c_][k] + u;
                            else return value;
                        }),
                    );
                m2 = m2.slice(0, c_).concat(D);
                if (ymax > 0 && m2.every((column: any) => column[ymax] === 0))
                    m2 = m2.map((column: any) => column.slice(0, ymax));
                return m2;
            };
        return (m: any, FSterm: any): any => {
            if ('' + m === 'Infinity') return [[], Array(FSterm + 1).fill(1)];
            if (m.length === 0) return [];
            var datakey = display(m);
            if (!data[datakey]) data[datakey] = [];
            else if (data[datakey][FSterm] !== undefined) return data[datakey][FSterm];
            return (data[datakey][FSterm] = normalize(expand(standardize(m), FSterm)));
        };
    })(),
    init: (): any => [[[Infinity]], []],
};
