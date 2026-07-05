import { boolean_compare, lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

type Expr = [0] | [1, Expr, Expr];

function INFINITY(): Expr {
    return [Infinity] as any;
}

function is_infinity(a: Expr): boolean {
    return a[0] === Infinity;
}

function is_zero(a: Expr): a is [0] {
    return a[0] === 0;
}

function infinity_FS(index: number): Expr {
    let result: Expr = [0];
    for (let i = 0; i < index; i++) result = [1, result, [0]];
    return [1, [0], result];
}

type DisplayType = 'plain' | 'html_psi' | 'latex';

function display(e: Expr, type: DisplayType): string {
    let latex = type === 'latex';
    if (is_infinity(e)) return latex ? '\\text{Limit}' : 'Limit';
    if (is_zero(e)) return '0';
    let [, v, a] = e;
    let v_display = is_zero(v) ? undefined : display(v, type);
    let a_display = display(a, type);
    let psi = type === 'latex' ? '\\psi ' : 'ψ';
    switch (type) {
        case 'plain':
            return v_display === undefined ? 'ψ(' + a_display + ')' : 'ψ_{' + v_display + '}(' + a_display + ')';
        case 'html_psi':
            return v_display === undefined
                ? 'ψ(' + a_display + ')'
                : 'ψ<sub>' + v_display + '</sub>(' + a_display + ')';
        case 'latex':
            return v_display === undefined
                ? psi + '(' + a_display + ')'
                : psi + '_{' + v_display + '}(' + a_display + ')';
    }
}

function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }
    if (is_zero(a) || is_zero(b)) {
        return boolean_compare(!is_zero(a), !is_zero(b));
    }
    return lex_compare([a[1], a[2]], [b[1], b[2]], compare);
}

function cofinality(e: Expr): Expr | undefined {
    if (is_zero(e)) return undefined;
    let [, v, a] = e;
    if (is_zero(a)) {
        if (is_zero(v)) return undefined;
        let cf_v = cofinality(v);
        if (cf_v === undefined) return v;
        return cf_v;
    }
    let cf_a = cofinality(a);
    if (cf_a === undefined) return undefined;
    if (compare(cf_a, v) <= 0) return cf_a;
    return [0];
}

function ZERO(): Expr {
    return [0];
}

function from_nat(n: number): Expr {
    let result: Expr = [0];
    for (let i = 0; i < n; i++) {
        result = [1, [0], result];
    }
    return result;
}

function to_nat(e: Expr): number {
    if (is_zero(e)) return 0;
    if (compare(e[1], ZERO()) !== 0) throw new Error('not a natural number');
    return 1 + to_nat(e[2]);
}

function FS(e: Expr, index: Expr): Expr {
    if (is_infinity(e)) return infinity_FS(to_nat(index));
    if (is_zero(e)) return e;

    let [, v, a] = e;
    if (is_zero(a)) {
        if (is_zero(v)) return ZERO();
        let cf_v = cofinality(v);
        if (cf_v === undefined) return index;
        return [1, FS(v, index), [0]];
    }
    let cf_a = cofinality(a);
    if (cf_a === undefined) {
        return [1, v, FS(a, [0])];
    }
    if (compare(cf_a, v) <= 0) {
        return [1, v, FS(a, index)];
    }
    let result: Expr = [0];
    let index_nat = to_nat(index);
    let cf_a_pred = FS(cf_a, [0]);
    for (let i = 0; i < index_nat; i++) {
        result = FS(a, [1, cf_a_pred, result]);
    }
    return [1, v, result];
}

export const NOCF_EBO: NotationDefinition<Expr> = {
    id: 'nocf-ebo',
    name: 'NOCF (EBO)',
    is_limit: (e) => is_infinity(e) || cofinality(e) !== undefined,
    compare,
    FS: (e, index) => FS(e, from_nat(index)),
    display: {
        plain: (e) => display(e, 'plain'),
        html: (e) => display(e, 'html_psi'),
        latex: (e) => display(e, 'latex'),
    },
    credit_text_id: 'credit.nocf',

    init: () => [INFINITY(), ZERO()],
};
