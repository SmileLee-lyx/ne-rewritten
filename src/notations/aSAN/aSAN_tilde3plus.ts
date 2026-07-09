import { aSAN_able, aSAN_base, aSAN_compare, aSAN_display, aSAN_semiable } from './asan_helpers.ts';
import { NotationDefinition } from '@/notation-definition.ts';

var data: any = {};
var Copy = (a: any): any => (typeof a === 'number' ? a : a.map(Copy));
var pilot = (A: any): any => {
    if (typeof A === 'number') return A;
    for (var b = 0; b < A.length; ++b) {
        if (A[b] !== 1) return A[b];
    }
};
var pre = (A: any): any => {
    if (typeof A === 'number') return A - 1;
    var e = A.slice();
    e.unshift(pre(e.shift()));
    return e;
};
var change = (A: any, n: any): any => {
    var b: any,
        e = A.slice();
    for (b = 0; b < e.length; ++b) {
        if (e[b] !== 1) {
            b ? e.splice(b - 1, 2, n, pre(e[b])) : e.splice(b, 1, pre(e[b]));
            return e;
        }
    }
};
var layers = (A: any): any => {
    var Lk: any,
        L: any = [A];
    while (true) {
        Lk = pilot(L[L.length - 1]);
        if (aSAN_base(Lk) > 1) break;
        L.push(Lk);
    }
    return L;
};
var changeL = (L: any, a: any, b: any): any => {
    if (a === L.length - 1) return change(L[a], b);
    var x = L[a].indexOf(L[a + 1]),
        La = Copy(L[a]);
    La[x] = changeL(L, a + 1, b);
    return La;
};
var trans = (L: any): any => {
    var n = L.length - 1,
        Trans = 0,
        Transcenders: any = {};
    for (var k = 1; k <= n; ++k) {
        if (!Trans && L[k - 1][0] !== L[k]) {
            Transcenders[k - 1] = true;
            Trans = 1;
        }
        if (Trans && aSAN_compare(L[n], L[k]) > 0) Trans = 0;
    }
    return Transcenders;
};
var search = (L: any): any => {
    var T = trans(L),
        k = L.length - 1,
        N = L[k],
        o = k,
        M = N,
        Trans = 0;
    while (k--) {
        if (aSAN_compare(L[k], M) > 0) o = k;
        if (!Trans) {
            if (T[k]) {
                if (aSAN_compare(M, L[k]) > 0 && aSAN_compare(L[k], L[k + 1]) > 0) return o;
                o = k;
                M = L[k];
                Trans = 1;
            }
            if (N[1] === 1 && k > 0) continue;
        }
        if (Trans && !T[k]) continue;
        if (aSAN_compare(M, L[k]) > 0) return o;
    }
    return 0;
};
var Standard = (A: any): any => {
    if (typeof A === 'number') return A;
    if (A.length === 1) {
        if (typeof A[0] === 'number') return A[0];
        if (A[0].length === 1) return Standard(A[0]);
    }
    if (A[A.length - 1] === 1) return Standard(A.slice(0, A.length - 1));
    return A.map(Standard);
};
var aSAN_FS = (A: any, FSterm: any): any => {
    var L = layers(Copy(A)),
        m = search(L),
        f = (n: any) => changeL(L, m, n),
        result = FSterm + 1;
    for (var n = FSterm; n--;) {
        result = f(result);
    }
    if (m > 0) {
        L[m - 1][L[m - 1].indexOf(L[m])] = result;
        result = L[0];
    }
    var std;
    while (JSON.stringify((std = Standard(result))) !== JSON.stringify(result)) result = std;
    return result;
};

export const aSAN_tilde3plus: NotationDefinition<any> = {
    id: 'asan-tilde3plus',
    name: 'aSAN~3+',
    simple_name: 'aSAN~3+',
    category_id: 'category-asan',
    display: aSAN_display,
    is_limit: aSAN_able,
    compare: aSAN_compare,
    FS: (A: any, FSterm: any) => {
        if (!aSAN_semiable(A)) return A;
        if ('' + A === '1,Infinity') return FSterm ? Array(FSterm).fill(1).concat(2) : 2;
        if (aSAN_base(A) > 1) return pre(A);
        var key = aSAN_display(A);
        if (!data[key]) data[key] = [];
        else if (data[key][FSterm] !== undefined) return data[key][FSterm];
        return (data[key][FSterm] = aSAN_FS(A, FSterm));
    },
    credit_text_id: 'credit.asan',
    init: () => [[1, Infinity], 1],
};
