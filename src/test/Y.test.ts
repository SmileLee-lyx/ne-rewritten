import { describe, expect, it } from 'vitest';
import { Y_seq } from '@/notations/Y/Y.ts';

describe('expand', () => {
    it('1343', () => {
        expect(Y_seq.FS([1, 3, 4, 3], 3).slice(0, 9)).toEqual([1, 3, 4, 2, 5, 9, 4, 9, 18]);
    });
});
