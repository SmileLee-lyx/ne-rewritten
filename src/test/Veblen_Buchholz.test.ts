import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import {
    VeblenPhi,
    encode_countable,
    decode_countable,
    compare_psi_forest,
    type PsiForest,
    type PsiNode,
} from '@/notations/Misc/Veblen.ts';
import { BM4, display as display_bm, from_display as parse_bm, compare as compare_bm } from '@/notations/BM-like/BM.ts';
import { VEBLEN_BUCHHOLZ_EXAMPLES as FIXTURE } from './fixtures/veblen_buchholz.ts';

const PHI = resolve_display(VeblenPhi.display);
const SEPARATE = resolve_display(VeblenPhi.display_equiv!.separate);
const BOCF = resolve_display(VeblenPhi.display_equiv!.bocf);
const BMS = resolve_display(VeblenPhi.display_equiv!.bms);
const BOUNDARY = [[], [1, 1], [2, 2]];
type Expr = ReturnType<typeof VeblenPhi.init>[number];

function check_roundtrip(expr: Expr): void {
    const bocf_text = BOCF.plain(expr),
        bms_text = BMS.plain(expr);
    expect(BOCF.from_display!(bocf_text)).toEqual(expr);
    expect(BMS.from_display!(bms_text)).toEqual(expr);
    expect(BOCF.plain(BMS.from_display!(bms_text))).toBe(bocf_text);
    expect(BMS.plain(BOCF.from_display!(bocf_text))).toBe(bms_text);
}

function freeze_tree(value: unknown): void {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze_tree);
    Object.freeze(value);
}

// 独立的有限 G 集合计算，供语法生成器筛选测试树。
function g_terms(forest: PsiForest, label: number): PsiForest[] {
    const result: PsiForest[] = [];
    for (const [i, child] of forest)
        if (i >= label) {
            result.push(child, ...g_terms(child, label));
        }
    return result;
}

function generated_forests(max_size: number): PsiForest[] {
    const forests: PsiForest[][] = [[[]]],
        principal: PsiNode[][] = [[]];
    for (let size = 1; size <= max_size; size++) {
        principal[size] = [];
        for (const child of forests[size - 1])
            for (const label of [0, 1] as const) {
                if (g_terms(child, label).every((term) => compare_psi_forest(term, child) < 0))
                    principal[size].push([label, child]);
            }
        forests[size] = [];
        for (let head_size = 1; head_size <= size; head_size++)
            for (const head of principal[head_size]) {
                for (const tail of forests[size - head_size]) {
                    if (!tail.length || compare_psi_forest([head], [tail[0]]) >= 0) forests[size].push([head, ...tail]);
                }
            }
    }
    return forests.flat().filter((forest) => forest.every(([label]) => label === 0));
}

describe('Veblen φ BOCF and BMS displays (note-11)', () => {
    it('adds two named equivalents to the existing φ notation', () => {
        expect(Object.keys(VeblenPhi.display_equiv!)).toEqual(['separate', 'bocf', 'bms']);
        expect(BOCF.name).toBe('BOCF');
        expect(BMS.name).toBe('BMS');
    });

    it.each(FIXTURE.examples)('matches note-11 for $input', (example) => {
        const expr = PHI.from_display!(example.input);
        freeze_tree(expr);
        expect(SEPARATE.plain(expr)).toBe(example.phi);
        expect(BOCF.plain(expr)).toBe(example.bocf);
        expect(BOCF.html(expr)).toBe(example.html);
        expect(BOCF.latex(expr)).toBe(example.latex);
        expect(BMS.plain(expr)).toBe(example.bms);
        expect(BMS.html(expr)).toBe(example.bms);
        expect(BMS.latex(expr)).toBe(example.bms);
        check_roundtrip(expr);
        const forest = encode_countable(expr);
        freeze_tree(forest);
        expect(decode_countable(forest)).toEqual(expr);
        expect(encode_countable(decode_countable(forest))).toEqual(forest);
    });

    it.each(FIXTURE.aliases)('canonicalizes the BOCF alias $input', ({ input, canonical, phi }) => {
        const expr = BOCF.from_display!(input);
        expect(BOCF.plain(expr)).toBe(canonical);
        expect(SEPARATE.plain(expr)).toBe(phi);
        check_roundtrip(expr);
    });

    it.each(FIXTURE.boundary_aliases)('maps the complete BOCF boundary alias %s to φ Limit', (text) => {
        expect(BOCF.from_display!(text)).toBe(VeblenPhi.init()[0]);
        expect(BOCF.plain(BOCF.from_display!(text))).toBe(FIXTURE.boundary.bocf);
    });

    it('uses the φ BHO boundary, including zero padding and token whitespace', () => {
        const expr = VeblenPhi.init()[0];
        expect(BOCF.plain(expr)).toBe(FIXTURE.boundary.bocf);
        expect(BOCF.html(expr)).toBe(FIXTURE.boundary.html);
        expect(BOCF.latex(expr)).toBe(FIXTURE.boundary.latex);
        expect(BMS.plain(expr)).toBe(FIXTURE.boundary.bms);
        expect(BMS.html(expr)).toBe(FIXTURE.boundary.bms);
        expect(BMS.latex(expr)).toBe(FIXTURE.boundary.bms);
        expect(BOCF.from_display!(' ψ [ 0 ] ( ε [ Ω + 1 ] ) ')).toBe(expr);
        expect(BMS.from_display!(' ( 0 , 0 )\n ( 1 , 1 , 0 )\t( 2 , 2 , 0 ) ')).toBe(expr);
        check_roundtrip(expr);
        expect(() => encode_countable(expr)).toThrow(/Limit/);
    });

    it.each(FIXTURE.bms_accepted)('canonicalizes BMS input $input', ({ input, phi, canonical }) => {
        const expr = BMS.from_display!(input);
        expect(SEPARATE.plain(expr)).toBe(phi);
        expect(BMS.plain(expr)).toBe(canonical);
        check_roundtrip(expr);
    });

    it.each([
        ...FIXTURE.rejected,
        'BHO+0',
        'ψ(BHO)',
        'ψ(ε[Ω+1])+0',
        'B H O',
        'ψ[00](0)',
        'psi[-1](0)',
        'psi[10](0)',
        'psi(0,0)',
        '1 1',
        '1e2',
        'ω2',
        'ω*',
        'ω*-1',
        'ω*1.5',
        '9007199254740993',
        'ω*9007199254740993',
        'psi[9007199254740993](0)',
        'ψ(ψ(Ω))*0+ω',
        '(ψ(ψ(Ω))+Ω)*0',
        'ψ(ψ(Ω))*0',
        'ψ[1](ψ[1](0))',
    ])('rejects invalid, out-of-domain or nonstandard BOCF input %s', (text) => {
        expect(() => BOCF.from_display!(text)).toThrow();
    });

    it.each([
        ...FIXTURE.bms_rejected,
        '(0)(-1)',
        '(0)(1,NaN)',
        '(0)(1,Infinity)',
        '(0)(1,0.5)',
        '(0)(1,0,9007199254740993)',
        '(0)(1,1)(2,2,0.5)',
        '(0)(1,1)(2,2)garbage',
        '(0)(1,1)(2,2)(-0)',
        '(0)(1,1)(2,2,9007199254740993)',
        '(0)(1)(0)(1,1)',
        '(0)(1 1)',
        '(0)(1,1,)',
        '(0)(1,1',
        '(0)(1,,1)',
        'Limit+0',
        'BHO',
    ])('rejects malformed or nonstandard BMS input %s', (text) => {
        expect(() => BMS.from_display!(text)).toThrow();
    });

    it.each([
        ['  psi [ 0 ] ( psi [ 1 ] ( 0 ) + 0 )  ', 'ψ(Ω)'],
        ['psi(Omega)', 'ψ(Ω)'],
        ['omega+0+1+omega', 'ω·2'],
        ['(ω·2+1)*3', 'ω·6+1'],
        ['(ψ(Ω)+ω+1)*2', 'ψ(Ω)·2+ω+1'],
        ['(0+0)*9007199254740991', '0'],
        ['Ω*0', '0'],
    ])('applies ordinal addition and finite right multiplication in %s', (text, expected) => {
        const expr = BOCF.from_display!(text);
        expect(BOCF.plain(expr)).toBe(expected);
        check_roundtrip(expr);
    });

    it('restores the full high prefix in the 16-column critical-chain regression', () => {
        const { critical } = FIXTURE;
        const expr = BMS.from_display!(critical.bms);
        expect(PHI.plain(expr)).toBe(critical.value);
        expect(BOCF.plain(expr)).toBe(critical.bocf);
        expect(BMS.plain(PHI.from_display!(critical.value))).toBe(critical.bms);
        expect(BOCF.from_display!(critical.bocf)).toEqual(expr);
        expect(VeblenPhi.compare(expr, PHI.from_display!(critical.lambda))).toBeGreaterThan(0);
        let matrix = BOUNDARY;
        for (const index of critical.standard_path) matrix = BM4.FS(matrix, index);
        expect(display_bm(matrix)).toBe(critical.bms);
        expect(matrix.length).toBe(16);
        check_roundtrip(expr);
    });

    it('round-trips independent standard two-label forests and agrees on order', () => {
        const forests = generated_forests(6).sort(compare_psi_forest);
        expect(forests.length).toBeGreaterThan(500);
        let previous_expr: Expr | undefined, previous_matrix: number[][] | undefined;
        for (const forest of forests) {
            const expr = decode_countable(forest);
            expect(encode_countable(expr)).toEqual(forest);
            const matrix = parse_bm(BMS.plain(expr));
            check_roundtrip(expr);
            if (previous_expr && previous_matrix) {
                expect(VeblenPhi.compare(previous_expr, expr)).toBeLessThan(0);
                expect(compare_bm(previous_matrix, matrix)).toBeLessThan(0);
            }
            previous_expr = expr;
            previous_matrix = matrix;
        }
    });

    it('round-trips actual BM4 descendants of the BHO boundary', () => {
        const queue = [BOUNDARY],
            seen = new Set<string>();
        for (let cursor = 0; cursor < queue.length && seen.size < 300; cursor++) {
            const matrix = queue[cursor],
                text = display_bm(matrix);
            if (seen.has(text)) continue;
            seen.add(text);
            const expr = BMS.from_display!(text);
            expect(BMS.plain(expr)).toBe(text);
            check_roundtrip(expr);
            for (const index of [0, 1, 2, 3]) {
                const child = BM4.FS(matrix, index);
                if (child.length <= 14) queue.push(child);
            }
        }
        expect(seen.size).toBe(300);
    });

    it('round-trips nested φ terms generated with both φ basic-sequence variants', () => {
        const queue = VeblenPhi.init(),
            seen = new Set<string>();
        for (let cursor = 0; cursor < queue.length && seen.size < 300; cursor++) {
            const expr = queue[cursor],
                key = PHI.plain(expr);
            if (seen.has(key)) continue;
            seen.add(key);
            check_roundtrip(expr);
            for (const index of [0, 1, 2, 3])
                for (const fs of [VeblenPhi.FS, VeblenPhi.FS_short!]) {
                    const child = fs(expr, index);
                    if (PHI.plain(child).length < 500) queue.push(child);
                }
        }
        expect(seen.size).toBe(300);
    });

    it('handles long finite coefficients in roots and ψ arguments', () => {
        const count = 8000;
        const natural = BOCF.from_display!('' + count);
        expect(BOCF.plain(natural)).toBe('' + count);
        expect(BMS.plain(natural)).toBe('(0)'.repeat(count));
        const epsilon = BOCF.from_display!('ψ(Ω*' + count + ')');
        expect(BOCF.plain(epsilon)).toBe('ψ(Ω·' + count + ')');
        expect(BMS.plain(epsilon)).toBe('(0)' + '(1,1)'.repeat(count));
    });

    it('reports resource exhaustion instead of truncating a value', () => {
        expect(() => BOCF.from_display!('100001')).toThrow(/resource limit/);
        expect(() => BOCF.from_display!('ω*100001')).toThrow(/resource limit/);
        expect(() => BOCF.from_display!('('.repeat(514) + '1' + ')'.repeat(514))).toThrow(/nesting resource limit/);
    });
});
