import { describe, expect, it } from 'vitest';
import { Y_seq } from '@/notations/Y/Y.ts';

describe('expand', () => {
    it('1343', () => {
        expect(Y_seq.FS([1, 3, 4, 3], 3).slice(0, 9)).toEqual([1, 3, 4, 2, 5, 9, 4, 9, 18]);
    });
});

describe('Y_seq Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = Y_seq.init()[0];
        const other_limit = structuredClone(limit);
        expect(Y_seq.compare(limit, other_limit)).toBe(0);
        expect(Y_seq.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [...Y_seq.init().slice(1), ...[0, 1, 2].map((index) => Y_seq.FS(limit, index))];
        for (const term of ordinary_terms) {
            expect(Y_seq.compare(limit, term)).toBe(1);
            expect(Y_seq.compare(term, limit)).toBe(-1);
            expect(Y_seq.compare(term, structuredClone(term))).toBe(0);
        }
    });
});
