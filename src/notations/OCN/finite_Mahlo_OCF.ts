import { boolean_compare, lex_compare, number_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { make_OCN_display, type OCNDisplayIR, display_OCN_IR, merge_sum } from '@/notations/OCN/OCN_utils.ts';

type Expr = ['zero'] | ['sum', Expr[]] | ['omega_pow', Expr] | ['M', number] | ['psi', Expr, Expr];

function INFINITY(): Expr {
    return [Infinity] as any;
}

function zero(): Expr {
    return ['zero'];
}

function one(): Expr {
    return ['omega_pow', zero()];
}

function omega(): Expr {
    return ['omega_pow', one()];
}

function Omega(): Expr {
    return ['M', 1];
}

function M_index(n: number): Expr {
    return ['M', n];
}

function is_infinity(e: Expr) {
    return '' + e === '' + Infinity;
}

function is_zero(e: Expr): boolean {
    return e[0] === 'zero';
}

function is_one(e: Expr): boolean {
    return e[0] === 'omega_pow' && is_zero(e[1]);
}

function prim_list(e: Expr): Expr[] {
    if (is_zero(e)) return [];
    if (e[0] === 'sum') return e[1];
    return [e];
}

function from_prim_list(es: Expr[]): Expr {
    if (es.length === 0) return zero();
    if (es.length === 1) return es[0];
    return ['sum', es];
}

function to_OCN_IR(e: Expr): OCNDisplayIR {
    if (is_infinity(e)) return { type: 'constant', display: 'Limit', display_latex: '\\text{Limit}' };
    switch (e[0]) {
        case 'zero':
            return { type: 'number', value: 0 };
        case 'sum':
            return merge_sum(e[1].map(to_OCN_IR));
        case 'omega_pow': {
            if (is_zero(e[1])) return { type: 'number', value: 1 };
            if (is_one(e[1])) return { type: 'omega' };
            return { type: 'omega', sup: to_OCN_IR(e[1]) };
        }
        case 'M': {
            if (e[1] === 1) return { type: 'Omega' };
            if (e[1] === 2) return { type: 'constant', display: 'M', display_latex: '\\mathrm{M}' };
            return {
                type: 'constant',
                display: 'Ξ',
                display_latex: '\\Xi',
                arg: { type: 'number', value: e[1] },
            };
        }
        case 'psi': {
            const sub = to_OCN_IR(e[1]);
            const arg = to_OCN_IR(e[2]);
            if (display_OCN_IR(sub, 'plain') === 'Ω') return { type: 'psi', arg };
            return { type: 'psi', sub, arg };
        }
    }
}

function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }

    function impl(a: Expr, b: Expr): number {
        if (a[0] === 'zero' || b[0] === 'zero') {
            return boolean_compare(!is_zero(a), !is_zero(b));
        }
        if (a[0] === 'sum' || b[0] === 'sum') {
            return lex_compare(prim_list(a), prim_list(b), impl);
        }
        if (a[0] === 'omega_pow' && b[0] === 'omega_pow') {
            return impl(a[1], b[1]);
        }
        if (a[0] === 'omega_pow') {
            return impl(a[1], b);
        }
        if (b[0] === 'omega_pow') {
            return impl(a, b[1]);
        }
        if (a[0] === 'M') {
            switch (b[0]) {
                case 'M':
                    return number_compare(a[1], b[1]);
                case 'psi':
                    return impl(a, b[1]) < 0 ? -1 : 1;
            }
        }
        if (b[0] === 'M') return -impl(b, a);
        let cmp_v = compare(a[1], b[1]);
        if (cmp_v === 0) return compare(a[2], b[2]);
        if (cmp_v < 0) [a, b] = [b, a];
        return cmp_v * (compare(a, b[1]) < 0 ? -1 : 1);
    }

    return impl(a, b);
}

function m_deg(a: Expr): number {
    switch (a[0]) {
        case 'zero':
        case 'sum':
        case 'omega_pow':
            return 0;
        case 'M':
            return a[1];
        case 'psi':
            return m_deg(a[1]) - 1;
    }
}

function add(a: Expr, b: Expr): Expr {
    return from_prim_list([...prim_list(a), ...prim_list(b)]);
}

function omega_pow(a: Expr): Expr {
    if (a[0] === 'zero' || a[0] === 'sum' || a[0] === 'omega_pow') return ['omega_pow', a];
    return a;
}

function mul_nat(e: Expr, n: number): Expr {
    return from_prim_list(Array.from({ length: n }, () => e));
}

function from_nat(n: number): Expr {
    return mul_nat(one(), n);
}

function to_nat(e: Expr): number {
    let ps = prim_list(e);
    if (ps.length === 0) return 0;
    if (compare(ps[0], one()) !== 0) throw new Error('not a natural number');
    return ps.length;
}

function iterate(fn: (x: Expr) => Expr, initial: Expr): (index: Expr) => Expr {
    return (index: Expr): Expr => {
        const i_nat = to_nat(index);
        let current = initial;
        for (let i = 0; i < i_nat; i++) current = fn(current);
        return current;
    };
}

function iterate_plus_one(fn: (x: Expr) => Expr, base: Expr): (index: Expr) => Expr {
    return (index: Expr) => {
        const i_nat = to_nat(index);
        let current = base;
        if (i_nat !== 0) current = add(current, one());
        for (let i = 1; i < i_nat; i++) current = fn(current);
        return current;
    };
}

interface AdmissibleData {
    fn_def: (x: Expr) => Expr;
    psi0_cf: Expr;
    psi0_FS: (x: Expr) => Expr;
}

function cofinality(e: Expr): Expr {
    switch (e[0]) {
        case 'zero': {
            return zero();
        }
        case 'sum': {
            return cofinality(e[1][e[1].length - 1]);
        }
        case 'omega_pow': {
            let cf_e1 = cofinality(e[1]);
            if (is_zero(cf_e1)) return one();
            if (is_one(cf_e1)) return omega();
            return cf_e1;
        }
        case 'M': {
            return e;
        }
        case 'psi': {
            const d = m_deg(e);
            if (d > 0) return e;
            let [, v, a] = e;
            if (is_zero(a)) {
                return compute_data(v).psi0_cf;
            }
            let cf_a = cofinality(a);
            if (is_zero(cf_a) || is_one(cf_a)) return omega();
            if (compare(cf_a, v) < 0) return cf_a;
            return omega();
        }
    }
}

function infinity_FS(index: number): Expr {
    let result: Expr;
    if (index === 0) result = zero();
    else result = M_index(index);
    return ['psi', Omega(), result];
}

function FS(e: Expr, index: Expr): Expr {
    if (is_infinity(e)) return infinity_FS(to_nat(index));
    switch (e[0]) {
        case 'zero': {
            return zero();
        }
        case 'sum': {
            let tail_FS = FS(e[1][e[1].length - 1], index);
            return from_prim_list([...e[1].slice(0, -1), ...prim_list(tail_FS)]);
        }
        case 'omega_pow': {
            if (is_zero(e[1])) return zero();
            let cf_e1 = cofinality(e[1]);
            if (is_one(cf_e1)) {
                let wp_prev = omega_pow(FS(e[1], zero()));
                return mul_nat(wp_prev, to_nat(index));
            } else {
                return omega_pow(FS(e[1], index));
            }
        }
        case 'M': {
            return index;
        }
        case 'psi': {
            const d = m_deg(e);
            if (d > 0) return index;
            let [, v, a] = e;
            let cf_a = cofinality(a);
            if (is_zero(cf_a)) {
                return compute_data(v).psi0_FS(index);
            }
            if (is_one(cf_a)) {
                let a_prev = FS(a, zero());
                const base: Expr = ['psi', v, a_prev];
                return iterate_plus_one(compute_data(v).fn_def, base)(index);
            }
            if (compare(cf_a, v) < 0) {
                return ['psi', v, FS(a, index)];
            } else {
                return ['psi', v, iterate((x) => FS(a, ['psi', cf_a, x]), zero())(index)];
            }
        }
    }
}

function compute_data(e: Expr): AdmissibleData {
    function cache(data: AdmissibleData): AdmissibleData {
        (e as any).data = data;
        return data;
    }

    if ((e as any).data !== undefined) return (e as any).data;

    switch (e[0]) {
        case 'zero':
        case 'sum':
        case 'omega_pow': {
            throw new Error('Illegal state');
        }
        case 'M': {
            return {
                fn_def: omega_pow,
                psi0_cf: omega(),
                psi0_FS: e[1] === 1 ? iterate(omega_pow, zero()) : iterate_plus_one(omega_pow, ['M', e[1] - 1]),
            };
        }
        case 'psi': {
            const d = m_deg(e);
            if (d === 0) throw new Error('Illegal state');
            const [, v, a] = e;
            const cf_a = cofinality(a);
            const cmp = compare(cf_a, v);
            if (is_zero(cf_a)) {
                return cache(compute_data(v));
            } else if (is_one(cf_a)) {
                const v_data = compute_data(v);
                const a_prev = FS(a, zero());
                const e_prev: Expr = ['psi', v, a_prev];
                return cache({
                    fn_def: v_data.fn_def,
                    psi0_cf: omega(),
                    psi0_FS: iterate_plus_one(v_data.fn_def, e_prev),
                });
            } else if (cmp < 0) {
                const v_data = compute_data(v);
                return cache({
                    fn_def: v_data.fn_def,
                    psi0_cf: cf_a,
                    psi0_FS: (x) => ['psi', v, FS(a, x)],
                });
            } else if (cmp === 0) {
                const fn_def = (x: Expr): Expr => ['psi', v, FS(a, x)];
                return cache({
                    fn_def: fn_def,
                    psi0_cf: omega(),
                    psi0_FS: iterate(fn_def, zero()),
                });
            } else {
                const v_data = compute_data(v);
                return cache({
                    fn_def: v_data.fn_def,
                    psi0_cf: omega(),
                    psi0_FS: (i) => ['psi', v, iterate((x) => FS(a, ['psi', cf_a, x]), zero())(i)],
                });
            }
        }
    }
}

function is_limit(e: Expr): boolean {
    if (is_infinity(e)) return true;
    let cf_e = cofinality(e);
    return !is_zero(cf_e) && !is_one(cf_e);
}

export const finite_Mahlo_OCF: NotationDefinition<Expr> = {
    id: 'finite-mahlo-ocf',
    name: 'Finite Mahlo ordinal OCF',
    simple_name: 'OCF (n-Mahlo)',
    category_id: 'category-ocf',
    is_limit,
    compare,
    FS: (e, index) => FS(e, from_nat(index)),
    display: make_OCN_display(to_OCN_IR),
    credit_text_id: 'credit.bocf',

    init: () => [INFINITY(), zero()],

    debug: { cofinality },
};
