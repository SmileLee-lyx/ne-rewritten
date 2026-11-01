import type { NotationDefinition } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { lex_compare } from '@/utils.ts';

// note-9: tsomega_tomegay_final_9.md，有限区域计数与自身矩阵 CNF。
// 内部高行标递归保存普通域矩阵；CNF 只用于序数运算、计数和显示。
export type HeightPos = Expr;
export type HeightEntry = [number, HeightPos];
export type Height = HeightEntry[];
export type Entry = [number, Height];
export type Column = Entry[];
export type Expr = Column[];
export type Ordinal = { kind: 'epsilon'; expr: Expr } | { kind: 'cnf'; terms: CnfTerm[] };
export interface CnfTerm {
    exponent: Ordinal;
    coefficient: bigint;
}
type DisplayType = 'plain' | 'html' | 'latex';
export type FsVariant = 'FS' | 'FS_alter' | 'FS_short' | 'fast';

const INFINITY = Infinity as unknown as Expr;
export const ORD_ZERO: Ordinal = { kind: 'cnf', terms: [] };
export const ORD_ONE: Ordinal = { kind: 'cnf', terms: [{ exponent: ORD_ZERO, coefficient: 1n }] };
const ORD_OMEGA = ord_pow_omega(ORD_ONE);
const LOW: Expr = [[], [[0, [[0, []]]]]];
// 这些是物化资源限制，不是标准性判据；超限时明确报告资源不足。
const MAX_MATERIALIZED_LENGTH = 100_000;
const MAX_INVERSE_STEPS = 100_000;
const CNF_CACHE = new WeakMap<Expr, Ordinal>();
const ORDINAL_CACHE = new WeakMap<Expr, Ordinal>();
const MAX_EPSILON_CACHE = new WeakMap<Ordinal, Ordinal | undefined>();

export function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

export function is_limit(expr: Expr): boolean {
    return is_infinity(expr) || (expr.length > 0 && expr[expr.length - 1].length > 0);
}

export function compare_height(a: Height, b: Height): number {
    return lex_compare(a, b, (x, y) => Math.sign(x[0] - y[0]) || compare(x[1], y[1]), false);
}

function compare_entry(a: Entry, b: Entry): number {
    return Math.sign(a[0] - b[0]) || compare_height(a[1], b[1]);
}

export function compare_column(a: Column, b: Column): number {
    return lex_compare(a, b, compare_entry);
}

export function compare(a: Expr, b: Expr): number {
    if (a === b) return 0;
    if (is_infinity(a)) return 1;
    if (is_infinity(b)) return -1;
    return lex_compare(a, b, compare_column);
}

function ord_terms(value: Ordinal): CnfTerm[] {
    // 临时视图 ε = ω^ε；不在有限 AST 内建立自指。
    return value.kind === 'epsilon' ? [{ exponent: value, coefficient: 1n }] : value.terms;
}

function ord_from_terms(terms: CnfTerm[]): Ordinal {
    if (!terms.length) return ORD_ZERO;
    if (terms.length === 1 && terms[0].coefficient === 1n && terms[0].exponent.kind === 'epsilon') {
        return terms[0].exponent;
    }
    return { kind: 'cnf', terms };
}

function ord_is_zero(value: Ordinal): boolean {
    return value.kind === 'cnf' && value.terms.length === 0;
}

export function ord_natural(value: bigint): Ordinal {
    if (value < 0n) throw new Error('Negative ordinal');
    return value === 0n ? ORD_ZERO : ord_from_terms([{ exponent: ORD_ZERO, coefficient: value }]);
}

export function ord_compare(a: Ordinal, b: Ordinal): number {
    if (a === b) return 0;
    if (a.kind === 'epsilon' && b.kind === 'epsilon') return compare(a.expr, b.expr);
    if (a.kind === 'epsilon') return -ord_compare(b, a);
    if (b.kind === 'epsilon') {
        if (!a.terms.length) return -1;
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
    if (!right.length) return a;
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

// 返回 a + delta = b 的右侧余差，不能交换加法的两项。
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
    if (i === left.length || ord_compare(left[i].exponent, right[i].exponent) < 0) {
        return ord_from_terms(right.slice(i));
    }
    return ord_from_terms([
        { exponent: right[i].exponent, coefficient: right[i].coefficient - left[i].coefficient },
        ...right.slice(i + 1),
    ]);
}

export function ord_is_limit(value: Ordinal): boolean {
    const terms = ord_terms(value);
    return terms.length > 0 && !ord_is_zero(terms[terms.length - 1].exponent);
}

function max_epsilon_atom(value: Ordinal): Ordinal | undefined {
    if (MAX_EPSILON_CACHE.has(value)) return MAX_EPSILON_CACHE.get(value);
    let result: Ordinal | undefined;
    if (value.kind === 'epsilon') result = value;
    else
        for (const term of value.terms) {
            const atom = max_epsilon_atom(term.exponent);
            if (atom && (!result || ord_compare(atom, result) > 0)) result = atom;
        }
    MAX_EPSILON_CACHE.set(value, result);
    return result;
}

function materialized_count(count: bigint, width: number = 1, previous: number = 0): number {
    if (count * BigInt(width) + BigInt(previous) > BigInt(MAX_MATERIALIZED_LENGTH)) {
        throw new RangeError('TSωDBMS materialization resource limit exceeded');
    }
    return Number(count);
}

function height(col: Column): Height | undefined {
    return col[col.length - 1]?.[1];
}

function merge_column(a: Column, b: Column): Column {
    const h = height(a);
    return a.concat(h ? b.filter(([, k]) => compare_height(k, h) > 0) : b);
}

function predecessor(position: Expr): Expr {
    if (!position.length || is_limit(position)) throw new Error('Expected a successor position');
    return position.slice(0, -1);
}

export function height_fill_dec(h: Height, position: HeightPos, anchor: number): Height {
    const result = h.slice();
    while (result.length && compare(result[result.length - 1][1], position) <= 0) result.pop();
    if (result[result.length - 1]?.[0] === anchor) result.pop();
    result.push([anchor, position]);
    return result;
}

export function compute_new_height(h: Height, expr: Expr, root: number): Height | undefined {
    const [anchor, position] = h[h.length - 1];
    if (position.length) return height_fill_dec(h, predecessor(position), root);
    if (h.length === 1) return height(expr[anchor]);
    const bound = h[h.length - 2][1],
        col = expr[anchor];
    const j = col.findIndex(([, cap]) => compare_height(h, cap) <= 0);
    if (j < 0) return height(col);
    let result = height_fill_dec(h, predecessor(bound), col[j][0]);
    if (j > 0 && compare_height(col[j - 1][1], result) > 0) result = col[j - 1][1];
    return result;
}

function root_components(expr: Expr): Expr[] {
    if (is_infinity(expr) || (expr.length && expr[0].length)) throw new Error('Invalid TSωDBMS scalar');
    const roots = expr.flatMap((col, i) => (col.length ? [] : [i]));
    return roots.map((start, i) => slice_component(expr, start, roots[i + 1]));
}

export function matrix_add(a: Expr, b: Expr): Expr {
    const left = root_components(a),
        right = root_components(b);
    if (!right.length) return a;
    while (left.length && compare(left[left.length - 1], right[0]) < 0) left.pop();
    return concatenate(left.concat(right));
}

export function matrix_tail(a: Expr, b: Expr): Expr {
    if (compare(a, b) > 0) throw new Error('Negative TSωDBMS scalar tail');
    const left = root_components(a),
        right = root_components(b);
    let k = 0;
    while (k < left.length && k < right.length && compare(left[k], right[k]) === 0) k++;
    return concatenate(right.slice(k));
}

export function height_fs(value: Expr, index: number, variant: FsVariant = 'FS'): Expr {
    return fundamental_sequence(value, index, variant);
}

function limit_approximation(h: Height, lower: Height | undefined, index: number, variant: FsVariant): Height {
    const [anchor, alpha] = h[h.length - 1],
        prefix = h.slice(0, -1);
    const zero_cap: Height = [...prefix, [anchor, []]];
    let beta: Expr = [];
    if (lower && compare_height(zero_cap, lower) <= 0) {
        if (
            lower.length < h.length ||
            lower[prefix.length][0] !== anchor ||
            prefix.some(([a, position], i) => a !== lower[i][0] || compare(position, lower[i][1]) !== 0)
        ) {
            throw new Error('Invalid TSωDBMS limit prefix');
        }
        beta = lower[prefix.length][1];
        if (compare(beta, alpha) >= 0) throw new Error('Invalid TSωDBMS limit interval');
    }
    const difference = beta.length ? matrix_tail(beta, alpha) : alpha;
    const approximation = height_fs(difference, index, variant);
    if (!approximation.length) throw new Error('Zero limit approximation');
    return [...prefix, [anchor, beta.length ? matrix_add(beta, approximation) : approximation]];
}

export function expand(
    expr: Expr,
    index: number,
    shorter: boolean = true,
    variant: FsVariant = shorter ? 'FS' : 'FS_alter',
): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    if (is_infinity(expr)) return infinity_FS(index);
    if (!expr.length) return expr;
    const right = expr.length - 1,
        col = expr[right];
    if (!col.length) return expr.slice(0, -1);
    const [root, h] = col[col.length - 1];
    let replacement = col.slice(0, -1);
    if (is_limit(h[h.length - 1][1])) {
        replacement.push([root, limit_approximation(h, height(replacement), index, variant)]);
        return expr.slice(0, -1).concat([replacement]);
    }
    const next = compute_new_height(h, expr, root);
    if (next) replacement = merge_column(replacement, [[root, next]]);
    replacement = merge_column(replacement, expr[root]);
    materialized_count(BigInt(index), right - root, expr.length);
    const result = expr.slice(0, -1).concat([replacement]);
    for (let w = 1; w <= index; w++) {
        for (let i = root + 1; i <= right; i++) {
            result.push(remap_column(result[i], (n) => (n >= root ? n + (right - root) * w : n)));
        }
    }
    if (shorter) result.pop();
    return result;
}

export function infinity_FS(index: number): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    materialized_count(BigInt(index));
    let result = LOW;
    for (let n = 0; n < index; n++) result = [[], [[0, [[0, result]]]]];
    return result;
}

function truncate(expr: Expr): Expr {
    const right = expr.length - 1,
        top = expr[right].length - 1;
    const result = expand(expr, 0, false);
    if (result[right].length <= top) return result;
    result[right] = result[right].slice(0, result[right][top][0] === expr[right][top][0] ? top + 1 : top);
    return result;
}

function pure_low(col: Column): boolean {
    return col.length === 1 && col[0][1].length === 1 && col[0][1][0][0] === 0 && col[0][1][0][1].length === 0;
}
// 普通域与 125 相对域之间只运输有限父、锚引用，高行标原样保留。
function low_column(col: Column, parent: number): boolean {
    return pure_low(col) && col[0][0] === parent;
}

function remap_column(
    col: Column,
    map_parent: (n: number) => number,
    map_anchor: (n: number, level: Expr) => number = map_parent,
): Column {
    return col.map(([p, h]) => [map_parent(p), h.map(([a, position]) => [map_anchor(a, position), position])]);
}

function shift_column(col: Column, offset: number): Column {
    return remap_column(col, (n) => n + offset);
}

function slice_component(expr: Expr, start: number, end: number = expr.length): Expr {
    return expr.slice(start, end).map((col) => shift_column(col, -start));
}

function concatenate(parts: Expr[]): Expr {
    const result: Expr = [];
    for (const part of parts) {
        const offset = result.length;
        materialized_count(1n, part.length, offset);
        for (const col of part) result.push(shift_column(col, offset));
    }
    return result;
}

function tail_template(expr: Expr, cut: number): Expr {
    const map = (n: number) => {
        if (n !== 0 && n < cut) throw new Error('Invalid TSωDBMS product reference');
        return n === 0 ? 0 : n - cut + 1;
    };
    return [[], ...expr.slice(cut).map((col) => remap_column(col, map))];
}

function root_substitute(head: Expr, template: Expr): Expr {
    const result: Expr = [],
        mapping: number[] = [];
    for (let i = 0; i < template.length; i++) {
        mapping[i] = result.length;
        if (!template[i].length) {
            const offset = result.length;
            materialized_count(1n, head.length, offset);
            for (const col of head) result.push(shift_column(col, offset));
        } else result.push(remap_column(template[i], (n) => mapping[n]));
    }
    return result;
}

function clean_matrix_padding(expr: Expr): Expr {
    const result: Expr = [[], [[0, [[0, []]]]], ...expr.slice(1).map((col) => shift_column(col, 1))];
    const last = expr[expr.length - 1];
    if (pure_low(last)) result[result.length - 1][0][1][0][0] = 0;
    return result;
}

function convert_matrix_one(expr: Expr, to_relative: boolean): Expr {
    if (expr.length === 1) return expr;
    if (to_relative) {
        if (low_column(expr[1], 0)) return expr;
        const cut = expr.findIndex((col, i) => i > 0 && low_column(col, 0));
        if (cut < 0) return clean_matrix_padding(expr);
        const head = clean_matrix_padding(expr.slice(0, cut)),
            tail = tail_template(expr, cut);
        const threshold = head.concat([[[1, [[0, []]]]]]);
        return compare(tail, threshold) < 0 ? root_substitute(head, tail) : tail;
    }
    if (!low_column(expr[1], 0)) throw new Error('Invalid TSωDBMS relative prefix');
    const bound: Expr = [[], [[0, [[0, []]]]], [[1, [[1, [[]]]]]]];
    if (compare(expr, bound) < 0) return expr;
    let cut = expr.findIndex((col, i) => i >= 2 && low_column(col, 0));
    if (cut < 0) cut = expr.length;
    const prefix = expr.slice(0, cut),
        restored: Expr = [[]];
    let gap = false;
    for (let i = 2; i < prefix.length; i++) {
        const col = prefix[i],
            last = i === prefix.length - 1;
        if (col.every(([p, h]) => p >= 1 && h.every(([a]) => a >= 1))) {
            const candidate = shift_column(col, -1);
            const corrected_last = last && pure_low(candidate);
            if (!low_column(candidate, 0) && !corrected_last) {
                restored.push(candidate);
                continue;
            }
        }
        if (last && pure_low(col) && col[0][0] > 1) {
            restored.push([[col[0][0] - 1, [[0, []]]]]);
            continue;
        }
        const parent = col[0][0] - 1;
        if (parent > 0) restored.push([[parent, [[0, []]]]]);
        gap = true;
        break;
    }
    if (gap) return root_substitute(restored, expr);
    return cut === expr.length ? restored : root_substitute(restored, tail_template(expr, cut));
}

export function convert_matrix(expr: Expr, to_relative: boolean): Expr {
    const roots = expr.flatMap((col, i) => (col.length ? [] : [i]));
    const parts = roots.map((start, i) => convert_matrix_one(slice_component(expr, start, roots[i + 1]), to_relative));
    parts.sort((a, b) => -compare(a, b));
    return concatenate(parts);
}

function suspend(head: Expr, template: Expr): Expr {
    const offset = head.length - 1;
    return head.concat(
        template.slice(1).map((col) =>
            remap_column(
                col,
                (p) => (p === 0 ? 1 : p + offset),
                (a, level) => (a === 0 && level.length === 0 ? 0 : a + offset),
            ),
        ),
    );
}

function unsuspend(expr: Expr, cut: number): Expr {
    return [
        [],
        ...expr.slice(cut).map((col) =>
            remap_column(
                col,
                (p) => {
                    if (p !== 1 && p < cut) throw new Error('Invalid TSωDBMS suspension parent');
                    return p === 1 ? 0 : p - cut + 1;
                },
                (a, level) => {
                    if (a === 0 && level.length === 0) return 0;
                    if (a < cut) throw new Error('Invalid TSωDBMS suspension anchor');
                    return a - cut + 1;
                },
            ),
        ),
    ];
}

function relative_to_cnf(expr: Expr): Ordinal {
    const cached = CNF_CACHE.get(expr);
    if (cached) return cached;
    let result: Ordinal;
    if (!expr.length) result = ORD_ZERO;
    else if (expr.length === 1) result = ORD_ONE;
    else {
        const roots = expr.flatMap((col, i) => (col.length ? [] : [i]));
        if (roots.length > 1) {
            result = ORD_ZERO;
            for (let j = 0; j < roots.length; j++)
                result = ord_add(result, relative_to_cnf(slice_component(expr, roots[j], roots[j + 1])));
        } else {
            if (!low_column(expr[1], 0)) throw new Error('Invalid TSωDBMS relative prefix');
            const two = expr.findIndex((col, i) => i >= 2 && low_column(col, 0));
            if (two >= 0)
                result = ord_mul(relative_to_cnf(expr.slice(0, two)), relative_to_cnf(tail_template(expr, two)));
            else if (expr.length === 2) result = ORD_OMEGA;
            else {
                const three = expr.findIndex((col, i) => i >= 2 && low_column(col, 1));
                if (three < 0) result = { kind: 'epsilon', expr };
                else {
                    const head: Ordinal = three === 2 ? ORD_ONE : { kind: 'epsilon', expr: expr.slice(0, three) };
                    result = ord_pow_omega(ord_mul(head, relative_to_cnf(unsuspend(expr, three))));
                }
            }
        }
    }
    CNF_CACHE.set(expr, result);
    return result;
}

function relative_from_cnf(value: Ordinal): Expr {
    if (value.kind === 'epsilon') return value.expr;
    const blocks: Expr[] = [];
    let length = 0;
    for (const term of value.terms) {
        const block = relative_power(term.exponent);
        const count = materialized_count(term.coefficient, block.length, length);
        for (let j = 0; j < count; j++) blocks.push(block);
        length += block.length * count;
    }
    return concatenate(blocks);
}

function relative_power(exponent: Ordinal): Expr {
    if (exponent.kind === 'epsilon') return exponent.expr;
    if (!exponent.terms.length) return [[]];
    if (exponent.terms.length > 1 || exponent.terms[0].coefficient > 1n) {
        let result: Expr = [[]];
        for (const term of exponent.terms) {
            const factor = relative_power(ord_pow_omega(term.exponent));
            const count = materialized_count(term.coefficient, factor.length - 1, result.length);
            for (let j = 0; j < count; j++) result = root_substitute(result, factor);
        }
        return result;
    }
    const maximum = max_epsilon_atom(exponent);
    if (!maximum) return suspend(LOW, relative_from_cnf(exponent));
    const quotient = ord_pow_omega(ord_tail_after(maximum, exponent.terms[0].exponent));
    return suspend((maximum as Extract<Ordinal, { kind: 'epsilon' }>).expr, relative_from_cnf(quotient));
}

export function tsomega_to_cnf(expr: Expr): Ordinal {
    if (is_infinity(expr)) throw new Error('Limit is not a TSωDBMS ordinal');
    if (expr.length && expr[0].length) throw new Error('TSωDBMS ordinal must start with an empty column');
    const cached = ORDINAL_CACHE.get(expr);
    if (cached) return cached;
    const result = relative_to_cnf(convert_matrix(expr, true));
    ORDINAL_CACHE.set(expr, result);
    return result;
}

export function cnf_to_tsomega(value: Ordinal): Expr {
    return convert_matrix(relative_from_cnf(value), false);
}

type CapHeight = [number, Ordinal][];
type SampleHeight = [number, number][];
type CellHeight = [number, number, number][]; // 锚、常量块、块内相对秩。
type Cell = CellHeight[];
interface CountBlock {
    lower: Ordinal;
    upper: Ordinal;
    exponent: Ordinal;
    reduced: Ordinal;
    infinite: boolean;
}
interface CountPoint {
    block: number;
    rank: number;
    value: Ordinal;
}
interface CountDomain {
    caps: [number, CapHeight][][];
    blocks: CountBlock[];
    points: CountPoint[];
}
interface CountCut {
    cut: (number | Ordinal)[];
    open: boolean;
    exponent: Ordinal;
}
type Interleaving = [number[], number[]];
const MAX_COUNT_WORK = 3_000_000;
const MAX_COUNT_STATES = 250_000;
const COUNT_CACHE = new WeakMap<Expr, Ordinal>();

function ord_predecessor(value: Ordinal): Ordinal {
    if (ord_is_zero(value) || ord_is_limit(value)) throw new Error('Expected a successor ordinal');
    return drop_last_principal(value);
}

function drop_last_principal(value: Ordinal): Ordinal {
    const terms = ord_terms(value).slice(),
        last = terms.pop();
    if (last && last.coefficient > 1n) terms.push({ exponent: last.exponent, coefficient: last.coefficient - 1n });
    return ord_from_terms(terms);
}

function point_rank(alpha: Ordinal): Ordinal {
    return ord_compare(alpha, ORD_OMEGA) < 0 ? alpha : ord_predecessor(alpha);
}

// 实际分隔符为 0 或后继，坐标 q 对应 q（有限）或 q+1（无限）。
function prepare_domain(expr: Expr): CountDomain {
    const caps: CountDomain['caps'] = expr.map((col) =>
        col.map(([p, h]) => [p, h.map(([a, position]) => [a, tsomega_to_cnf(position)])]),
    );
    let maximum = ORD_ZERO;
    const cuts = [ORD_ZERO];
    for (const col of caps)
        for (const [, h] of col)
            for (const [, alpha] of h) {
                if (ord_compare(alpha, maximum) > 0) maximum = alpha;
                cuts.push(ord_is_limit(alpha) ? alpha : point_rank(alpha));
            }
    const upper = ord_add(ORD_ONE, maximum);
    cuts.push(upper);
    cuts.sort(ord_compare);
    const unique = cuts.filter((x, i) => i === 0 || ord_compare(x, cuts[i - 1]) !== 0);
    const blocks: CountBlock[] = [];
    let cursor = ORD_ZERO;
    function append_gap(end: Ordinal): void {
        if (ord_compare(cursor, end) >= 0) return;
        for (const term of ord_terms(ord_tail_after(cursor, end))) {
            const count = materialized_count(term.coefficient, 1, blocks.length);
            for (let k = 0; k < count; k++) {
                const next = ord_add(cursor, ord_pow_omega(term.exponent));
                blocks.push({
                    lower: cursor,
                    upper: next,
                    exponent: term.exponent,
                    reduced: drop_last_principal(term.exponent),
                    infinite: !ord_is_zero(term.exponent),
                });
                cursor = next;
            }
        }
    }
    for (const cut of unique) {
        if (ord_compare(cut, upper) >= 0) break;
        append_gap(cut);
        if (ord_compare(cursor, cut) === 0) {
            blocks.push({
                lower: cut,
                upper: ord_add(cut, ORD_ONE),
                exponent: ORD_ZERO,
                reduced: ORD_ZERO,
                infinite: false,
            });
            cursor = ord_add(cut, ORD_ONE);
        }
    }
    append_gap(upper);
    const points: CountPoint[] = [];
    blocks.forEach((block, b) => {
        const count = block.infinite ? Math.max(1, expr.length - 1) : 1;
        materialized_count(BigInt(count), 1, points.length);
        for (let rank = 0; rank < count; rank++) {
            points.push({ block: b, rank, value: ord_add(block.lower, ord_natural(BigInt(rank))) });
        }
    });
    return { caps, blocks, points };
}

function sample_height_order(a: SampleHeight, b: SampleHeight): number {
    return lex_compare(a, b, (x, y) => Math.sign(x[0] - y[0]) || Math.sign(x[1] - y[1]), false);
}

function cap_order(h: SampleHeight, cap: CapHeight, points: CountPoint[]): number {
    for (let k = 0; k < Math.min(h.length, cap.length); k++) {
        const anchor = Math.sign(h[k][0] - cap[k][0]);
        if (anchor) return anchor;
        const q = points[h[k][1]].value,
            alpha = cap[k][1];
        const order = ord_is_limit(alpha) ? (ord_compare(q, alpha) < 0 ? -1 : 1) : ord_compare(q, point_rank(alpha));
        if (order) return order;
    }
    return Math.sign(cap.length - h.length);
}

function sample_edges(domain: CountDomain, work: () => void): { parent: number; height: SampleHeight }[][] {
    const { caps, points } = domain,
        columns: { parent: number; height: SampleHeight }[][] = [];
    for (const col of caps) {
        const edges: { parent: number; height: SampleHeight }[] = [];
        for (let j = 0; j < col.length; j++) {
            const [p, cap] = col[j],
                lower = col[j - 1]?.[1];
            const append = (h: SampleHeight): void => {
                work();
                if (cap_order(h, cap, points) <= 0 && (!lower || cap_order(h, lower, points) > 0)) {
                    if (edges.length >= MAX_COUNT_STATES) throw new RangeError('TωY edge resource limit exceeded');
                    edges.push({ parent: p, height: h });
                }
            };
            for (let q = 0; q < points.length; q++) append([[p, q]]);
            for (const edge of columns[p]) {
                append(edge.height);
                for (let q = 0; q < edge.height[edge.height.length - 1][1]; q++) {
                    append([...edge.height, [p, q]]);
                }
            }
        }
        edges.sort((a, b) => sample_height_order(a.height, b.height));
        columns.push(edges);
    }
    return columns;
}

function canonical_cell(path: SampleHeight[], points: CountPoint[], blocks: CountBlock[]): Cell {
    const ranks = blocks.map(() => new Set<number>());
    for (const h of path) for (const [, q] of h) ranks[points[q].block].add(points[q].rank);
    const sorted = ranks.map((set) => [...set].sort((a, b) => a - b));
    return path.map((h) => h.map(([a, q]) => [a, points[q].block, sorted[points[q].block].indexOf(points[q].rank)]));
}

function cell_value(cell: Cell, blocks: CountBlock[], size: number): CountCut {
    const seen = new Set<string>(),
        record = blocks.map(() => -1),
        increments: Ordinal[] = [];
    const cut: CountCut['cut'] = [];
    let open = false;
    for (let step = 0; step < size - 1; step++) {
        const h = cell[step] ?? [];
        for (let slot = 0; slot < size - 1; slot++) {
            const entry = h[slot];
            // END 大于所有列锚；立即结束排在继续路径之后。
            if (!open) cut.push(entry ? entry[0] : size);
            if (!entry) {
                if (!open) cut.push(ORD_ZERO);
                continue;
            }
            const [, b, rank] = entry,
                block = blocks[b];
            if (block.infinite) {
                if (!open) {
                    cut.push(block.upper);
                    open = true;
                }
                const id = b + ':' + rank;
                if (!seen.has(id)) {
                    seen.add(id);
                    increments.push(rank > record[b] ? block.exponent : block.reduced);
                    record[b] = Math.max(record[b], rank);
                }
            } else if (!open) cut.push(block.lower);
        }
    }
    return { cut, open, exponent: increments.reverse().reduce(ord_add, ORD_ZERO) };
}

function cut_order(a: CountCut, b: CountCut): number {
    for (let k = 0; k < Math.min(a.cut.length, b.cut.length); k++) {
        const order =
            k % 2
                ? ord_compare(a.cut[k] as Ordinal, b.cut[k] as Ordinal)
                : Math.sign((a.cut[k] as number) - (b.cut[k] as number));
        if (order) return order;
    }
    return Math.sign(a.cut.length - b.cut.length) || Number(b.open) - Number(a.open);
}

function interleavings(left_size: number, right_size: number, work: () => void): Interleaving[] {
    const result: Interleaving[] = [];
    function visit(i: number, j: number, rank: number, left: number[], right: number[]): void {
        work();
        if (i === left_size && j === right_size) {
            if (result.length >= MAX_COUNT_STATES) throw new RangeError('TωY interleaving resource limit exceeded');
            result.push([left, right]);
            return;
        }
        if (i < left_size) visit(i + 1, j, rank + 1, left.concat(rank), right);
        if (j < right_size) visit(i, j + 1, rank + 1, left, right.concat(rank));
        if (i < left_size && j < right_size) visit(i + 1, j + 1, rank + 1, left.concat(rank), right.concat(rank));
    }
    visit(0, 0, 0, [], []);
    return result;
}

function cell_height_order(a: CellHeight, b: CellHeight): number {
    return lex_compare(
        a,
        b,
        (x, y) => Math.sign(x[0] - y[0]) || Math.sign(x[1] - y[1]) || Math.sign(x[2] - y[2]),
        false,
    );
}

function extend_cell(
    path: Cell,
    edge: CellHeight,
    blocks: CountBlock[],
    get_interleavings: (a: number, b: number) => Interleaving[],
    work: () => void,
    consume: (next: Cell) => void,
): void {
    const left_size = blocks.map(() => 0),
        right_size = blocks.map(() => 0);
    for (const h of path) for (const [, b, rank] of h) left_size[b] = Math.max(left_size[b], rank + 1);
    for (const [, b, rank] of edge) right_size[b] = Math.max(right_size[b], rank + 1);
    const left_map: number[][] = [],
        right_map: number[][] = [];
    function visit(b: number): void {
        work();
        if (b < blocks.length) {
            const choices: Interleaving[] = blocks[b].infinite
                ? get_interleavings(left_size[b], right_size[b])
                : [[[0], [0]]];
            for (const [left, right] of choices) {
                left_map[b] = left;
                right_map[b] = right;
                visit(b + 1);
            }
            return;
        }
        const previous: Cell = path.map((h) => h.map(([a, block, rank]) => [a, block, left_map[block][rank]]));
        const last: CellHeight = edge.map(([a, block, rank]) => [a, block, right_map[block][rank]]);
        if (previous.length && cell_height_order(last, previous[previous.length - 1]) < 0) return;
        consume(previous.concat([last]));
    }
    visit(0);
}

export function count_last_cnf(expr: Expr): Ordinal {
    if (is_infinity(expr)) throw new Error('Limit has no finite TωY sequence');
    if (!expr.length) return ORD_ZERO;
    if (!expr[expr.length - 1].length) return ORD_ONE;
    const cached = COUNT_CACHE.get(expr);
    if (cached) return cached;
    let operations = 0;
    const work = (): void => {
        if (++operations > MAX_COUNT_WORK) throw new RangeError('TωY region resource limit exceeded');
    };
    const domain = prepare_domain(expr),
        sampled = sample_edges(domain, work);
    const columns = sampled.map((col) => {
        const unique = new Map<string, { parent: number; height: CellHeight }>();
        for (const edge of col) {
            const h = canonical_cell([edge.height], domain.points, domain.blocks)[0];
            unique.set(JSON.stringify([edge.parent, h]), { parent: edge.parent, height: h });
        }
        return [...unique.values()];
    });
    // 只用 N−1 个代表构造单边；路径之间再枚举精确的相等/大小关系。
    const merges = new Map<string, Interleaving[]>();
    const get_interleavings = (a: number, b: number): Interleaving[] => {
        const key = a + ':' + b;
        let result = merges.get(key);
        if (!result) {
            result = interleavings(a, b, work);
            merges.set(key, result);
        }
        return result;
    };
    const cells = new Map<string, Cell>(),
        seen = new Set<string>();
    function visit(column: number, path: Cell): void {
        const state = JSON.stringify([column, path]);
        if (seen.has(state)) return;
        if (seen.size >= MAX_COUNT_STATES) throw new RangeError('TωY state resource limit exceeded');
        seen.add(state);
        for (const edge of columns[column]) {
            extend_cell(path, edge.height, domain.blocks, get_interleavings, work, (next) => {
                cells.set(JSON.stringify(next), next);
                if (cells.size > MAX_COUNT_STATES) throw new RangeError('TωY cell resource limit exceeded');
                visit(edge.parent, next);
            });
        }
    }
    visit(expr.length - 1, []);
    const cuts = [...cells.values()].map((cell) => cell_value(cell, domain.blocks, expr.length)).sort(cut_order);
    const merged: CountCut[] = [];
    for (const cut of cuts) {
        const previous = merged[merged.length - 1];
        if (previous && cut_order(previous, cut) === 0) {
            if (ord_compare(cut.exponent, previous.exponent) > 0) previous.exponent = cut.exponent;
        } else merged.push(cut);
    }
    // 同一上确界只保留最大指数；按切口排序求和，前置 1 必须左加。
    const result = merged.reduce((total, cut) => ord_add(total, ord_pow_omega(cut.exponent)), ORD_ONE);
    COUNT_CACHE.set(expr, result);
    return result;
}

export function compute_tomegay_cnf(expr: Expr): Ordinal[] {
    if (is_infinity(expr)) throw new Error('Limit has no finite TωY sequence');
    return expr.map((_, i) => count_last_cnf(i === expr.length - 1 ? expr : expr.slice(0, i + 1)));
}

export function tomegay_cnf_to_tsomega(sequence: Ordinal[]): Expr {
    if (sequence.length && ord_compare(sequence[0], ORD_ONE) !== 0) throw new Error('TωY must start with 1');
    if (sequence.some((value) => ord_compare(value, ORD_ONE) < 0)) throw new Error('TωY entries must be positive');
    materialized_count(BigInt(sequence.length));
    const prefix: Expr = [];
    let steps = 0;
    for (const target of sequence) {
        if (ord_compare(target, ORD_ONE) === 0) {
            prefix.push([]);
            continue;
        }
        const p = prefix.length - 1;
        let current: Expr = prefix.concat([[[p, [[p, cnf_to_tsomega(target)]]]]]);
        let value = count_last_cnf(current);
        while (ord_compare(value, target) > 0) {
            if (++steps > MAX_INVERSE_STEPS) throw new RangeError('TωY inverse resource limit exceeded');
            const h = height(current[current.length - 1])!;
            if (!is_limit(h[h.length - 1][1])) {
                current = expand(current, 0, false, 'FS');
                value = count_last_cnf(current);
            } else {
                const sample = (n: number): [Expr, Ordinal] => {
                    const child = expand(current, n, false, 'FS');
                    return [child, count_last_cnf(child)];
                };
                let [child, count] = sample(0);
                if (ord_compare(count, target) < 0) {
                    let low = 0,
                        high = 1;
                    [child, count] = sample(high);
                    while (ord_compare(count, target) < 0) {
                        low = high;
                        high *= 2;
                        if (!Number.isSafeInteger(high))
                            throw new RangeError('TωY inverse index resource limit exceeded');
                        [child, count] = sample(high);
                    }
                    while (high - low > 1) {
                        const middle = low + Math.floor((high - low) / 2),
                            [candidate, candidate_count] = sample(middle);
                        if (ord_compare(candidate_count, target) >= 0) {
                            high = middle;
                            child = candidate;
                            count = candidate_count;
                        } else low = middle;
                    }
                }
                current = child;
                value = count;
            }
        }
        if (ord_compare(value, target) !== 0) throw new Error('TωY inverse lost its lower bound');
        prefix.push(current[current.length - 1]);
    }
    return prefix;
}

export function convert_to_tomegay(expr: Expr): Expr[] {
    return compute_tomegay_cnf(expr).map(cnf_to_tsomega);
}

export function convert_from_tomegay(values: Expr[]): Expr {
    return tomegay_cnf_to_tsomega(values.map(tsomega_to_cnf));
}

// RMN 的压缩端点行值直接查询左环境，不物化实际边或无限山脉。
export type ExprRmn = [number, Ordinal][][];

export function convert_to_rmn(expr: Expr): ExprRmn {
    if (is_infinity(expr)) throw new Error('Limit has no finite RMN');
    const members = new Map<string, boolean>(),
        lowers = new Map<string, Height | undefined>();
    const values = new Map<string, Ordinal>();
    function seed_member(a: number, h: Height): boolean {
        const key = JSON.stringify([a, h]);
        if (members.has(key)) return members.get(key)!;
        const result = expr[a].some(
            ([p, cap], i) =>
                compare_height(h, cap) <= 0 &&
                (i === 0 || compare_height(h, expr[a][i - 1][1]) > 0) &&
                grid_member(p, h),
        );
        members.set(key, result);
        return result;
    }
    function grid_member(a: number, h: Height): boolean {
        const [b, position] = h[h.length - 1];
        if (b < a) return seed_member(a, h);
        if (b > a || is_limit(position)) return false;
        const u = h.slice(0, -1);
        return !u.length || (seed_member(a, u) && compare(position, u[u.length - 1][1]) < 0);
    }
    function seed_below(a: number, cap: Height): Height | undefined {
        const key = JSON.stringify([a, cap]);
        if (lowers.has(key)) return lowers.get(key);
        let result: Height | undefined;
        for (const [p, upper] of expr[a]) {
            const candidate = compare_height(upper, cap) < 0 ? upper : grid_below(p, cap);
            if (candidate && (!result || compare_height(candidate, result) > 0)) result = candidate;
        }
        lowers.set(key, result);
        return result;
    }
    function grid_below(a: number, cap: Height): Height | undefined {
        if (!cap.length || cap[0][0] > a) throw new Error('Unbounded RMN height query');
        const lower = seed_below(a, cap);
        let j = 0;
        while (j < cap.length && cap[j][0] < a) j++;
        const u = cap.slice(0, j);
        if (u.length && !seed_member(a, u)) return lower;
        let cut: Expr;
        if (j === cap.length) cut = u[u.length - 1][1];
        else if (!u.length) cut = cap[j][1];
        else if (cap[j][0] > a) cut = u[u.length - 1][1];
        else cut = compare(cap[j][1], u[u.length - 1][1]) < 0 ? cap[j][1] : u[u.length - 1][1];
        if (!cut.length) return lower;
        // 查询的 cap 是去掉末槽后的前缀，其中各位置都是后继。
        return [...u, [a, predecessor(cut)]];
    }
    function value(h: Height | undefined): Ordinal {
        if (!h) return ORD_ZERO;
        const key = JSON.stringify(h),
            cached = values.get(key);
        if (cached) return cached;
        const [a, position] = h[h.length - 1];
        const base = seed_below(a, h.slice(0, -1));
        const result = ord_add(value(base), ord_pow_omega(tsomega_to_cnf(position)));
        values.set(key, result);
        return result;
    }
    return expr.map((col) => col.map(([p, h]) => [p, value(h)]));
}
function superscript(base: string, exponent: string, type: DisplayType, pair: boolean = false): string {
    if (type === 'html') return base + '<sup>' + exponent + '</sup>';
    if (type === 'latex') return base + '^{' + exponent + '}';
    return base + '^' + (pair || /^\d+$|^w$/.test(exponent) ? exponent : '(' + exponent + ')');
}

export function display_ordinal(value: Ordinal, type: DisplayType = 'plain'): string {
    if (max_epsilon_atom(value)) return display(cnf_to_tsomega(value), type);
    const terms = ord_terms(value);
    if (!terms.length) return '0';
    return terms
        .map(({ exponent, coefficient }) => {
            if (ord_is_zero(exponent)) return coefficient.toString();
            let base = type === 'html' ? 'ω' : type === 'latex' ? '\\omega ' : 'w';
            if (ord_compare(exponent, ORD_ONE) !== 0) base = superscript(base, display_ordinal(exponent, type), type);
            if (coefficient !== 1n) base += (type === 'html' ? '·' : type === 'latex' ? '\\cdot ' : '*') + coefficient;
            return base;
        })
        .join('+');
}

function height_display(h: Height, type: DisplayType): string {
    return (
        '(' +
        h.map(([anchor, position]) => anchor + 1 + '@' + display_ordinal(tsomega_to_cnf(position), type)).join(',') +
        ')'
    );
}

function entry_display([parent, h]: Entry, type: DisplayType): string {
    return superscript('' + (parent + 1), height_display(h, type), type, true);
}

export function display(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';
    return expr
        .map((col) => '(' + (col.length ? col.map((entry) => entry_display(entry, type)).join(',') : '0') + ')')
        .join('');
}

function marked_column(content: string, index: number, type: DisplayType): string {
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    if (type === 'latex') return '(' + content + ')_{' + index + '}';
    return '(' + content + ':' + index + ')';
}

export function display_marked(expr: Expr, type: DisplayType = 'plain', start_index: number = 1): string {
    if (is_infinity(expr)) return 'Limit';
    return expr
        .map((col, i) =>
            marked_column(
                col.length ? col.map((entry) => entry_display(entry, type)).join(',') : type === 'plain' ? '' : '0',
                start_index + i,
                type,
            ),
        )
        .join('');
}

function rmn_display(expr: Expr, type: DisplayType): string {
    if (is_infinity(expr)) return 'Limit';
    return convert_to_rmn(expr)
        .map((col) => '(' + col.map(([parent, row]) => parent + 1 + ':' + display_ordinal(row, type)).join(',') + ')')
        .join('');
}

export function display_as_Y(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';
    return compute_tomegay_cnf(expr)
        .map((value) => display_ordinal(value, type))
        .join(',');
}
function split_top_level(text: string, separator: string): string[] {
    const closing: string[] = [],
        result: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(' || text[i] === '{') closing.push(text[i] === '(' ? ')' : '}');
        else if (text[i] === ')' || text[i] === '}') {
            if (closing.pop() !== text[i]) throw new Error('Mismatched TSωDBMS brackets');
        } else if (text[i] === separator && !closing.length) {
            result.push(text.slice(start, i));
            start = i + 1;
        }
    }
    if (closing.length) throw new Error('Unclosed TSωDBMS brackets');
    result.push(text.slice(start));
    return result;
}

function closing_index(text: string, start: number): number {
    const closing: string[] = [];
    for (let i = start; i < text.length; i++) {
        if (text[i] === '(' || text[i] === '{') closing.push(text[i] === '(' ? ')' : '}');
        else if (text[i] === ')' || text[i] === '}') {
            if (closing.pop() !== text[i]) throw new Error('Mismatched TSωDBMS brackets');
            if (!closing.length) return i;
        }
    }
    throw new Error('Unclosed TSωDBMS brackets');
}

export function parse_ordinal(text: string): Ordinal {
    const source = text.replace(/\s/g, '').replaceAll('ω', 'w');
    if (!source || source.includes('Limit')) throw new Error('Invalid TSωDBMS ordinal');
    const sum = split_top_level(source, '+');
    if (sum.length > 1) return sum.reduce((value, term) => ord_add(value, parse_ordinal(term)), ORD_ZERO);
    const product = split_top_level(source.replaceAll('·', '*'), '*');
    if (product.length > 1) {
        if (product.length !== 2 || !/^\d+$/.test(product[1])) throw new Error('Invalid CNF coefficient');
        return ord_mul(parse_ordinal(product[0]), ord_natural(BigInt(product[1])));
    }
    if (/^\d+$/.test(source)) return ord_natural(BigInt(source));
    if (source === 'w') return ORD_OMEGA;
    if (source.startsWith('w^')) return ord_pow_omega(parse_ordinal(source.slice(2)));
    if (source[0] === '(' || source[0] === '{') {
        const end = closing_index(source, 0);
        if (source === '()' || (source[0] === '(' && source[end + 1] === '(')) {
            return tsomega_to_cnf(from_display(source));
        }
        if (end === source.length - 1) return parse_ordinal(source.slice(1, -1));
    }
    throw new Error('Invalid TSωDBMS ordinal: ' + text);
}

function parse_index(text: string): number {
    if (!/^\d+$/.test(text)) throw new Error('Invalid TSωDBMS index');
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid TSωDBMS index');
    return value - 1;
}

export function from_display(text: string): Expr {
    const source = text.replace(/\s/g, '');
    if (source === 'Limit') return INFINITY;
    const result: Expr = [];
    let start = 0;
    while (start < source.length) {
        if (source[start] !== '(') throw new Error('Invalid TSωDBMS column');
        const end = closing_index(source, start);
        const marked = split_top_level(source.slice(start + 1, end), ':');
        if (marked.length > 2) throw new Error('Invalid TSωDBMS column index');
        if (marked.length === 2) parse_index(marked[1]);
        const content = marked[0],
            col: Column = [];
        if (content !== '' && content !== '0')
            for (const entry of split_top_level(content, ',')) {
                const match = /^(\d+)\^?(\(.*\))$/.exec(entry);
                if (!match) throw new Error('Invalid TSωDBMS entry');
                const parent = parse_index(match[1]);
                let body = match[2];
                if (closing_index(body, 0) !== body.length - 1) throw new Error('Invalid TSωDBMS height');
                body = body.slice(1, -1);
                // 兼容原生高度外多包一层括号的输入。
                while (body.startsWith('(') && closing_index(body, 0) === body.length - 1) body = body.slice(1, -1);
                const h: Height = split_top_level(body, ',').map((slot) => {
                    const parts = split_top_level(slot, '@');
                    if (parts.length !== 2) throw new Error('Invalid TSωDBMS height slot');
                    return [parse_index(parts[0]), cnf_to_tsomega(parse_ordinal(parts[1]))];
                });
                if (parent >= result.length || h.some(([a]) => a > parent))
                    throw new Error('TSωDBMS references must point left');
                for (let j = 1; j < h.length; j++) {
                    if (h[j - 1][0] >= h[j][0] || compare(h[j - 1][1], h[j][1]) <= 0 || is_limit(h[j - 1][1])) {
                        throw new Error(
                            'TSωDBMS heights need increasing anchors and decreasing positions; nonfinal positions must be successors',
                        );
                    }
                }
                if (
                    col.length &&
                    (col[col.length - 1][0] <= parent || compare_height(col[col.length - 1][1], h) >= 0)
                ) {
                    throw new Error('TSωDBMS entries must have decreasing parents and increasing heights');
                }
                col.push([parent, h]);
            }
        result.push(col);
        start = end + 1;
    }
    return result;
}

export function from_display_y_seq(text: string): Expr {
    const source = text.trim();
    if (!source) return [];
    if (source === 'Limit') return INFINITY;
    return tomegay_cnf_to_tsomega(split_top_level(source, ',').map(parse_ordinal));
}
const ORDINARY_FS = MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display, compare_column, truncate);

function fundamental_sequence(expr: Expr, index: number, variant: FsVariant): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    if (is_infinity(expr)) return infinity_FS(index);
    if (is_limit(expr)) {
        const col = expr[expr.length - 1],
            [, h] = col[col.length - 1];
        // 极限高分量直接递归到同一变体，保持下标；不套外层的截断/下标调整。
        if (is_limit(h[h.length - 1][1])) return expand(expr, index, true, variant);
    }
    return variant === 'fast' ? ORDINARY_FS.FS_equiv.fast(expr, index) : ORDINARY_FS[variant](expr, index);
}

export const TS_omega_DBMS: NotationDefinition<Expr> = {
    id: 'ts-omega-dbms',
    name: 'TSωDBMS',
    category_id: 'category-sdbms',
    display: {
        plain: (m) => display(m, 'plain'),
        html: (m) => display(m, 'html'),
        latex: (m) => display(m, 'latex'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        m: {
            plain: (m) => display_marked(m, 'plain'),
            html: (m) => display_marked(m, 'html'),
            latex: (m) => display_marked(m, 'latex'),
            from_display,
            name: { id: 'display.index-marked' },
        },
        RMN: {
            plain: (m) => rmn_display(m, 'plain'),
            html: (m) => rmn_display(m, 'html'),
            latex: (m) => rmn_display(m, 'latex'),
        },
        Y: {
            plain: (m) => display_as_Y(m, 'plain'),
            html: (m) => display_as_Y(m, 'html'),
            latex: (m) => display_as_Y(m, 'latex'),
            from_display: from_display_y_seq,
        },
    },
    FS: (expr, index) => fundamental_sequence(expr, index, 'FS'),
    FS_alter: (expr, index) => fundamental_sequence(expr, index, 'FS_alter'),
    FS_short: (expr, index) => fundamental_sequence(expr, index, 'FS_short'),
    FS_equiv: { fast: (expr, index) => fundamental_sequence(expr, index, 'fast') },
    is_limit,
    compare,
    init: () => [INFINITY, [[]], []],
};
