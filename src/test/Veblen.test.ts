import { describe, expect, it } from 'vitest';
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
});
