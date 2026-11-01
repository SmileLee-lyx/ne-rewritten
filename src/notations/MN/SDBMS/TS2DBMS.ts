import type { NotationDefinition } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { lex_compare } from '@/utils.ts';

// note-9: ts2dbms_t1y_final_9.md 及其 CNF、RMN/DBMS 格式附件。
// 内部高行标递归保存普通域矩阵；CNF 只用于序数运算、计数和显示。
export type Height = [number, Expr];
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
const LOW: Expr = [[], [[0, [0, []]]]];
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
    return compare(a[1], b[1]) || Math.sign(a[0] - b[0]);
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
        throw new RangeError('TS2DBMS materialization resource limit exceeded');
    }
    return Number(count);
}

function height(col: Column): Height | undefined {
    return col[col.length - 1]?.[1];
}

function height1(col: Column): Expr {
    return height(col)?.[1] ?? [];
}

function merge_column(a: Column, b: Column): Column {
    const h = height(a);
    return a.concat(h ? b.filter(([, k]) => compare_height(k, h) > 0) : b);
}

export type HeightStep = { kind: 'ordinary'; height: Height | undefined } | { kind: 'limit'; alpha: Expr };

export function compute_new_height(h: Height, expr: Expr, root: number): HeightStep {
    const [anchor, alpha] = h,
        col = expr[anchor];
    const j = col.findIndex(([, k]) => compare_height(h, k) <= 0);
    if (j < 0) {
        if (compare(height1(col), alpha) < 0) {
            if (is_limit(alpha)) return { kind: 'limit', alpha };
            return { kind: 'ordinary', height: [root, alpha.slice(0, -1)] };
        }
        return { kind: 'ordinary', height: height(col) };
    }
    let result: Height = [col[j][0], alpha];
    if (j > 0 && compare_height(col[j - 1][1], result) > 0) result = col[j - 1][1];
    return { kind: 'ordinary', height: result };
}

function copy_column(col: Column, root: number, offset: number): Column {
    return remap_column(col, (n) => (n >= root ? n + offset : n));
}

export function height_fs(value: Expr, index: number, variant: FsVariant = 'FS'): Expr {
    return fundamental_sequence(value, index, variant);
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
    const [root, h] = col[col.length - 1],
        step = compute_new_height(h, expr, root);
    let replacement = col.slice(0, -1);
    if (step.kind === 'limit') {
        const base_level = ts2dbms_to_cnf(height1(replacement));
        const difference = cnf_to_ts2dbms(ord_tail_after(base_level, ts2dbms_to_cnf(step.alpha)));
        const approximation = height_fs(difference, index, variant);
        const new_level = cnf_to_ts2dbms(ord_add(base_level, ts2dbms_to_cnf(approximation)));
        replacement.push([root, [root, new_level]]);
        // 相对高度的极限切口：不合并根列、不复制、不执行 shorter 删除。
        return expr.slice(0, -1).concat([replacement]);
    }
    if (step.height) replacement = merge_column(replacement, [[root, step.height]]);
    replacement = merge_column(replacement, expr[root]);
    materialized_count(BigInt(index), right - root, expr.length);
    const result = expr.slice(0, -1).concat([replacement]);
    for (let w = 1; w <= index; w++) {
        for (let i = root + 1; i <= right; i++) result.push(copy_column(result[i], root, (right - root) * w));
    }
    if (shorter) result.pop();
    return result;
}

export function infinity_FS(index: number): Expr {
    let result = LOW;
    for (let n = 0; n < index; n++) result = [[], [[0, [0, result]]]];
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

// 普通域与 125 相对域之间只运输有限父、锚引用，高行标原样保留。
function low_column(col: Column, parent: number): boolean {
    return col.length === 1 && col[0][0] === parent && col[0][1][0] === 0 && col[0][1][1].length === 0;
}

function remap_column(
    col: Column,
    map_parent: (n: number) => number,
    map_anchor: (n: number, level: Expr) => number = map_parent,
): Column {
    return col.map(([p, [a, level]]) => [map_parent(p), [map_anchor(a, level), level]]);
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
        if (n !== 0 && n < cut) throw new Error('Invalid TS2DBMS product reference');
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
    const result: Expr = [[], [[0, [0, []]]], ...expr.slice(1).map((col) => shift_column(col, 1))];
    const last = expr[expr.length - 1];
    if (last.length === 1 && last[0][1][0] === 0 && last[0][1][1].length === 0) result[result.length - 1][0][1][0] = 0;
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
        const threshold = head.concat([[[1, [0, []]]]]);
        return compare(tail, threshold) < 0 ? root_substitute(head, tail) : tail;
    }
    if (!low_column(expr[1], 0)) throw new Error('Invalid TS2DBMS relative prefix');
    const bound: Expr = [[], [[0, [0, []]]], [[1, [1, [[]]]]]];
    if (compare(expr, bound) < 0) return expr;
    let cut = expr.findIndex((col, i) => i >= 2 && low_column(col, 0));
    if (cut < 0) cut = expr.length;
    const prefix = expr.slice(0, cut),
        restored: Expr = [[]];
    let gap = false;
    for (let i = 2; i < prefix.length; i++) {
        const col = prefix[i],
            last = i === prefix.length - 1;
        if (col.every(([p, [a]]) => p >= 1 && a >= 1)) {
            const candidate = shift_column(col, -1);
            const corrected_last =
                last && candidate.length === 1 && candidate[0][1][0] === 0 && candidate[0][1][1].length === 0;
            if (!low_column(candidate, 0) && !corrected_last) {
                restored.push(candidate);
                continue;
            }
        }
        if (last && col.length === 1 && col[0][0] > 1 && col[0][1][0] === 0 && col[0][1][1].length === 0) {
            restored.push([[col[0][0] - 1, [0, []]]]);
            continue;
        }
        const parent = col[0][0] - 1;
        if (parent > 0) restored.push([[parent, [0, []]]]);
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
                    if (p !== 1 && p < cut) throw new Error('Invalid TS2DBMS suspension parent');
                    return p === 1 ? 0 : p - cut + 1;
                },
                (a, level) => {
                    if (a === 0 && level.length === 0) return 0;
                    if (a < cut) throw new Error('Invalid TS2DBMS suspension anchor');
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
            if (!low_column(expr[1], 0)) throw new Error('Invalid TS2DBMS relative prefix');
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

export function ts2dbms_to_cnf(expr: Expr): Ordinal {
    if (is_infinity(expr)) throw new Error('Limit is not a TS2DBMS ordinal');
    if (expr.length && expr[0].length) throw new Error('TS2DBMS ordinal must start with an empty column');
    const cached = ORDINAL_CACHE.get(expr);
    if (cached) return cached;
    const result = relative_to_cnf(convert_matrix(expr, true));
    ORDINAL_CACHE.set(expr, result);
    return result;
}

export function cnf_to_ts2dbms(value: Ordinal): Expr {
    return convert_matrix(relative_from_cnf(value), false);
}

interface LayerData {
    heights: number[];
    parents: number[][];
}

export function layer_data(expr: Expr, alpha: Ordinal): LayerData {
    const heights: number[] = [],
        parents: number[][] = [];
    for (let i = 0; i < expr.length; i++) {
        const caps = expr[i]
            .filter(([, h]) => ord_compare(ts2dbms_to_cnf(h[1]), alpha) === 0)
            .map(([p, [a]]) => [p, a]);
        const above = expr[i].find(([, h]) => ord_compare(ts2dbms_to_cnf(h[1]), alpha) > 0);
        if (above && (!caps.length || caps[caps.length - 1][1] < above[0])) {
            caps.push([above[0], above[0]]);
        }
        const anchor = caps[caps.length - 1]?.[1];
        heights.push(anchor === undefined ? 0 : heights[anchor] + 1);
        const local: number[] = [];
        for (const [p, a] of caps) {
            while (local.length <= heights[a]) {
                if (local.length > heights[p]) throw new Error('Invalid TS2DBMS layer parent');
                local.push(p);
            }
        }
        if (local.length !== heights[i]) throw new Error('Invalid TS2DBMS layer height');
        parents.push(local);
    }
    return { heights, parents };
}

type LayerEvent =
    | { kind: 'layer'; alpha: Ordinal }
    | { kind: 'bulk'; start: Ordinal; length: Ordinal; parents: (number | undefined)[] };

function build_t1y_events(expr: Expr): LayerEvent[] {
    const sorted = [ORD_ZERO, ...expr.flatMap((col) => col.map(([, h]) => ts2dbms_to_cnf(h[1])))].sort(ord_compare);
    const levels = sorted.filter((level, i) => i === 0 || ord_compare(level, sorted[i - 1]) !== 0);
    const events: LayerEvent[] = [];
    for (let k = 0; k < levels.length; k++) {
        if (k > 0) {
            let start = ord_add(levels[k - 1], ORD_ONE);
            if (ord_compare(start, levels[k]) < 0) {
                for (const term of ord_terms(ord_tail_after(start, levels[k]))) {
                    const length = ord_pow_omega(term.exponent);
                    const count = materialized_count(term.coefficient, 1, events.length);
                    for (let n = 0; n < count; n++) {
                        if (ord_compare(length, ORD_ONE) === 0) events.push({ kind: 'layer', alpha: start });
                        else
                            events.push({
                                kind: 'bulk',
                                start,
                                length,
                                parents: expr.map(
                                    (col) => col.find(([, h]) => ord_compare(ts2dbms_to_cnf(h[1]), start) > 0)?.[0],
                                ),
                            });
                        start = ord_add(start, length);
                    }
                }
            }
        }
        events.push({ kind: 'layer', alpha: levels[k] });
    }
    return events;
}

export function compute_t1y_cnf(expr: Expr): Ordinal[] {
    if (is_infinity(expr)) throw new Error('Limit has no finite T1Y sequence');
    const events = build_t1y_events(expr);
    let ranks = expr.map(() => ORD_ZERO);
    for (let k = events.length - 1; k >= 0; k--) {
        const event = events[k],
            old = ranks;
        ranks = [];
        if (event.kind === 'bulk') {
            for (let i = 0; i < expr.length; i++) {
                const p = event.parents[i];
                ranks.push(
                    p === undefined ? old[i] : ord_add(ord_mul(ord_add(ranks[p], ORD_ONE), event.length), old[i]),
                );
            }
        } else {
            const { heights, parents } = layer_data(expr, event.alpha),
                cells: Ordinal[][] = [];
            for (let i = 0; i < expr.length; i++) {
                const local: Ordinal[] = [];
                local[heights[i]] = old[i];
                for (let j = heights[i] - 1; j >= 0; j--) {
                    local[j] =
                        ord_is_limit(event.alpha) && j === 0
                            ? local[j + 1]
                            : ord_add(ord_add(cells[parents[i][j]][j], ORD_ONE), local[j + 1]);
                }
                cells.push(local);
                ranks.push(local[0]);
            }
        }
    }
    // 左加 1；无限计数不能右加 1。
    return ranks.map((rank) => ord_add(ORD_ONE, rank));
}

function max_level(expr: Expr): Ordinal {
    let result = ORD_ZERO;
    for (const col of expr)
        for (const [, [, level]] of col) {
            const value = ts2dbms_to_cnf(level);
            if (ord_compare(value, result) > 0) result = value;
        }
    return result;
}

function last_count(expr: Expr): Ordinal {
    const counts = compute_t1y_cnf(expr);
    return counts[counts.length - 1];
}

export function t1y_cnf_to_ts2dbms(sequence: Ordinal[]): Expr {
    if (sequence.length && ord_compare(sequence[0], ORD_ONE) !== 0) throw new Error('T1Y must start with 1');
    if (sequence.some((value) => ord_compare(value, ORD_ONE) < 0)) throw new Error('T1Y entries must be positive');
    const prefix: Expr = [];
    let steps = 0;
    for (const target of sequence) {
        if (ord_compare(target, ORD_ONE) === 0) {
            prefix.push([]);
            continue;
        }
        const p = prefix.length - 1,
            bound = ord_add(max_level(prefix), ORD_ONE);
        const beta = ord_compare(bound, target) > 0 ? bound : target;
        let current = prefix.concat([[[p, [p, cnf_to_ts2dbms(beta)]]]]),
            value = last_count(current);
        while (ord_compare(value, target) > 0) {
            if (++steps > MAX_INVERSE_STEPS) throw new RangeError('T1Y inverse resource limit exceeded');
            const col = current[current.length - 1],
                [root, h] = col[col.length - 1];
            if (compute_new_height(h, current, root).kind === 'ordinary') {
                current = expand(current, 0, false, 'FS');
                value = last_count(current);
            } else {
                // 严格单调且共尾：倍增找到上界，再二分取最小可用下标。
                const sample = (n: number): [Expr, Ordinal] => {
                    const child = expand(current, n, false, 'FS');
                    return [child, last_count(child)];
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
                            throw new RangeError('T1Y inverse index resource limit exceeded');
                        [child, count] = sample(high);
                    }
                    while (high - low > 1) {
                        const middle = low + Math.floor((high - low) / 2);
                        const [candidate, candidate_count] = sample(middle);
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
        if (ord_compare(value, target) !== 0) throw new Error('T1Y inverse lost its lower bound');
        prefix.push(current[current.length - 1]);
    }
    return prefix;
}

export type ExprRmn = [number, Ordinal][][];

export function convert_to_rmn(expr: Expr): ExprRmn {
    const layers = new Map<Ordinal, LayerData>();
    return expr.map((col) =>
        col.map(([p, [a, level]]) => {
            const alpha = ts2dbms_to_cnf(level);
            let data = layers.get(alpha);
            if (!data) {
                data = layer_data(expr, alpha);
                layers.set(alpha, data);
            }
            const low = data.heights[a] + (ord_is_zero(alpha) ? 1 : 0);
            return [p, ord_add(ord_mul(ORD_OMEGA, alpha), ord_natural(BigInt(low)))];
        }),
    );
}

export interface DbmsAtom {
    kind: 'atom';
    value: number; // 显示数字：父列号 + 1，或层级本身。
    separator: number;
}
export type DbmsPart = DbmsAtom | { kind: 'repeat'; body: DbmsAtom[]; count: Ordinal };
export type ExprDbms = DbmsPart[][];

function dbms_atom(value: number, separator: number): DbmsAtom {
    return { kind: 'atom', value, separator };
}

function same_atom(a: DbmsPart | undefined, b: DbmsAtom): boolean {
    return a?.kind === 'atom' && a.value === b.value && a.separator === b.separator;
}

function append_repeat(word: DbmsPart[], body: DbmsAtom[], count: Ordinal): void {
    // 只吸收完整且数字、逗号均相同的词，不按相同终点合并。
    while (
        word.length >= body.length &&
        body.every((atom, j) => same_atom(word[word.length - body.length + j], atom))
    ) {
        word.splice(word.length - body.length, body.length);
        count = ord_add(ORD_ONE, count);
    }
    const last = word[word.length - 1];
    if (
        last?.kind === 'repeat' &&
        last.body.length === body.length &&
        body.every((atom, j) => same_atom(last.body[j], atom))
    ) {
        last.count = ord_add(last.count, count);
    } else word.push({ kind: 'repeat', body, count });
}

export function convert_to_dbms(expr: Expr): ExprDbms {
    const result: ExprDbms = expr.map(() => []);
    for (const event of build_t1y_events(expr)) {
        if (event.kind === 'layer') {
            const { heights, parents } = layer_data(expr, event.alpha);
            for (let i = 0; i < expr.length; i++)
                for (let j = 0; j < heights[i]; j++) {
                    if (j === 0 && ord_is_limit(event.alpha)) continue;
                    result[i].push(dbms_atom(parents[i][j] + 1, j === 0 && !ord_is_zero(event.alpha) ? 1 : 0));
                }
        } else {
            const heights: number[] = [];
            for (let i = 0; i < expr.length; i++) {
                const p = event.parents[i],
                    h = p === undefined ? 0 : heights[p] + 1;
                heights.push(h);
                if (p === undefined) continue;
                if (!ord_is_limit(event.start)) result[i].push(dbms_atom(p + 1, 1));
                const body = [...Array.from({ length: h - 1 }, () => dbms_atom(p + 1, 0)), dbms_atom(p + 1, 1)];
                append_repeat(result[i], body, event.length);
            }
        }
    }
    return result;
}

export function convert_to_layered_dbms(expr: Expr): ExprDbms {
    const events = build_t1y_events(expr),
        event_words: ExprDbms[] = [];
    let heads = expr.map(() => 0);
    for (let k = events.length - 1; k >= 0; k--) {
        const event = events[k],
            words: ExprDbms = expr.map(() => []),
            old_heads = heads;
        heads = [];
        if (event.kind === 'layer') {
            const { heights, parents } = layer_data(expr, event.alpha);
            const first = ord_is_limit(event.alpha) ? 1 : 0,
                labels: number[][] = [];
            for (let i = 0; i < expr.length; i++) {
                const local: number[] = [];
                for (let j = first; j < heights[i]; j++) {
                    const p = parents[i][j];
                    local[j] = 1 + (j < heights[p] ? labels[p][j] : old_heads[p]);
                    words[i].push(dbms_atom(local[j], j === 0 && !ord_is_zero(event.alpha) ? 1 : 0));
                }
                labels.push(local);
                heads.push(first < heights[i] ? local[first] : old_heads[i]);
            }
        } else {
            const heights: number[] = [];
            for (let i = 0; i < expr.length; i++) {
                const p = event.parents[i],
                    h = p === undefined ? 0 : heights[p] + 1;
                heights.push(h);
                heads.push(h);
                if (!h) continue;
                if (!ord_is_limit(event.start)) words[i].push(dbms_atom(h, 1));
                const body = [...Array.from({ length: h - 1 }, () => dbms_atom(h, 0)), dbms_atom(h, 1)];
                words[i].push({ kind: 'repeat', body, count: event.length });
            }
        }
        event_words[k] = words;
    }
    // 必须先求实际边层级，再正规化重复词；父列词的吸收可能跨越层级变化。
    const result: ExprDbms = expr.map(() => []);
    for (const words of event_words)
        for (let i = 0; i < expr.length; i++)
            for (const part of words[i]) {
                if (part.kind === 'atom') result[i].push(part);
                else append_repeat(result[i], part.body, part.count);
            }
    return result;
}

function superscript(base: string, exponent: string, type: DisplayType, pair: boolean = false): string {
    if (type === 'html') return base + '<sup>' + exponent + '</sup>';
    if (type === 'latex') return base + '^{' + exponent + '}';
    return base + '^' + (pair || /^\d+$|^w$/.test(exponent) ? exponent : '(' + exponent + ')');
}

export function display_ordinal(value: Ordinal, type: DisplayType = 'plain'): string {
    if (max_epsilon_atom(value)) return display(cnf_to_ts2dbms(value), type);
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

function height_display([anchor, level]: Height, type: DisplayType): string {
    return '(' + display_ordinal(ts2dbms_to_cnf(level), type) + ',' + (anchor + 1) + ')';
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

function dbms_atom_display(atom: DbmsAtom): string {
    return ','.repeat(atom.separator + 1) + atom.value;
}

function dbms_word_display(word: DbmsPart[], type: DisplayType): string {
    return word
        .map((part) => {
            if (part.kind === 'atom') return dbms_atom_display(part);
            const base = '[' + part.body.map(dbms_atom_display).join('') + ']';
            const exponent = display_ordinal(part.count, type);
            if (type === 'plain' && max_epsilon_atom(part.count)) return base + '^{' + exponent + '}';
            return superscript(base, exponent, type);
        })
        .join('');
}

function dbms_display(expr: Expr, type: DisplayType, marked: boolean = false, layered: boolean = false): string {
    if (is_infinity(expr)) return 'Limit';
    return (layered ? convert_to_layered_dbms(expr) : convert_to_dbms(expr))
        .map((word, i) => {
            const content = dbms_word_display(word, type);
            return marked ? marked_column(content, i + 1, type) : '(' + content + ')';
        })
        .join('');
}

export function display_as_Y(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';
    return compute_t1y_cnf(expr)
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
            if (closing.pop() !== text[i]) throw new Error('Mismatched TS2DBMS brackets');
        } else if (text[i] === separator && !closing.length) {
            result.push(text.slice(start, i));
            start = i + 1;
        }
    }
    if (closing.length) throw new Error('Unclosed TS2DBMS brackets');
    result.push(text.slice(start));
    return result;
}

function closing_index(text: string, start: number): number {
    const closing: string[] = [];
    for (let i = start; i < text.length; i++) {
        if (text[i] === '(' || text[i] === '{') closing.push(text[i] === '(' ? ')' : '}');
        else if (text[i] === ')' || text[i] === '}') {
            if (closing.pop() !== text[i]) throw new Error('Mismatched TS2DBMS brackets');
            if (!closing.length) return i;
        }
    }
    throw new Error('Unclosed TS2DBMS brackets');
}

export function parse_ordinal(text: string): Ordinal {
    const source = text.replace(/\s/g, '').replaceAll('ω', 'w');
    if (!source || source.includes('Limit')) throw new Error('Invalid TS2DBMS ordinal');
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
            return ts2dbms_to_cnf(from_display(source));
        }
        if (end === source.length - 1) return parse_ordinal(source.slice(1, -1));
    }
    throw new Error('Invalid TS2DBMS ordinal: ' + text);
}

function parse_index(text: string): number {
    if (!/^\d+$/.test(text)) throw new Error('Invalid TS2DBMS index');
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid TS2DBMS index');
    return value - 1;
}

export function from_display(text: string): Expr {
    const source = text.replace(/\s/g, '');
    if (source === 'Limit') return INFINITY;
    const result: Expr = [];
    let start = 0;
    while (start < source.length) {
        if (source[start] !== '(') throw new Error('Invalid TS2DBMS column');
        const end = closing_index(source, start);
        const marked = split_top_level(source.slice(start + 1, end), ':');
        if (marked.length > 2) throw new Error('Invalid TS2DBMS column index');
        if (marked.length === 2) parse_index(marked[1]);
        const content = marked[0],
            col: Column = [];
        if (content !== '' && content !== '0')
            for (const entry of split_top_level(content, ',')) {
                const match = /^(\d+)\^?(\(.*\))$/.exec(entry);
                if (!match) throw new Error('Invalid TS2DBMS entry');
                const parent = parse_index(match[1]),
                    pair = match[2];
                if (closing_index(pair, 0) !== pair.length - 1) throw new Error('Invalid TS2DBMS height');
                const parts = split_top_level(pair.slice(1, -1), ',');
                if (parts.length !== 2) throw new Error('Invalid TS2DBMS height pair');
                const h: Height = [parse_index(parts[1]), cnf_to_ts2dbms(parse_ordinal(parts[0]))];
                if (h[0] > parent || parent >= result.length) throw new Error('TS2DBMS references must point left');
                if (
                    col.length &&
                    (col[col.length - 1][0] <= parent || compare_height(col[col.length - 1][1], h) >= 0)
                ) {
                    throw new Error('TS2DBMS entries must have decreasing parents and increasing heights');
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
    return t1y_cnf_to_ts2dbms(split_top_level(source, ',').map(parse_ordinal));
}

const ORDINARY_FS = MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display, compare_column, truncate);

function fundamental_sequence(expr: Expr, index: number, variant: FsVariant): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    if (is_infinity(expr)) return infinity_FS(index);
    if (is_limit(expr)) {
        const col = expr[expr.length - 1],
            [root, h] = col[col.length - 1];
        // 极限高分量直接递归到同一变体，保持下标；不套外层的截断/下标调整。
        if (compute_new_height(h, expr, root).kind === 'limit') return expand(expr, index, true, variant);
    }
    return variant === 'fast' ? ORDINARY_FS.FS_equiv.fast(expr, index) : ORDINARY_FS[variant](expr, index);
}

export const TS2DBMS: NotationDefinition<Expr> = {
    id: 'ts-2-dbms',
    name: 'TS2DBMS',
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
        dbms: {
            plain: (m) => dbms_display(m, 'plain'),
            html: (m) => dbms_display(m, 'html'),
            latex: (m) => dbms_display(m, 'latex'),
            name: { id: 'display.dbms' },
        },
        'm dbms': {
            plain: (m) => dbms_display(m, 'plain', true),
            html: (m) => dbms_display(m, 'html', true),
            latex: (m) => dbms_display(m, 'latex', true),
            name: { id: 'display.marked-dbms' },
        },
        'l dbms': {
            plain: (m) => dbms_display(m, 'plain', false, true),
            html: (m) => dbms_display(m, 'html', false, true),
            latex: (m) => dbms_display(m, 'latex', false, true),
            name: { id: 'display.layered-dbms' },
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
