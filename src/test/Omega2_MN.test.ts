import { describe, expect, it } from 'vitest';
import { extend, Mountain } from '@/notations/SMN/SA_omega2_MN.ts';

describe('omega MN', () => {
    it('0 ;1', () => {
        const e: Mountain = [[], [[1, [0, 1], false]]];
        const e_ex: Mountain = [
            [],
            [[1, [1], true]],
            [
                [2, [1], true],
                [2, [0, 1], false],
            ],
        ];
        const e_ex2: Mountain = [
            [],
            [[1, [1], true]],
            [
                [2, [1], true],
                [2, [2], true],
            ],
            [
                [3, [1], true],
                [3, [2], true],
                [3, [0, 1], false],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
        expect(extend(e_ex)).toEqual(e_ex2);
    });
    it('0 ;1 ,2;1', () => {
        const e: Mountain = [
            [],
            [[1, [0, 1], false]],
            [
                [2, [1], true],
                [1, [0, 1], false],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, [0, 1], false]],
            [[2, [1], true]],
            [
                [3, [1], true],
                [3, [0, 1], false],
            ],
            [
                [4, [1], true],
                [4, [2], true],
                [3, [0, 1], false],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
});
