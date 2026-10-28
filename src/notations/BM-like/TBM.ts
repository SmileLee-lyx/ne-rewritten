import { lex_compare, number_compare, tuple_lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { FS_default_LNZ_variant } from '@/notations/notation_utils.ts';

export type Entry = [number, Expr];
export type Column = Entry[];
export type Expr = Column[];
export type Vertical = Expr[];

export function entry_compare(e1: Entry, e2: Entry): number {
    return tuple_lex_compare(e1, e2, [number_compare, compare]);
}

export function column_compare(c1: Column, c2: Column): number {
    return lex_compare(c1, c2, entry_compare);
}

export function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

export function vertical_compare(v1: Vertical, v2: Vertical): number {
    return lex_compare(v1, v2, compare);
}

export function index_after(V: Vertical[], pos: Vertical): number {
    for (let k = 0; k < V.length; k++) {
        if (vertical_compare(V[k], pos) > 0) return k;
    }
    return V.length;
}

export function vertical_parent(v: Vertical, Pi: [number, number][], Vi: Vertical[]): [number, number] | undefined {
    for (let k = 0; k < Vi.length; k++) {
        if (vertical_compare(Vi[k], v) >= 0) return Pi[k];
    }
    return undefined;
}

export function vertical_add(v1: Vertical, v2: Vertical): Vertical {
    if (v1.length === 0) return v2.slice();
    if (v2.length === 0) return v1.slice();
    const first2 = v2[0];
    let i = v1.length;
    while (i > 0 && compare(v1[i - 1], first2) < 0) i--;
    return v1.slice(0, i).concat(v2);
}

export function parents(m: Expr, V: Vertical[][]): [number, number][][] {
    const P: [number, number][][] = [];
    for (let i = 0; i < m.length; i++) {
        const Pi: [number, number][] = [];
        for (let j = 0; j < m[i].length; j++) {
            const [value] = m[i][j];
            const pos: Vertical = j === 0 ? [] : V[i][j - 1];
            let p = j === 0 ? i - 1 : Pi[j - 1][0];
            while (p >= 0) {
                if (m[p].length === 0) {
                    if (0 < value) {
                        Pi.push([p, 0]);
                        break;
                    }
                    p = -1;
                    break;
                }
                const j_p = j === 0 ? 0 : index_after(V[p], pos);
                if (j_p >= m[p].length) {
                    Pi.push([p, j_p]);
                    break;
                }
                const value_p = m[p][j_p][0];
                if (value_p < value) {
                    Pi.push([p, j_p]);
                    break;
                }
                const next = j === 0 ? [p - 1, 0] : vertical_parent(pos, P[p], V[p]);
                if (!next) {
                    p = -1;
                    break;
                }
                p = next[0];
            }
            if (p < 0) break;
        }
        P.push(Pi);
    }
    return P;
}

export function column_verticals(col: Column): Vertical[] {
    const result: Vertical[] = [];
    let acc: Vertical = [];
    for (const [, height_expr] of col) {
        acc = vertical_add(acc, [height_expr]);
        result.push(acc.slice());
    }
    return result;
}

export function is_one(expr: Expr): boolean {
    return expr.length === 1 && expr[0].length === 0;
}

export function to_vertical(m: Expr): Vertical {
    const v: Vertical = [];
    let prev = 0;
    for (let i = 1; i <= m.length; i++) {
        if (i === m.length || m[i].length === 0) {
            v.push(m.slice(prev, i));
            prev = i;
        }
    }
    return v;
}

export function expand_limit(m: Expr, index: number): Expr {
    const right = m.length - 1;
    const col = m[right];
    const last_idx = col.length - 1;
    const [v, h] = col[last_idx];
    const new_h = TBM.FS(h, index);
    const segs = to_vertical(new_h);
    const result = m.slice();
    const new_entries: Entry[] = col.slice(0, last_idx);
    for (const seg of segs) new_entries.push([v, seg]);
    result[right] = new_entries;
    return result;
}

function expand_successor(m: Expr, index: number): Expr {
    const V = m.map(column_verticals);
    const P = parents(m, V);
    const N = m.length - 1;
    const r = P[N][m[N].length - 1][0];
    const result = m.slice(0, N);

    const b: Vertical = m[N].length > 1 ? V[N][m[N].length - 2] : [];

    const offset: Column = column_sub(m[N], m[r]);

    const A = ascension_threshold(V, P, r, b);

    for (let w = 1; w <= index; w++) {
        for (let i = r; i < N; i++) {
            result.push(copy_column(m[i], offset, A[i], w));
        }
    }
    return result;
}

export function column_sub(a: Column, b: Column): Column {
    const off: Column = [];
    const Va = column_verticals(a);
    const Vb = column_verticals(b);
    for (let j = 0; j < a.length; j++) {
        const pos: Vertical = j === 0 ? [] : Va[j - 1];
        const j_r = index_after(Vb, pos);
        const delta = a[j][0] - (j_r < Vb.length ? b[j_r][0] : 0);
        if (delta <= 0) break;
        off.push([delta, a[j][1]]);
    }
    return off;
}

export function const_column(value: number, vertical: Vertical): Column {
    return vertical.map((s) => [value, s]);
}

export function ascension_threshold(V: Vertical[][], P: [number, number][][], r: number, b: Vertical): Vertical[] {
    const A: Vertical[] = [];
    for (let i = 0; i < V.length; i++) {
        if (i < r) {
            A.push([]);
            continue;
        }
        if (i === r) {
            A.push(b);
            continue;
        }
        let found: Vertical | undefined;
        for (let j = 0; j < V[i].length; j++) {
            const pos: Vertical = j === 0 ? [] : V[i][j - 1];
            const [col_p] = P[i][j];
            if (col_p < r) {
                found = pos;
                break;
            }
            if (vertical_compare(pos, A[col_p]) >= 0) {
                found = pos;
                break;
            }
            let new_pos = V[i][j];
            if (vertical_compare(new_pos, A[col_p]) >= 0) {
                found = A[col_p];
                break;
            }
        }
        A.push(found ?? V[i][V[i].length - 1]);
    }
    return A;
}

export function column_add(a: Column, b: Column): Column {
    const res: Column = [];
    let ai = 0,
        bi = 0;
    while (ai < a.length || bi < b.length) {
        if (ai >= a.length) {
            res.push([b[bi][0], b[bi][1]]);
            bi++;
        } else if (bi >= b.length) {
            res.push([a[ai][0], a[ai][1]]);
            ai++;
        } else {
            const ea = a[ai],
                eb = b[bi];
            const cmp = compare(ea[1], eb[1]);
            const h = cmp < 0 ? ea[1] : eb[1];
            res.push([ea[0] + eb[0], h]);
            if (cmp <= 0) ai++;
            if (cmp >= 0) bi++;
        }
    }
    return res;
}

export function column_truncate(col: Column, b: Vertical): Column {
    const res: Column = [];
    let ci = 0,
        vi = 0;
    while (ci < col.length && vi < b.length) {
        const e = col[ci];
        const vh = b[vi];
        const cmp = compare(e[1], vh);
        const h = cmp < 0 ? e[1] : vh;
        res.push([e[0], h]);
        if (cmp <= 0) ci++;
        if (cmp >= 0) vi++;
    }
    return res;
}

export function column_mul(col: Column, w: number): Column {
    return col.map(([v, e]) => [v * w, e]);
}

export function copy_column(col_i: Column, offset: Column, A_i: Vertical, w: number): Column {
    return column_add(col_i, column_mul(column_truncate(offset, A_i), w));
}

export function expand(m: Expr, index: number): Expr {
    if (m.length === 0) return m;
    const N = m.length - 1;
    const last_col = m[N];
    if (last_col.length === 0) return m.slice(0, N);
    const [, last_height] = last_col[last_col.length - 1];
    if (is_one(last_height)) {
        return expand_successor(m, index);
    } else {
        return expand_limit(m, index);
    }
}

export function is_infinity(a: Expr): boolean {
    return a.length > 0 && a[0].length > 0 && a[0][0][0] === Infinity;
}

export function ONE(): Expr {
    return [[]];
}

function OMEGA(): Expr {
    return [[], [[1, ONE()]]];
}

export function INFINITY(): Expr {
    return [[[Infinity, []]]];
}

// note-9 (tbms_t0y_design_9.md): 用 ε 原子终止固定点展开, 其余序数使用 CNF。
export type Ordinal = { kind: 'epsilon'; expr: Expr } | { kind: 'cnf'; terms: CnfTerm[] };

export interface CnfTerm {
    exponent: Ordinal;
    coefficient: bigint;
}

const ORD_ZERO: Ordinal = { kind: 'cnf', terms: [] };
const ORD_ONE: Ordinal = { kind: 'cnf', terms: [{ exponent: ORD_ZERO, coefficient: 1n }] };
// CNF 系数保持 bigint; 生成实际矩阵时检查 JavaScript 数组的长度上限。
const MAX_ARRAY_LENGTH = 0xffffffff;
const CNF_CACHE = new Map<string, Ordinal>();
const EPSILON_COMPARE_CACHE = new Map<string, number>();
const MAX_EPSILON_CACHE = new WeakMap<Ordinal, Ordinal | undefined>();
const T0Y_CACHE = new Map<string, Ordinal[]>();

function ord_terms(value: Ordinal): CnfTerm[] {
    // 仅临时提供 ε = ω^ε 的视图, AST 中不建立自指。
    return value.kind === 'epsilon' ? [{ exponent: value, coefficient: 1n }] : value.terms;
}

function ord_from_terms(terms: CnfTerm[]): Ordinal {
    if (terms.length === 0) return ORD_ZERO;
    if (terms.length === 1 && terms[0].coefficient === 1n && terms[0].exponent.kind === 'epsilon') {
        return terms[0].exponent;
    }
    return { kind: 'cnf', terms };
}

function ord_is_zero(value: Ordinal): boolean {
    return value.kind === 'cnf' && value.terms.length === 0;
}

function ord_natural(value: bigint): Ordinal {
    if (value < 0n) throw new Error('Negative ordinal');
    return value === 0n ? ORD_ZERO : ord_from_terms([{ exponent: ORD_ZERO, coefficient: value }]);
}

export function ord_compare(a: Ordinal, b: Ordinal): number {
    if (a === b) return 0;
    if (a.kind === 'epsilon' && b.kind === 'epsilon') {
        const key = JSON.stringify([a.expr, b.expr]);
        let result = EPSILON_COMPARE_CACHE.get(key);
        if (result === undefined) {
            result = compare(a.expr, b.expr);
            EPSILON_COMPARE_CACHE.set(key, result);
        }
        return result;
    }
    if (a.kind === 'epsilon') return -ord_compare(b, a);
    if (b.kind === 'epsilon') {
        if (a.terms.length === 0) return -1;
        const compared = ord_compare(a.terms[0].exponent, b);
        return compared || (a.terms.length === 1 && a.terms[0].coefficient === 1n ? 0 : 1);
    }
    for (let i = 0; i < Math.min(a.terms.length, b.terms.length); i++) {
        const compared = ord_compare(a.terms[i].exponent, b.terms[i].exponent);
        if (compared) return compared;
        if (a.terms[i].coefficient !== b.terms[i].coefficient) {
            return a.terms[i].coefficient < b.terms[i].coefficient ? -1 : 1;
        }
    }
    return Math.sign(a.terms.length - b.terms.length);
}

export function ord_add(a: Ordinal, b: Ordinal): Ordinal {
    const right = ord_terms(b);
    if (right.length === 0) return a;
    const left = ord_terms(a).slice();
    while (left.length && ord_compare(left[left.length - 1].exponent, right[0].exponent) < 0) left.pop();
    if (left.length && ord_compare(left[left.length - 1].exponent, right[0].exponent) === 0) {
        const last = left.pop()!;
        left.push({ exponent: last.exponent, coefficient: last.coefficient + right[0].coefficient });
        return ord_from_terms(left.concat(right.slice(1)));
    }
    return ord_from_terms(left.concat(right));
}

export function ord_pow_omega(exponent: Ordinal): Ordinal {
    return ord_from_terms([{ exponent, coefficient: 1n }]);
}

export function ord_mul(a: Ordinal, b: Ordinal): Ordinal {
    if (ord_is_zero(a) || ord_is_zero(b)) return ORD_ZERO;
    const left = ord_terms(a);
    let result = ORD_ZERO;
    for (const { exponent, coefficient } of ord_terms(b)) {
        const term = ord_is_zero(exponent)
            ? ord_from_terms([
                  { exponent: left[0].exponent, coefficient: left[0].coefficient * coefficient },
                  ...left.slice(1),
              ])
            : ord_from_terms([{ exponent: ord_add(left[0].exponent, exponent), coefficient }]);
        result = ord_add(result, term);
    }
    return result;
}

export function ord_tail_after(a: Ordinal, b: Ordinal): Ordinal {
    if (ord_compare(a, b) > 0) throw new Error('Negative ordinal tail');
    const left = ord_terms(a),
        right = ord_terms(b);
    let i = 0;
    while (
        i < left.length &&
        i < right.length &&
        ord_compare(left[i].exponent, right[i].exponent) === 0 &&
        left[i].coefficient === right[i].coefficient
    )
        i++;
    if (i === left.length) return ord_from_terms(right.slice(i));
    const compared = ord_compare(left[i].exponent, right[i].exponent);
    if (compared < 0) return ord_from_terms(right.slice(i));
    return ord_from_terms([
        { exponent: right[i].exponent, coefficient: right[i].coefficient - left[i].coefficient },
        ...right.slice(i + 1),
    ]);
}

export function ord_left_div_rem(dividend: Ordinal, divisor: Ordinal): { quotient: Ordinal; remainder: Ordinal } {
    if (ord_is_zero(divisor)) throw new Error('Ordinal division by zero');
    const leading = ord_terms(divisor)[0];
    let quotient = ORD_ZERO,
        remainder = dividend;
    while (ord_compare(remainder, divisor) >= 0) {
        const current = ord_terms(remainder)[0];
        let step: Ordinal;
        if (ord_compare(current.exponent, leading.exponent) > 0) {
            step = ord_from_terms([
                { exponent: ord_tail_after(leading.exponent, current.exponent), coefficient: current.coefficient },
            ]);
        } else {
            let count = current.coefficient / leading.coefficient;
            if (ord_compare(ord_mul(divisor, ord_natural(count)), remainder) > 0) count--;
            step = ord_natural(count);
        }
        quotient = ord_add(quotient, step);
        remainder = ord_tail_after(ord_mul(divisor, step), remainder);
    }
    return { quotient, remainder };
}

export function max_epsilon_atom(value: Ordinal): Ordinal | undefined {
    if (MAX_EPSILON_CACHE.has(value)) return MAX_EPSILON_CACHE.get(value);
    let result: Ordinal | undefined;
    if (value.kind === 'epsilon') result = value;
    else
        for (const term of value.terms) {
            const atom = max_epsilon_atom(term.exponent);
            if (atom !== undefined && (result === undefined || ord_compare(atom, result) > 0)) result = atom;
        }
    MAX_EPSILON_CACHE.set(value, result);
    return result;
}

function materialized_count(coefficient: bigint, width: number, previous: number = 0): number {
    if (coefficient * BigInt(width) + BigInt(previous) > BigInt(MAX_ARRAY_LENGTH)) {
        throw new RangeError('TBMS materialization exceeds the JavaScript array length limit');
    }
    return Number(coefficient);
}

export function cnf_to_tbms(value: Ordinal): Expr {
    if (value.kind === 'epsilon') return structuredClone(value.expr);
    const result: Expr = [];
    for (const { exponent, coefficient } of value.terms) {
        const atom = max_epsilon_atom(exponent);
        const prefix = atom?.kind === 'epsilon' ? atom.expr : ONE();
        const tail = atom === undefined ? exponent : ord_tail_after(atom, exponent);
        const block = prefix.concat(shift_first_row(cnf_to_tbms(tail), 1));
        const count = materialized_count(coefficient, block.length, result.length);
        for (let i = 0; i < count; i++) {
            for (const col of block) result.push(structuredClone(col));
        }
    }
    return result;
}

export function normalize_column(col: Column): Column {
    const result: Column = [];
    for (let i = 0; i < col.length;) {
        const value = col[i][0];
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid TBMS entry');
        let height = ORD_ZERO;
        do {
            const next = tbms_to_cnf(col[i][1]);
            if (ord_is_zero(next)) throw new Error('Zero TBMS height');
            height = ord_add(height, next);
            i++;
        } while (i < col.length && col[i][0] === value);
        for (const { exponent, coefficient } of ord_terms(height)) {
            const segment = cnf_to_tbms(ord_pow_omega(exponent));
            const count = materialized_count(coefficient, 1, result.length);
            for (let j = 0; j < count; j++) result.push([value, segment]);
        }
    }
    while (result.length && result[result.length - 1][0] === 0) result.pop();
    return result;
}

export function shift_first_row(expr: Expr, delta: 1 | -1): Expr {
    return expr.map((input) => {
        const col = normalize_column(input);
        if (col.length === 0) {
            if (delta < 0) throw new Error('Negative first row');
            return [[1, ONE()]];
        }
        const [value, height] = col[0];
        if (value + delta < 0) throw new Error('Negative first row');
        const first: Entry = [value + delta, ONE()];
        const shifted = normalize_column([first, ...(is_one(height) ? col.slice(1) : col)]);
        if (shifted.length && shifted[0][0] === 0) throw new Error('Invalid zero first row');
        return shifted;
    });
}

export function tbms_to_cnf(expr: Expr): Ordinal {
    if (is_infinity(expr)) throw new Error('Limit is not a CNF ordinal');
    const key = JSON.stringify(expr);
    const cached = CNF_CACHE.get(key);
    if (cached !== undefined) return cached;
    const normalized = expr.map(normalize_column);
    if (normalized.length && normalized[0].length) throw new Error('TBMS ordinal must start with an empty column');
    let result = ORD_ZERO;
    for (const block of to_vertical(normalized)) {
        let value: Ordinal;
        if (is_one(block)) value = ORD_ONE;
        else {
            const epsilon_column: Column = [
                [1, ONE()],
                [1, ONE()],
            ];
            const boundary = block.findIndex((col, i) => i > 0 && column_compare(col, epsilon_column) < 0);
            if (boundary === -1) value = { kind: 'epsilon', expr: block };
            else {
                if (column_compare(block[boundary], [[1, ONE()]]) !== 0) throw new Error('Invalid TBMS ordinal block');
                const prefix: Ordinal = boundary === 1 ? ORD_ZERO : { kind: 'epsilon', expr: block.slice(0, boundary) };
                const tail = tbms_to_cnf(shift_first_row(block.slice(boundary), -1));
                value = ord_pow_omega(ord_add(prefix, tail));
            }
        }
        result = ord_add(result, value);
    }
    CNF_CACHE.set(key, result);
    return result;
}

function prepare_t0y_data(expr: Expr) {
    if (is_infinity(expr)) throw new Error('Limit has no finite T0Y sequence');
    const matrix = expr.map(normalize_column);
    const verticals = matrix.map(column_verticals);
    const parent_data = parents(matrix, verticals);
    const ends = matrix.map((col) => {
        let height = ORD_ZERO;
        return col.map(([, segment]) => (height = ord_add(height, tbms_to_cnf(segment))));
    });
    const sorted = [ORD_ZERO, ...ends.flat()].sort(ord_compare);
    const boundaries = sorted.filter((value, i) => i === 0 || ord_compare(value, sorted[i - 1]) !== 0);
    return { matrix, parent_data, ends, boundaries };
}

export function compute_t0y_cnf(expr: Expr): Ordinal[] {
    const key = JSON.stringify(expr);
    const cached = T0Y_CACHE.get(key);
    if (cached !== undefined) return cached.slice();
    const { matrix, parent_data, ends, boundaries } = prepare_t0y_data(expr);
    let rank = matrix.map(() => ORD_ZERO);
    let blocks = 0;
    for (let k = boundaries.length - 1; k > 0; k--) {
        const start = boundaries[k - 1];
        const block_parents = ends.map((col, i) => {
            const j = col.findIndex((end) => ord_compare(end, start) > 0);
            if (j === -1) return undefined;
            const parent = parent_data[i][j]?.[0];
            if (parent === undefined) throw new Error('Missing TBMS parent');
            return parent;
        });
        // 从高到低处理主块; 有限长度 n 必须拆为 n 个长度 1 的块。
        const terms = ord_terms(ord_tail_after(start, boundaries[k]));
        for (let j = terms.length - 1; j >= 0; j--) {
            const length = ord_pow_omega(terms[j].exponent);
            const count = materialized_count(terms[j].coefficient, 1, blocks);
            blocks += count;
            for (let repetition = 0; repetition < count; repetition++) {
                const old_rank = rank;
                rank = [];
                for (let i = 0; i < matrix.length; i++) {
                    const parent = block_parents[i];
                    rank.push(
                        parent === undefined
                            ? ORD_ZERO
                            : ord_add(ord_mul(ord_add(rank[parent], ORD_ONE), length), old_rank[i]),
                    );
                }
            }
        }
    }
    // 计数是 1 + R, 不能把左侧的 1 改成后继。
    const result = rank.map((value) => ord_add(ORD_ONE, value));
    T0Y_CACHE.set(key, result);
    return result.slice();
}

export function convert_to_t0y(expr: Expr): Expr[] {
    return compute_t0y_cnf(expr).map(cnf_to_tbms);
}

export interface T0yInverseBand {
    start: Ordinal;
    end: Ordinal;
    length: Ordinal;
    values: number[];
    parents: (number | undefined)[];
    tail_ranks: Ordinal[];
}

export function prepare_t0y_inverse_bands(prefix: Expr): T0yInverseBand[] {
    const { matrix, parent_data, ends, boundaries } = prepare_t0y_data(prefix);
    const bands: T0yInverseBand[] = [];
    for (let k = 0; k + 1 < boundaries.length; k++) {
        let start = boundaries[k];
        const indexes = ends.map((col) => col.findIndex((end) => ord_compare(end, start) > 0));
        const values = indexes.map((j, i) => (j < 0 ? 0 : matrix[i][j][0]));
        const block_parents = indexes.map((j, i) => {
            if (j < 0) return undefined;
            const parent = parent_data[i][j]?.[0];
            if (parent === undefined) throw new Error('Missing TBMS parent');
            return parent;
        });
        for (const { exponent, coefficient } of ord_terms(ord_tail_after(start, boundaries[k + 1]))) {
            const length = ord_pow_omega(exponent);
            const count = materialized_count(coefficient, 1, bands.length);
            for (let repetition = 0; repetition < count; repetition++) {
                const end = ord_add(start, length);
                bands.push({ start, end, length, values, parents: block_parents, tail_ranks: [] });
                start = end;
            }
        }
    }
    let rank = matrix.map(() => ORD_ZERO);
    for (let k = bands.length - 1; k >= 0; k--) {
        const band = bands[k],
            old_rank = rank;
        rank = [];
        for (let i = 0; i < matrix.length; i++) {
            const parent = band.parents[i];
            rank.push(
                parent === undefined
                    ? ORD_ZERO
                    : ord_add(ord_mul(ord_add(rank[parent], ORD_ONE), band.length), old_rank[i]),
            );
        }
        band.tail_ranks = rank;
    }
    return bands;
}

// note-9 (t0y_tbms_inverse_design_9.md): invert the whole sequence by constant row bands.
export function t0y_cnf_to_tbms(sequence: Ordinal[]): Expr {
    if (sequence.length > 0 && ord_compare(sequence[0], ORD_ONE) !== 0)
        throw new Error('A T0Y sequence must start with 1');
    if (sequence.some((value) => ord_compare(value, ORD_ONE) < 0)) throw new Error('T0Y entries must be positive');
    const matrix: Expr = [];
    for (const value of sequence) {
        const target = ord_tail_after(ORD_ONE, value);
        if (ord_is_zero(target)) {
            matrix.push([]);
            continue;
        }
        const bands = prepare_t0y_inverse_bands(matrix);
        const segments: [number, Ordinal][] = [];
        let row = ORD_ZERO,
            spent = ORD_ZERO;
        let parent: number | undefined = matrix.length - 1;
        let band_index = 0;
        while (ord_compare(spent, target) < 0) {
            const remaining = ord_tail_after(spent, target);
            if (band_index === bands.length) {
                segments.push([1, remaining]);
                break;
            }
            const band = bands[band_index];
            // Keep the previously chosen parent when advancing to the next band.
            while (parent !== undefined && ord_compare(band.tail_ranks[parent], remaining) >= 0)
                parent = band.parents[parent];
            if (parent === undefined) throw new Error('Missing T0Y inverse parent');
            const weight = ord_add(band.tail_ranks[parent], ORD_ONE);
            const { quotient } = ord_left_div_rem(remaining, weight);
            const available = ord_tail_after(row, band.end);
            const length = ord_compare(quotient, available) <= 0 ? quotient : available;
            segments.push([band.values[parent] + 1, length]);
            spent = ord_add(spent, ord_mul(weight, length));
            row = ord_add(row, length);
            if (ord_compare(row, band.end) === 0) band_index++;
        }
        matrix.push(normalize_column(segments.map(([entry, length]) => [entry, cnf_to_tbms(length)])));
    }
    return matrix;
}

export function convert_from_t0y(sequence: Expr[]): Expr {
    return t0y_cnf_to_tbms(sequence.map(tbms_to_cnf));
}

export function display_small_cnf(value: Ordinal, html: boolean = false): string {
    if (value.kind === 'epsilon') throw new Error('Not a small CNF ordinal');
    if (value.terms.length === 0) return '0';
    return value.terms
        .map(({ exponent, coefficient }) => {
            if (ord_is_zero(exponent)) return '' + coefficient;
            let term = 'ω';
            if (ord_compare(exponent, ORD_ONE) !== 0) {
                const power = display_small_cnf(exponent, html);
                term += html ? '<sup>' + power + '</sup>' : '^' + (/^\d+$|^ω$/.test(power) ? power : '{' + power + '}');
            }
            return term + (coefficient === 1n ? '' : '·' + coefficient);
        })
        .join('+');
}

export function display_ordinal(value: Ordinal, html: boolean = false): string {
    return max_epsilon_atom(value) === undefined ? display_small_cnf(value, html) : display(cnf_to_tbms(value), html);
}

export function display_as_t0y(expr: Expr, html: boolean = false): string {
    if (is_infinity(expr)) return 'Limit';
    return compute_t0y_cnf(expr)
        .map((value) => display_ordinal(value, html))
        .join(',');
}

function height_display(s: Expr, html: boolean): string | undefined {
    if (is_one(s)) return undefined;
    if (is_infinity(s)) return 'Limit';
    return display_ordinal(tbms_to_cnf(s), html);
}

function entry_display([v, s]: Entry, html: boolean): string {
    let sd = height_display(s, html);
    if (sd === undefined) return '' + v;
    if (html) return v + '<sup>' + sd + '</sup>';
    return v + '^' + (/^\d+$|^ω$|^Limit$/.test(sd) ? sd : '{' + sd + '}');
}

function column_display(col: Column, html: boolean): string {
    return '(' + col.map((e) => entry_display(e, html)).join(',') + ')';
}

export function display(m: Expr, html: boolean = false): string {
    if (is_infinity(m)) return 'Limit';
    return m.map((col) => column_display(col, html)).join('');
}

function parse_display(str: string, as_ordinal: true): Ordinal;
function parse_display(str: string, as_ordinal?: false): Expr;
function parse_display(str: string, as_ordinal: boolean = false): Expr | Ordinal {
    let i = 0;
    const s = str;

    function error(): never {
        throw new Error(`Illegal input string: ${s}`);
    }

    function skip_spaces(): void {
        while (i < s.length && /\s/.test(s[i])) i++;
    }

    function parse_natural(): bigint {
        skip_spaces();
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return BigInt(s.substring(start, i));
    }

    function parse_number(): number {
        const value = Number(parse_natural());
        if (!Number.isSafeInteger(value)) error();
        return value;
    }

    function parse_expr(): Expr {
        const result: Expr = [];
        skip_spaces();
        while (i < s.length && s[i] === '(') {
            result.push(parse_column());
            skip_spaces();
        }
        return result;
    }

    function parse_column(): Column {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;

        const entries: Entry[] = [];
        skip_spaces();
        if (i < s.length && s[i] !== ')') {
            entries.push(parse_entry());
            skip_spaces();
            while (i < s.length && s[i] === ',') {
                i++;
                skip_spaces();
                if (i < s.length && s[i] === ')') break;
                entries.push(parse_entry());
                skip_spaces();
            }
        }

        skip_spaces();
        if (i >= s.length || s[i] !== ')') error();
        i++;

        return normalize_column(entries);
    }

    function parse_cnf_power(): Ordinal {
        skip_spaces();
        if (s[i] === '(' || s[i] === '{') {
            const closing = s[i++] === '(' ? ')' : '}';
            const value = parse_cnf();
            skip_spaces();
            if (s[i] !== closing) error();
            i++;
            return value;
        }
        if (s[i] !== 'ω' && s[i] !== 'w') return ord_natural(parse_natural());
        i++;
        skip_spaces();
        if (s[i] !== '^') return tbms_to_cnf(OMEGA());
        i++;
        return ord_pow_omega(parse_cnf_power());
    }

    function parse_cnf_term(): Ordinal {
        skip_spaces();
        const implicit_coefficient = s[i] === 'ω' || s[i] === 'w';
        const value = parse_cnf_power();
        skip_spaces();
        if (s[i] === '·' || s[i] === '*') {
            i++;
            return ord_mul(value, ord_natural(parse_natural()));
        }
        if (implicit_coefficient && s[i] >= '0' && s[i] <= '9') return ord_mul(value, ord_natural(parse_natural()));
        return value;
    }

    function parse_cnf(): Ordinal {
        let value = parse_cnf_term();
        skip_spaces();
        while (s[i] === '+') {
            i++;
            value = ord_add(value, parse_cnf_term());
            skip_spaces();
        }
        return value;
    }

    function parse_ordinal(): Ordinal {
        skip_spaces();
        const braced = s[i] === '{';
        if (braced) {
            i++;
            skip_spaces();
        }
        // 空列或数字开头的圆括号保留旧 TBMS 上标语法; CNF 的指数括号由 parse_cnf 处理。
        let next = i + 1;
        while (next < s.length && /\s/.test(s[next])) next++;
        const matrix = s[i] === '(' && (s[next] === ')' || (s[next] >= '0' && s[next] <= '9'));
        const value = matrix ? tbms_to_cnf(parse_expr()) : parse_cnf();
        skip_spaces();
        if (braced) {
            if (s[i] !== '}') error();
            i++;
        }
        return value;
    }

    function parse_height(): Expr {
        const value = parse_ordinal();
        if (ord_is_zero(value)) error();
        return cnf_to_tbms(value);
    }

    function parse_entry(): Entry {
        const v = parse_number();
        skip_spaces();
        if (i < s.length && s[i] === '^') {
            i++;
            return [v, parse_height()];
        }
        return [v, ONE()];
    }

    skip_spaces();
    if (i + 5 <= s.length && s.slice(i, i + 5) === 'Limit') {
        if (as_ordinal) error();
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY();
    }

    const result = as_ordinal ? parse_ordinal() : parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

export function from_display(str: string): Expr {
    return parse_display(str);
}

export function from_display_as_t0y(str: string): Expr {
    const s = str.trim();
    if (s === '') return [];
    if (s === 'Limit') return INFINITY();
    const sequence: Ordinal[] = [];
    const closing: string[] = [];
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(' || s[i] === '{') closing.push(s[i] === '(' ? ')' : '}');
        else if (s[i] === ')' || s[i] === '}') {
            if (closing.pop() !== s[i]) throw new Error('Mismatched T0Y brackets');
        } else if (s[i] === ',' && closing.length === 0) {
            sequence.push(parse_display(s.slice(start, i), true));
            start = i + 1;
        }
    }
    if (closing.length > 0) throw new Error('Unclosed T0Y brackets');
    sequence.push(parse_display(s.slice(start), true));
    return t0y_cnf_to_tbms(sequence);
}

export function infinity_FS(index: number): Expr {
    if (index === 0) return [[]];
    return [[], [[1, infinity_FS(index - 1)]]];
}

function is_limit(m: Expr) {
    if (is_infinity(m)) return true;
    if (m.length === 0) return false;
    return m[m.length - 1].length > 0;
}

export const TBM: NotationDefinition<Expr> = {
    id: 'tbm',
    name: 'Transfinite Bashicu matrix',
    simple_name: 'TBMS',
    category_id: 'category-bm-like',
    display: {
        plain: (m) => display(m, false),
        html: (m) => display(m, true),
        from_display,
    },
    display_equiv: {
        T0Y: {
            plain: (m) => display_as_t0y(m, false),
            html: (m) => display_as_t0y(m, true),
            from_display: from_display_as_t0y,
        },
    },
    is_limit: is_limit,
    compare,

    ...FS_default_LNZ_variant(expand, compare, is_infinity, infinity_FS, is_limit, (m) => JSON.stringify(m)),

    credit_text_id: 'credit.tbm',

    init: (): Expr[] => {
        return [INFINITY(), []];
    },
};
