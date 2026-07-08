import { raise, TON_compare, TON_limit, TON_main_display } from './ton_helpers.ts';
import { NotationDefinition } from '@/notation-definition.ts';

var data: any = {};
var StdTrue: any = {};
var mark = (sys: any): any => {
    var res = [[-1, sys, -2], sys, -2];
    for (var i = sys - 1; i > 0; i--) res = [-1, res, -2];
    return res;
};
var mark_FS = (sys: any, n: any): any => {
    var i: any,
        res: any = sys - 1;
    for (i = 0; i < n; ++i) res = [sys - 1, res, -2];
    for (i = sys - 1; i > 0; i--) res = [-1, res, -2];
    return res;
};
var BuiltQ = (n: any, b: any, a: any, x: any): any =>
    n
        ? BuiltQ(n - 1, b, x, x) ||
          (TON_compare(x, a) <= 0 && (typeof x === 'number' ? x >= 0 : BuiltQ(n, b, a, x[1]) && BuiltQ(n, b, a, x[0])))
        : TON_compare(a, b) < 0;
var StandardQ = (n: any, a: any): any => {
    var str = JSON.stringify(a);
    if (StdTrue[str]) {
        return StdTrue[str];
    } else if (
        typeof a === 'number' ||
        (StandardQ(n, a[1]) &&
            StandardQ(n, a[0]) &&
            (typeof a[0] === 'number' || TON_compare(a[1], a[0][1]) <= 0) &&
            BuiltQ(n, a, a[1], a[1]))
    ) {
        return (StdTrue[str] = true);
    } else {
        return false;
    }
};
var Copy = (x: any): any => (typeof x === 'number' ? x : [Copy(x[0]), Copy(x[1]), -2]);
var regress = (x: any): any =>
    typeof x === 'number' ? x : x[0] === -1 && x[1] > 0 ? x[1] - 1 : [regress(x[0]), regress(x[1]), -2];
var regress_repeated = (x: any): any => {
    var x1: any;
    while ('' + (x1 = regress(x)) !== '' + x) x = x1;
    return x1;
};
var TON_gen = function* (term: any, sys: any): any {
    var flag = true,
        c1: any,
        c3: any,
        n = 0,
        beta = Copy(term),
        len = ('' + term).split(',').length;
    mainloop: while (true) {
        if (flag) {
            if (typeof beta === 'number' && beta >= 0) {
                beta = -1;
            } else if (beta[1] === -1) {
                beta = beta[0];
                continue;
            } else if (typeof beta[1] === 'number' && beta[1] >= 0) {
                beta[1] = -1;
            } else if (beta[1][1] === -1) {
                beta = [[beta[0], beta[1][0], -2], sys, -2];
            } else if (typeof beta[1][1] === 'number' && beta[1][1] >= 0) {
                beta[1][1] = -1;
            } else {
                c3 = beta;
                c1 = beta[1][1];
                while (typeof c1[1] !== 'number') {
                    c3 = c3[1];
                    c1 = c1[1];
                }
                if (c1[1] === -1) {
                    c3[1] = [[c3[1][0], c1[0], -2], sys, -2];
                } else {
                    c1[1] = -1;
                }
            }
        }
        flag = true;
        while (('' + beta).split(',').length < len + n * 2) {
            if (!StandardQ(sys, beta)) continue mainloop;
            if (typeof beta !== 'number') {
                c1 = beta;
                while (typeof c1[1] !== 'number') c1 = c1[1];
                c1[1] = [c1[1], sys, -2];
            } else {
                beta = [beta, sys, -2];
            }
        }
        if (StandardQ(sys, beta)) {
            n = yield regress_repeated(beta);
            flag = false;
        }
    }
};

export const TON_main: NotationDefinition<any> = {
    id: 'ton-m',
    name: "Taranosvky's ordinal notation",
    simple_name: 'TON',
    category_id: 'category-ton',
    display: TON_main_display,
    is_limit: TON_limit,
    compare: TON_compare,
    FS: (() => {
        return (term: any, n: any): any => {
            var i: any,
                res: any,
                sys = typeof term === 'number' ? term : Math.max(0, ...('' + term).split(',').map(Number));
            if (sys === Infinity) {
                res = [n, n, -2];
                for (i = 0; i < n; ++i) res = [-1, res, -2];
                return res;
            }
            term = raise(term, sys);
            if (sys >= 1 && '' + term === '' + mark(sys)) return mark_FS(sys, n);
            var datakey = '' + term,
                dataterm = data[datakey];
            if (!dataterm) {
                dataterm = data[datakey] = [];
                dataterm.gen = TON_gen(term, sys);
                dataterm[0] = dataterm.gen.next().value;
            }
            if (dataterm[n] !== undefined) return dataterm[n];
            return (dataterm[n] = dataterm.gen.next(n).value);
        };
    })(),
    credit_text_id: 'credit.ton',
    init: () => [Infinity, 0, -1],
};
