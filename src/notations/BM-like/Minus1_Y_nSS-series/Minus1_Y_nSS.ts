import { bind2, bind3, deepcopy, index_of_last, lex_compare, number_compare, tuple_lex_compare } from '@/utils.ts';
import type { NotationCategoryDefinition } from '@/core/notation_category.ts';
import { NotationDefinition } from '@/notation-definition.ts';

type Column = [number[], number];
type Expr = Column[];

function INFINITY(): Expr {
    return [[[Infinity]]] as any;
}

function EMPTY_COLUMN(n: number): Column {
    return [Array.from({ length: n }, () => 0), 0];
}

function is_infinity(e: Expr | Expr_BOCF): boolean {
    return '' + e === 'Infinity';
}

function infinity_FS(index: number, n: number): Expr {
    return [EMPTY_COLUMN(n), [Array.from({ length: n }, () => 1), index]];
}

function column_compare(a: Column, b: Column): number {
    return tuple_lex_compare(a, b, [(x, y) => lex_compare(x, y, number_compare), number_compare]);
}

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, column_compare);
}

function parents(e: Expr, n: number): Expr {
    if (is_infinity(e)) return [];
    let result: Expr = [];
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
            if (e[p][1] < v) break;
            p = n === 0 ? p - 1 : result[p][0][n - 1];
        }
        result[i][1] = p;
    }
    return result;
}

function is_limit(e: Expr, n: number): boolean {
    return is_infinity(e) || (e.length > 0 && (n === 0 ? e[e.length - 1][1] > 0 : e[e.length - 1][0][0] > 0));
}

function root(P: Expr, n: number): [r: number, b: number] | undefined {
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

function ascension_thresholds(P: Expr, r: number, b: number): number[] {
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

function ascend(ei: Column, delta: number[], b: number, w: number): Column {
    let result: Column = [deepcopy(ei[0]), ei[1]]; // shallow copy ei[1]. aligned with T(-1)Y-nSS.

    for (let i = 0; i < b; i++) result[0][i] += delta[i] * w;
    return result;
}

function FS(e: Expr, index: number, n: number): Expr {
    if (is_infinity(e)) return infinity_FS(index, n);
    if (e.length === 0) return e;
    let P = parents(e, n);
    let rb = root(P, n);
    if (rb === undefined) return e.slice(0, -1);
    let right = e.length - 1;
    let [r, b] = rb;
    let width = right - r;

    let V = ascension_vector(e, r, b);
    let A = ascension_thresholds(P, r, b);
    let result: Expr = e.slice(0, -1).map((c) => [deepcopy(c[0]), c[1]]);

    for (let w = 1; w <= index; w++) {
        for (let i = r; i < right; i++) {
            result.push(ascend(e[i], V, A[i], w));
        }
        if (b === n) result[r + w * width][1] = e[right][1] - 1;
    }
    return result;
}

function column_display(c: Column): string {
    let result_list = [...c[0], c[1]];
    while (result_list.length > 0 && result_list[result_list.length - 1] === 0) result_list.pop();
    return '(' + result_list.join(',') + ')';
}

function display(e: Expr): string {
    if (is_infinity(e)) return 'Limit';
    return e.map(column_display).join('');
}

function from_display(s: string, n: number): Expr {
    if (s.trim() === 'Limit') return INFINITY();

    let i = 0;

    function error(): never {
        throw new Error(`Illegal input string: ${s}`);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_number(): number {
        skip_spaces();
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_column(): Column {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;

        skip_spaces();
        const values: number[] = [];

        if (i < s.length && s[i] !== ')') {
            values.push(parse_number());
            while (true) {
                skip_spaces();
                if (i >= s.length || s[i] !== ',') break;
                i++;
                skip_spaces();
                if (i < s.length && s[i] === ')') break;
                values.push(parse_number());
            }
        }

        skip_spaces();
        if (i >= s.length || s[i] !== ')') error();
        i++;

        const arr = values.slice(0, n);
        while (arr.length < n) arr.push(0);
        const step = values.length > n ? values[n] : 0;
        return [arr, step];
    }

    function parse_expr(): Expr {
        const result: Expr = [];
        skip_spaces();
        while (i < s.length) {
            if (s[i] !== '(') break;
            result.push(parse_column());
            skip_spaces();
        }
        return result;
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

type Expr_BOCF = [0, Expr_BOCF[]] | [1, number, Expr_BOCF];

function INFINITY_BOCF(): Expr_BOCF {
    return [Infinity] as any;
}

function bocf_from_2ss(e: Expr): Expr_BOCF {
    if (is_infinity(e)) return INFINITY_BOCF();

    let i = 0;

    function impl(base: number): Expr_BOCF {
        let result: Expr_BOCF[] = [];

        while (i < e.length) {
            let [[x], y] = e[i];
            if (x <= base) break;
            i++;
            let inner = impl(x);
            result.push([1, y, inner]);
        }

        if (result.length === 1) return result[0];
        return [0, result];
    }

    return impl(-1);
}

function display_bocf(e: Expr_BOCF, html: boolean): string {
    if (is_infinity(e)) return 'Limit';

    function impl(a: Expr_BOCF): string {
        if (a[0] === 0) {
            if (a[1].length === 0) return '0';
            return a[1].map(impl).join('+');
        }
        let str_inner = impl(a[2]);
        if (str_inner === '0') {
            if (a[1] === 0) return '1';
            if (a[1] === 1) return 'Ω';
            return html ? 'Ω<sub>' + a[1] + '</sub>' : 'Ω(' + a[1] + ')';
        }
        return html ? 'ψ<sub>' + a[1] + '</sub>(' + str_inner + ')' : 'ψ(' + a[1] + ',' + str_inner + ')';
    }

    return impl(e);
}

export const category_bm_minus1_y_nss: NotationCategoryDefinition = {
    id: 'category-bm-minus1-y-nss',
    name: '-1Y n-tuple Sequence System',
    simple_name: '-1Y-nSS',
    parent_id: 'category-minus1-y-nss-series',
    generator: { start: 0, initial: 3, create: (n) => Minus1_Y_nSS(n) },
};
export function Minus1_Y_nSS(n: number): NotationDefinition<Expr> {
    let display_equiv: NotationDefinition<Expr>['display_equiv'] = {};
    if (n === 1) {
        display_equiv = {
            BOCF: {
                plain: (e) => display_bocf(bocf_from_2ss(e), false),
                html: (e) => display_bocf(bocf_from_2ss(e), true),
            },
        };
    }

    return {
        id: '-1y-' + (n + 1) + 'ss',
        name: '(-1)Y-' + (n + 1) + 'SS',
        category_id: 'category-bm-minus1-y-nss',

        display: { plain: display, from_display: (s) => from_display(s, n) },
        display_equiv,

        is_limit: bind2(is_limit, n),
        compare,
        FS: bind3(FS, n),

        credit_text_id: 'credit.community_y',

        init: () => [INFINITY(), [EMPTY_COLUMN(n)], []],
    };
}
