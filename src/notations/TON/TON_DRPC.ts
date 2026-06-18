import type { NotationDefinition } from '@/utils.ts';
import { r, TON_limit, TON_noraise_compare, TON_noraise_display } from './ton_helpers.ts';

var data: any = {};
var DRPCStd: any = {};
var smallpart = (term: any): any => {
    var sow_smallpart = (a: any): any => {
            if (a === 0) return;
            if (TON_noraise_compare(a, 0) < 0) {
                result.push(a);
            } else {
                sow_smallpart(a[0]);
                sow_smallpart(a[1]);
            }
        },
        result: any = [];
    sow_smallpart(term);
    return result;
};
var BuiltQ = (a: any, ap: any, ai: any, b: any, a0: any, d: any): any => {
    if (a === 0 || TON_noraise_compare(a, b) < 0) return true;
    if (d === -1 && TON_noraise_compare(a, 0) < 0 && TON_noraise_compare(r(a, ap), r(ai, b)) > 0) return false;
    if (TON_noraise_compare(a, d) < 0) return BuiltQ(a, ap, ai, b, a0, -1);
    var x2 = TON_noraise_compare(a, 0) < 0 ? a : ap;
    if (d === -1 && TON_noraise_compare(a[0], 0) < 0 && TON_noraise_compare(r(a[1], x2), r(a0, b)) < 0)
        return BuiltQ(a, ap, ai, b, a0, a);
    return BuiltQ(a[0], x2, ai, b, a0, d) && BuiltQ(a[1], x2, ai, b, a0, d);
};
var StandardQ = (a: any): any => {
    var str = JSON.stringify(a);
    if (DRPCStd[str]) {
        return DRPCStd[str];
    } else if (
        typeof a === 'number' ||
        (StandardQ(a[1]) &&
            StandardQ(a[0]) &&
            (typeof a[0] === 'number' || TON_noraise_compare(a[1], a[0][1]) <= 0) &&
            smallpart(a[1]).every((x: any) => BuiltQ(x, a, x, a, a[1], -1)))
    ) {
        return (DRPCStd[str] = true);
    } else {
        return false;
    }
};
var Copy = (x: any): any => (typeof x === 'number' ? x : [Copy(x[0]), Copy(x[1]), -2]);
var TON_gen = function* (term: any): any {
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
                beta = [[beta[0], beta[1][0], -2], 0, -2];
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
                    c3[1] = [[c3[1][0], c1[0], -2], 0, -2];
                } else {
                    c1[1] = -1;
                }
            }
        }
        flag = true;
        while (('' + beta).split(',').length < len + n * 2) {
            if (!StandardQ(beta)) continue mainloop;
            if (typeof beta !== 'number') {
                c1 = beta;
                while (typeof c1[1] !== 'number') c1 = c1[1];
                c1[1] = [c1[1], 0, -2];
            } else {
                beta = [beta, 0, -2];
            }
        }
        if (StandardQ(beta)) {
            n = yield Copy(beta);
            flag = false;
        }
    }
};

export const TON_DRPC: NotationDefinition<any> = {
    id: 'ton-drpc',
    name: 'Degrees of Reflection with Passthrough (reflection configuration)',
    simple_name: 'TON_DRPC',
    display: TON_noraise_display,
    is_limit: TON_limit,
    compare: TON_noraise_compare,
    FS: (() => {
        return (term: any, n: any): any => {
            if ('' + term === 'Infinity') {
                term = [-1, 0, -2];
            }
            var datakey = '' + term,
                dataterm = data[datakey];
            if (!dataterm) {
                dataterm = data[datakey] = [];
                dataterm.gen = TON_gen(term);
                dataterm[0] = dataterm.gen.next().value;
            }
            if (dataterm[n] !== undefined) return dataterm[n];
            return (dataterm[n] = dataterm.gen.next(n).value);
        };
    })(),
    init: () => [Infinity, -1],
};
