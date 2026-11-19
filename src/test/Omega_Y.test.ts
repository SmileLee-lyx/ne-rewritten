import { describe, expect, it } from 'vitest';
import { omega_Y_actual, omega_Y_medium, omega_Y_strong, omega_Y_weak } from '@/notations/Y/Omega_Y.ts';

describe('expand', () => {
    it('1343', () => {
        expect(omega_Y_weak.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 4, 9, 18]);
        expect(omega_Y_medium.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25]);
        expect(omega_Y_actual.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25]);
        expect(omega_Y_strong.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25]);
    });
});

describe('omega_Y_actual Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = omega_Y_actual.init()[0];
        const other_limit = structuredClone(limit);
        expect(omega_Y_actual.compare(limit, other_limit)).toBe(0);
        expect(omega_Y_actual.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [
            ...omega_Y_actual.init().slice(1),
            ...[0, 1, 2].map((index) => omega_Y_actual.FS(limit, index)),
        ];
        for (const term of ordinary_terms) {
            expect(omega_Y_actual.compare(limit, term)).toBe(1);
            expect(omega_Y_actual.compare(term, limit)).toBe(-1);
            expect(omega_Y_actual.compare(term, structuredClone(term))).toBe(0);
        }
    });
});

describe('omega_Y_medium Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = omega_Y_medium.init()[0];
        const other_limit = structuredClone(limit);
        expect(omega_Y_medium.compare(limit, other_limit)).toBe(0);
        expect(omega_Y_medium.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [
            ...omega_Y_medium.init().slice(1),
            ...[0, 1, 2].map((index) => omega_Y_medium.FS(limit, index)),
        ];
        for (const term of ordinary_terms) {
            expect(omega_Y_medium.compare(limit, term)).toBe(1);
            expect(omega_Y_medium.compare(term, limit)).toBe(-1);
            expect(omega_Y_medium.compare(term, structuredClone(term))).toBe(0);
        }
    });
});

describe('omega_Y_strong Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = omega_Y_strong.init()[0];
        const other_limit = structuredClone(limit);
        expect(omega_Y_strong.compare(limit, other_limit)).toBe(0);
        expect(omega_Y_strong.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [
            ...omega_Y_strong.init().slice(1),
            ...[0, 1, 2].map((index) => omega_Y_strong.FS(limit, index)),
        ];
        for (const term of ordinary_terms) {
            expect(omega_Y_strong.compare(limit, term)).toBe(1);
            expect(omega_Y_strong.compare(term, limit)).toBe(-1);
            expect(omega_Y_strong.compare(term, structuredClone(term))).toBe(0);
        }
    });
});

describe('omega_Y_weak Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = omega_Y_weak.init()[0];
        const other_limit = structuredClone(limit);
        expect(omega_Y_weak.compare(limit, other_limit)).toBe(0);
        expect(omega_Y_weak.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [
            ...omega_Y_weak.init().slice(1),
            ...[0, 1, 2].map((index) => omega_Y_weak.FS(limit, index)),
        ];
        for (const term of ordinary_terms) {
            expect(omega_Y_weak.compare(limit, term)).toBe(1);
            expect(omega_Y_weak.compare(term, limit)).toBe(-1);
            expect(omega_Y_weak.compare(term, structuredClone(term))).toBe(0);
        }
    });
});
