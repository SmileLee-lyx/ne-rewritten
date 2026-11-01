import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import { S_omega_DBMS_v3 } from '@/notations/MN/SDBMS/S_omega_DBMS-v3.ts';
import { omega_Y_weak, dimension_difference } from '@/notations/Y/Omega_Y.ts';
import {
    TS_omega_DBMS,
    ORD_ZERO,
    ORD_ONE,
    type Expr,
    type Height,
    type Ordinal,
    type FsVariant,
    compare,
    compare_height,
    is_limit,
    is_infinity,
    expand,
    height_fs,
    infinity_FS,
    matrix_add,
    matrix_tail,
    convert_matrix,
    tsomega_to_cnf,
    cnf_to_tsomega,
    ord_add,
    ord_compare,
    ord_mul,
    ord_natural,
    ord_pow_omega,
    ord_tail_after,
    count_last_cnf,
    compute_tomegay_cnf,
    tomegay_cnf_to_tsomega,
    convert_to_tomegay,
    convert_from_tomegay,
    convert_to_rmn,
    display,
    display_marked,
    display_ordinal,
    display_as_Y,
    from_display,
    from_display_y_seq,
    parse_ordinal,
} from '@/notations/MN/SDBMS/TS_omega_DBMS.ts';

const OLD_ORIGINAL = resolve_display(S_omega_DBMS_v3.display);
const OLD_Y = resolve_display(S_omega_DBMS_v3.display_equiv!.Y);
const RMN = resolve_display(TS_omega_DBMS.display_equiv!.RMN);
const W = parse_ordinal('w');
const E = parse_ordinal('(0)(1^(1@0))(2^(2@0))');
const VARIANTS: FsVariant[] = ['FS', 'FS_alter', 'FS_short', 'fast'];

function natural(n: number): Ordinal {
    return ord_natural(BigInt(n));
}
function same_ordinal(a: Ordinal, b: Ordinal): void {
    expect(ord_compare(a, b)).toBe(0);
}
function seed(alpha: Ordinal): Expr {
    return [[], [[0, [[0, cnf_to_tsomega(alpha)]]]]];
}
function chain(alpha: Ordinal, length: number): Expr {
    return [[], ...Array.from({ length: length - 1 }, (_, p): Expr[number] => [[p, [[0, cnf_to_tsomega(alpha)]]]])];
}
function counts_equal(expr: Expr, expected: Ordinal[]): void {
    const counts = compute_tomegay_cnf(expr);
    expect(counts.length).toBe(expected.length);
    counts.forEach((value, i) => same_ordinal(value, expected[i]));
}
function freeze_tree(value: unknown): void {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze_tree);
    Object.freeze(value);
}
function matrix_positions_only(expr: Expr): void {
    expect(Array.isArray(expr)).toBe(true);
    for (const col of expr)
        for (const [p, h] of col) {
            expect(Number.isSafeInteger(p)).toBe(true);
            for (const [a, position] of h) {
                expect(Number.isSafeInteger(a)).toBe(true);
                matrix_positions_only(position);
            }
        }
}

// 独立参照：已有 ωY 的山脉与高度提取，不调用 TSω 的计数或下降逆算法。
function mountain_inverse(sequence: number[]): Expr {
    const shape = omega_Y_weak.mountain_view!(sequence, {})!.shape;
    const heights: Height[][] = [],
        result: Expr = [];
    for (let i = 0; i < shape.length; i++) {
        const col = shape[i];
        heights[i] = [];
        for (let j = 0; j + 1 < col.length; j++) {
            const entry = col[j],
                [p, parent_entry] = entry.leg_target!,
                upper = parent_entry - 1;
            const separator = cnf_to_tsomega(natural(dimension_difference(entry.vertical, col[j + 1].vertical)));
            heights[i][j] =
                upper < 0
                    ? [[p, separator]]
                    : JSON.stringify(shape[p][upper].vertical) === JSON.stringify(entry.vertical)
                      ? heights[p][upper]
                      : [...heights[p][upper], [p, separator]];
        }
        result[i] = [];
        for (let j = col.length - 2; j >= 0; j--) {
            const p = col[j].leg_target![0];
            if (j === 0 || p !== col[j - 1].leg_target![0]) result[i].push([p, heights[i][j]]);
        }
    }
    return result;
}

describe('TSωDBMS (note-9)', () => {
    it('registers only the four requested formats, without a description', () => {
        expect(TS_omega_DBMS.category_id).toBe(S_omega_DBMS_v3.category_id);
        expect(Object.keys(TS_omega_DBMS.display_equiv!)).toEqual(['m', 'RMN', 'Y']);
        expect(TS_omega_DBMS.description).toBeUndefined();
        expect(TS_omega_DBMS.init().map((expr) => display(expr))).toEqual(['Limit', '(0)', '']);
        expect(compare(TS_omega_DBMS.init()[0], infinity_FS(4))).toBeGreaterThan(0);
    });

    it('keeps matrix positions and diagonal top approximants', () => {
        let position: Expr = [];
        for (let n = 0; n < 5; n++) {
            const expected: Expr = [[], [[0, [[0, position]]]]];
            for (const variant of VARIANTS) expect(height_fs(TS_omega_DBMS.init()[0], n, variant)).toEqual(expected);
            matrix_positions_only(expected);
            expect(from_display(display(expected))).toEqual(expected);
            position = expected;
        }
        expect(
            compare_height(
                [
                    [0, [[]]],
                    [1, []],
                ],
                [[0, [[]]]],
            ),
        ).toBeLessThan(0);
    });

    it('matches finite SωDBMS displays, RMN, Y and all basic-sequence variants', () => {
        const queue = Array.from({ length: 5 }, (_, n) => S_omega_DBMS_v3.FS(S_omega_DBMS_v3.init()[0], n));
        const seen = new Set<string>();
        for (let cursor = 0; cursor < queue.length && seen.size < 120; cursor++) {
            const original = queue[cursor],
                text = OLD_ORIGINAL.plain(original);
            if (seen.has(text)) continue;
            seen.add(text);
            const expr = from_display(text);
            expect(display(expr)).toBe(text);
            expect(display_as_Y(expr)).toBe(OLD_Y.plain(original));
            for (const key of ['m', 'RMN']) {
                const old_text = resolve_display(S_omega_DBMS_v3.display_equiv![key]).plain(original);
                expect(resolve_display(TS_omega_DBMS.display_equiv![key]).plain(expr)).toBe(
                    old_text.replaceAll('ω', 'w'),
                );
            }
            const old_variants = [
                S_omega_DBMS_v3.FS,
                S_omega_DBMS_v3.FS_alter!,
                S_omega_DBMS_v3.FS_short!,
                S_omega_DBMS_v3.FS_equiv!.fast,
            ];
            for (let v = 0; v < VARIANTS.length; v++)
                for (const n of [0, 1, 2]) {
                    expect(display(height_fs(expr, n, VARIANTS[v]))).toBe(
                        OLD_ORIGINAL.plain(old_variants[v](original, n)),
                    );
                }
            for (const n of [0, 1, 2]) {
                const child = S_omega_DBMS_v3.FS(original, n);
                if (child.length <= 6) queue.push(child);
            }
        }
        expect(seen.size).toBe(120);
    });

    it.each([
        ['', ''],
        ['(0)', '1'],
        ['(0)(1^(1@0))', '1,2'],
        ['(0)(1^(1@5))', '1,7'],
        ['(0)(1^(1@w))', '1,w'],
        ['(0)(1^(1@w+1))', '1,w+1'],
        ['(0)(1^(1@w))(2^(1@w))', '1,w,w^2'],
        ['(0)(1^(1@w))(2^(2@0))', '1,w,w^2+1'],
        ['(0)(1^(1@w^2))(2^(1@w^2))', '1,w^2,w^5'],
        ['(0)(1^(1@w^2))(2^(2@0))', '1,w^2,w^5+1'],
        ['(0)(1^(1@w^3))(2^(1@w^3))', '1,w^3,w^8'],
        ['(0)(1^(1@w^w))(2^(1@w^w))', '1,w^w,w^(w*2)'],
        ['(0)(1^(1@3))(2^(1@3),1^(1@w))', '1,5,w'],
    ])('counts %s as %s', (text, expected) => {
        const expr = from_display(text);
        expect(display_as_Y(expr)).toBe(expected);
        expect(display_as_Y(from_display_y_seq(expected))).toBe(expected);
    });

    it.each([
        ['w', 'w^3'],
        ['w^2', 'w^9'],
        ['w^3', 'w^15'],
        ['w^w', 'w^(w*3)'],
    ])('counts the four-column chain at %s as %s', (lambda, expected) => {
        const expr = chain(parse_ordinal(lambda), 4);
        same_ordinal(count_last_cnf(expr), parse_ordinal(expected));
        expect(ord_compare(count_last_cnf(height_fs(expr, 0, 'FS')), count_last_cnf(expr))).toBeLessThan(0);
    });

    it('amalgamates five-column path regions instead of enumerating full representative paths', () => {
        same_ordinal(count_last_cnf(chain(W, 5)), parse_ordinal('w^4'));
    });

    it.each(['w', 'w+1', 'w^2', 'w^w'])('computes RMN rows directly at position %s', (text) => {
        const alpha = parse_ordinal(text),
            matrix = seed(alpha);
        same_ordinal(convert_to_rmn(matrix)[1][0][1], ord_pow_omega(alpha));
        matrix.push([[1, [[1, []]]]]);
        same_ordinal(convert_to_rmn(matrix)[2][0][1], ord_add(ord_pow_omega(alpha), ORD_ONE));
    });

    it('evaluates RMN at successor gaps above limit cuts and at multiple slots', () => {
        const expr = from_display('(0)(1^(1@w+1))(2^(1@w+1,2@0))');
        expect(RMN.plain(expr)).toBe('()(1:w^(w+1))(2:w^w+1)');
        const another = from_display('(0)(1^(1@w^2+1))(2^(1@w^2+1,2@w))');
        same_ordinal(convert_to_rmn(another)[2][0][1], parse_ordinal('w^(w^2)+w^w'));
    });

    it.each([
        ['3', 'w'],
        ['w+3', 'w*2'],
        ['w', 'w^2'],
    ])('preserves shadowing and variant propagation from %s to %s', (low, high) => {
        const beta = parse_ordinal(low),
            alpha = parse_ordinal(high),
            lower = chain(beta, 3);
        const base = count_last_cnf(lower);
        const expr: Expr = lower.slice(0, -1).concat([[...lower[2], [0, [[0, cnf_to_tsomega(alpha)]]]]]);
        const total = count_last_cnf(expr);
        same_ordinal(total, ord_add(base, ord_tail_after(ord_add(ORD_ONE, beta), ord_add(ORD_ONE, alpha))));
        const delta = cnf_to_tsomega(ord_tail_after(beta, alpha));
        for (const variant of VARIANTS) {
            let previous = base;
            for (let n = 0; n < 3; n++) {
                const child = height_fs(expr, n, variant),
                    h = child[2][1][1];
                expect(child.slice(0, 2)).toEqual(expr.slice(0, 2));
                expect(child[2][0]).toEqual(lower[2][0]);
                expect(child[2][1][0]).toBe(0);
                expect(h[0][0]).toBe(0);
                const position = tsomega_to_cnf(h[0][1]);
                same_ordinal(position, ord_add(beta, tsomega_to_cnf(height_fs(delta, n, variant))));
                const count = count_last_cnf(child);
                same_ordinal(count, ord_add(base, ord_tail_after(ord_add(ORD_ONE, beta), ord_add(ORD_ONE, position))));
                expect(ord_compare(count, previous)).toBeGreaterThan(0);
                expect(ord_compare(count, total)).toBeLessThan(0);
                previous = count;
            }
        }
    });

    it('retains a nonempty height prefix and anchor through a shadowed limit step', () => {
        const stem: Height = [[0, cnf_to_tsomega(parse_ordinal('w^2+1'))]];
        const lower_h: Height = [...stem, [1, cnf_to_tsomega(natural(3))]],
            upper_h: Height = [...stem, [1, cnf_to_tsomega(W)]];
        const prefix: Expr = [[], [[0, stem]], [[1, lower_h]]];
        const base = count_last_cnf([...prefix, [[2, lower_h]]]);
        const expr: Expr = [
            ...prefix,
            [
                [2, lower_h],
                [1, upper_h],
            ],
        ];
        freeze_tree(expr);
        for (const variant of VARIANTS)
            for (const n of [0, 1, 2]) {
                const child = height_fs(expr, n, variant),
                    h = child[3][1][1];
                expect(h[0]).toEqual(stem[0]);
                expect(h[1][0]).toBe(1);
                const position = tsomega_to_cnf(h[1][1]);
                same_ordinal(
                    count_last_cnf(child),
                    ord_add(base, ord_mul(natural(2), ord_tail_after(natural(4), ord_add(ORD_ONE, position)))),
                );
            }
    });

    it('uses whole root components for right tails and matrix addition', () => {
        for (const [left, right] of [
            ['w^2+w*2+3', 'w^2+w*4+1'],
            ['w+3', 'w^2'],
            ['w^2+w', 'w^2+w'],
            ['w^2', 'w^3'],
        ]) {
            const a = cnf_to_tsomega(parse_ordinal(left)),
                b = cnf_to_tsomega(parse_ordinal(right));
            const delta = matrix_tail(a, b);
            same_ordinal(tsomega_to_cnf(delta), ord_tail_after(parse_ordinal(left), parse_ordinal(right)));
            expect(matrix_add(a, delta)).toEqual(b);
        }
        expect(() => matrix_tail(cnf_to_tsomega(W), [[]])).toThrow(/Negative/);
    });

    it('round-trips its own scalar CNF, relative matrices and epsilon arithmetic', () => {
        const scalars = [
            ORD_ZERO,
            ORD_ONE,
            parse_ordinal('w^3*2+w+4'),
            parse_ordinal('w^(w+1)'),
            E,
            ord_add(E, W),
            ord_mul(E, E),
            ord_pow_omega(ord_mul(E, E)),
            tsomega_to_cnf(infinity_FS(3)),
        ];
        for (const value of scalars) {
            const expr = cnf_to_tsomega(value);
            freeze_tree(expr);
            same_ordinal(tsomega_to_cnf(expr), value);
            expect(convert_matrix(convert_matrix(expr, true), false)).toEqual(expr);
            expect(from_display(display(expr))).toEqual(expr);
            same_ordinal(parse_ordinal(display_ordinal(value)), value);
            matrix_positions_only(expr);
        }
        same_ordinal(ord_pow_omega(E), E);
        expect(ord_compare(E, W)).toBeGreaterThan(0);
    });

    it('transports every height anchor but never shifts a position matrix', () => {
        const expr = from_display('(0)(1^(1@3))(2^(1@3,2@1))');
        const relative = convert_matrix(expr, true),
            position = expr[2][0][1][0][1];
        expect(relative[3][0][1].map(([a]) => a)).toEqual([1, 2]);
        expect(relative[3][0][1][0][1]).toBe(position);
        expect(convert_matrix(relative, false)).toEqual(expr);
        const expanded = expand(expr, 2, false);
        matrix_positions_only(expanded);
        expect(compare(expanded, expr)).toBeLessThan(0);
    });

    it('counts and inverts recursive positions with its own epsilon atoms', () => {
        for (const alpha of [E, tsomega_to_cnf(seed(W)), tsomega_to_cnf(infinity_FS(3))]) {
            same_ordinal(count_last_cnf(seed(alpha)), alpha);
            same_ordinal(count_last_cnf(chain(alpha, 3)), ord_mul(alpha, alpha));
            const target = [ORD_ONE, alpha, ord_add(ord_mul(alpha, alpha), ORD_ONE)];
            const result = tomegay_cnf_to_tsomega(target);
            counts_equal(result, target);
            matrix_positions_only(result);
            expect(convert_from_tomegay(convert_to_tomegay(result))).toEqual(result);
            expect(from_display_y_seq(display_as_Y(result))).toEqual(result);
        }
    });

    it('recovers arbitrary finite first-one sequences against the independent ωY mountain', () => {
        const sequences: number[][] = [];
        for (let a = 1; a <= 5; a++) for (let b = 1; b <= 7; b++) sequences.push([1, a, b]);
        for (let n = 0; n < 12; n++) sequences.push([1, 1 + (n % 4), 1 + ((n * 3) % 7), 1 + ((n * 5) % 8)]);
        for (const sequence of sequences) {
            const actual = tomegay_cnf_to_tsomega(sequence.map(natural));
            expect(actual).toEqual(mountain_inverse(sequence));
            counts_equal(actual, sequence.map(natural));
        }
    });

    it.each(['1,w,w,1', '1,w,w,w', '1,w,w,w+1', '1,w,1,w', '1,w,w+1,w', '1,w^2,w,w+1'])(
        'round-trips the unrestricted transfinite Y sequence %s',
        (text) => {
            const expr = from_display_y_seq(text);
            expect(display_as_Y(expr)).toBe(text);
            expect(from_display_y_seq(display_as_Y(expr))).toEqual(expr);
        },
    );

    it('parses nested matrix positions and marked columns, with real HTML and LaTeX exponents', () => {
        const expr = seed(tsomega_to_cnf(infinity_FS(2)));
        expect(from_display(display_marked(expr))).toEqual(expr);
        expect(from_display('(0)(1^((1@ω^2)))')).toEqual(seed(parse_ordinal('w^2')));
        const marked = resolve_display(TS_omega_DBMS.display_equiv!.m);
        expect(marked.html(expr)).toContain('<sub>');
        expect(marked.latex!(expr)).toContain('_{2}');
        const html = resolve_display(TS_omega_DBMS.display).html(seed(parse_ordinal('w^2')));
        expect(html).toContain('<sup>');
        expect(html).not.toContain('^');
        expect(resolve_display(TS_omega_DBMS.display).latex!(seed(parse_ordinal('w^2')))).toContain('^{');
        expect(is_infinity(from_display_y_seq('Limit'))).toBe(true);
        expect(is_infinity(from_display_y_seq('1,w'))).toBe(false);
        expect(from_display_y_seq('')).toEqual([]);
    });

    it.each([
        '(1^(1@0))',
        '(0)(2^(1@0))',
        '(0)(1^(1@Limit))',
        '(0)(1^(0@0))',
        '(0)(1^(1@0))(2^(1@w,2@0))',
        '(0)(1^(1@0))(2^(2@0,1@1))',
        '(0)(1^(1@w^))',
        '(0)(1^(1@0))(2^(1@0),1^(1@0))',
        '(0)(1^())',
        '(0)(1^(1@0]}))',
    ])('rejects malformed native input %s', (text) => {
        expect(() => from_display(text)).toThrow();
    });

    it.each(['0', '2,3', '1,0', '1,-1', '1,Limit', '1,,2'])('rejects malformed Y input %s', (text) => {
        expect(() => from_display_y_seq(text)).toThrow();
    });

    it('reports materialization exhaustion separately from invalid input', () => {
        expect(() => cnf_to_tsomega(natural(100001))).toThrow(RangeError);
        expect(() => height_fs(seed(W), -1)).toThrow(/index/);
        expect(() => tsomega_to_cnf(TS_omega_DBMS.init()[0])).toThrow(/Limit/);
        expect(is_limit(seed(W))).toBe(true);
    });
});
