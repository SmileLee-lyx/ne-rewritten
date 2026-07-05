import { deepcopy } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type PrimExpr = [true, number, Expr];
export type SumExpr = [false, Expr, Expr];
export type Expr = 0 | PrimExpr | SumExpr;
export type NExpr = PrimExpr | SumExpr;

export function is_infinity(m: Expr) {
    return '' + m === 'true,Infinity';
}

type DisplayStyle = 'plain' | 'html-psi' | 'html-plain';

export function LMN_display(x: Expr, style: DisplayStyle): string {
    if (is_infinity(x)) return 'Limit';
    if (x === 0) return style === 'html-psi' ? '0' : '';
    if (x[0]) {
        if (style === 'html-psi') {
            return 'ψ<sub>' + x[1] + '</sub>(' + LMN_display(x[2], style) + ')';
        } else {
            if (x[2] === 0) return '' + x[1];
            let x2_display = LMN_display(x[2], style);
            return style === 'plain' ? x[1] + '(' + x2_display + ')' : x[1] + '<sup>' + x2_display + '</sup>';
        }
    } else {
        return LMN_display(x[1], style) + '+' + LMN_display(x[2], style);
    }
}

export function from_display(str: string): Expr {
    str = str.trim();
    const len = str.length;

    function parse(start: number): [Expr, number] {
        if (start >= len || str[start] === ')') return [0, start];
        const [first, pos1] = parseTerm(start);
        const terms = [first];
        let pos = pos1;
        while (pos < len && str[pos] === '+') {
            pos++;
            const [next, nextPos] = parseTerm(pos);
            terms.push(next);
            pos = nextPos;
        }
        let result = terms[0];
        for (let i = 1; i < terms.length; i++) result = [false, result, terms[i]];
        return [result, pos];
    }

    function parseTerm(start: number): [Expr, number] {
        if (start >= len || !/\d/.test(str[start])) throw new Error('illegal input string: ' + str);
        let end = start;
        while (end < len && /\d/.test(str[end])) end++;
        const num = parseInt(str.slice(start, end), 10);
        if (end < len && str[end] === '(') {
            const [innerExpr, afterInner] = parse(end + 1);
            if (afterInner >= len || str[afterInner] !== ')') throw new Error('illegal input string: ' + str);
            return [[true, num, innerExpr], afterInner + 1];
        }
        return [[true, num, 0], end];
    }

    const [expr, endPos] = parse(0);
    if (endPos !== len) throw new Error('illegal input string: ' + str);
    return expr;
}

export var LMN_compare = (x: Expr, y: Expr): number => {
    if (x === 0) {
        return y === 0 ? 0 : -1;
    }
    if (y === 0) return 1;
    if (x[0]) {
        if (y[0]) {
            if (x[1] < y[1]) return -1;
            if (x[1] > y[1]) return 1;
            return LMN_compare(x[2], y[2]);
        } else {
            return LMN_compare(x, y[1]) <= 0 ? -1 : 1;
        }
    } else {
        if (y[0]) {
            return LMN_compare(x[1], y) < 0 ? -1 : 1;
        } else {
            let cmp = LMN_compare(x[1], y[1]);
            if (cmp) return cmp;
            return LMN_compare(x[2], y[2]);
        }
    }
};

export function LMN_is_limit(x: Expr): boolean {
    if (is_infinity(x)) return true;
    if (x === 0) return false;
    if (x[0]) return x[1] !== 0 || x[2] !== 0;
    return LMN_is_limit(x[2]);
}

const data: Record<string, Expr[]> = {};

function max_summand(x: Expr): Expr {
    if (x === 0 || x[0]) return x;
    let x1 = max_summand(x[1]),
        x2 = max_summand(x[2]);
    if (LMN_compare(x1, x2) < 0) return x2;
    else return x1;
}

function cut0(x: Expr): Expr {
    if (x === 0) {
        return 0;
    } else if (x[0]) {
        return [true, x[1], cut0(x[2])];
    } else {
        return x[2]
            ? LMN_compare(x[1], max_summand(x[2])) < 0
                ? cut0(x[2])
                : [false, cut0(x[1]), cut0(x[2])]
            : cut0(x[1]);
    }
}

function L(x0: Expr): PrimExpr[] {
    let x = x0,
        lx: PrimExpr[] = [];
    while (x) {
        if (x[0]) {
            lx.push(x);
            if ((x = x[2]) === 0) break;
        } else {
            x = x[2];
        }
    }
    return lx;
}

function change(x: Expr, y: Expr): Expr {
    let x1 = deepcopy(x),
        lx = L(x1),
        n = lx.length - 1;
    if (lx[n] === x1) return y;
    let prev = n ? lx[n - 1] : x1;
    while ((prev as NExpr)[2] !== lx[n]) prev = (prev as NExpr)[2];
    (prev as NExpr)[2] = y;
    return x1;
}

function it(x: Expr, n: number): Expr {
    return n ? change(x, it(x, n - 1)) : 0;
}

function term_tier(x: Expr): number {
    let n = 0;
    while (LMN_compare(x, [true, n + 1, 0]) >= 0) ++n;
    return n;
}

function inner(x: Expr): Expr {
    let n = term_tier(x),
        Lx = L(x);
    let m = Lx.slice(1).findIndex((xj) => term_tier(xj) === n);
    if (m === -1) return 0;
    let A = (Lx[m] as NExpr)[2];
    while (!(A as NExpr)[0]) {
        if (term_tier(A) === n) return A;
        A = (A as NExpr)[2];
    }
    return (A as NExpr)[1] === n ? A : 0;
}

function is_critical(x: Expr): boolean {
    let n = term_tier(x),
        lx = L(x);
    return (
        lx.findIndex(
            (xi, i) =>
                LMN_compare(x, xi) < 0 &&
                term_tier(xi) === n &&
                lx.slice(i + 1).every((xj) => LMN_compare(xj, [true, n + 1, 0]) >= 0) &&
                lx.slice(0, i).every((xj) => LMN_compare(xj, [true, n, 0]) >= 0),
        ) >= 0
    );
}

function subtract(c: Expr, b: Expr): Expr {
    if (b === 0) return c;
    if (c === 0) return 0;
    let b1 = b[0] ? b : b[1],
        c1 = c[0] ? c : c[1],
        cmp = LMN_compare(b1, c1);
    if (cmp < 0) return c;
    if (cmp > 0) return 0;
    return subtract(c[0] ? 0 : c[2], b[0] ? 0 : b[2]);
}

function lift(x: Expr, a: PrimExpr, s: PrimExpr): Expr {
    if (x === 0 || (x[0] && LMN_compare(x, a) < 0)) return x;
    if (!x[0]) return [false, lift(x[1], a, s), lift(x[2], a, s)];
    if (a[1] < x[1]) return [true, x[1] - a[1] + s[1], lift(x[2], a, s)];
    return [true, s[1], cut0([false, s[2], lift(subtract(x[2], a[2]), a, s)])];
}

function is_one(x: Expr) {
    return '' + x === '' + [true, 0, 0];
}

function LMN_FS(x: Expr, index: number): Expr {
    if ('' + x === 'true,Infinity') {
        let res: Expr = 0;
        for (let i = index; i >= 0; --i) res = [true, i, res];
        return [true, 0, res];
    }
    if (x === 0) return 0;
    if (!x[0]) {
        let x2 = x[2];
        if (is_one(x2)) return x[1];
        return cut0([x[0], x[1], LMN_FS(x2, index)]);
    }
    let x1 = deepcopy(x);
    let lx = L(x1),
        xn = lx[lx.length - 1];
    if (is_one(xn)) {
        let xn1 = lx[lx.length - 2] as NExpr;
        if (xn1[2] === xn) xn1[2] = 0;
        else {
            let prev = xn1;
            while ((prev[2] as NExpr)[2] !== xn) prev = prev[2] as NExpr;
            prev[2] = (prev[2] as NExpr)[1] as Expr;
        }
        if (x1 === xn1) {
            let res: Expr = 0;
            for (let i = index; i--;) res = [false, deepcopy(xn1), res];
            return cut0(res);
        } else {
            let prev: NExpr = lx.length === 2 ? x1 : lx[lx.length - 3];
            while (prev[2] !== xn1) prev = prev[2] as NExpr;
            prev[2] = 0;
            for (let i = index; i--;) prev[2] = [false, deepcopy(xn1), prev[2]];
            return cut0(x1);
        }
    }
    let j = (xn as PrimExpr)[1];
    let lxr = lx.slice();
    let xk = lxr.reverse().find((xz) => term_tier(xz) === j - 1)!;
    let xi = lxr.find(is_critical)!;
    let s = term_tier(xi);
    if (s === j - 1) {
        if (LMN_compare(xi, change(xk, xk)) >= 0) {
            let prev: NExpr = x1;
            while (prev[2] !== xk) prev = prev[2] as NExpr;
            prev[2] = [true, 0, 0];
            if (x1 === xi) return cut0(it(xi, index));
            prev = x1;
            while (prev[2] !== xi) prev = prev[2] as NExpr;
            prev[2] = it(xi, index);
            return cut0(x1);
        }
        return cut0(change(x1, it(inner(xi), index)));
    }
    let xj = lxr.find((xz) => term_tier(xz) === s)!;
    return LMN_FS(cut0(change(x1, lift(inner(xi), xj, xk))), index);
}

export const LMN: NotationDefinition<Expr> = {
    id: 'lmn',
    name: 'lifting M-notation (LMN)',
    simple_name: 'LMN',
    display: {
        plain: (e) => LMN_display(e, 'plain'),
        html: (e) => LMN_display(e, 'html-psi'),
        from_display,
    },
    display_equiv: {
        plain: (e) => LMN_display(e, 'plain'),
        sup: {
            plain: (e) => LMN_display(e, 'plain'),
            html: (e) => LMN_display(e, 'html-plain'),
        },
    },
    is_limit: LMN_is_limit,
    compare: LMN_compare,
    FS: (x: Expr, index: number) => {
        const key = '' + x;
        if (!data[key]) data[key] = [];
        else if (data[key][index] !== undefined) return data[key][index];
        return (data[key][index] = LMN_FS(x, index));
    },
    credit_text_id: 'credit.alpha0',

    init: () => [[true, Infinity] as unknown as Expr, [true, 0, 0], 0],
};
