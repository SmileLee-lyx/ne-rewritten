import {
    deepcopy,
    index_of_last,
    lex_compare,
    type NotationDefinition,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';

type Column = [number[], Expr];
type Expr = Column[];

type ParentColumn = [number[], number];
type Parents = ParentColumn[];

function INFINITY(): Expr {
    return [[[Infinity]]] as any;
}

function EMPTY_COLUMN(n: number): Column {
    return [Array.from({ length: n }, () => 0), []];
}

function is_infinity(e: Expr): boolean {
    return '' + e === 'Infinity';
}

function infinity_FS(index: number, n: number): Expr {
    if (index === 0) return [EMPTY_COLUMN(n)];
    return [EMPTY_COLUMN(n), [Array.from({ length: n }, () => 1), infinity_FS(index - 1, n)]];
}

function column_compare(a: Column, b: Column): number {
    return tuple_lex_compare(a, b, [(x, y) => lex_compare(x, y, number_compare), compare]);
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

function parents(e: Expr, n: number): Parents {
    if (is_infinity(e)) return [];
    let result: Parents = [];
    for (let i = 0; i < e.length; i++) {
        result[i] = [Array.from({ length: n }, () => -1), -1];

        for (let j = 0; j < n; j++) {
            let v = e[i][0][j] ?? 0;
            let p = j === 0 ? i - 1 : result[i][0][j - 1];
            while (p >= 0) {
                if (e[p][0][j] < v) break;
                p = j === 0 ? p - 1 : result[p][0][j - 1];
            }
            if (p < 0) break;
            result[i][0][j] = p;
        }

        let v = e[i][1];
        let p = n === 0 ? i - 1 : result[i][0][n - 1];
        while (p >= 0) {
            if (compare(e[p][1], v) < 0) break;
            p = n === 0 ? p - 1 : result[p][0][n - 1];
        }
        result[i][1] = p;
    }
    return result;
}

function is_limit(e: Expr, n: number): boolean {
    return is_infinity(e) || (e.length > 0 && (n === 0 ? e[e.length - 1][1].length > 0 : e[e.length - 1][0][0] > 0));
}

function root(P: Parents, n: number): [r: number, b: number] | undefined {
    if (P.length === 0) return undefined;
    let right = P.length - 1;
    if (P[right][1] >= 0) return [P[right][1], n];
    let b = index_of_last(P[right][0], (pb) => pb >= 0);
    if (b === -1) return undefined;
    return [P[right][0][b], b];
}

function ascension_vector(e: Expr, r: number, b: number): number[] {
    return Array.from({ length: b }, (_, i) => e[e.length - 1][0][i] - e[r][0][i]);
}

function ascension_thresholds(P: Parents, r: number, b: number, n: number): number[] {
    let result: number[] = [];
    result[r] = b;
    for (let i = r + 1; i < P.length; i++) {
        let ai = 0;
        while (ai < b) {
            let p = i;
            while (p > r) p = P[p][0][ai];
            if (p < r) break;
            ai++;
        }
        result[i] = ai;
    }
    return result;
}

function ascend(ei: Column, delta: number[], b: number, w: number, n: number): Column {
    let result: Column = [deepcopy(ei[0]), ei[1]]; // shallow copy ei[1]. aligned with T(-1)Y-nSS.

    for (let i = 0; i < b; i++) result[0][i] += delta[i] * w;
    return result;
}

function FS(e: Expr, index: number, n: number): Expr {
    if (is_infinity(e)) return infinity_FS(index, n);
    if (e.length === 0) return e;

    let right = e.length - 1;
    if (is_limit(e[right][1], n)) {
        return [...e.slice(0, -1), [e[right][0].slice(), FS(e[right][1], index, n)]];
    }

    let P = parents(e, n);
    let rb = root(P, n);
    if (rb === undefined) return e.slice(0, -1);
    let [r, b] = rb;
    let width = right - r;

    let V = ascension_vector(e, r, b);
    let A = ascension_thresholds(P, r, b, n);
    let result: Expr = e.slice(0, -1).map((c) => [deepcopy(c[0]), c[1]]);

    for (let w = 1; w <= index; w++) {
        for (let i = r; i < right; i++) {
            result.push(ascend(e[i], V, A[i], w, n));
        }
        if (b === n) result[r + w * width][1] = e[right][1].slice(0, -1);
    }
    return result;
}

function column_display(c: Column): string {
    return '(' + c[0].join(',') + ',' + display(c[1], false) + ')';
}

function display(e: Expr, top_level: boolean = true): string {
    if (is_infinity(e)) return 'Limit';

    if (!top_level && e.every((c) => c[1].length === 0 && c[0].every((x) => x === 0))) {
        return '' + e.length;
    }

    return e.map(column_display).join('');
}

export function T_Minus1_Y_nSS(n: number): NotationDefinition<Expr> {
    return {
        id: 't--1y-' + (n + 1) + 'ss',
        name: 'T(-1)Y-' + (n + 1) + 'SS',

        display: { plain: display },
        is_limit: (e) => is_limit(e, n),
        compare,
        FS: (e, index) => FS(e, index, n),

        init: () => [INFINITY(), [EMPTY_COLUMN(n)], []],
    };
}
