import { bind2, boolean_compare, lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

type Expr = ['zero'] | ['sum', Expr[]] | ['omega_pow', Expr] | ['Omega', Expr] | ['I'] | ['psi', Expr, Expr];

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
    return ['Omega', one()];
}

function I(): Expr {
    return ['I'];
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

function is_omega(e: Expr): boolean {
    return e[0] === 'omega_pow' && is_one(e[1]);
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
        if (a[0] === 'I') {
            switch (b[0]) {
                case 'Omega':
                    return impl(a, b[1]);
                case 'I':
                    return 0;
                case 'psi':
                    return impl(a, b[1]) < 0 ? -1 : 1;
            }
        }
        if (b[0] === 'I') return -impl(b, a);
        if (a[0] === 'Omega') {
            switch (b[0]) {
                case 'Omega':
                    return impl(a[1], b[1]);
                case 'psi':
                    if (b[1][0] === 'I') {
                        return impl(a[1], b);
                    }
                    return impl(a, b[1]) < 0 ? -1 : 1;
            }
        }
        if (b[0] === 'Omega') return -impl(b, a);
        if (a[1][0] === 'I') {
            if (b[1][0] === 'I') return impl(a[2], b[2]);
            return impl(a, b[1]);
        }
        if (b[1][0] === 'I') return -impl(b, a);
        return lex_compare([a[1], a[2]], [b[1], b[2]], impl);
    }

    return impl(a, b);
}

type DisplayType = 'plain' | 'html_psi' | 'latex';

function display(e: Expr, type: DisplayType): string {
    let latex = type === 'latex';
    if (is_infinity(e)) return latex ? '\\text{Limit}' : 'Limit';

    function impl(a: Expr): string {
        switch (a[0]) {
            case 'zero': {
                return '0';
            }
            case 'sum': {
                return a[1].map(impl).join('+');
            }
            case 'omega_pow': {
                let str_a1 = impl(a[1]);
                if (str_a1 === '0') return '1';
                if (str_a1 === '1') return latex ? '\\omega' : 'ω';
                switch (type) {
                    case 'plain':
                        return 'ω(' + str_a1 + ')';
                    case 'html_psi':
                        return 'ω<sup>' + str_a1 + '</sup>';
                    case 'latex':
                        return '\\omega^{' + str_a1 + '}';
                    default:
                        throw new Error('unreachable');
                }
            }
            case 'Omega': {
                let str_a1 = impl(a[1]);
                if (str_a1 === '1') return latex ? '\\Omega' : 'Ω';
                switch (type) {
                    case 'plain':
                        return 'Ω(' + str_a1 + ')';
                    case 'html_psi':
                        return 'Ω<sub>' + str_a1 + '</sub>';
                    case 'latex':
                        return '\\Omega_{' + str_a1 + '}';
                    default:
                        throw new Error('unreachable');
                }
            }
            case 'I': {
                return latex ? '\\mathrm{I}' : 'I';
            }
            case 'psi': {
                let str_a1 = impl(a[1]);
                let str_a2 = impl(a[2]);
                if (str_a1 === 'Ω') return 'ψ(' + str_a2 + ')';
                switch (type) {
                    case 'plain':
                        return 'ψ_{' + str_a1 + '}(' + str_a2 + ')';
                    case 'html_psi':
                        return 'ψ<sub>' + str_a1 + '</sub>(' + str_a2 + ')';
                    case 'latex':
                        return '\\psi_{' + str_a1 + '}(' + str_a2 + ')';
                    default:
                        throw new Error('unreachable');
                }
            }
        }
    }

    return impl(e);
}

function add(a: Expr, b: Expr): Expr {
    return from_prim_list([...prim_list(a), ...prim_list(b)]);
}

function omega_pow(a: Expr): Expr {
    if (a[0] === 'zero' || a[0] === 'sum' || a[0] === 'omega_pow') return ['omega_pow', a];
    return a;
}

function Omega_index(a: Expr): Expr {
    if (is_zero(a)) return zero();
    if (a[0] === 'I' || (a[0] === 'psi' && a[1][0] === 'I')) return a;
    return ['Omega', a];
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
        case 'Omega': {
            let cf_e1 = cofinality(e[1]);
            if (is_one(cf_e1)) return e;
            return cf_e1;
        }
        case 'I': {
            return e;
        }
        case 'psi': {
            let [, v, a] = e;
            if (is_zero(a)) {
                return omega();
            }
            let cf_a = cofinality(a);
            if (is_zero(cf_a) || is_one(cf_a)) return omega();
            if (compare(cf_a, v) < 0) return cf_a;
            return omega();
        }
    }
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

function infinity_FS(index: number): Expr {
    let result: Expr;
    if (index === 0) result = zero();
    else if (index === 1) result = I();
    else {
        result = add(I(), one());
        for (let i = 0; i < index - 2; i++) result = ['omega_pow', result];
    }
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
        case 'Omega': {
            let cf_e1 = cofinality(e[1]);
            if (is_one(cf_e1)) return index;
            let e1_FS = FS(e[1], index);
            return Omega_index(e1_FS);
        }
        case 'I': {
            return index;
        }
        case 'psi': {
            let [, v, a] = e;
            let cf_a = cofinality(a);
            if (is_zero(cf_a) || is_one(cf_a)) {
                let i_nat = to_nat(index);
                let base: Expr;
                if (is_zero(a)) {
                    if (v[0] === 'I' || (v[0] === 'Omega' && is_one(v[1]))) {
                        base = zero();
                    } else {
                        if (v[0] !== 'Omega') throw new Error('Illegal state');
                        base = Omega_index(FS(v[1], zero()));
                    }
                } else {
                    let a_prev = FS(a, zero());
                    base = ['psi', v, a_prev];
                }
                if (i_nat === 0) return base;
                let result = add(base, one());
                for (let i = 0; i < i_nat - 1; i++) {
                    if (v[0] === 'Omega') {
                        result = ['omega_pow', result];
                    } else {
                        result = ['Omega', result];
                    }
                }
                return result;
            }
            if (compare(cf_a, v) < 0) {
                return ['psi', v, FS(a, index)];
            } else {
                let i_nat = to_nat(index);
                let result = zero();
                for (let i = 0; i < i_nat; i++) {
                    result = FS(a, ['psi', cf_a, result]);
                }
                return ['psi', v, result];
            }
        }
    }
}

function is_limit(e: Expr): boolean {
    if (is_infinity(e)) return true;
    let cf_e = cofinality(e);
    return !is_zero(cf_e) && !is_one(cf_e);
}

export const Inacc_OCF: NotationDefinition<Expr> = {
    id: 'inacc-ocf',
    name: 'Inaccessible ordinal OCF',
    simple_name: 'OCF (I)',
    category_id: 'category-ocf',
    is_limit,
    compare,
    FS: (e, index) => FS(e, from_nat(index)),
    display: {
        plain: bind2(display, 'plain'),
        html: bind2(display, 'html_psi'),
        latex: bind2(display, 'latex'),
    },
    credit_text_id: 'credit.bocf',

    init: () => [INFINITY(), zero()],

    debug: { cofinality },
};
