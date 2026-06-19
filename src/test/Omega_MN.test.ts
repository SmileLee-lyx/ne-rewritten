import { describe, expect, it } from 'vitest';
import {
    column_verticals,
    copy_column,
    extend,
    magma_indices,
    Mountain,
    parent,
    subtract_1,
} from '@/notations/SMN/n_MN.ts';

describe('omega MN', () => {
    it('0 ,1', () => {
        const e: Mountain = [[], [[1, 0]]];
        const e_ex: Mountain = [[], [], [[2, 0]]];
        expect(extend(e)).toEqual(e_ex);
    });
    it('0 ,,1', () => {
        const e: Mountain = [[], [[1, 1]]];
        const e_ex: Mountain = [
            [],
            [[1, 0]],
            [
                [2, 0],
                [2, 1],
            ],
        ];
        const e_ex2: Mountain = [
            [],
            [[1, 0]],
            [
                [2, 0],
                [2, 0],
            ],
            [
                [3, 0],
                [3, 0],
                [3, 1],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
        expect(extend(extend(e))).toEqual(e_ex2);
    });
    it('0 ,,1 ,2,,1', () => {
        const e: Mountain = [
            [],
            [[1, 1]],
            [
                [2, 0],
                [1, 1],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, 1]],
            [[2, 0]],
            [
                [3, 0],
                [3, 1],
            ],
            [
                [4, 0],
                [4, 0],
                [3, 1],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
    it('0 ,,1 ,,2,,1', () => {
        const e: Mountain = [
            [],
            [[1, 1]],
            [
                [2, 1],
                [2, 1],
            ],
        ];
        const e_ex: Mountain = [
            [],
            [[1, 1]],
            [
                [2, 1],
                [2, 0],
            ],
            [
                [3, 1],
                [3, 0],
                [3, 1],
            ],
        ];
        expect(extend(e)).toEqual(e_ex);
    });
});
