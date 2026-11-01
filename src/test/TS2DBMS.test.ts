import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import { parse_analysis_entries, stringify_analysis_entries } from '@/core/analysis.ts';
import { S2DBMS } from '@/notations/MN/SDBMS/S2DBMS.ts';
import {
    TS2DBMS,
    ORD_ZERO,
    ORD_ONE,
    type Expr,
    type Ordinal,
    type FsVariant,
    compare,
    compare_height,
    compute_new_height,
    expand,
    height_fs,
    infinity_FS,
    is_infinity,
    ord_is_limit,
    ord_add,
    ord_compare,
    ord_mul,
    ord_natural,
    ord_pow_omega,
    ord_tail_after,
    cnf_to_ts2dbms,
    ts2dbms_to_cnf,
    convert_matrix,
    compute_t1y_cnf,
    t1y_cnf_to_ts2dbms,
    convert_to_dbms,
    convert_to_layered_dbms,
    convert_to_rmn,
    layer_data,
    display,
    display_marked,
    display_ordinal,
    display_as_Y,
    from_display,
    from_display_y_seq,
    parse_ordinal,
} from '@/notations/MN/SDBMS/TS2DBMS.ts';

const ORIGINAL = resolve_display(TS2DBMS.display);
const OLD_ORIGINAL = resolve_display(S2DBMS.display);
const Y = resolve_display(TS2DBMS.display_equiv!.Y);
const OLD_Y = resolve_display(S2DBMS.display_equiv!.Y);
const W = parse_ordinal('w');
const E = parse_ordinal('(0)(1^(0,1))(2^(0,2))');

function same_ordinal(a: Ordinal, b: Ordinal): void {
    expect(ord_compare(a, b)).toBe(0);
}

function seed(level: Ordinal): Expr {
    return [[], [[0, [0, cnf_to_ts2dbms(level)]]]];
}

function freeze_tree(value: unknown): void {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze_tree);
    Object.freeze(value);
}

function counts_equal(expr: Expr, expected: Ordinal[]): void {
    const actual = compute_t1y_cnf(expr);
    expect(actual.length).toBe(expected.length);
    actual.forEach((value, i) => same_ordinal(value, expected[i]));
}

function matrix_heights_only(expr: Expr): void {
    expect(Array.isArray(expr)).toBe(true);
    for (const col of expr)
        for (const [parent, [anchor, level]] of col) {
            expect(Number.isSafeInteger(parent)).toBe(true);
            expect(Number.isSafeInteger(anchor)).toBe(true);
            matrix_heights_only(level);
        }
}

describe('TS2DBMS (note-9)', () => {
    it('uses the S2DBMS category and display modes, without a description', () => {
        expect(TS2DBMS.category_id).toBe(S2DBMS.category_id);
        expect(Object.keys(TS2DBMS.display_equiv!)).toEqual(Object.keys(S2DBMS.display_equiv!));
        expect(TS2DBMS.description).toBeUndefined();
        expect(TS2DBMS.init().map((expr) => display(expr))).toEqual(['Limit', '(0)', '']);
        expect(TS2DBMS.compare(TS2DBMS.init()[0], seed(E))).toBeGreaterThan(0);
    });

    it.each([
        ['', ''],
        ['(0)', '1'],
        ['(0)(1^(0,1))', '1,2'],
        ['(0)(1^(5,1))', '1,7'],
        ['(0)(1^(w,1))', '1,w'],
        ['(0)(1^(w+1,1))', '1,w+1'],
        ['(0)(1^(w,1))(2^(w,1))', '1,w,w^2'],
        ['(0)(1^(w,1))(2^(w,2))', '1,w,w^2+1'],
        ['(0)(1^(w,1))(2^(w+1,2))', '1,w,w^2+2'],
        ['(0)(1^(w^2,1))(2^(w^2,2))', '1,w^2,w^4+1'],
        ['(0)(1^(w^2+w,1))(2^(w^2+w,1))', '1,w^2+w,w^4+w^2'],
        ['(0)(1^(3,1))(2^(3,1),1^(w,1))', '1,5,w'],
    ])('counts %s as %s', (text, expected) => {
        const expr = from_display(text);
        expect(display_as_Y(expr)).toBe(expected);
        expect(display_as_Y(from_display_y_seq(expected))).toBe(expected);
    });

    it('matches finite S2DBMS displays and all four fundamental-sequence variants', () => {
        const queue = Array.from({ length: 5 }, (_, n) => S2DBMS.FS(S2DBMS.init()[0], n));
        const seen = new Set<string>();
        for (let cursor = 0; cursor < queue.length && seen.size < 160; cursor++) {
            const original = queue[cursor],
                text = OLD_ORIGINAL.plain(original);
            if (seen.has(text)) continue;
            seen.add(text);
            const expr = from_display(text);
            expect(display(expr)).toBe(text);
            expect(display_as_Y(expr)).toBe(OLD_Y.plain(original));
            for (const key of ['m', 'RMN', 'dbms', 'm dbms', 'l dbms']) {
                const old_text = resolve_display(S2DBMS.display_equiv![key]).plain(original);
                const expected = old_text
                    .replaceAll('ω', 'w')
                    .replaceAll('(0)', '()')
                    .replace(/\(0:(\d+)\)/g, '(:$1)');
                expect(resolve_display(TS2DBMS.display_equiv![key]).plain(expr)).toBe(expected);
            }
            const old_variants = [S2DBMS.FS, S2DBMS.FS_alter!, S2DBMS.FS_short!, S2DBMS.FS_equiv!.fast];
            const new_variants = [TS2DBMS.FS, TS2DBMS.FS_alter!, TS2DBMS.FS_short!, TS2DBMS.FS_equiv!.fast];
            for (let v = 0; v < old_variants.length; v++)
                for (const n of [0, 1, 2]) {
                    expect(display(new_variants[v](expr, n))).toBe(OLD_ORIGINAL.plain(old_variants[v](original, n)));
                }
            for (const n of [0, 1, 2]) {
                const child = S2DBMS.FS(original, n);
                if (child.length <= 10) queue.push(child);
            }
        }
        expect(seen.size).toBe(160);
    });

    it('recovers arbitrary finite first-one sequences, checked against the old dense counter', () => {
        let state = 921834;
        const random = (bound: number) => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state % bound;
        };
        for (let k = 0; k < 160; k++) {
            const values = [1, ...Array.from({ length: random(6) }, () => 1 + random(16))];
            const expr = from_display_y_seq(values.join(','));
            const old = OLD_ORIGINAL.from_display!(display(expr));
            expect(OLD_Y.plain(old)).toBe(values.join(','));
            expect(compare(from_display_y_seq(display_as_Y(expr)), expr)).toBe(0);
        }
        expect(display_as_Y(from_display_y_seq('1,1,8,2,11,1,3'))).toBe('1,1,8,2,11,1,3');
    });

    it('uses relative high components, with positive and strictly increasing limit approximations', () => {
        const cases = [
            [parse_ordinal('3'), W],
            [parse_ordinal('w+3'), parse_ordinal('w*2')],
            [W, parse_ordinal('w^2')],
            [ord_add(E, ord_natural(3n)), ord_mul(E, ord_natural(2n))],
        ];
        for (const [beta, lambda] of cases) {
            const prefix = seed(beta);
            const expr: Expr = prefix.concat([
                [
                    [1, [0, cnf_to_ts2dbms(beta)]],
                    [0, [0, cnf_to_ts2dbms(lambda)]],
                ],
            ]);
            let previous = expr.slice(0, -1),
                previous_count = ORD_ZERO;
            for (let n = 0; n < 4; n++) {
                const child = expand(expr, n);
                const gamma = ord_add(beta, ts2dbms_to_cnf(height_fs(cnf_to_ts2dbms(ord_tail_after(beta, lambda)), n)));
                expect(child.length).toBe(expr.length);
                expect(child[2][0]).toEqual(expr[2][0]);
                expect(child[2][1][0]).toBe(0);
                expect(child[2][1][1][0]).toBe(0);
                same_ordinal(ts2dbms_to_cnf(child[2][1][1][1]), gamma);
                expect(ord_compare(beta, gamma)).toBeLessThan(0);
                expect(ord_compare(gamma, lambda)).toBeLessThan(0);
                expect(compare(previous, child)).toBeLessThan(0);
                const count = compute_t1y_cnf(child)[2];
                expect(ord_compare(previous_count, count)).toBeLessThan(0);
                expect(ord_compare(count, compute_t1y_cnf(expr)[2])).toBeLessThan(0);
                previous = child;
                previous_count = count;
            }
        }
        const expr = from_display('(0)(1^(3,1))(2^(3,1),1^(w,1))');
        expect([0, 1, 2].map((n) => display_as_Y(expand(expr, n)))).toEqual(['1,5,25', '1,5,26', '1,5,27']);
        expect([0, 1, 2].map((n) => display(expand(expr, n)))).toEqual([
            '(0)(1^(3,1))(2^(3,1),1^(4,1))',
            '(0)(1^(3,1))(2^(3,1),1^(5,1))',
            '(0)(1^(3,1))(2^(3,1),1^(6,1))',
        ]);
    });

    it('resets the low component to the bad root, independently of the previous anchor', () => {
        const expr = from_display('(0)(1^(3,1))(2^(3,2))(3^(3,3),2^(w,1))');
        const child = expand(expr, 0);
        expect(child[3][1][1][0]).toBe(1);
        same_ordinal(ts2dbms_to_cnf(child[3][1][1][1]), parse_ordinal('4'));
        expect(compare_height(child[3][0][1], child[3][1][1])).toBeLessThan(0);
    });

    it('retains ordinary last edges within a limit layer', () => {
        const expr = from_display('(0)(1^(w,1))(2^(w,2))');
        expect(compute_new_height(expr[2][0][1], expr, 1).kind).toBe('ordinary');
        const child = expand(expr, 0, false);
        expect(display_as_Y(child)).toBe('1,w,w^2');
        same_ordinal(ord_add(compute_t1y_cnf(child)[2], ORD_ONE), compute_t1y_cnf(expr)[2]);
    });

    it('uses the self-recursive top sequence and default short height FS', () => {
        let theta = ORD_ZERO;
        for (let n = 0; n < 4; n++) {
            const expr = infinity_FS(n);
            same_ordinal(ts2dbms_to_cnf(expr[1][0][1][1]), theta);
            const value = ts2dbms_to_cnf(expr);
            expect(ord_compare(theta, value)).toBeLessThan(0);
            expect(compare(cnf_to_ts2dbms(value), expr)).toBe(0);
            counts_equal(expr, [ORD_ONE, ord_add(ord_natural(2n), theta)]);
            theta = value;
        }
        expect([0, 1, 2, 3].map((n) => display_ordinal(ts2dbms_to_cnf(height_fs(cnf_to_ts2dbms(W), n))))).toEqual([
            '1',
            '2',
            '3',
            '4',
        ]);
        expect(display(infinity_FS(1))).toBe('(0)(1^(w,1))');
        expect(is_infinity(from_display_y_seq('1,w'))).toBe(false);
    });

    it('stores every height recursively as an Expr, including parsed and expanded results', () => {
        expect(from_display('(0)(1^(0,1))')).toEqual([[], [[0, [0, []]]]]);
        expect(from_display('(0)(1^(2,1))')).toEqual([[], [[0, [0, [[], []]]]]]);
        expect(from_display('(0)(1^(w,1))')).toEqual([[], [[0, [0, [[], [[0, [0, []]]]]]]]]);
        const values = [seed(W), seed(E), infinity_FS(3), from_display_y_seq('1,w,w^2+1')];
        for (const expr of values) {
            matrix_heights_only(expr);
            expect(JSON.parse(JSON.stringify(expr))).toEqual(expr);
            for (const variant of [TS2DBMS.FS, TS2DBMS.FS_alter!, TS2DBMS.FS_short!]) {
                for (const n of [0, 1, 2]) matrix_heights_only(variant(expr, n));
            }
        }
    });

    it.each(['FS', 'FS_alter', 'FS_short'] as const)(
        'uses the same %s variant and index on the matrix of the relative height difference',
        (variant) => {
            const cases = [
                [parse_ordinal('3'), W],
                [parse_ordinal('w+3'), parse_ordinal('w*2')],
                [W, parse_ordinal('w^2')],
                [ord_add(E, ord_natural(3n)), ord_mul(E, ord_natural(2n))],
            ];
            for (const [beta, lambda] of cases) {
                const expr: Expr = seed(beta).concat([
                    [
                        [1, [0, cnf_to_ts2dbms(beta)]],
                        [0, [0, cnf_to_ts2dbms(lambda)]],
                    ],
                ]);
                const difference = cnf_to_ts2dbms(ord_tail_after(beta, lambda));
                // 差的矩阵在有限 S2 域内：独立调用原记号对应变体，不以新实现作预期值。
                const old_difference = OLD_ORIGINAL.from_display!(display(difference));
                let previous: Expr | undefined;
                for (const n of [0, 1, 2, 3]) {
                    const old_child = S2DBMS[variant]!(old_difference, n);
                    const approximation = ts2dbms_to_cnf(from_display(OLD_ORIGINAL.plain(old_child)));
                    const child = TS2DBMS[variant]!(expr, n);
                    expect(child.length).toBe(expr.length);
                    expect(child.slice(0, -1)).toEqual(expr.slice(0, -1));
                    expect(child[2][0]).toEqual(expr[2][0]);
                    expect(child[2][1][1][0]).toBe(0);
                    same_ordinal(ts2dbms_to_cnf(child[2][1][1][1]), ord_add(beta, approximation));
                    expect(compare(child, expr)).toBeLessThan(0);
                    if (previous) expect(compare(previous, child)).toBeLessThan(0);
                    previous = child;
                }
            }
        },
    );

    it('propagates the selected variant through nested transfinite height matrices without mixing caches', () => {
        const variants: FsVariant[] = ['FS_short', 'FS_alter', 'FS', 'fast'];
        const apply = (expr: Expr, n: number, variant: FsVariant): Expr =>
            variant === 'fast' ? TS2DBMS.FS_equiv!.fast(expr, n) : TS2DBMS[variant]!(expr, n);
        const height = seed(parse_ordinal('w^2'));
        const expr: Expr = [[], [[0, [0, height]]]];
        const expected = new Map<string, string>();
        for (const variant of variants)
            for (const n of [0, 1, 2, 3]) {
                const inner = apply(height, n, variant),
                    child = apply(expr, n, variant);
                expect(child.length).toBe(2);
                expect(compare(child[1][0][1][1], inner)).toBe(0);
                expected.set(variant + n, display(child));
            }
        expect(expected.get('FS1')).not.toBe(expected.get('FS_alter1'));
        expect(expected.get('FS1')).not.toBe(expected.get('FS_short1'));
        for (const variant of variants.toReversed())
            for (const n of [3, 1, 0, 2]) {
                expect(display(apply(expr, n, variant))).toBe(expected.get(variant + n));
            }
    });

    it('performs CNF arithmetic with its own recursive epsilon atoms', () => {
        const bigger = ts2dbms_to_cnf(from_display('(0)(1^(0,1))(2^(0,2))(2^(0,2))'));
        const nested = ts2dbms_to_cnf(seed(E));
        expect(ord_compare(E, bigger)).toBeLessThan(0);
        expect(ord_compare(bigger, nested)).toBeLessThan(0);
        same_ordinal(ord_pow_omega(E), E);
        const pool = [
            ORD_ZERO,
            ORD_ONE,
            W,
            parse_ordinal('w^(w+1)*2+w^3+5'),
            E,
            bigger,
            nested,
            ord_add(E, ORD_ONE),
            ord_mul(E, E),
            ord_pow_omega(ord_mul(E, E)),
        ];
        for (const value of pool) {
            const expr = cnf_to_ts2dbms(value);
            same_ordinal(ts2dbms_to_cnf(expr), value);
            same_ordinal(parse_ordinal(display_ordinal(value)), value);
            counts_equal(seed(value), [ORD_ONE, ord_add(ord_natural(2n), value)]);
        }
        for (const [value, expected] of [
            [E, '1,2,4'],
            [ord_mul(E, E), '1,2,4,2,4'],
            [ord_pow_omega(ord_mul(E, E)), '1,2,4,3,5'],
            [ord_pow_omega(ord_pow_omega(ord_mul(E, E))), '1,2,4,3,5,4,6'],
        ] as [Ordinal, string][]) {
            expect(display_as_Y(convert_matrix(cnf_to_ts2dbms(value), true))).toBe(expected);
        }
    });

    it('preserves the 1259 bottom-edge correction in relative-domain conversion', () => {
        const relative = from_display_y_seq('1,2,5,9');
        const ordinary = convert_matrix(relative, false);
        expect(display_as_Y(ordinary)).not.toBe('1,3,4');
        expect(compare(convert_matrix(ordinary, true), relative)).toBe(0);
    });

    it('round-trips arbitrary positive transfinite sequences and is idempotent', () => {
        const pool = [
            ORD_ONE,
            ord_natural(3n),
            W,
            parse_ordinal('w+2'),
            parse_ordinal('w^2+w'),
            parse_ordinal('w^w'),
            E,
            ord_add(E, ORD_ONE),
            ord_mul(E, E),
            ts2dbms_to_cnf(seed(E)),
        ];
        let state = 129328;
        const random = (bound: number) => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state % bound;
        };
        for (let k = 0; k < 70; k++) {
            const values = [ORD_ONE, ...Array.from({ length: 1 + random(3) }, () => pool[random(pool.length)])];
            const expr = t1y_cnf_to_ts2dbms(values);
            counts_equal(expr, values);
            expect(compare(t1y_cnf_to_ts2dbms(compute_t1y_cnf(expr)), expr)).toBe(0);
            expect(compare(from_display(display(expr)), expr)).toBe(0);
            counts_equal(from_display_y_seq(display_as_Y(expr)), values);
        }
    });

    it('returns a canonical counting inverse without assuming arbitrary matrices are literal inverses', () => {
        const expr = from_display('(0)(1^(3,1))(2^(3,1),1^(w,1))');
        const restored = from_display_y_seq(display_as_Y(expr));
        expect(display(restored)).toBe('(0)(1^(3,1))(2^(w,2))');
        counts_equal(restored, compute_t1y_cnf(expr));
    });

    it('renders the exact RMN, DBMS and layered examples', () => {
        const expr = from_display('(0)(1^(w,1))(2^(w,2))');
        const expected: Record<string, string> = {
            m: '(:1)(1^(w,1):2)(2^(w,2):3)',
            RMN: '()(1:w^2)(2:w^2+1)',
            dbms: '()(,1[,,1]^w)(,2[,2,,2]^w,2)',
            'm dbms': '(:1)(,1[,,1]^w:2)(,2[,2,,2]^w,2:3)',
            'l dbms': '()(,1[,,1]^w)(,2[,2,,2]^w,1)',
            Y: '1,w,w^2+1',
        };
        for (const [key, text] of Object.entries(expected)) {
            const spec = resolve_display(TS2DBMS.display_equiv![key]);
            expect(spec.plain(expr)).toBe(text);
            expect(spec.html(expr)).not.toContain('^');
            expect(spec.latex(expr)).not.toMatch(/<\/?(?:span|sup|sub)/);
        }
        expect(resolve_display(TS2DBMS.display_equiv!.dbms).html(expr)).toBe(
            '()(,1[,,1]<sup>ω</sup>)(,2[,2,,2]<sup>ω</sup>,2)',
        );
        expect(resolve_display(TS2DBMS.display_equiv!.dbms).latex(expr)).toContain('[,,1]^{\\omega }');
        expect(ORIGINAL.html(expr)).toContain('1<sup>(ω,1)</sup>');
        expect(ORIGINAL.latex(expr)).toContain('1^{(\\omega ,1)}');
    });

    it('keeps infinite blocks finite even at epsilon heights', () => {
        for (const alpha of [parse_ordinal('w^w'), E, ts2dbms_to_cnf(seed(E))]) {
            const expr: Expr = [[], [[0, [0, cnf_to_ts2dbms(alpha)]]], [[1, [1, cnf_to_ts2dbms(alpha)]]]];
            const words = convert_to_dbms(expr),
                layered = convert_to_layered_dbms(expr);
            expect(words[2].length).toBe(3);
            expect(layered[2].length).toBe(3);
            expect(words[2][1].kind).toBe('repeat');
            expect(layered[2][2]).toEqual({ kind: 'atom', value: 1, separator: 0 });
            counts_equal(expr, [ORD_ONE, alpha, ord_add(ord_mul(alpha, alpha), ORD_ONE)]);
        }
        expect(resolve_display(TS2DBMS.display_equiv!.dbms).plain(seed(E))).toBe('()(,1[,,1]^{(0)(1^(0,1))(2^(0,2))})');
    });

    it('agrees with RMN endpoints and independent parent-chain depths at mixed transfinite rows', () => {
        const samples = [
            ORD_ZERO,
            ORD_ONE,
            ord_natural(4n),
            W,
            parse_ordinal('w+3'),
            parse_ordinal('w*2'),
            parse_ordinal('w^2+w'),
            E,
            ord_add(E, ORD_ONE),
        ];
        for (const alpha of samples) {
            const source: Expr = [
                [],
                [[0, [0, cnf_to_ts2dbms(alpha)]]],
                [[1, [1, cnf_to_ts2dbms(ord_add(alpha, ord_natural(2n)))]]],
                [[2, [2, cnf_to_ts2dbms(ord_add(alpha, ord_natural(3n)))]]],
            ];
            for (const expr of [source, expand(source, 0, false), expand(source, 1, false)]) {
                const rmn = convert_to_rmn(expr);
                // 扫描有限词端点，与直接层森林 RMN 公式对照。
                convert_to_dbms(expr).forEach((word, i) => {
                    let level = ORD_ZERO,
                        low = 0;
                    const endpoints: [number, Ordinal][] = [];
                    for (const part of word) {
                        const parent = (part.kind === 'atom' ? part.value : part.body[0].value) - 1;
                        if (part.kind === 'repeat') {
                            level = ord_add(level, part.count);
                            low = 0;
                        } else if (part.separator === 1) {
                            level = ord_add(level, ORD_ONE);
                            low = 0;
                        } else low++;
                        const row = ord_add(ord_mul(W, level), ord_natural(BigInt(low)));
                        if (endpoints.at(-1)?.[0] === parent) endpoints[endpoints.length - 1][1] = row;
                        else endpoints.push([parent, row]);
                    }
                    expect(endpoints.length).toBe(rmn[i].length);
                    endpoints.forEach(([p, row], j) => {
                        expect(p).toBe(rmn[i][j][0]);
                        same_ordinal(row, rmn[i][j][1]);
                    });
                });
                // 查询真实行坐标上第一条不低于当前行的边，逐次向左求层级。
                const next_edge = (
                    column: number,
                    level: Ordinal,
                    low: number,
                ): { parent: number; level: Ordinal; low: number } | undefined => {
                    const { heights, parents } = layer_data(expr, level);
                    const shift = ord_compare(level, ORD_ZERO) === 0 ? 1 : 0;
                    const j = Math.max(ord_is_limit(level) ? 1 : 0, low - shift);
                    if (j < heights[column]) return { parent: parents[column][j], level, low: j + shift };
                    const top = ts2dbms_to_cnf(expr[column].at(-1)?.[1][1] ?? []);
                    if (ord_compare(level, top) >= 0) return undefined;
                    const next = ord_add(level, ORD_ONE);
                    return { parent: layer_data(expr, next).parents[column][0], level: next, low: 0 };
                };
                const depth = (column: number, level: Ordinal, low: number): number => {
                    let edge = next_edge(column, level, low),
                        result = 0;
                    expect(edge).toBeDefined();
                    same_ordinal(edge!.level, level);
                    expect(edge!.low).toBe(low);
                    while (edge) {
                        expect(edge.parent).toBeLessThan(column);
                        result++;
                        column = edge.parent;
                        edge = next_edge(column, edge.level, edge.low);
                    }
                    return result;
                };
                convert_to_layered_dbms(expr).forEach((word, i) => {
                    let level = ORD_ZERO,
                        low = 0;
                    for (const part of word) {
                        if (part.kind === 'atom') {
                            if (part.separator === 1) {
                                level = ord_add(level, ORD_ONE);
                                low = 0;
                            } else low++;
                            expect(part.value).toBe(depth(i, level, low));
                        } else {
                            for (const offset of [ORD_ZERO, ORD_ONE, W, parse_ordinal('w+1')]) {
                                if (ord_compare(offset, part.count) >= 0) continue;
                                let at = ord_add(level, offset),
                                    finite = ord_compare(offset, ORD_ZERO) === 0 ? low : 0;
                                for (const atom of part.body) {
                                    if (atom.separator === 1) {
                                        at = ord_add(at, ORD_ONE);
                                        finite = 0;
                                    } else finite++;
                                    expect(atom.value).toBe(depth(i, at, finite));
                                }
                            }
                            level = ord_add(level, part.count);
                            low = 0;
                        }
                    }
                });
            }
        }
    });

    it('round-trips scalar CNF and decreases along standard transfinite expansion paths', () => {
        const queue = [W, parse_ordinal('w^2'), E].map(seed);
        const seen = new Set<string>();
        for (let cursor = 0; cursor < queue.length && seen.size < 80; cursor++) {
            const expr = queue[cursor],
                key = display(expr);
            if (seen.has(key)) continue;
            seen.add(key);
            const value = ts2dbms_to_cnf(expr);
            expect(compare(cnf_to_ts2dbms(value), expr)).toBe(0);
            for (const n of [0, 1, 2]) {
                const child = expand(expr, n);
                if (expr.length) expect(ord_compare(ts2dbms_to_cnf(child), value)).toBeLessThan(0);
                if (child.length <= 8) queue.push(child);
            }
        }
        expect(seen.size).toBe(80);
    });

    it('persists recursive matrix heights using the existing JSON format', () => {
        const expr = seed(ord_add(E, ord_natural(5n)));
        expect(JSON.parse(JSON.stringify(expr))).toEqual(expr);
        const entries = [
            { expr, analysis: ['recursive height'] },
            { expr: TS2DBMS.init()[0], analysis: ['limit'] },
        ];
        const restored = parse_analysis_entries<Expr>(stringify_analysis_entries(entries));
        expect(restored).toEqual(entries);
        expect(compare(restored[0].expr, expr)).toBe(0);
        expect(is_infinity(restored[1].expr)).toBe(true);
        const legacy = [{ expr: [1, 2, 3], analysis: ['plain numbers'] }];
        expect(parse_analysis_entries(stringify_analysis_entries(legacy))).toEqual(legacy);
    });

    it('keeps original and marked parsers compatible, including nested self ordinals', () => {
        const expr: Expr = seed(ord_add(E, ORD_ONE));
        const text = display(expr);
        expect(text).toContain('(0)(1^(0,1))(2^(0,2))(0)');
        expect(compare(from_display(text), expr)).toBe(0);
        expect(compare(from_display(display_marked(expr)), expr)).toBe(0);
        expect(display(from_display(' (:1) (1^({ω^(ω+1)*2+ω^3+5},1):2) '))).toBe('(0)(1^(w^(w+1)*2+w^3+5,1))');
        expect(display_ordinal(parse_ordinal('ω^{ω+1}*2+ω^3+5'))).toBe('w^(w+1)*2+w^3+5');
        const huge = '123456789012345678901234567890';
        expect(display_ordinal(parse_ordinal(huge))).toBe(huge);
        expect(() => from_display('(0)(1^(' + huge + ',1))')).toThrow(/resource limit/);
    });

    it.each(['0', '2,3', '1,0', '1,,2', '1,', ',1', '1,Limit', '1,(w}', '1,w^', '1,()(1,1)', '1,-1'])(
        'rejects invalid Y input %s',
        (text) => {
            expect(() => from_display_y_seq(text)).toThrow();
        },
    );

    it.each([
        '(1^(0,1))',
        '(0)(2^(0,1))',
        '(0)(1^(0,2))',
        '(0)(1^(Limit,1))',
        '(0)(1^(w,1)',
        '(0)(1^(w,1))oops',
        '(0)(1^(w,1),1^(w+1,1))',
        '(0)(1^(0,1),)',
        '(0)(1^(w,1):)',
        '(0)(9007199254740993^(w,1))',
    ])('rejects invalid native input %s', (text) => {
        expect(() => from_display(text)).toThrow();
    });

    it('round-trips only the explicit Limit sentinel across input modes', () => {
        for (const expr of TS2DBMS.init()) {
            expect(compare(ORIGINAL.from_display!(ORIGINAL.plain(expr)), expr)).toBe(0);
            expect(compare(Y.from_display!(Y.plain(expr)), expr)).toBe(0);
        }
        for (const mode of Object.values(TS2DBMS.display_equiv!)) {
            expect(resolve_display(mode).plain(TS2DBMS.init()[0])).toBe('Limit');
        }
        expect(display_as_Y(from_display_y_seq('1,ω'))).toBe('1,w');
    });

    it('does not mutate input matrices or recursive ordinal ASTs', () => {
        const expr = from_display('(0)(1^(3,1))(2^(3,1),1^(w,1))');
        freeze_tree(expr);
        const values = [ORD_ONE, E, ord_add(E, ORD_ONE)];
        freeze_tree(values);
        for (const mode of [TS2DBMS.display, ...Object.values(TS2DBMS.display_equiv!)])
            resolve_display(mode).plain(expr);
        expand(expr, 2);
        counts_equal(t1y_cnf_to_ts2dbms(values), values);
        const finite = from_display('(0)(1^(2,1))');
        freeze_tree(finite);
        expand(finite, 2);
        cnf_to_ts2dbms(ts2dbms_to_cnf(finite));
        expect(display(expr)).toBe('(0)(1^(3,1))(2^(3,1),1^(w,1))');
    });

    it('reports materialization limits as resource errors', () => {
        expect(() => cnf_to_ts2dbms(ord_natural(100000000000000000000n))).toThrow(/resource limit/);
        expect(() => compute_t1y_cnf(seed(ord_natural(100000000000000000000n)))).toThrow(/resource limit/);
    });
});
