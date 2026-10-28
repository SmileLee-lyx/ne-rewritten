import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import { compute_0Y_mountain, convert_to_0Y } from '@/notations/BM-like/BM.ts';
import {
    TBM,
    ONE,
    INFINITY,
    from_display,
    display,
    compare,
    is_one,
    type Expr,
    type Ordinal,
    tbms_to_cnf,
    cnf_to_tbms,
    ord_compare,
    ord_add,
    ord_mul,
    ord_pow_omega,
    ord_tail_after,
    ord_left_div_rem,
    max_epsilon_atom,
    shift_first_row,
    normalize_column,
    compute_t0y_cnf,
    convert_to_t0y,
    prepare_t0y_inverse_bands,
    t0y_cnf_to_tbms,
    convert_from_t0y,
    from_display_as_t0y,
    display_ordinal,
    display_as_t0y,
} from '@/notations/BM-like/TBM.ts';

const ZERO = tbms_to_cnf([]);
const ONE_ORD = tbms_to_cnf(ONE());
const EPSILON = tbms_to_cnf(from_display('()(1,1)'));
const T0Y = resolve_display(TBM.display_equiv!.T0Y);

function ordinal(text: string): Ordinal {
    return from_display(`(1^{${text}})`)[0].reduce((sum, [, height]) => ord_add(sum, tbms_to_cnf(height)), ZERO);
}

function freeze_tree(value: unknown): void {
    if (!Array.isArray(value)) return;
    value.forEach(freeze_tree);
    Object.freeze(value);
}

describe('TBMS CNF display and T0Y (note-9)', () => {
    it.each([
        ['()(1^ω)(1^ω)', '1,ω,ω'],
        ['()(1^ω)(2)', '1,ω,ω+1'],
        ['()(1^ω)(2,1^ω)', '1,ω,ω·2'],
        ['()(1^ω)(2,2)', '1,ω,ω·2+1'],
        ['()(1^ω)(2,2,1^ω)', '1,ω,ω·3'],
        ['()(1^ω)(2^ω)', '1,ω,ω^2'],
        ['()(1^ω)(2^ω,1)', '1,ω,ω^2+1'],
        ['()(1^ω,1^ω)(2^ω,2^ω)', '1,ω·2,ω^2·2'],
        ['()(1^()(1,1))(2)', '1,()(1,1),()(1,1)()'],
        ['()(1^()(1,1))(2,1^()(1,1))', '1,()(1,1),()(1,1)()(1,1)'],
        ['()(1^()(1,1))(2^()(1,1))', '1,()(1,1),()(1,1)(1)(2,1)'],
        ['()(1^()(1,1))(2^()(1,1),1)', '1,()(1,1),()(1,1)(1)(2,1)()'],
    ])('counts %s as %s', (text, expected) => {
        const expr = from_display(text);
        expect(T0Y.plain(expr)).toBe(expected);
        const values = compute_t0y_cnf(expr);
        expect(
            convert_to_t0y(expr)
                .map(tbms_to_cnf)
                .map((value, i) => ord_compare(value, values[i])),
        ).toEqual(values.map(() => 0));
        expect(from_display(display(expr))).toEqual(expr);
        expect(T0Y.from_display!(expected)).toEqual(expr.map(normalize_column));
        expect(convert_from_t0y(convert_to_t0y(expr))).toEqual(expr.map(normalize_column));
    });

    it.each([
        ['2', '(1,1)'],
        ['ω', '(1^ω)'],
        ['w^2', '(1^{ω^2})'],
        ['ω^(ω+1)', '(1^{ω^{ω+1}})'],
        ['ω^{ω^2+ω*2+3}', '(1^{ω^{ω^2+ω·2+3}})'],
        ['ω^2*2+ω3+2', '(1^{ω^2},1^{ω^2},1^ω,1^ω,1^ω,1,1)'],
        ['()(1)(1)', '(1^{ω^2})'],
        ['()(1,1)', '(1^{()(1,1)})'],
        ['()(1^ω)', '(1^{()(1^ω)})'],
    ])('normalizes and reads back the height %s', (height, expected) => {
        const expr = from_display(`(1^${height})`);
        expect(display(expr)).toBe(expected);
        expect(from_display(expected)).toEqual(expr);
    });

    it('renders nested HTML superscripts and handles empty and Limit T0Y inputs', () => {
        expect(display(from_display('(1^{ω^(ω+1)})'), true)).toBe('(1<sup>ω<sup>ω+1</sup></sup>)');
        expect(T0Y.html(from_display('()(1^ω)(2^ω)'))).toBe('1,ω,ω<sup>2</sup>');
        expect(T0Y.from_display!('')).toEqual([]);
        expect(T0Y.from_display!('  ')).toEqual([]);
        expect(T0Y.from_display!('1')).toEqual([[]]);
        expect(T0Y.from_display!('1,1,1')).toEqual([[], [], []]);
        expect(T0Y.from_display!(' Limit ')).toEqual(INFINITY());
        expect(T0Y.plain([])).toBe('');
        expect(T0Y.plain([[]])).toBe('1');
        expect(T0Y.plain(INFINITY())).toBe('Limit');
        expect(T0Y.html(INFINITY())).toBe('Limit');
        expect(display(INFINITY())).toBe('Limit');
        expect(from_display(' Limit ')).toEqual(INFINITY());
        expect(() => tbms_to_cnf(INFINITY())).toThrow();
    });

    it('rejects zero or malformed heights and preserves intermediate zero rows', () => {
        for (const text of [
            '(1^0)',
            '(1^{0})',
            '(1^{})',
            '(1^ω^)',
            '(1^{ω+})',
            '(1^{ω*})',
            '(1^{ω^2)',
            '(1^{ω}x)',
            '(1^)',
            '(1^{2 3})',
            '(9007199254740992)',
        ]) {
            expect(() => from_display(text)).toThrow();
        }
        expect(display(from_display('(1,0,1,0,0)'))).toBe('(1,0,1)');
        expect(from_display(' (1 ^ { w ^ ( w + 1 ) }) ')).toEqual(from_display('(1^{ω^(ω+1)})'));
    });

    it('moves only the first row of an infinite segment and normalizes the reverse move', () => {
        const expr = from_display('(1^ω)');
        const shifted = shift_first_row(expr, 1);
        expect(display(shifted)).toBe('(2,1^ω)');
        expect(shift_first_row(shifted, -1)).toEqual(expr);
        expect(from_display('(1,1^ω)')).toEqual(expr);
        expect(shift_first_row([[]], 1)).toEqual(from_display('(1)'));
        expect(shift_first_row(from_display('(1)'), -1)).toEqual([[]]);
        expect(() => shift_first_row(expr, -1)).toThrow('zero first row');
    });

    it('terminates at epsilon fixed points and respects noncommutative arithmetic', () => {
        expect(EPSILON.kind).toBe('epsilon');
        expect(tbms_to_cnf(ONE()).kind).toBe('cnf');
        expect(ord_pow_omega(EPSILON)).toBe(EPSILON);
        expect(ord_compare(ord_add(ONE_ORD, EPSILON), EPSILON)).toBe(0);
        expect(ord_compare(ord_add(EPSILON, ONE_ORD), EPSILON)).toBeGreaterThan(0);
        expect(display_ordinal(ord_mul(ordinal('ω+1'), ordinal('2')))).toBe('ω·2+1');
        expect(display_ordinal(ord_mul(ordinal('2'), ordinal('ω')))).toBe('ω');
        expect(display_ordinal(ord_mul(ZERO, EPSILON))).toBe('0');
        // Large coefficients stay exact without expanding their TBMS output.
        const large: Ordinal = { kind: 'cnf', terms: [{ exponent: ZERO, coefficient: 9007199254740993n }] };
        expect(display_ordinal(ord_mul(large, ordinal('2')))).toBe('18014398509481986');
        expect(() => cnf_to_tbms(large)).toThrow(RangeError);
    });

    it('uses an ordinal right tail for epsilon-relative suspension', () => {
        const square = ord_mul(EPSILON, EPSILON);
        expect(display_ordinal(square)).toBe('()(1,1)(1)(2,1)');
        expect(ord_compare(ord_tail_after(EPSILON, square), square)).toBe(0);
        expect(display_ordinal(ord_pow_omega(square))).toBe('()(1,1)(1)(2,1)(2)(3,1)');
        expect(display_ordinal(ord_mul(EPSILON, ordinal('ω')))).toBe('()(1,1)(1)');
        expect(ord_compare(tbms_to_cnf(cnf_to_tbms(ord_pow_omega(square))), ord_pow_omega(square))).toBe(0);
        for (const [a, b] of [
            [ZERO, EPSILON],
            [EPSILON, EPSILON],
            [EPSILON, square],
            [ordinal('ω+4'), ordinal('ω·3+2')],
        ]) {
            expect(ord_compare(ord_add(a, ord_tail_after(a, b)), b)).toBe(0);
        }
        expect(() => ord_tail_after(square, EPSILON)).toThrow();
    });

    it('divides on the left with exact remainders, bigint coefficients and epsilon exponents', () => {
        for (const [dividend, quotient, remainder] of [
            ['ω^2', 'ω', '0'],
            ['ω·2', '1', 'ω'],
            ['ω·2+1', '2', '0'],
        ]) {
            const actual = ord_left_div_rem(ordinal(dividend), ordinal('ω+1'));
            expect(display_ordinal(actual.quotient)).toBe(quotient);
            expect(display_ordinal(actual.remainder)).toBe(remainder);
        }
        const large: Ordinal = { kind: 'cnf', terms: [{ exponent: ZERO, coefficient: 9007199254740993n }] };
        const divided = ord_left_div_rem(large, ordinal('2'));
        expect(display_ordinal(divided.quotient)).toBe('4503599627370496');
        expect(ord_compare(divided.remainder, ONE_ORD)).toBe(0);
        const square = ord_mul(EPSILON, EPSILON);
        const values = [
            ZERO,
            ONE_ORD,
            ordinal('2'),
            ordinal('3'),
            ordinal('ω'),
            ordinal('ω+1'),
            ordinal('ω·2'),
            ordinal('ω^2'),
            ordinal('ω^ω'),
            EPSILON,
            ord_add(EPSILON, ONE_ORD),
            square,
            ord_pow_omega(square),
            tbms_to_cnf(from_display('()(1,1)(2,2)')),
            large,
        ];
        for (const dividend of values)
            for (const divisor of values.slice(1)) {
                const { quotient, remainder } = ord_left_div_rem(dividend, divisor);
                expect(ord_compare(ord_add(ord_mul(divisor, quotient), remainder), dividend)).toBe(0);
                expect(ord_compare(remainder, divisor)).toBeLessThan(0);
            }
        expect(() => ord_left_div_rem(ONE_ORD, ZERO)).toThrow('division by zero');
    });

    it('prepares whole-band tail ranks and splits finite lengths into unit blocks', () => {
        const bands = prepare_t0y_inverse_bands(from_display('()(1^ω)(2^ω,1)'));
        expect(bands.map(({ start, end, length }) => [start, end, length].map((v) => display_ordinal(v)))).toEqual([
            ['0', 'ω', 'ω'],
            ['ω', 'ω+1', '1'],
        ]);
        expect(bands.map((band) => band.values)).toEqual([
            [0, 1, 2],
            [0, 0, 1],
        ]);
        expect(bands.map((band) => band.parents)).toEqual([
            [undefined, 0, 1],
            [undefined, undefined, 1],
        ]);
        expect(bands.map((band) => band.tail_ranks.map((v) => display_ordinal(v)))).toEqual([
            ['0', 'ω', 'ω^2+1'],
            ['0', '0', '1'],
        ]);
        const finite = prepare_t0y_inverse_bands(from_display('()(1,1)'));
        expect(finite.map((band) => display_ordinal(band.length))).toEqual(['1', '1']);
        expect(finite.map((band) => display_ordinal(band.tail_ranks[1]))).toEqual(['2', '1']);
        expect(prepare_t0y_inverse_bands([[], []])).toEqual([]);
        expect(() => prepare_t0y_inverse_bands(INFINITY())).toThrow();
    });

    it('parses CNF and nested TBMS sequence items without treating 1,omega as Limit', () => {
        for (const text of ['1,ω', '1,w', ' 1 , { w } ']) {
            expect(T0Y.from_display!(text)).toEqual(from_display('()(1^ω)'));
        }
        expect(T0Y.from_display!('1, (ω+1)')).toEqual(from_display('()(1^ω,1)'));
        expect(T0Y.from_display!('1,ω^(ω+1),w^{w+1}*2+3')).toEqual(
            t0y_cnf_to_tbms([ONE_ORD, ordinal('ω^(ω+1)'), ordinal('ω^(ω+1)*2+3')]),
        );
        expect(T0Y.from_display!('1, ()(1,1), { ()(1,1)(1)(2,1) }')).toEqual(
            from_display('()(1^{()(1,1)})(2^{()(1,1)})'),
        );
        const large_atom = tbms_to_cnf(from_display('()(1^{()(1,1)})'));
        const sequence = [ONE_ORD, large_atom, ord_mul(large_atom, large_atom)];
        const decoded = T0Y.from_display!(sequence.map((v) => display_ordinal(v)).join(','));
        expect(compute_t0y_cnf(decoded).map((v, i) => ord_compare(v, sequence[i]))).toEqual([0, 0, 0]);
    });

    it.each([
        '0',
        '2',
        'ω',
        '1,0',
        '1,',
        ',1',
        '1,,2',
        '1,Limit',
        'Limit,1',
        '1,ω^',
        '1,{ω+}',
        '1,ω^-1',
        '1,-1',
        '1,1.5',
        '1,NaN',
        '1,{ω)',
        '1,()(1,1',
        '1,()(1,1)}',
        '1,(1)',
        '1,()(0,1)',
        '1,()(1,1)x',
        '1,()(1^0)',
        '1,()(1^Limit)',
    ])('rejects invalid T0Y input %s', (text) => {
        expect(() => T0Y.from_display!(text)).toThrow();
    });

    it('validates sequence boundaries and keeps large counts compressed until decoding', () => {
        expect(t0y_cnf_to_tbms([])).toEqual([]);
        for (const sequence of [[ZERO], [ordinal('2')], [ONE_ORD, ZERO]])
            expect(() => t0y_cnf_to_tbms(sequence)).toThrow();
        expect(() => convert_from_t0y([ONE(), INFINITY()])).toThrow();
        expect(() => T0Y.from_display!('1,9007199254740993')).toThrow(RangeError);
        // Counts exceed Number.MAX_SAFE_INTEGER, while the decoded matrix has only 54 rows.
        const sequence = Array.from({ length: 55 }, (_, i) => 1n << BigInt(i));
        const decoded = T0Y.from_display!(sequence.join(','));
        expect(decoded).toEqual(sequence.map((_, i) => Array.from({ length: i }, (_, j) => [i - j, ONE()])));
        expect(T0Y.plain(decoded)).toBe(sequence.join(','));
    });

    it('recovers arbitrary supported ordinal sequences by batching transfinite rows', () => {
        const values = ['1', '2', '3', 'ω', 'ω+1', 'ω·2', 'ω^2', 'ω^ω'].map(ordinal);
        for (const atom of [EPSILON, tbms_to_cnf(from_display('()(1,1)(2,2)')), tbms_to_cnf(from_display('()(1^ω)'))])
            values.push(
                atom,
                ord_add(atom, ONE_ORD),
                ord_add(atom, atom),
                ord_mul(atom, atom),
                ord_pow_omega(ord_mul(atom, atom)),
            );
        let state = 20261029;
        for (let trial = 0; trial < 160; trial++) {
            const sequence = [ONE_ORD];
            for (let j = 0; j < 1 + (trial % 6); j++) {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                sequence.push(values[state % values.length]);
            }
            const snapshot = structuredClone(sequence);
            const decoded = t0y_cnf_to_tbms(sequence);
            expect(sequence).toEqual(snapshot);
            expect(compute_t0y_cnf(decoded).map((v, i) => ord_compare(v, sequence[i]))).toEqual(sequence.map(() => 0));
            expect(T0Y.from_display!(T0Y.plain(decoded))).toEqual(decoded);
        }
    });

    it.each([
        ['()(1,1)(2,1,1)', '()(1,1)(2,2)', '1,3,6'],
        ['()(1^ω)(2,1^{ω^2})', '()(1^ω)(2^ω)', '1,ω,ω^2'],
    ])('selects the canonical representative of the colliding matrix %s', (raw, canonical, text) => {
        const original = from_display(raw),
            expected = from_display(canonical);
        expect(T0Y.plain(original)).toBe(text);
        expect(T0Y.from_display!(text)).toEqual(expected);
        expect(T0Y.plain(T0Y.from_display!(T0Y.plain(original)))).toBe(text);
        expect(expected).not.toEqual(original);
    });

    it('round-trips CNF expressions with several epsilon atoms and agrees with TBMS comparison', () => {
        const atoms = [EPSILON, tbms_to_cnf(from_display('()(1,1)(2,2)')), tbms_to_cnf(from_display('()(1^ω)'))];
        const values = [ZERO, ONE_ORD, ordinal('2'), ordinal('ω'), ordinal('ω^ω')];
        for (const atom of atoms)
            values.push(
                atom,
                ord_add(atom, ONE_ORD),
                ord_add(atom, atom),
                ord_mul(atom, atom),
                ord_pow_omega(ord_mul(atom, atom)),
            );
        values.push(ord_add(atoms[1], atoms[0]), ord_mul(atoms[2], ord_add(atoms[1], ONE_ORD)));
        const matrices = values.map(cnf_to_tbms);
        for (let i = 0; i < values.length; i++) {
            expect(ord_compare(tbms_to_cnf(matrices[i]), values[i])).toBe(0);
            expect(max_epsilon_atom(values[i]) === undefined).toBe(i < 5);
            for (let j = 0; j < values.length; j++) {
                expect(Math.sign(ord_compare(values[i], values[j]))).toBe(Math.sign(compare(matrices[i], matrices[j])));
            }
        }
    });

    it('matches finite 0Y counting across varied parent graphs', () => {
        let state = 20261028;
        for (let trial = 0; trial < 160; trial++) {
            const sequence = [1];
            for (let i = 0; i < 1 + (trial % 6); i++) {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                sequence.push(1 + (state % 12));
            }
            const matrix = compute_0Y_mountain(sequence).m;
            const expr: Expr = matrix.map((col) => col.map((value) => [value, ONE()]));
            expect(display_as_t0y(expr)).toBe(convert_to_0Y(matrix).join(','));
            expect(from_display_as_t0y(sequence.join(','))).toEqual(expr);
        }
    });

    it('preserves standard ordinal round-trips, successor counts and limit truncations', () => {
        const queue = ['()(1,1)(2,1)', '()(1^ω)(2^ω)', '()(1^{ω^2})(2^{ω^2})', '()(1^()(1,1))(2^()(1,1))'].map(
            from_display,
        );
        const seen = new Set<string>();
        let successors = 0,
            limits = 0;
        for (let cursor = 0; cursor < queue.length && seen.size < 160; cursor++) {
            const expr = queue[cursor];
            const key = JSON.stringify(expr);
            if (seen.has(key)) continue;
            seen.add(key);
            expect(cnf_to_tbms(tbms_to_cnf(expr))).toEqual(expr.map(normalize_column));
            expect(from_display(display(expr))).toEqual(expr.map(normalize_column));
            expect(t0y_cnf_to_tbms(compute_t0y_cnf(expr))).toEqual(expr.map(normalize_column));
            const column = expr.at(-1);
            if (!column?.length) continue;
            const count = compute_t0y_cnf(expr).at(-1)!;
            if (is_one(column.at(-1)![1])) {
                // A full copy may append several columns; lnz−1 is its prefix at the original width.
                const predecessor = TBM.FS(expr, 1).slice(0, expr.length);
                expect(ord_compare(ord_add(compute_t0y_cnf(predecessor).at(-1)!, ONE_ORD), count)).toBe(0);
                successors++;
            } else {
                const truncated = [0, 1, 2].map((index) => compute_t0y_cnf(TBM.FS(expr, index)).at(-1)!);
                for (const value of truncated) expect(ord_compare(value, count)).toBeLessThan(0);
                expect(ord_compare(truncated[0], truncated[1])).toBeLessThan(0);
                expect(ord_compare(truncated[1], truncated[2])).toBeLessThan(0);
                limits++;
            }
            for (const index of [0, 1, 2]) {
                const next = TBM.FS(expr, index);
                if (next.length <= 9 && JSON.stringify(next).length < 1800) queue.push(next);
            }
        }
        expect(seen.size).toBe(160);
        expect(successors).toBeGreaterThan(30);
        expect(limits).toBeGreaterThan(30);
    });

    it('keeps source expressions unchanged and invalidates structural cache keys after edits', () => {
        const expr = from_display('()(1^()(1,1))(2^()(1,1),1)');
        const snapshot = structuredClone(expr);
        freeze_tree(expr);
        display(expr);
        T0Y.plain(expr);
        T0Y.html(expr);
        convert_to_t0y(expr);
        const sequence = convert_to_t0y(expr);
        freeze_tree(sequence);
        expect(convert_from_t0y(sequence)).toEqual(expr);
        cnf_to_tbms(tbms_to_cnf(expr));
        expect(expr).toEqual(snapshot);
        const mutable = from_display('()(1^ω)(2^ω)');
        expect(T0Y.plain(mutable)).toBe('1,ω,ω^2');
        mutable[2] = [[2, ONE()]];
        expect(T0Y.plain(mutable)).toBe('1,ω,ω+1');
    });
});
