import { describe, expect, it } from 'vitest';
import { omega_Y_actual, omega_Y_medium, omega_Y_strong, omega_Y_weak } from '@/notations/Y/Omega_Y.ts';

describe('expand', () => {
    it('1343', () => {
        expect(omega_Y_weak.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 4, 9, 18, 8]);
        expect(omega_Y_medium.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25, 36]);
        expect(omega_Y_actual.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25, 36]);
        expect(omega_Y_strong.FS([1, 3, 4, 3], 2)).toEqual([1, 3, 4, 2, 5, 9, 11, 16, 25, 36]);
    });
});
