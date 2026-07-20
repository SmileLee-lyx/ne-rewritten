import { Expr, from_display, LMN_compare, LMN_display, LMN_is_limit } from '@/notations/OCN/LMN.ts';

import { NotationDefinition } from '@/notation-definition.ts';

const data: any = {};
var Copy = (x: any): any => (typeof x === 'number' ? x : [x[0]].concat(x.slice(1).map(Copy)));
var maxsummand = (x: any): any => {
    if (!x || x[0]) return x;
    var x1 = maxsummand(x[1]),
        x2 = maxsummand(x[2]);
    if (LMN_compare(x1, x2) < 0) return x2;
    else return x1;
};
var cut0 = (x: any): any =>
    x
        ? x[0]
            ? [true, x[1], cut0(x[2])]
            : x[2]
              ? LMN_compare(x[1], maxsummand(x[2])) < 0
                  ? cut0(x[2])
                  : [false, cut0(x[1]), cut0(x[2])]
              : cut0(x[1])
        : 0;
var L = (x0: any): any => {
    var x = x0,
        lx: any = [];
    while (x) {
        if (x[0]) {
            lx.push(x);
            if ((x = x[2]) === 0) break;
        } else {
            x = x[2];
        }
    }
    return lx;
};
var change = (x: any, y: any): any => {
    var x1 = Copy(x),
        lx = L(x1),
        n = lx.length - 1;
    if (lx[n] === x1) return y;
    var prev = n ? lx[n - 1] : x1;
    while (prev[2] !== lx[n]) prev = prev[2];
    prev[2] = y;
    return x1;
};
var it = (x: any, n: any): any => (n ? change(x, it(x, n - 1)) : 0);
var termtier = (x: any): any => {
    for (var n = 0; LMN_compare(x, [true, n + 1, 0]) >= 0; ++n);
    return n;
};
var inner = (x: any): any => {
    var n = termtier(x),
        Lx = L(x),
        m = Lx.slice(1).findIndex((xj: any) => termtier(xj) === n);
    if (m === -1) return 0;
    var A = Lx[m][2];
    while (!A[0]) {
        if (termtier(A) === n) return A;
        A = A[2];
    }
    return A[1] === n ? A : 0;
};
var iscritical = (x: any): any => {
    var n = termtier(x),
        lx = L(x);
    return (
        lx.findIndex(
            (xi: any, i: any) =>
                LMN_compare(x, xi) < 0 &&
                termtier(xi) === n &&
                lx.slice(i + 1).every((xj: any) => LMN_compare(xj, [true, n + 1, 0]) >= 0) &&
                lx.slice(0, i).every((xj: any) => LMN_compare(xj, [true, n, 0]) >= 0),
        ) >= 0
    );
};
var subtract = (c: any, b: any): any => {
    if (b === 0) return c;
    if (c === 0) return 0;
    var b1 = b[0] ? b : b[1],
        c1 = c[0] ? c : c[1],
        cmp = LMN_compare(b1, c1);
    if (cmp < 0) return c;
    if (cmp > 0) return 0;
    return subtract(c[0] ? 0 : c[2], b[0] ? 0 : b[2]);
};
var lift = (x: any, a: any, s: any): any => {
    if (x === 0 || (x[0] && LMN_compare(x, a) < 0)) return x;
    if (!x[0]) return [false].concat(x.slice(1).map((xi: any) => lift(xi, a, s)));
    if (a[1] < x[1]) return [true, x[1] - a[1] + s[1], lift(x[2], a, s)];
    return [true, s[1], cut0([false, s[2], lift(subtract(x[2], a[2]), a, s)])];
};
var isone = (x: any) => '' + x === '' + [true, 0, 0];
var LON_FS = (x: any, FSterm: any): any => {
    var i: any, res: any, x2: any, xn1: any, prev: any;
    if ('' + x === 'true,Infinity') {
        res = 0;
        for (i = FSterm; i >= 0; --i) res = [true, i, res];
        return [true, 0, res];
    }
    if (x === 0) return 0;
    if (!x[0]) {
        x2 = x[2];
        if (isone(x2)) return x[1];
        return cut0(x.slice(0, 2).concat([LON_FS(x2, FSterm)]));
    }
    x2 = Copy(x);
    var lx = L(x2),
        xn = lx[lx.length - 1];
    if (isone(xn)) {
        xn1 = lx[lx.length - 2];
        if (xn1[2] === xn) xn1[2] = 0;
        else {
            prev = xn1;
            while (prev[2][2] !== xn) prev = prev[2];
            prev[2] = prev[2][1];
        }
        if (x2 === xn1) {
            res = 0;
            for (i = FSterm; i--;) res = [false, Copy(xn1), res];
            return cut0(res);
        } else {
            prev = lx.length === 2 ? x2 : lx[lx.length - 3];
            while (prev[2] !== xn1) prev = prev[2];
            prev[2] = 0;
            for (i = FSterm; i--;) prev[2] = [false, Copy(xn1), prev[2]];
            return cut0(x2);
        }
    }
    var j = xn[1],
        lxr = lx.slice(),
        xk = lxr.reverse().find((xz: any) => termtier(xz) === j - 1);
    if (xk && LMN_compare(xk, [true, j - 1, [true, j, 0]]) > 0) {
        return cut0(change(x2, it(xk, FSterm)));
    }
    var xi = lxr.find(iscritical),
        s = termtier(xi);
    if (s === j - 1) {
        return cut0(change(x2, it(inner(xi), FSterm)));
    }
    var xj = lxr.find((xz: any) => termtier(xz) === s);
    return LON_FS(cut0(change(x2, lift(inner(xi), xj, xk))), FSterm);
};

export const LON: NotationDefinition<Expr> = {
    id: 'lon',
    name: 'lifting Omega notation',
    simple_name: 'LON',
    category_id: 'category-ocn',
    display: {
        plain: (e) => LMN_display(e, 'plain'),
        html: (e) => LMN_display(e, 'html-psi'),
        from_display,
    },
    display_equiv: {
        plain: {
            plain: (e) => LMN_display(e, 'plain'),
            name_id: 'display.simple',
        },
        sup: {
            plain: (e) => LMN_display(e, 'plain'),
            html: (e) => LMN_display(e, 'html-plain'),
            name_id: 'display.pocn-sup',
        },
    },
    is_limit: LMN_is_limit,
    compare: LMN_compare,
    FS: (x: Expr, index: number) => {
        const key = '' + x;
        if (!data[key]) data[key] = [];
        else if (data[key][index] !== undefined) return data[key][index];
        return (data[key][index] = LON_FS(x, index));
    },
    credit_text_id: 'credit.test-alpha0',

    init: () => [[true, Infinity] as unknown as Expr, [true, 0, 0], 0],
};
