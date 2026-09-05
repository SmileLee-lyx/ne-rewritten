import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import { aSAN } from '@/notations/aSAN/aSAN.ts';
import { T_Minus1_Y } from '@/notations/Y/T_minus1_Y.ts';
import { DEN } from '@/notations/DEN/DEN.ts';
import { DEN2 } from '@/notations/DEN/DEN2.ts';
import { DEN3 } from '@/notations/DEN/DEN3.ts';
import { BM4 } from '@/notations/BM-like/BM.ts';

type Parser = (s: string) => any;
type Term = unknown[];

function parser(def: { display: unknown }): Parser {
    const rd = resolve_display(def.display as any);
    return (s: string) => rd.from_display!(s);
}
function plain(def: { display: unknown }): (e: Term) => string {
    const rd = resolve_display(def.display as any);
    return (e: Term) => rd.plain(e);
}

const throwCheck = (fd: Parser) => (s: string) => expect(() => fd(s)).toThrow();

// 带空格的输入必须与紧凑写法解析出相同结果; 整数内部插空格保持非法
function spacedSuite(name: string, fd: Parser, pairs: [string, string][], rejects: string[]) {
    describe(name, () => {
        it('whitespace == canonical', () => {
            for (const [c, sp] of pairs) expect(fd(sp)).toEqual(fd(c));
        });
        it('rejects', () => {
            for (const s of rejects) throwCheck(fd)(s);
        });
    });
}

// display 输出往返: from_display(display(t)) 精确还原
function roundtripSuite(name: string, fd: Parser, d: (t: Term) => string, terms: Term[]) {
    describe(name, () => {
        it('display -> from_display roundtrip', () => {
            for (const t of terms) expect(fd(d(t))).toEqual(t);
        });
    });
}

describe('aSAN', () => {
    const fd = parser(aSAN);
    const d = plain(aSAN);
    const inf = [1, Infinity];
    roundtripSuite('roundtrip', fd, d, [
        inf,
        [[1, Infinity], 1],
        [1, [1, Infinity]],
        [2, [1, Infinity]],
        [1, [2, 3], 4],
        [[1, 2], 3],
    ]);
    it('Limit', () => {
        expect(fd('Limit')).toEqual(inf);
        expect(fd('Limit ')).toEqual(inf);
        expect(d(fd('Limit') as Term)).toBe('Limit');
    });
    it('nested Limit allowed', () => {
        expect(fd('(Limit,1)')).toEqual([[1, Infinity], 1]);
    });
});

describe('T(-1)Y', () => {
    const fd = parser(T_Minus1_Y);
    const d = plain(T_Minus1_Y);
    roundtripSuite('roundtrip', fd, d, [
        [[]],
        [[], []],
        [[], [[]]],
        [[], [[], [[]]]],
        [[[], []]],
        [[[], []], []],
        [[], [[], [[], []]]],
        Array.from({ length: 5 }, () => []),
    ]);
    it('Limit only as whole input', () => {
        expect(fd('Limit')).toEqual([Infinity]);
        expect(fd(' Limit ')).toEqual([Infinity]);
    });
    it('rejects nested or trailing Limit', () => {
        for (const s of ['Limit,0', ' Limit ,0', '(Limit)', 'Limitx']) throwCheck(fd)(s);
    });
    it('rejects bare numbers separated by space', () => {
        for (const s of ['0 1', '1 0']) throwCheck(fd)(s);
    });
});

describe('DEN1', () => {
    const fd = parser(DEN);
    const d = plain(DEN);
    roundtripSuite('roundtrip', fd, d, [
        [
            [0, 0, 0],
            [1, 1, 0],
            [1, 2, 1, 0],
            [2, 2, 1, 0],
        ],
        [[], [2, 1, 0]],
        [[0, 0], [3]],
        [
            [1, 2],
            [2, 5, 7],
        ],
        [
            [0, 12],
            [4, 10],
            [23, 100],
        ],
        [[1, 2], [4]],
    ]);
    it('Limit', () => {
        expect(fd('Limit')).toEqual([[Infinity]]);
        expect(fd(' Limit ')).toEqual([[Infinity]]);
    });
    it('rejects', () => {
        for (const s of ['', '(1,0)1', '(1,0)1;0,', '(1,0)1;0,,1', '(1 0)1;0', ';x', 'Limit;0']) throwCheck(fd)(s);
    });
});

describe('DEN2', () => {
    const fd = parser(DEN2);
    const d = plain(DEN2);
    it('canonical strings parse', () => {
        expect(fd('(1,0)1(2,1,0)1')).toEqual([
            [1, [[1], [0]]],
            [1, [[2], [1], [0]]],
        ]);
        expect(fd('(*0,1,*2)3')).toEqual([[3, [[0, true], [1], [2, true]]]]);
        expect(fd('(1,0)1(2,1,0)1')).toEqual(fd(' ( 1 , 0 ) 1 ( 2 , 1 , 0 ) 1 '));
    });
    it('empty entries rejected', () => {
        for (const s of ['()1', '( )1']) throwCheck(fd)(s);
    });
    it('Limit', () => {
        expect(fd('Limit')).toEqual([Infinity]);
        expect(fd(' Limit ')).toEqual([Infinity]);
    });
    it('rejects', () => {
        for (const s of ['(1 0)1', '( 1 , 0 1 ) 2', 'Limitx', '*0', '1']) throwCheck(fd)(s);
    });
    roundtripSuite('roundtrip', fd, d, [
        [],
        [[1, [[1], [0]]]],
        [[2, [[0], [1, true], [2]]]],
        [
            [1, [[1], [0]]],
            [1, [[2], [1], [0]]],
        ],
        [[5, [[3, true]]]],
    ]);
});

describe('DEN3', () => {
    const fd = parser(DEN3);
    const d = plain(DEN3);
    roundtripSuite('roundtrip', fd, d, [
        [],
        [[1, [1], [0]]],
        [[2, [0], [1, true], [2]]],
        [
            [1, [1], [0]],
            [1, [2], [1], [0]],
        ],
        [[3]],
        [[5, [3, true]]],
        [
            [1, [7, true], [2, true]],
            [4, [0]],
        ],
    ]);
    it('Limit', () => {
        expect(fd('Limit')).toEqual([Infinity]);
        expect(fd(' Limit ')).toEqual([Infinity]);
    });
    it('rejects', () => {
        for (const s of [';', '(1,0)', '(0,)1', '(*)1', '( 1 , 0 1 ) 2', 'Limit 0']) throwCheck(fd)(s);
    });
});

describe('BMS from_display', () => {
    const fd = parser(BM4);
    it('Limit and empty', () => {
        expect(fd('Limit')).toEqual([[Infinity]]);
        expect(fd(' Limit ')).toEqual([[Infinity]]);
        expect(fd('')).toEqual([]);
        expect(fd('  ')).toEqual([]);
    });
    it('canonical vs spaced', () => {
        expect(fd('(0,0,0)(1,1,1)')).toEqual(fd(' ( 0 , 0 , 0 ) ( 1 , 1 , 1 ) '));
        expect(fd('(0)(1)(2)')).toEqual(fd('( 0 ) ( 1 ) ( 2 ) '));
    });
    it('rejects', () => {
        for (const s of ['(1 0)', '( 1 , 0 1 )', 'Limitx']) throwCheck(fd)(s);
    });
});

// ---- 空格容忍性(任意记号边界, 除多位整数内部) ----
spacedSuite(
    'aSAN whitespace',
    parser(aSAN),
    [
        ['Limit', ' Limit '],
        ['1', ' 1 '],
        ['(1,(2,3),4)', ' ( 1 , ( 2 , 3 ) , 4 ) '],
        ['(Limit,1)', '( Limit , 1 )'],
        ['(1,2,3)', '( 1 , 2, 3 )'],
    ],
    ['(1 2)', '( 1 0 0 )', 'Limi t'],
);
spacedSuite(
    'T(-1)Y whitespace',
    parser(T_Minus1_Y),
    [
        ['Limit', ' Limit '],
        ['0', ' 0 '],
        ['', '  '],
        ['0,1', ' 0 , 1 '],
        ['0,(0,1)', '0 , ( 0 , 1 )'],
        ['(0,1)', ' ( 0 , 1 ) '],
    ],
    ['0 1', 'Limit,0', ' Limit ,0', '(Limit)', '1 0'],
);
spacedSuite(
    'DEN1 whitespace',
    parser(DEN),
    [
        ['Limit', ' Limit '],
        [';', ' ; '],
        ['(1,0)1(2,1,0)2;0,0,0', ' ( 1 , 0 ) 1 ( 2 , 1 , 0 ) 2 ; 0 , 0 , 0 '],
        ['(1,0)1;', '( 1, 0 ) 1 ; '],
        [';1,2', ' ; 1 , 2 '],
        ['()3;0,0', '( ) 3 ; 0 , 0'],
    ],
    ['(1 0)1;0', '(1,0 1)2;0'],
);
spacedSuite(
    'DEN2 whitespace',
    parser(DEN2),
    [
        ['Limit', ' Limit '],
        ['', '  '],
        ['(1,0)1(2,1,0)1', ' ( 1 , 0 ) 1 ( 2 , 1 , 0 ) 1 '],
        ['(*0,1,*2)3', '( * 0 , 1 , * 2 ) 3 '],
        ['(0)1', '( 0 ) 1 '],
    ],
    ['(1 0)1', '( 1 , 0 1 ) 2', 'Limitx'],
);
spacedSuite(
    'DEN3 whitespace',
    parser(DEN3),
    [
        ['Limit', ' Limit '],
        ['', '  '],
        ['(1,0)1', ' ( 1 , 0 ) 1 '],
        ['(*0,1,*2)2', '( * 0 , 1 , * 2 ) 2 '],
        ['(*3)5', ' ( * 3 ) 5 '],
    ],
    ['(1 0)1', '( 1 , 0 1 ) 2', 'Limit 0'],
);
spacedSuite(
    'BMS whitespace',
    parser(BM4),
    [
        ['Limit', ' Limit '],
        ['', '  '],
        ['(0,0,0)(1,1,1)', ' ( 0 , 0 , 0 ) ( 1 , 1 , 1 ) '],
        ['(0)(1)(2)', '( 0 ) ( 1 ) ( 2 ) '],
        ['(0,1,2)', '( 0 , 1 , 2 ) '],
    ],
    ['(1 0)', '( 1 , 0 1 )', 'Limitx'],
);
