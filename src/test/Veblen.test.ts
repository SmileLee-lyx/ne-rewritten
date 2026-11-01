import { describe, expect, it, vi } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import { VeblenPhi } from '@/notations/Misc/Veblen.ts';

type Term = any[];

const pl = (e: Term) => resolve_display(VeblenPhi.display as any).plain(e);
const sep = (e: Term) => resolve_display(VeblenPhi.display_equiv!.separate as any).plain(e);
const fd = (s: string) => resolve_display(VeblenPhi.display as any).from_display!(s) as Term;
const cmp = (a: Term, b: Term) => (VeblenPhi.compare as (a: any, b: any) => number)(a, b);

const throwCheck = (s: string) => expect(() => fd(s)).toThrow();

function sameExpr(a: unknown, b: unknown) {
    expect(a).toEqual(b);
}

// FS 生成标准表达式, 校验 parse(display(e)) 语义等价且再显示一致
function generatedExprs(limit: number): Term[] {
    const j = (x: unknown) => JSON.stringify(x, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '#I' : v));
    const seen = new Set<string>();
    const queue: (Term | number)[] = [VeblenPhi.init()[0], [2, [], [2, [], [0]]], VeblenPhi.init()[1]];
    const out: Term[] = [];
    for (let r = 0; r < 100 && out.length < limit; r++) {
        const next: (Term | number)[] = [];
        for (const e of queue) {
            const k = j(e);
            if (e !== null && !seen.has(k)) {
                seen.add(k);
                next.push(e);
            }
        }
        if (next.length === 0) break;
        const grown: (Term | number)[] = [];
        for (const e of next) {
            for (const n of [0, 1, 2, 3, 4, 5]) {
                for (const f of [VeblenPhi.FS, VeblenPhi.FS_short!]) {
                    try {
                        const o = f(e as never, n);
                        if (o !== null && !seen.has(j(o))) grown.push(o);
                    } catch {
                        // skip
                    }
                }
            }
        }
        queue.length = 0;
        queue.push(...grown.slice(0, 80));
    }
    for (const e of seen) {
        const parsed = JSON.parse(e) as unknown;
        if (Array.isArray(parsed)) out.push(parsed as Term);
    }
    return out;
}

describe('Veblen φ from_display', () => {
    it('parse/display roundtrip for FS-generated terms (both styles)', () => {
        const exprs = generatedExprs(200);
        expect(exprs.length).toBeGreaterThan(50);
        for (const e of exprs) {
            const p = fd(pl(e));
            const s = fd(sep(e));
            expect(cmp(p, e)).toBe(0);
            expect(cmp(s, e)).toBe(0);
            expect(pl(p)).toBe(pl(e));
            expect(sep(s)).toBe(sep(e));
        }
    });

    it('identity: φ(1,0,1) = φ(1@2,1@0) = φ(1@1;1)', () => {
        sameExpr(fd('φ(1,0,1)'), fd('φ(1@2,1@0)'));
        sameExpr(fd('φ(1,0,1)'), fd('φ(1@1;1)'));
    });

    it('identity: φ(1,0,0) = φ(1,0;0)', () => {
        sameExpr(fd('φ(1,0,0)'), fd('φ(1,0;0)'));
    });

    it('identity: φ(2;0)+φ(1,0) = φ(2,0)+φ(1,0)', () => {
        sameExpr(fd('φ(2;0)+φ(1,0)'), fd('φ(2,0)+φ(1,0)'));
    });

    it('identity: mixed labelled list equals canonical entries', () => {
        sameExpr(fd('φ(1@(1,0), 2@3, 1, 1)'), fd('φ(1@(1,0),2@3,1@1,1@0)'));
    });

    it('scalar index equal to a natural uses slot semantics', () => {
        sameExpr(fd('φ(1@φ(0),1)'), fd('φ(1@1,1)'));
        expect(pl(fd('φ(1@φ(0),1)'))).toBe('φ(1,1)');
        sameExpr(fd('φ(1@φ(0))'), fd('φ(1,0)'));
        expect(pl(fd('φ(1@φ(0)+φ(0))'))).toBe('φ(1,0,0)');
        expect(pl(fd('φ(2@φ(0),φ(0))'))).toBe('φ(2,1)');
    });

    it('merge-sum coefficients and nested sums', () => {
        expect(pl(fd('ω2+1'))).toBe('ω2+1');
        expect(pl(fd('φ(1,0)+φ(1,0)+1'))).toBe('φ(1,0)2+1');
        expect(pl(fd('φ(φ(1,0)+1)'))).toBe('φ(φ(1,0)+1)');
        expect(pl(fd('φ(2,0)+φ(1,0)+1'))).toBe('φ(2,0)+φ(1,0)+1');
    });

    it('primitive ordinals', () => {
        expect(pl(fd('1'))).toBe('1');
        expect(pl(fd('2'))).toBe('2');
        expect(pl(fd('ω'))).toBe('ω');
        expect(pl(fd('0'))).toBe('0');
        expect(pl(fd('φ(2)'))).toBe('φ(2)');
        expect(pl(fd('φ(ω+1,ω)'))).toBe('φ(ω+1,ω)');
    });

    it('aliases f == φ and w == ω', () => {
        sameExpr(fd('f(1,0)'), fd('φ(1,0)'));
        sameExpr(fd('f(1@w;1)'), fd('φ(1@ω;1)'));
        sameExpr(fd('f(1,w)'), fd('φ(1,ω)'));
        sameExpr(fd('f(w)'), fd('φ(ω)'));
        sameExpr(fd('w+1'), fd('ω+1'));
        sameExpr(fd('f(w2+1)'), fd('φ(ω2+1)'));
    });

    it('Limit', () => {
        expect(fd('Limit')).toBe(Infinity);
        expect(fd(' Limit ')).toBe(Infinity);
    });

    it('complex and nested indices', () => {
        expect(pl(fd('φ(1@(1,0))'))).toBe('φ(1@(1,0))');
        expect(sep(fd('φ(1@(1,0))'))).toBe('φ(1@(1,0);0)');
        expect(pl(fd('φ(1@(1@(1,0)))'))).toBe('φ(1@(1@(1,0)))');
        expect(pl(fd('φ(1@ω)'))).toBe('φ(1@ω)');
        expect(pl(fd('φ(1@φ(1,0))'))).toBe('φ(1@φ(1,0))');
    });

    it('canonical re-display of alternative spellings', () => {
        expect(pl(fd('φ(1@2,1@0)'))).toBe('φ(1,0,1)');
        expect(pl(fd('φ(1,0)+φ(1,0)+1'))).toBe('φ(1,0)2+1');
        expect(pl(fd('φ(1@(1,0), 2@3, 1, 1)'))).toBe('φ(1@(1,0),2@3,1@1,1@0)');
    });

    it('rejects malformed input', () => {
        for (const s of [
            '(1, 1@(1,0))',
            'φ(1, 1@(1,0))',
            'φ(1@0,2)',
            'abc',
            'φ(1,0))',
            'Limit,0',
            'φ(1@1, 1, 2@3)',
            'ω^2',
        ])
            throwCheck(s);
    });

    it.each(['φ(0,0,0)', 'φ(0@2)', 'φ(0@ω)', 'φ(0@(1,0))', 'φ(0+0@2,ω0,φ(2)0)'])(
        'removes every zero entry in %s',
        (text) => {
            const expr = fd(text);
            expect(expr).toEqual(fd('1'));
            expect(pl(expr)).toBe('1');
            expect(VeblenPhi.is_limit(expr as never)).toBe(false);
            expect(VeblenPhi.FS(expr as never, 2)).toEqual(fd('0'));
        },
    );

    it.each([
        ['φ(1@(0@(1)))', 'ω'],
        ['φ(1@(0@2,1@0))', 'φ(1@1)'],
        ['φ(1,0,1)', 'φ(1@2,1@0)'],
        ['φ(1,0,0,0)', 'φ(1@3)'],
        ['φ(1,0,0;1)', 'φ(1@2;1)'],
        ['φ(1@(1,0,0))', 'φ(1@(1@2))'],
        ['φ(1@(1,0,1))', 'φ(1@(1@2,1@0))'],
    ])('deletes zeros recursively without renumbering slots: %s', (text, expected) => {
        expect(fd(text)).toEqual(fd(expected));
    });

    it.each(['0+0', 'ω0', 'φ(2)0', 'ω0+φ(1,0)0+0'])('represents the zero sum %s as [0]', (text) => {
        const expr = fd(text);
        expect(expr).toEqual([0]);
        expect(pl(expr)).toBe('0');
        expect(cmp(expr, fd('0'))).toBe(0);
        expect(VeblenPhi.is_limit(expr as never)).toBe(false);
        expect(VeblenPhi.FS(expr as never, 1)).toEqual([0]);
    });

    it.each([
        ['0+1', '1'],
        ['ω+0', 'ω'],
        ['1+ω', 'ω'],
        ['ω+1', 'ω+1'],
        ['ω+1+ω', 'ω2'],
        ['ω+1+0+ω+2+ω', 'ω3'],
        ['ω2+φ(2)', 'φ(2)'],
        ['φ(2)+ω2+1+φ(2)+ω+1', 'φ(2)2+ω+1'],
        ['φ(φ(1,0))+ω+φ(1,0)', 'φ(1,0)2'],
    ])('uses ordinal absorption without sorting addends: %s → %s', (text, expected) => {
        const expr = fd(text);
        expect(expr).toEqual(fd(expected));
        expect(pl(expr)).toBe(expected);
        expect(VeblenPhi.is_limit(expr as never)).toBe(VeblenPhi.is_limit(fd(expected) as never));
    });

    it.each([
        ['φ(1+ω)', 'φ(ω)'],
        ['φ(ω+0;0)', 'φ(ω;0)'],
        ['φ(1+ω,0+0,ω0)', 'φ(ω@2)'],
        ['φ(1@1+ω)', 'φ(1@ω)'],
        ['φ(1@(1+ω))', 'φ(1@ω)'],
        ['φ(1@ω+0)', 'φ(1@ω)'],
        ['φ(1@0+0)', 'ω'],
        ['φ(1@ω0)', 'ω'],
        ['φ(1@(0+0))', 'ω'],
        ['φ(φ(1,0))', 'φ(1,0)'],
        ['φ(φ(φ(1,0)))', 'φ(1,0)'],
        ['φ(1@φ(φ(1,0)))', 'φ(1@φ(1,0))'],
    ])('normalizes ordinal subexpressions before using them: %s', (text, expected) => {
        expect(fd(text)).toEqual(fd(expected));
    });

    it.each([
        ['φ(1@(1))', 'φ(1@1)'],
        ['φ(1@(1@0))', 'φ(1@1)'],
        ['φ(1@(1+1))', 'φ(1@2)'],
        ['φ(1@1+1)', 'φ(1@2)'],
        ['φ(1@(1);0)', 'φ(1@1;0)'],
        ['φ(1@(1@(1)))', 'φ(1@(1@1))'],
    ])('shares finite slot semantics without shifting separate or nested addresses: %s', (text, expected) => {
        expect(fd(text)).toEqual(fd(expected));
    });

    it.each([
        'φ(1@1,1@2)',
        'φ(1@(1@0,1@1))',
        'φ(1@2,1@2)',
        'φ(1@(2),1@2)',
        'φ(1@(0@2,1@0),1@1)',
        'φ(1@φ(φ(1,0)),1@φ(1,0))',
        'φ(1@ω+0,1@1+ω)',
        'φ(1@0,1@1;0)',
        'φ(1@(1@ω+0,1@1+ω))',
        'φ(0@1,1@2)',
        'φ(0@2,0@2)',
        'φ(1@(0@0,1@1))',
    ])('rejects increasing or duplicate addresses, including normalized and zero-valued entries: %s', (text) => {
        expect(() => fd(text)).toThrow();
    });

    it.each([false, true])(
        'round-trips the reported generated term with parsed-first cache order %s',
        async (parsed_first) => {
            for (const variant of ['FS', 'FS_short'] as const) {
                vi.resetModules();
                const notation = (await import('@/notations/Misc/Veblen.ts')).VeblenPhi;
                let original = notation.init()[0];
                for (const n of [3, 2, 2, 2]) original = notation.FS(original, n);
                const plain = resolve_display(notation.display),
                    separate = resolve_display(notation.display_equiv!.separate);
                expect(plain.plain(original)).toBe('φ(1,0,0,0)');
                const parsed = plain.from_display!(plain.plain(original));
                const parsed_separate = separate.from_display!(separate.plain(original));
                expect(parsed).toEqual(original);
                expect(parsed_separate).toEqual(original);
                const expand = notation[variant]!;
                const first = parsed_first ? parsed : original,
                    second = parsed_first ? original : parsed;
                for (const n of [0, 1, 2, 3]) {
                    const expected = expand(first, n);
                    expect(expand(second, n)).toEqual(expected);
                    expect(expand(parsed_separate, n)).toEqual(expected);
                    if (n === 1) expect(plain.plain(expected)).toBe('1');
                }
            }
        },
    );
});
