import { describe, expect, it } from 'vitest';
import { BM4, display, from_display } from '@/notations/BM-like/BM.ts';

// ===========================================================================
// display 测试
// ===========================================================================

describe('display', () => {
    it('极限', () => {
        expect(display([[Infinity]])).toBe('Limit');
    });

    it('空矩阵', () => {
        expect(display([])).toBe('');
    });

    it('标准矩阵', () => {
        expect(display([[], []])).toBe('(0)(0)');
        expect(display([[], [1, 1]])).toBe('(0)(1,1)');
        expect(display([[], [1, 1, 1], [], [1, 1, 1]])).toBe('(0)(1,1,1)(0)(1,1,1)');
        expect(display([[], [1, 1, 1], [2, 1], [1, 1, 1]])).toBe('(0)(1,1,1)(2,1)(1,1,1)');
    });
});

// ===========================================================================
// fromDisplay 测试（反转 display 测试用例）
// ===========================================================================

describe('fromDisplay', () => {
    it('极限', () => {
        expect(from_display('Limit')).toEqual([[Infinity]]);
    });

    it('空矩阵', () => {
        expect(from_display('')).toEqual([]);
    });

    it('标准矩阵', () => {
        expect(from_display('(0)(0)')).toEqual([[], []]);
        expect(from_display('(0)(1,1)')).toEqual([[], [1, 1]]);
        expect(from_display('(0)(1,1,1)(0)(1,1,1)')).toEqual([[], [1, 1, 1], [], [1, 1, 1]]);
        expect(from_display('(0)(1,1,1)(2,1)(1,1,1)')).toEqual([[], [1, 1, 1], [2, 1], [1, 1, 1]]);
    });

    it('带空格的字符串', () => {
        expect(from_display('()(1, 0)')).toEqual([[], [1]]);
        expect(from_display('( 0)(1,1)')).toEqual([[], [1, 1]]);
        expect(from_display('(0)( 1, 1 )')).toEqual([[], [1, 1]]);
        expect(from_display('( 0 , 0 ) ( 0 , 0 )')).toEqual([[], []]);
    });

    it('非法格式', () => {
        expect(() => from_display('abc')).toThrow('Illegal input string: abc');
        expect(() => from_display('(0)extra')).toThrow('Illegal input string: (0)extra');
        expect(() => from_display('(0')).toThrow('Illegal input string: (0');
        expect(() => from_display('0')).toThrow('Illegal input string: 0');
    });
});

// ===========================================================================
// FS 展开测试
// ===========================================================================

describe('FS', () => {
    it('0 展开', () => {
        expect(display(BM4.FS(from_display(''), 2))).toBe('');
        expect(display(BM4.FS(from_display(''), 4))).toBe('');
    });

    it('后继展开', () => {
        expect(display(BM4.FS(from_display('(0)(0)'), 2))).toBe('(0)');
        expect(display(BM4.FS(from_display('(0)(1,1)(0)'), 4))).toBe('(0)(1,1)');
    });

    it('极限展开', () => {
        expect(display(BM4.FS(from_display('Limit'), 2))).toBe('(0)(1,1,1)');
        expect(display(BM4.FS(from_display('Limit'), 4))).toBe('(0)(1,1,1,1,1)');
    });

    it('2 行展开', () => {
        expect(display(BM4.FS(from_display('(0)(1,1)(1,1)'), 2))).toBe('(0)(1,1)(1)(2,1)(2)(3,1)');
    });

    it('3 行提升展开', () => {
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2)(1,1,1)'), 1))).toBe('(0)(1,1,1)(2)(1,1)(2,2,1)(3)');
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2,1)(1,1,1)'), 1))).toBe('(0)(1,1,1)(2,1)(1,1)(2,2,1)(3,2)');
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2,1,1)(3,1)(2,1,1)'), 1))).toBe(
            '(0)(1,1,1)(2,1,1)(3,1)(2,1)(3,2,1)(4,2,1)(5,2)',
        );
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2,2)(1,1,1)'), 1))).toBe('(0)(1,1,1)(2,2)(1,1)(2,2,1)(3,3)');
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2,2,2)(3,1)(2,2,2)'), 1))).toBe(
            '(0)(1,1,1)(2,2,2)(3,1)(2,2,1)(3,3,2)(4,1)',
        );
        expect(display(BM4.FS(from_display('(0)(1,1,1)(2,2,2)(3,2)(2,2,2)'), 1))).toBe(
            '(0)(1,1,1)(2,2,2)(3,2)(2,2,1)(3,3,2)(4,3)',
        );
    });
});

describe('BM4 Infinity comparison', () => {
    it('orders Limit above ordinary terms in both directions and equates independent sentinels', () => {
        const limit = BM4.init()[0];
        const other_limit = structuredClone(limit);
        expect(BM4.compare(limit, other_limit)).toBe(0);
        expect(BM4.compare(other_limit, limit)).toBe(0);
        const ordinary_terms = [...BM4.init().slice(1), ...[0, 1, 2].map((index) => BM4.FS(limit, index))];
        for (const term of ordinary_terms) {
            expect(BM4.compare(limit, term)).toBe(1);
            expect(BM4.compare(term, limit)).toBe(-1);
            expect(BM4.compare(term, structuredClone(term))).toBe(0);
        }
    });
});
