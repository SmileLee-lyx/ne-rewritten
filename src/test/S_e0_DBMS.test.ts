import { describe, expect, it } from 'vitest';
import { resolve_display } from '@/notation-definition.ts';
import {
    S_e0_DBMS,
    INFINITY,
    INFINITE_HEIGHT,
    compare_height,
    compare,
    display,
    display_marked,
    from_display,
    infinity_FS,
    create_queries,
    copy_height,
    expand,
    validate_expr,
    height_value,
    display_ordinal,
    compare_ordinal,
    add_ordinal,
    convert_to_dbms_data,
    convert_to_dbms,
    dbms_column_verticals,
    dbms_to_y_mountain,
    dbms_compute_parent,
    to_y_sequence,
    from_y_seq,
    type Expr,
    type Height,
    type Entry,
    type Ordinal,
} from '@/notations/MN/SDBMS/S_e0_DBMS.ts';

const Y = resolve_display(S_e0_DBMS.display_equiv!.Y);
const RMN = resolve_display(S_e0_DBMS.display_equiv!.RMN);

function tower(a: number, depth: number): Height {
    let h: Height = 0;
    for (let i = 0; i < depth; i++) h = [[a, h]];
    return h;
}

function reference_compare(a: Height, b: Height): number {
    if (a === 0 || b === 0) return a === b ? 0 : a === 0 ? -1 : 1;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = a[i][0] - b[i][0] || reference_compare(a[i][1], b[i][1]);
        if (d !== 0) return d;
    }
    return b.length - a.length;
}

function nth_tail(h: Height, n: number): Height {
    for (let i = 0; i < n && h !== 0; i++) h = h[h.length - 1][1];
    return h;
}

function unique(heights: Height[]): Height[] {
    return [...new Map(heights.map((h) => [JSON.stringify(h), h])).values()].sort(reference_compare);
}

/** Independent finite set construction from note-7's definition of G.
 * It enumerates every internal seed gap, and is deliberately not the production
 * predecessor/seed-prefix algorithm. Only these small test fixtures use it. */
function reference_model(expr: Expr) {
    const mountain: Entry[][] = [];
    const cache = new Map<string, Height[]>();
    function seeds(a: number, n: number): Height[] {
        return unique([0, ...mountain[a].map(([, h]) => nth_tail(h, n))]);
    }
    function grid(a: number, n: number, cap: Height): Height[] {
        if (cap === 0) return [0];
        if (cap.length === 0 || cap[0][0] > a) throw new Error('Reference grid needs a finite upper bound');
        const key = a + ':' + n + ':' + JSON.stringify(cap);
        const cached = cache.get(key);
        if (cached) return cached;
        const k = seeds(a, n);
        const result: Height[] = [...k];
        for (const u of k) {
            if (u === 0) continue;
            const p = nth_tail(u, 1);
            if (p === 0) continue;
            for (const q of grid(a, n + 1, p)) {
                if (reference_compare(q, p) < 0) result.push([...u, [a, q]]);
            }
        }
        if (cap[0][0] === a) for (const p of grid(a, n + 1, cap[0][1])) result.push([[a, p]]);
        const bounded = unique(result.filter((h) => reference_compare(h, cap) <= 0));
        cache.set(key, bounded);
        return bounded;
    }
    for (const col of expr) {
        const points: Entry[] = [];
        let lower: Height = 0;
        for (const [r, h] of col) {
            for (const g of grid(r, 0, h)) if (reference_compare(g, lower) > 0) points.push([r, g]);
            lower = h;
        }
        mountain.push(points);
    }
    const value_cache = new Map<string, Ordinal>();
    function value(h: Height, n: number = 0): Ordinal {
        if (h === 0) return [];
        const key = n + ':' + JSON.stringify(h);
        const cached = value_cache.get(key);
        if (cached) return cached;
        const [a, p] = h[h.length - 1];
        const u = h.slice(0, -1);
        // Literal filtering first, then maximum ordinal value: the original formula.
        let base: Ordinal = [];
        for (const q of seeds(a, n))
            if (reference_compare(q, u) < 0) {
                const v = value(q, n);
                if (compare_ordinal(v, base) > 0) base = v;
            }
        const result = add_ordinal(base, [[value(p, n + 1), 1n]]);
        value_cache.set(key, result);
        return result;
    }
    const values: bigint[][] = [];
    const parents: [number, number][][] = [];
    for (let i = 0; i < expr.length; i++) {
        const col = mountain[i];
        parents[i] = col.map(([r, h]) => [r, mountain[r].filter(([, q]) => reference_compare(q, h) < 0).length]);
        values[i] = [];
        values[i][col.length] = 1n;
        for (let j = col.length - 1; j >= 0; j--) {
            const [r, p] = parents[i][j];
            values[i][j] = values[i][j + 1] + values[r][p];
        }
    }
    return { mountain, seeds, grid, value, values, parents };
}

function freeze_tree(value: unknown): void {
    if (!Array.isArray(value)) return;
    value.forEach(freeze_tree);
    Object.freeze(value);
}

describe('Sε₀DBMS (note-7)', () => {
    it('distinguishes zero, infinite height, proper prefixes and missing predecessors', () => {
        const a: Height = [[0, [[0, 0]]]];
        const b: Height = [...a, [1, 0]];
        expect(compare_height(0, a)).toBeLessThan(0);
        expect(compare_height(b, a)).toBeLessThan(0);
        expect(compare_height(a, INFINITE_HEIGHT)).toBeLessThan(0);
        expect(compare_height(INFINITE_HEIGHT, [])).toBe(0);
        const q = create_queries([[]]);
        expect(q.grid_below(0, 0, 0)).toBeUndefined();
        expect(q.grid_prev(0, 0, 0)).toBeUndefined();
        expect(q.grid_below(0, 0, [])).toEqual([]);
        expect(q.grid_below(0, 0, [[1, 0]])).toEqual([]);
        expect(q.grid_member(0, 0, [])).toBe(false);
        expect(q.grid_prev(0, 0, [[0, 0]])).toBe(0);
        expect(() => q.grid_prev(0, 0, [])).toThrow();
        expect(() => q.grid_prev(0, 0, [[1, 0]])).toThrow();
    });

    it('uses the specified diagonal Limit sequence starting at one @', () => {
        expect(INFINITY).toBe(Infinity);
        expect(display(INFINITY)).toBe('Limit');
        for (let n = 0; n < 8; n++) {
            const expr: Expr = [[], [[0, tower(0, n + 1)]]];
            for (const fs of [S_e0_DBMS.FS, S_e0_DBMS.FS_alter!, S_e0_DBMS.FS_short!, S_e0_DBMS.FS_equiv!.fast])
                expect(fs(INFINITY, n)).toEqual(expr);
            expect(to_y_sequence(expr)).toEqual([1n, BigInt(n + 2)]);
        }
        expect(from_display('()(1^1@∅)')).toEqual(infinity_FS(0));
        expect(from_display('()(1^1@1@1@∅)')).toEqual(infinity_FS(2));
        expect([0, 1, 2].map((n) => display(infinity_FS(n)))).toEqual([
            '(0)(1^(1@0))',
            '(0)(1^(1@1))',
            '(0)(1^(1@(1@1)))',
        ]);
        expect(() => from_display('()(1^∞)')).toThrow();
        expect(compare(INFINITY, infinity_FS(3))).toBeGreaterThan(0);
    });

    it('round-trips recursive, marked, zero and Limit syntax', () => {
        const samples = [[], [[]], INFINITY, infinity_FS(5), from_y_seq([1, 3, 6, 5]), from_y_seq([1, 10, 3, 11])];
        for (const expr of samples) {
            expect(from_display(display(expr))).toEqual(expr);
            expect(from_display(display_marked(expr, 'plain', 12))).toEqual(expr);
            expect(from_display(display(expr).replaceAll('@0', '@∅'))).toEqual(expr);
            expect(from_display('  ' + display(expr).split('').join(' ') + '  ')).toEqual(expr);
        }
        for (const h of ['1@1', '1@(1@0)', '1@(1@∅)', '1@1@0', '1@1@∅'])
            expect(from_display('()(1^(' + h + '))')).toEqual(infinity_FS(1));
        const large_anchor: Expr = [...Array.from({ length: 12 }, () => []), [[11, tower(11, 2)]]];
        for (const p of ['12', '(12@0)', '(12@∅)'])
            expect(from_display('()'.repeat(12) + '(12^(12@' + p + '))')).toEqual(large_anchor);
        expect(display(large_anchor)).toBe('(0)'.repeat(12) + '(12^(12@12))');
        expect(display(infinity_FS(0), 'html')).toBe('(0)(1<sup>(1@0)</sup>)');
        expect(display(infinity_FS(1), 'html')).toBe('(0)(1<sup>(1@1)</sup>)');
        expect(display_marked(infinity_FS(0), 'html')).toContain('<sub>');
    });

    it.each([
        '()(1^(0@0))',
        '()(1^(2@0))',
        '()(1^0)',
        '()(1^(1@∞))',
        '()(1^(1@0,1@0))',
        '()(1^(1@1@0,2@0))',
        '()(1^(1@0)',
        '(1^1@0)',
        '()(1^1@0)junk',
        '()(1)',
        '()(1^1)',
    ])('rejects malformed or unsupported input %s', (text) => {
        expect(() => from_display(text)).toThrow();
    });

    it('does not replace literal caps by ordinal comparisons', () => {
        const expr: Expr = [[], [[0, [[0, 0]]]]];
        const p = tower(0, 2),
            q: Height = [[1, 0]];
        expect(compare_height(p, q)).toBeLessThan(0);
        expect(display_ordinal(height_value(expr, p))).toBe('ω');
        expect(display_ordinal(height_value(expr, q))).toBe('2');
        expect(compare_ordinal(height_value(expr, p), height_value(expr, q))).toBeGreaterThan(0);
    });

    it('displays RMN endpoint values, boundary terms and nested superscripts', () => {
        expect(RMN.plain([])).toBe('');
        expect(RMN.plain([[]])).toBe('()');
        expect(RMN.plain([[], []])).toBe('()()');
        expect(RMN.plain(INFINITY)).toBe('Limit');
        expect(RMN.html(INFINITY)).toBe('Limit');
        expect(RMN.latex(INFINITY)).toBe('Limit');
        expect([0, 1, 2, 3].map((n) => RMN.plain(infinity_FS(n)))).toEqual([
            '()(1:1)',
            '()(1:ω)',
            '()(1:ω^(ω))',
            '()(1:ω^(ω^(ω)))',
        ]);
        expect(RMN.html(infinity_FS(3))).toBe('()(1:ω<sup>ω<sup>ω</sup></sup>)');
        expect(RMN.latex(infinity_FS(3))).toBe('()(1:\\omega ^{\\omega ^{\\omega }})');
        const expr = from_display('(0)(1^(1@(1@1)))(2^(2@(1@1,2@0)))(3^(1@(1@1)),2^(2@0))');
        freeze_tree(expr);
        expect(RMN.plain(expr)).toBe('()(1:ω^(ω))(2:ω^(ω)+ω^2)(3:ω^(ω),2:ω^(ω)+1)');
    });

    it('matches finite-set grid enumeration, all-order tails, bounds and predecessors', () => {
        for (const input of [[1], [1, 3], [1, 3, 6, 5], [1, 10, 3, 11], [1, 3, 13, 10]]) {
            const expr = from_y_seq(input);
            const ref = reference_model(expr);
            const q = create_queries(expr);
            for (let a = 0; a < expr.length; a++)
                for (let n = 0; n < 4; n++) {
                    const k = ref.seeds(a, n);
                    expect(q.seed_max(a, n).height).toEqual(k[k.length - 1]);
                    const grid = ref.grid(a, n, tower(a, 3));
                    const caps = unique([
                        ...grid.filter((_, i) => i % Math.max(1, Math.floor(grid.length / 18)) === 0),
                        ...k,
                    ]);
                    for (const cap of caps) {
                        expect(q.grid_member(a, n, cap)).toBe(true);
                        expect(q.seed_member(a, n, cap) !== undefined).toBe(
                            k.some((h) => reference_compare(h, cap) === 0),
                        );
                        const below = grid.filter((h) => reference_compare(h, cap) < 0);
                        expect(q.grid_below(a, n, cap)).toEqual(below[below.length - 1]);
                        expect(q.grid_prev(a, n, cap)).toEqual(below[below.length - 1]);
                        const next = grid.find((h) => reference_compare(h, cap) > 0);
                        if (next !== undefined) expect(q.grid_above(a, n, cap)).toEqual(next);
                        const prefix = grid.filter((h) => reference_compare(h, cap) <= 0);
                        const tails = unique(prefix.map((h) => nth_tail(h, 1)));
                        expect(q.grid_head(a, n, cap)).toEqual(tails[tails.length - 1]);
                        const lower_seeds = k.filter((h) => reference_compare(h, cap) < 0);
                        expect(q.seed_below(a, n, cap)?.height).toEqual(lower_seeds[lower_seeds.length - 1]);
                    }
                }
            for (const col of expr)
                for (const [r, h] of col)
                    for (let n = 0; n < 5; n++) {
                        const tails = unique(ref.grid(r, 0, h).map((g) => nth_tail(g, n)));
                        expect(q.tail_bound(r, n, h)).toEqual(tails[tails.length - 1]);
                    }
            expect(convert_to_dbms_data(expr)[0]).toEqual(ref.mountain);
        }
    });

    it('handles strict cuts at arbitrary nonmember words and additional slots', () => {
        const expr = from_y_seq([1, 3, 6, 5]);
        const ref = reference_model(expr),
            q = create_queries(expr);
        const caps: Height[] = [
            [[0, tower(0, 2)]],
            [
                [0, tower(0, 2)],
                [1, 0],
            ],
            [
                [0, tower(0, 2)],
                [2, 0],
            ],
            [
                [0, tower(0, 2)],
                [3, 0],
            ],
            [
                [1, tower(0, 2)],
                [2, [[0, 0]]],
            ],
            [
                [2, tower(1, 2)],
                [3, 0],
            ],
        ];
        for (let a = 1; a < expr.length; a++)
            for (let n = 0; n < 3; n++)
                for (const cap of caps) {
                    if (cap === 0 || cap[0][0] > a) continue;
                    const bounded = ref.grid(a, n, cap);
                    const below = bounded.filter((h) => reference_compare(h, cap) < 0);
                    expect(q.grid_member(a, n, cap)).toBe(bounded.some((h) => reference_compare(h, cap) === 0));
                    expect(q.grid_below(a, n, cap)).toEqual(below[below.length - 1]);
                    const upper = ref.grid(a, n, tower(a, 4)).find((h) => reference_compare(h, cap) > 0);
                    expect(q.grid_above(a, n, cap)).toEqual(upper);
                }
    });

    it('keeps strict node caps distinct from closed endpoint tail bounds', () => {
        const expr = from_y_seq([1, 3, 6, 5, 18]);
        const ref = reference_model(expr),
            q = create_queries(expr);
        for (let a = 0; a < expr.length; a++) {
            const heights: Height[] = [INFINITE_HEIGHT, 0, ...ref.mountain[a].map(([, h]) => h)];
            for (let n = 0; n < 3; n++)
                for (const h of heights) {
                    for (const p of [INFINITE_HEIGHT, ...ref.seeds(a, n)]) {
                        const eligible = unique(
                            [0 as const, ...ref.mountain[a].map(([, g]) => g)]
                                .filter((g) => reference_compare(g, h) < 0)
                                .map((g) => nth_tail(g, n))
                                .filter((g) => reference_compare(g, p) < 0),
                        );
                        expect(q.lower_tail(a, n, h, p)).toEqual(eligible[eligible.length - 1]);
                    }
                }
        }
    });

    it('reproduces the exponential family without enumerating it for expansion or RMN', () => {
        const expr: Expr = [[]];
        for (let i = 1; i <= 6; i++) expr.push([[i - 1, tower(i - 1, 2)]]);
        const ref = reference_model(expr);
        for (let i = 0; i <= 6; i++) {
            expect(ref.mountain[i].length + 1).toBe(2 ** (i + 1) - 1);
            expect(ref.seeds(i, 1)).toEqual([0, ...Array.from({ length: i }, (_, a) => tower(a, 1))]);
            expect(ref.seeds(i, 2)).toEqual([0]);
        }
        const large: Expr = [[]];
        for (let i = 1; i <= 256; i++) large.push([[i - 1, tower(i - 1, 2)]]);
        const q = create_queries(large);
        expect(q.grid_prev(256, 0, tower(256, 2))).toEqual([[256, [[255, 0]]]]);
        const next = expand(large, 0, false);
        expect(next[256][0]).toEqual([255, [[255, [[254, 0]]]]]);
        expect(q.grid_head(256, 0, tower(256, 2))).toEqual(tower(256, 1));
        expect(RMN.plain(large)).toBe(
            '()' +
                Array.from({ length: 256 }, (_, i) => '(' + (i + 1) + ':ω' + (i === 0 ? '' : '^' + (i + 1)) + ')').join(
                    '',
                ),
        );
    });

    it('moves all nested references in every copied block', () => {
        const h: Height = [
            [0, tower(0, 3)],
            [2, [[1, [[1, 0]]]]],
        ];
        expect(copy_height(h, 1, 4)).toEqual([
            [0, tower(0, 3)],
            [6, [[5, [[5, 0]]]]],
        ]);
        const expr = infinity_FS(4);
        const decreased = expand(expr, 0, false);
        const copied = expand(expr, 2, false);
        expect(copied).toEqual([...decreased, [[1, tower(1, 4)]], [[2, tower(2, 4)]]]);
    });

    it('matches direct row values, dense parents and all six mountain views', () => {
        for (const input of [
            [1, 3, 6, 5],
            [1, 10, 3, 11],
            [1, 3, 13, 10],
            [1, 8, 5, 15],
        ]) {
            const expr = from_y_seq(input),
                ref = reference_model(expr);
            const [mountain, dbms] = convert_to_dbms_data(expr);
            const rows = dbms.map(dbms_column_verticals);
            expect(dbms_to_y_mountain(dbms)).toEqual(ref.values);
            for (let i = 0; i < expr.length; i++)
                for (let j = 0; j < mountain[i].length; j++) {
                    const h = mountain[i][j][1];
                    expect(rows[i][j]).toEqual(ref.value(h));
                    expect(height_value(expr, h)).toEqual(ref.value(h));
                    expect(dbms_compute_parent(dbms, rows, [i, j])).toEqual(ref.parents[i][j]);
                }
            for (const equiv of [undefined, 'm', 'dbms', 'm dbms', 'l dbms', 'Y']) {
                const source = S_e0_DBMS.mountain_view!(expr, { current_equiv: equiv })!;
                expect(source.display_html_row_label).toBe(true);
                expect(source.shape.map((col) => col.length)).toEqual(ref.mountain.map((col) => col.length + 1));
                for (let i = 0; i < expr.length; i++)
                    for (let j = 0; j < ref.mountain[i].length; j++)
                        expect(source.shape[i][j + 1].leg_target).toEqual(ref.parents[i][j]);
            }
        }
    });

    it('restores every short positive Y sequence and subtracts exactly one', () => {
        for (let a = 1; a <= 7; a++)
            for (let b = 1; b <= 7; b++)
                for (let c = 1; c <= 7; c++) {
                    const input = [1, a, b, c];
                    const expr = from_y_seq(input);
                    validate_expr(expr);
                    expect(to_y_sequence(expr)).toEqual(input.map(BigInt));
                    expect(from_display(display(expr))).toEqual(expr);
                    const decreased = expand(expr, 0, false);
                    const expected = c === 1 ? [1, a, b] : [1, a, b, c - 1];
                    expect(to_y_sequence(decreased)).toEqual(expected.map(BigInt));
                    expect(decreased).toEqual(from_y_seq(expected));
                }
    });

    it('preserves Y normal forms under all fundamental sequence variants', () => {
        const variants = [S_e0_DBMS.FS, S_e0_DBMS.FS_alter!, S_e0_DBMS.FS_short!, S_e0_DBMS.FS_equiv!.fast];
        const queue = [infinity_FS(4)];
        const seen = new Set<string>();
        let checked = 0;
        while (queue.length && checked < 100) {
            const expr = queue.shift()!;
            const key = display(expr);
            if (seen.has(key)) continue;
            seen.add(key);
            checked++;
            for (const fs of variants)
                for (let n = 0; n < 3; n++) {
                    const next = fs(expr, n);
                    validate_expr(next);
                    expect(compare(next, expr)).toBeLessThan(0);
                    const values = to_y_sequence(next);
                    expect(from_y_seq(values)).toEqual(next);
                    if (next.length > 1 && next.length <= 6 && values.every((v) => v < 150n)) queue.push(next);
                }
        }
        expect(checked).toBe(100);
    });

    it('keeps inputs immutable and binds caches to the current environment', () => {
        const expr = from_y_seq([1, 3, 6, 5]);
        const saved = display(expr);
        freeze_tree(expr);
        expand(expr, 2, false);
        to_y_sequence(expr);
        expect(display(expr)).toBe(saved);
        const mutable = infinity_FS(0);
        expect(display_ordinal(height_value(mutable, [[1, 0]]))).toBe('2');
        mutable[1][0][1] = tower(0, 2);
        expect(display_ordinal(height_value(mutable, [[1, 0]]))).toBe('ω+1');
    });

    it('handles empty, successor and Limit displays without inventing a numeric Y sentinel', () => {
        expect(Y.plain(INFINITY)).toBe('Limit');
        expect(Y.from_display!('Limit')).toBe(INFINITY);
        expect(Y.from_display!('')).toEqual([]);
        expect(Y.from_display!(' 1, 3, 6, 5 ')).toEqual(from_y_seq([1, 3, 6, 5]));
        for (const s of ['0', '2', '1,0', '1,-1', '1,1.5', '1,', '1,NaN']) expect(() => Y.from_display!(s)).toThrow();
        expect(() => from_y_seq([1, Number.MAX_SAFE_INTEGER + 1])).toThrow();
        expect(S_e0_DBMS.FS([], 2)).toEqual([]);
        expect(S_e0_DBMS.FS([[]], 2)).toEqual([]);
        expect(S_e0_DBMS.mountain_view!(INFINITY, {})).toBeUndefined();
    });
});
