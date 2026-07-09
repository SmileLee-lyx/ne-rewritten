import { bind2, boolean_compare, lex_compare, tuple_lex_compare_by } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { merge_sum } from '@/notations/notation_utils.ts';

type VeblenList = [VeblenList, Expr][];
// 0: 0
// 1: sum
// 2: φ
type Expr = [0] | [1, Expr[]] | [2, VeblenList, Expr];

const INFINITY: Expr = Symbol('infinity') as any;

function is_infinity(e: Expr) {
    return e === INFINITY;
}

type DisplayType = 'plain' | 'html' | 'latex';

function display_list_impl(l: VeblenList, d: (e: Expr) => string): string {
    function impl_list(l: VeblenList): string {
        if (l.length === 0) return '';
        if (list_is_finite(l[0][0])) {
            const max = list_to_nat(l[0][0]);
            const values = Array<Expr>(max + 1).fill(zero());
            for (let [p, v] of l) values[list_to_nat(p)] = v;
            return values.map(d).toReversed().join(',');
        }
        return l.map(impl_list_entry).join(',');
    }

    function impl_list_entry([p, v]: VeblenList[number]): string {
        if (p.length === 0) return d(v) + '@0';
        if (p.length === 1 && p[0][0].length === 0) return d(v) + '@' + d(p[0][1]);
        return d(v) + '@(' + impl_list(p) + ')';
    }

    return impl_list(l);
}

function is_finite(e: Expr): boolean {
    if (e[0] === 0) return true;
    if (e[0] === 2) return is_one(e);
    return is_one(e[1][0]);
}

function to_nat(e: Expr): number {
    return prim_list(e).length;
}

function from_nat(n: number): Expr {
    return from_prim_list(Array<Expr>(n).fill(one()));
}

function list_is_finite(l: VeblenList): boolean {
    return l.length === 0 || (l.length === 1 && l[0][0].length === 0 && is_finite(l[0][1]));
}

function list_to_nat(l: VeblenList): number {
    if (l.length === 0) return 0;
    return to_nat(l[0][1]);
}

function list_from_nat(n: number): VeblenList {
    if (n === 0) return [];
    return [[[], from_nat(n)]];
}

function add_tail_to_list(l: VeblenList, tail: Expr): VeblenList {
    let new_l: VeblenList = [];
    for (let [p, v] of l) {
        if (!list_is_finite(p)) new_l.push([p, v]);
        else new_l.push([list_from_nat(list_to_nat(p) + 1), v]);
    }
    if (!is_zero(tail)) new_l.push([[], tail]);
    return new_l;
}

function display(e: Expr, type: DisplayType): string {
    const is_latex = type === 'latex';
    if (is_infinity(e)) return is_latex ? '\\mathrm{Limit}' : 'Limit';

    function impl(e: Expr): string {
        switch (e[0]) {
            case 0:
                return '0';
            case 1:
                return merge_sum(e[1].map(impl));
            case 2:
                const phi = is_latex ? '\\varphi ' : 'φ';
                if (e[1].length === 0) {
                    if (is_zero(e[2])) return '1';
                    if (is_one(e[2])) return is_latex ? '\\omega' : 'ω';
                    if (type === 'html') {
                        return 'ω<sup>' + impl(e[2]) + '</sup>';
                    } else if (type === 'latex') {
                        return '\\omega^{' + impl(e[2]) + '}';
                    }
                    return phi + '(' + impl(e[2]) + ')';
                }
                let l = add_tail_to_list(e[1], e[2]);
                return phi + '(' + display_list_impl(l, impl) + ')';
            default:
                throw new Error('Unreachable');
        }
    }

    return impl(e);
}

function display_separate(e: Expr, type: DisplayType): string {
    const is_latex = type === 'latex';
    if (is_infinity(e)) return is_latex ? '\\mathrm{Limit}' : 'Limit';

    function impl(e: Expr): string {
        switch (e[0]) {
            case 0:
                return '0';
            case 1:
                return merge_sum(e[1].map(impl));
            case 2:
                const phi = is_latex ? '\\varphi ' : 'φ';
                if (e[1].length === 0) {
                    if (is_zero(e[2])) return '1';
                    if (is_one(e[2])) return is_latex ? '\\omega' : 'ω';
                    if (type === 'html') {
                        return 'ω<sup>' + impl(e[2]) + '</sup>';
                    } else if (type === 'latex') {
                        return '\\omega^{' + impl(e[2]) + '}';
                    }
                    return phi + '(' + impl(e[2]) + ')';
                }
                return phi + '(' + display_list_impl(e[1], impl) + ';' + impl(e[2]) + ')';
            default:
                throw new Error('Unreachable');
        }
    }

    return impl(e);
}

function zero(): Expr {
    return [0];
}

function one(): Expr {
    return [2, [], zero()];
}

function is_zero(e: Expr): boolean {
    return e[0] === 0;
}

function is_one(e: Expr) {
    return e[0] === 2 && e[1].length === 0 && is_zero(e[2]);
}

function infinity_FS(index: number): Expr {
    let list: VeblenList = [];
    for (let i = 0; i < index; i++) {
        list = [[list, one()]];
    }
    return [2, list, zero()];
}

function is_limit(e: Expr): boolean {
    if (is_infinity(e)) return true;
    if (e[0] === 0) return false;
    else if (e[0] === 1) return is_limit(e[1][e[1].length - 1]);
    return e[1].length !== 0 || !is_zero(e[2]);
}

function list_is_limit(l: VeblenList): boolean {
    if (l.length === 0) return false;
    const [p, v] = l[l.length - 1];
    return p.length > 0 || is_limit(v);
}

function prim_list(a: Expr): Expr[] {
    switch (a[0]) {
        case 0:
            return [];
        case 1:
            return a[1];
        case 2:
            return [a];
    }
}

function from_prim_list(a: Expr[]): Expr {
    if (a.length === 0) return [0];
    if (a.length === 1) return a[0];
    return [1, a];
}

function count_unbounded(l: VeblenList, bound: Expr): number {
    let result = 0;
    for (let [p, v] of l) {
        result += count_unbounded(p, bound);
        if (compare(v, bound) >= 0) result++;
    }
    return result;
}

function bounded_by(l: VeblenList, bound: Expr): boolean {
    return count_unbounded(l, bound) === 0;
}

function list_lex_compare(a: VeblenList, b: VeblenList): number {
    return lex_compare(a, b, tuple_lex_compare_by([list_lex_compare, compare]));
}

function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }

    if (a[0] === 0 || b[0] === 0) {
        return boolean_compare(!is_zero(a), !is_zero(b));
    }
    if (a[0] === 1 || b[0] === 1) {
        return lex_compare(prim_list(a), prim_list(b), compare);
    }
    let list_cmp = list_lex_compare(a[1], b[1]);
    if (list_cmp === 0) return compare(a[2], b[2]);
    if (list_cmp < 0) [a, b] = [b, a];

    // in standard form, now (a < b) iff b contains an ordinal >= a

    return list_cmp * (bounded_by(b[1], a) && compare(b[2], a) < 0 ? 1 : -1);
}

function get_abnormal(l: VeblenList, current?: VeblenList): Expr | undefined {
    if (current === undefined) current = l;
    if (current.length === 0) return undefined;

    const [p, v] = current[current.length - 1];
    if (v[0] !== 2) return undefined;
    if (is_one(v)) return get_abnormal(l, p);

    if (list_lex_compare(l, v[1]) < 0 && count_unbounded(l, v) === 1) return v;
    return undefined;
}

function is_normal_tail(l: VeblenList, v: Expr): boolean {
    if (v[0] !== 2) return true;
    return list_lex_compare(l, v[1]) >= 0 || !bounded_by(l, v);
}

function normalized_phi(l: VeblenList, v: Expr): Expr {
    if (!is_normal_tail(l, v)) return v;
    if (is_zero(v)) {
        let abnormal = get_abnormal(l);
        if (abnormal !== undefined) return abnormal;
    }
    return [2, l, v];
}

function normalize(e: Expr): Expr {
    if (e[0] !== 2) throw new Error('illegal argument');
    return normalized_phi(e[1], e[2]);
}

const MARK: Expr = Symbol('mark') as any;

function replace_mark(template: Expr, value: Expr): Expr {
    function impl(t: Expr): Expr {
        if (t === MARK) return value;

        switch (t[0]) {
            case 0:
                return [0];
            case 1:
                return [1, t[1].map(impl)];
            case 2:
                return [2, impl_list(t[1]), impl(t[2])];
        }
    }

    function impl_list(l: VeblenList): VeblenList {
        const result = l.map(impl_entry);
        if (result.length > 0 && is_zero(result[result.length - 1][1])) result.pop();
        return result;
    }

    function impl_entry([p, v]: VeblenList[number]): VeblenList[number] {
        return [impl_list(p), impl(v)];
    }

    return impl(template);
}

type FS_Type = 'plain' | 'iterate';

function prev_list(l: VeblenList): VeblenList {
    const [p, v] = l[l.length - 1];
    const v_prev = FS(v, 0);
    if (is_zero(v_prev)) return l.slice(0, -1);
    return [...l.slice(0, -1), [p, v_prev]];
}

function create_template_list(l: VeblenList, index: number): [VeblenList, FS_Type] {
    const [p, v] = l[l.length - 1];
    if (is_limit(v)) return [[...l.slice(0, -1), [p, FS(v, index)]], 'plain'];
    const v_prev = FS(v, 0);
    let new_l = l.slice(0, -1);
    if (!is_zero(v_prev)) new_l.push([p, v_prev]);

    if (!list_is_limit(p)) {
        new_l.push([prev_list(p), MARK]);
        return [new_l, 'iterate'];
    }
    const [new_p, type] = create_template_list(p, index);
    new_l.push([new_p, one()]);
    return [new_l, type];
}

function create_template(l: VeblenList, index: number): [Expr, FS_Type] {
    if (!list_is_limit(l)) {
        const l_prev = prev_list(l);
        return [[2, l_prev, MARK], 'iterate'];
    }

    const [tl, type] = create_template_list(l, index);
    if (type === 'plain') return [[2, tl, MARK], 'plain'];
    else return [[2, tl, zero()], 'iterate'];
}

function FS(a: Expr, index: number): Expr {
    if (is_infinity(a)) return infinity_FS(index);

    if (a[0] === 0) return zero();
    if (a[0] === 1) {
        const tail_FS = FS(a[1][a[1].length - 1], index);
        return from_prim_list([...a[1].slice(0, -1), ...prim_list(tail_FS)]);
    }
    if (is_limit(a[2])) {
        const tail_FS = FS(a[2], index);
        return normalized_phi(a[1], tail_FS);
    }
    if (a[1].length === 0) {
        if (is_zero(a[2])) return zero();
        let tail_FS = FS(a[2], 0);
        let result: Expr = normalized_phi([], tail_FS);
        return from_prim_list(Array<Expr>(index).fill(result));
    }

    let initial_value: Expr;
    if (is_zero(a[2])) initial_value = zero();
    else initial_value = [1, [normalized_phi(a[1], FS(a[2], 0)), one()]];

    const [t, type] = create_template(a[1], index);
    if (type === 'plain') return normalize(replace_mark(t, initial_value));
    if (index === 0) return initial_value;
    let current = normalize(replace_mark(t, initial_value));
    for (let i = 1; i < index; i++) current = replace_mark(t, current);
    return current;
}

export const VeblenPhi: NotationDefinition<Expr> = {
    id: 'veblen-phi',
    name: "Extended Veblen's φ Function",
    simple_name: 'BHO φ',
    is_limit,
    FS,
    compare,
    display: {
        plain: bind2(display, 'plain'),
        html: bind2(display, 'html'),
        latex: bind2(display, 'latex'),
    },
    display_equiv: {
        separate: {
            plain: bind2(display_separate, 'plain'),
            html: bind2(display_separate, 'html'),
            latex: bind2(display_separate, 'latex'),
        },
    },
    init: () => [INFINITY, zero()],
};
