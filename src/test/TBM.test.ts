import { describe, expect, it } from 'vitest';
import {
    ascending_threshold,
    Column,
    column_add,
    column_truncate,
    column_verticals,
    display,
    expand,
    Expr,
    parents,
} from '@/notations/BM-like/TBM.ts';

describe('parents', () => {
    it('parents', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w,1,1,1)(2^w,2,2,1)(3^w,2,1,1)(4,3^w,2)(5,2^w,1,1)
        const e: Expr = [
            [],
            [
                [1, Ew],
                [1, E1],
                [1, E1],
                [1, E1],
            ],
            [
                [2, Ew],
                [2, E1],
                [2, E1],
                [1, E1],
            ],
            [
                [3, Ew],
                [2, E1],
                [1, E1],
                [1, E1],
            ],
            [
                [4, E1],
                [3, Ew],
                [2, E1],
            ],
            [
                [5, E1],
                [2, Ew],
                [1, E1],
                [1, E1],
            ],
        ];
        const p = [
            [],
            [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
            ],
            [
                [1, 0],
                [1, 1],
                [1, 2],
                [0, 0],
            ],
            [
                [2, 0],
                [1, 1],
                [0, 0],
                [0, 0],
            ],
            [
                [3, 0],
                [2, 0],
                [1, 1],
            ],
            [
                [4, 0],
                [1, 0],
                [0, 0],
                [0, 0],
            ],
        ];
        expect(parents(e, e.map(column_verticals))).toEqual(p);
    });
    it('parents2', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];
        const Ewp2: Expr = [[], [[1, E1]], [[1, E1]]];

        // ()(1^{w^2},1^w)(2^{w^2},2,2,1^w)(3^w,2^{w^2})(4^w,3^w)(5^w,4^w,1^{w^2},1^w)
        const e: Expr = [
            [],
            [
                [1, Ewp2],
                [1, Ew],
            ],
            [
                [2, Ewp2],
                [2, E1],
                [2, E1],
                [1, Ew],
            ],
            [
                [3, Ew],
                [2, Ewp2],
            ],
            [
                [4, Ew],
                [3, Ew],
            ],
            [
                [5, Ew],
                [4, Ew],
                [1, Ewp2],
                [1, Ew],
            ],
        ];
        const p = [
            [],
            [
                [0, 0],
                [0, 0],
            ],
            [
                [1, 0],
                [1, 1],
                [1, 1],
                [0, 0],
            ],
            [
                [2, 0],
                [1, 0],
            ],
            [
                [3, 0],
                [3, 1],
            ],
            [
                [4, 0],
                [4, 1],
                [4, 2],
                [4, 2],
            ],
        ];
        expect(parents(e, e.map(column_verticals))).toEqual(p);
    });
    it('parents3', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w,1)(2^w,2)(3^w,3)(4,4,3^w,3)(5,5)(6,6,1^w,1)(7,3,1^w)(8,4)
        // (6,3,1^w)(3,3,2^w,1)(4,4,3^w,2)(4,4,2^w)
        const e: Expr = [
            [],
            [
                [1, Ew],
                [1, E1],
            ],
            [
                [2, Ew],
                [2, E1],
            ],
            [
                [3, Ew],
                [3, E1],
            ],
            [
                [4, E1],
                [4, E1],
                [3, Ew],
                [3, E1],
            ],
            [
                [5, E1],
                [5, E1],
            ],
            [
                [6, E1],
                [6, E1],
                [1, Ew],
                [1, E1],
            ],
            [
                [7, E1],
                [3, E1],
                [1, Ew],
            ],
            [
                [8, E1],
                [4, E1],
            ],
            [
                [6, E1],
                [3, E1],
                [1, Ew],
            ],
            [
                [3, E1],
                [3, E1],
                [2, Ew],
                [2, E1],
            ],
            [
                [4, E1],
                [4, E1],
                [3, Ew],
                [3, E1],
            ],
            [
                [4, E1],
                [4, E1],
                [2, Ew],
            ],
        ];
        const p = [
            [],
            [
                [0, 0],
                [0, 0],
            ],
            [
                [1, 0],
                [1, 1],
            ],
            [
                [2, 0],
                [2, 1],
            ],
            [
                [3, 0],
                [3, 0],
                [2, 0],
                [2, 1],
            ],
            [
                [4, 0],
                [4, 1],
            ],
            [
                [5, 0],
                [5, 1],
                [5, 2],
                [5, 2],
            ],
            [
                [6, 0],
                [2, 0],
                [0, 0],
            ],
            [
                [7, 0],
                [7, 1],
            ],
            [
                [5, 0],
                [2, 0],
                [0, 0],
            ],
            [
                [2, 0],
                [2, 0],
                [1, 0],
                [1, 1],
            ],
            [
                [10, 0],
                [10, 1],
                [10, 2],
                [10, 3],
            ],
            [
                [10, 0],
                [10, 1],
                [1, 0],
            ],
        ];
        expect(parents(e, e.map(column_verticals))).toEqual(p);
    });

    it('parents4', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w)(2^w)(3,3,1^w)(4,2^w)
        const e: Expr = [
            [],
            [[1, Ew]],
            [[2, Ew]],
            [
                [3, E1],
                [3, E1],
                [1, Ew],
            ],
            [
                [4, E1],
                [2, Ew],
            ],
        ];
        const p = [
            [],
            [[0, 0]],
            [[1, 0]],
            [
                [2, 0],
                [2, 0],
                [0, 0],
            ],
            [
                [3, 0],
                [1, 0],
            ],
        ];
        expect(parents(e, e.map(column_verticals))).toEqual(p);
    });

    it('add', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];
        const Ewp2: Expr = [[], [[1, E1]], [[1, E1]]];

        const c1: Column = [
            [2, Ew],
            [2, Ew],
            [1, Ewp2],
        ];
        const c2: Column = [
            [3, E1],
            [1, Ewp2],
        ];
        const c3: Column = [
            [5, E1],
            [3, Ew],
            [3, Ew],
            [2, Ewp2],
        ];
        expect(column_add(c1, c2)).toEqual(c3);
    });

    it('add2', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];
        const Ewp2: Expr = [[], [[1, E1]], [[1, E1]]];
        const Ewp3: Expr = [[], [[1, E1]], [[1, E1]], [[1, E1]]];

        // (3^w, 3, 2^{w^2}, 2^w, 1^{w^3})
        const c1: Column = [
            [3, Ew],
            [3, E1],
            [2, Ewp2],
            [2, Ew],
            [1, Ewp3],
        ];
        // (3, 2^{w^2}, 1^{w^2})
        const c2: Column = [
            [3, E1],
            [2, Ewp2],
            [1, Ewp2],
        ];
        // (6, 5^w, 5, 4^{w^2}, 3^w, 2^{w^2}, 1^{w^3})
        const c3: Column = [
            [6, E1],
            [5, Ew],
            [5, E1],
            [4, Ewp2],
            [3, Ew],
            [2, Ewp2],
            [1, Ewp3],
        ];
        expect(column_add(c1, c2)).toEqual(c3);
    });

    it('truncate', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];
        const Ewp2: Expr = [[], [[1, E1]], [[1, E1]]];

        const c1: Column = [
            [2, Ew],
            [2, Ew],
            [1, Ewp2],
        ];
        const c2: Column = [
            [2, Ew],
            [2, Ew],
            [1, Ew],
            [1, E1],
        ];
        const v = [Ew, Ew, Ew, E1];
        expect(column_truncate(c1, v)).toEqual(c2);
        const v2 = [Ew, Ew, Ew, Ew, E1, E1];
        const c3: Column = [
            [2, Ew],
            [2, Ew],
            [1, Ew],
            [1, Ew],
            [1, E1],
            [1, E1],
        ];
        expect(column_truncate(c1, v2)).toEqual(c3);
    });

    it('truncate2', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];
        const Ewp2: Expr = [[], [[1, E1]], [[1, E1]]];

        const c1: Column = [
            [3, Ew],
            [2, Ewp2],
            [1, Ew],
        ];
        const c2: Column = [
            [3, Ew],
            [2, Ewp2],
            [1, E1],
            [1, E1],
        ];
        const v = [Ewp2, E1, E1];
        expect(column_truncate(c1, v)).toEqual(c2);
    });

    it('expand', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w)(2^w)(3,3,1^w)(4,4,2^w)(4,2^w)(2,2,2,2)
        const e: Expr = [
            [],
            [[1, Ew]],
            [[2, Ew]],
            [
                [3, E1],
                [3, E1],
                [1, Ew],
            ],
            [
                [4, E1],
                [4, E1],
                [2, Ew],
            ],
            [
                [4, E1],
                [2, Ew],
            ],
            [
                [2, E1],
                [2, E1],
                [2, E1],
                [2, E1],
            ],
        ];
        const V = e.map(column_verticals);
        const P = parents(e, V);
        const A = ascending_threshold(V, P, 1, [E1, E1, E1]);
        expect(A.map((v) => v.map((e) => display(e)))).toEqual(
            [[], [E1, E1, E1], [E1, E1, E1], [E1, E1], [E1, E1], [E1, E1, E1], [E1, E1, E1]].map((v) =>
                v.map((e) => display(e)),
            ),
        );
        const e1: Expr = [
            [],
            [[1, Ew]],
            [[2, Ew]],
            [
                [3, E1],
                [3, E1],
                [1, Ew],
            ],
            [
                [4, E1],
                [4, E1],
                [2, Ew],
            ],
            [
                [4, E1],
                [2, Ew],
            ],
            [
                [2, E1],
                [2, E1],
                [2, E1],
                [1, Ew],
            ],
            [
                [3, E1],
                [3, E1],
                [3, E1],
                [2, Ew],
            ],
            [
                [4, E1],
                [4, E1],
                [1, Ew],
            ],
            [
                [5, E1],
                [5, E1],
                [2, Ew],
            ],
            [
                [5, E1],
                [3, E1],
                [3, E1],
                [2, Ew],
            ],
        ];
        expect(display(expand(e, 1))).toEqual(display(e1));
    });
    it('expand2', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w,1^w,1)(2^w,1)(2,1^w,1)(1^w,1^w,1)
        const e: Expr = [
            [],
            [
                [1, Ew],
                [1, Ew],
                [1, E1],
            ],
            [
                [2, Ew],
                [1, E1],
            ],
            [
                [2, E1],
                [1, Ew],
                [1, E1],
            ],
            [
                [1, Ew],
                [1, Ew],
                [1, E1],
            ],
        ];
        const V = e.map(column_verticals);
        const P = parents(e, V);
        const A = ascending_threshold(V, P, 0, [Ew, Ew]);
        expect(A.map((v) => v.map((e) => display(e)))).toEqual(
            [
                [Ew, Ew],
                [Ew, Ew],
                [Ew, E1],
                [Ew, E1],
                [Ew, Ew],
            ].map((v) => v.map((e) => display(e))),
        );
        // ()(1^w,1^w,1)(2^w,1)(2,1^w,1)(1^w,1^w)(2^w,2^w,1)(3^w,2)(3,2^w,2)
        const e1: Expr = [
            [],
            [
                [1, Ew],
                [1, Ew],
                [1, E1],
            ],
            [
                [2, Ew],
                [1, E1],
            ],
            [
                [2, E1],
                [1, Ew],
                [1, E1],
            ],
            [
                [1, Ew],
                [1, Ew],
            ],
            [
                [2, Ew],
                [2, Ew],
                [1, E1],
            ],
            [
                [3, Ew],
                [2, E1],
            ],
            [
                [3, E1],
                [2, Ew],
                [2, E1],
            ],
        ];
        expect(display(expand(e, 1))).toEqual(display(e1));
    });
    it('expand3', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w)(2)(1^w)  →  FS ×1 = ()(1^w)(2)(1,1)
        const e: Expr = [[], [[1, Ew]], [[2, E1]], [[1, Ew]]];
        const e1: Expr = [
            [],
            [[1, Ew]],
            [[2, E1]],
            [
                [1, E1],
                [1, E1],
            ],
        ];
        expect(expand(e, 1)).toEqual(e1);
    });
    it('expand4', () => {
        const E1: Expr = [[]];
        const Ew: Expr = [[], [[1, E1]]];

        // ()(1^w,1)(2^w,2)(3,1^w,1)
        const e: Expr = [
            [],
            [
                [1, Ew],
                [1, E1],
            ],
            [
                [2, Ew],
                [2, E1],
            ],
            [
                [3, E1],
                [1, Ew],
                [1, E1],
            ],
        ];
        // ()(1^w,1)(2^w,2)(3,1^w)(4,2^w,1)(5,3^w,2)
        const e1: Expr = [
            [],
            [
                [1, Ew],
                [1, E1],
            ],
            [
                [2, Ew],
                [2, E1],
            ],
            [
                [3, E1],
                [1, Ew],
            ],
            [
                [4, E1],
                [2, Ew],
                [1, E1],
            ],
            [
                [5, E1],
                [3, Ew],
                [2, E1],
            ],
        ];
        expect(expand(e, 1)).toEqual(e1);
    });
});
