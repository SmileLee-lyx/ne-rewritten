import { describe, expect, it } from 'vitest';
import { extend, Mountain } from '@/notations/SMN/S_omega2_MN.ts';

describe('omega2 MN', () => {
    it('0 ;1', () => {
        const e: Mountain = [[], [[1, [0, 1]]]];
        const e_ex: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [0, 1]],
            ],
        ];
        const e_ex2: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [2]],
            ],
            [
                [3, [1]],
                [3, [2]],
                [3, [0, 1]],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
        expect(extend(e_ex)).toEqual(e_ex2);
    });
    it('0 ;1 ,2;1', () => {
        const e: Mountain = [
            [],
            [[1, [0, 1]]],
            [
                [2, [1]],
                [1, [0, 1]],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, [0, 1]]],
            [[2, [1]]],
            [
                [3, [1]],
                [3, [0, 1]],
            ],
            [
                [4, [1]],
                [4, [2]],
                [3, [0, 1]],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
    it('0 ,1 ,2;2 ,3,3', () => {
        const e: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [0, 1]],
            ],
            [
                [3, [1]],
                [3, [1]],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [0, 1]],
            ],
            [
                [3, [1]],
                [2, [0, 1]],
            ],
            [
                [4, [1]],
                [4, [1]],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
    it('test', () => {
        const e: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [2]],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, [1]]],
            [
                [2, [1]],
                [2, [1]],
            ],
            [
                [3, [1]],
                [3, [1]],
                [3, [2]],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
});
