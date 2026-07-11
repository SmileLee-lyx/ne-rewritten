import { boolean_compare, lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { make_OCN_display, type OCNDisplayIR, merge_sum } from '@/notations/OCN/OCN_utils.ts';

type PrimExpr = [Expr, Expr];
type Expr = [0] | [1, PrimExpr, Expr];

function INFINITY(): Expr {
    return [Infinity] as any;
}

function is_infinity(a: Expr): boolean {
    return a[0] === Infinity;
}

function is_zero(a: Expr): a is [0] {
    return a[0] === 0;
}

function prim_list(e: Expr): PrimExpr[] {
    return is_zero(e) ? [] : [e[1], ...prim_list(e[2])];
}

function from_prim_list(ps: PrimExpr[]) {
    let result: Expr = [0];
    for (let i = ps.length - 1; i >= 0; i--) {
        result = [1, ps[i], result];
    }
    return result;
}

function infinity_FS(index: number): Expr {
    let result: Expr = [0];
    for (let i = 0; i < index; i++) result = [1, [result, [0]], [0]];
    return [1, [[0], result], [0]];
}

function to_OCN_IR(e: Expr): OCNDisplayIR {
    if (is_infinity(e)) return { type: 'constant', display: 'Limit', display_latex: '\\text{Limit}' };
    if (is_zero(e)) return { type: 'number', value: 0 };
    return merge_sum(prim_list(e).map(to_OCN_display_prim));
}

function to_OCN_display_prim(p: PrimExpr): OCNDisplayIR {
    const [v, a] = p;
    if (is_zero(v)) return { type: 'psi', arg: to_OCN_IR(a) };
    return { type: 'psi', sub: to_OCN_IR(v), arg: to_OCN_IR(a) };
}

function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }
    return lex_compare(prim_list(a), prim_list(b), prim_compare);
}

function prim_compare(a: PrimExpr, b: PrimExpr): number {
    return lex_compare(a, b, compare);
}

function cofinality(e: Expr): Expr | undefined {
    const ps = prim_list(e);
    if (ps.length === 0) return undefined;
    return cofinality_prim(ps[ps.length - 1]);
}

function cofinality_prim(p: PrimExpr): Expr | undefined {
    let [v, a] = p;
    if (is_zero(a)) {
        if (is_zero(v)) return undefined;
        let cf_v = cofinality(v);
        if (cf_v === undefined) return v;
        return cf_v;
    }
    let cf_a = cofinality(a);
    if (cf_a === undefined) return [0];
    if (compare(cf_a, v) <= 0) return cf_a;
    return [0];
}

function ZERO(): Expr {
    return [0];
}

function ONE_prim(): PrimExpr {
    return [ZERO(), ZERO()];
}

function from_nat(n: number): Expr {
    let result: Expr = [0];
    for (let i = 0; i < n; i++) {
        result = [1, ONE_prim(), result];
    }
    return result;
}

function to_nat(e: Expr): number {
    let ps = prim_list(e);
    if (ps.length === 0) return 0;
    if (prim_compare(ps[0], ONE_prim()) !== 0) throw new Error('not a natural number');
    return ps.length;
}

function prim_FS(p: PrimExpr, index: Expr): Expr {
    let [v, a] = p;
    if (is_zero(a)) {
        if (is_zero(v)) return ZERO();
        let cf_v = cofinality(v);
        if (cf_v === undefined) return index;
        return [1, [FS(v, index), [0]], [0]];
    }
    let cf_a = cofinality(a);
    if (cf_a === undefined) {
        let index_nat = to_nat(index);
        let pred_prim: PrimExpr = [v, FS(a, [0])];
        return from_prim_list(Array.from({ length: index_nat }, () => pred_prim));
    }
    if (compare(cf_a, v) <= 0) {
        return [1, [v, FS(a, index)], [0]];
    }
    let result: Expr = [0];
    let index_nat = to_nat(index);
    let cf_a_pred = FS(cf_a, [0]);
    for (let i = 0; i < index_nat; i++) {
        result = FS(a, [1, [cf_a_pred, result], [0]]);
    }
    return [1, [v, result], [0]];
}

function FS(e: Expr, index: Expr): Expr {
    if (is_infinity(e)) return infinity_FS(to_nat(index));
    if (is_zero(e)) return e;
    if (is_zero(e[2])) return prim_FS(e[1], index);
    return [1, e[1], FS(e[2], index)];
}

export const BOCF_EBO: NotationDefinition<Expr> = {
    id: 'bocf-ebo',
    name: "Buchholz's OCF",
    simple_name: 'BOCF (EBO)',
    category_id: 'category-ocf',
    is_limit: (e) => is_infinity(e) || cofinality(e) !== undefined,
    compare,
    FS: (e, index) => FS(e, from_nat(index)),
    display: make_OCN_display(to_OCN_IR),
    credit_text_id: 'credit.bocf',

    init: () => [INFINITY(), ZERO()],
};
