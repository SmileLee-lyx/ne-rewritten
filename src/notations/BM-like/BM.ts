import { boolean_compare, index_of_last, lex_compare, number_compare } from '@/utils.ts';
import type { Diagram } from '@/core/diagram_types.ts';
import { Y_FS_variants } from '@/notations/notation_utils.ts';
import { draw_mountain_diagram, type MountainDiagramData } from '@/notations/draw_mountain_util.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';

export type Expr = number[][];

export function INFINITY(): Expr {
    return [[Infinity]];
}

export function is_infinity(a: Expr): boolean {
    return ('' + a).startsWith('Infinity');
}

export function compare(a: Expr, b: Expr): number {
    if (is_infinity(a) || is_infinity(b)) {
        return boolean_compare(is_infinity(a), is_infinity(b));
    }
    return lex_compare(a, b, (x, y) => lex_compare(normalize_col(x), normalize_col(y), number_compare));
}

function column_display(col: number[]) {
    const n_col = normalize_col(col);
    if (n_col.length === 0) return '(0)';
    return '(' + n_col + ')';
}

export function display(a: Expr): string {
    if (is_infinity(a)) return 'Limit';
    return a.map(column_display).join('');
}

export function from_display(s: string, std: boolean = false): Expr {
    if (s === 'Limit') return INFINITY();
    s = s.trim();
    if (s === '') return [];

    function error(): never {
        throw new Error(`Illegal input string: ${s}`);
    }

    function skip_spaces(i: number): number {
        while (i < s.length && s[i] === ' ') i++;
        return i;
    }

    function parse_column(start: number): [number[], number] {
        if (s[start] !== '(') error();
        let i = skip_spaces(start + 1);

        if (i < s.length && s[i] === ')') return [[], i + 1];

        const col: number[] = [];
        while (i < s.length) {
            i = skip_spaces(i);

            if (i < s.length && s[i] >= '0' && s[i] <= '9') {
                let num = 0;
                while (i < s.length && s[i] >= '0' && s[i] <= '9') {
                    num = num * 10 + (s.charCodeAt(i) - 48);
                    i++;
                }
                col.push(num);
                i = skip_spaces(i);
                if (i < s.length && s[i] === ',') {
                    i++;
                } else if (i < s.length && s[i] === ')') {
                    i++;
                    break;
                } else {
                    error();
                }
            } else {
                error();
            }
        }
        return [col, i];
    }

    function parse_expression(start: number): [Expr, number] {
        const result: Expr = [];
        let i = start;
        while (i < s.length) {
            i = skip_spaces(i);
            if (i >= s.length || s[i] !== '(') break;
            const [col, end] = parse_column(i);
            result.push(col);
            i = end;
        }
        return [result, i];
    }

    const [result, end] = parse_expression(0);
    if (end !== s.length) error();
    return std ? standardize(result) : normalize(result);
}

export function is_limit(a: Expr): boolean {
    return is_infinity(a) || (a.length > 0 && a[a.length - 1][0] > 0);
}

function normalize_col(col: number[]): number[] {
    return col.slice(0, index_of_last(col, (x) => x > 0) + 1);
}

export function normalize(m: Expr): Expr {
    return m.map(normalize_col);
}

export function standardize(m: Expr): Expr {
    if (m.length === 0) return m;
    const H = Math.max(...m.map((col) => col.length));
    return m.map((col) => [...col, ...Array.from({ length: H - col.length }, () => 0)]);
}

export function parents(m: Expr): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < m.length; i++) {
        result.push([]);
        for (let j = 0; j < m[i].length; j++) {
            let p: number | undefined = i;
            while (true) {
                p = j > 0 ? result[p!][j - 1] : p! - 1;
                if (p < 0) p = undefined;
                if (p === undefined) break;
                if ((m[p][j] ?? 0) < m[i][j]) break;
            }
            if (p !== undefined) result[i].push(p);
            else break;
        }
    }
    return result;
}

function ascending_threshold(P: number[][], r: number, j_max: number): number[] {
    const result: number[] = [];
    result[r] = j_max;

    for (let i = r + 1; i < P.length; i++) {
        let result_i: number | undefined;
        for (let j = 0; j < j_max; j++) {
            const pij = P[i][j];
            if (pij === undefined || pij < r || j >= result[pij]) {
                result_i = j;
                break;
            }
        }
        result[i] = result_i ?? j_max;
    }

    return result;
}

function expand(m: Expr, index: number): Expr {
    if (m.length === 0) return m;

    const rightmost = m.length - 1;
    const col_last = m[rightmost];
    let topmost = col_last.length - 1;
    for (; topmost >= 0; --topmost) {
        if (col_last[topmost] > 0) break;
    }

    let result = m.slice(0, rightmost);
    if (topmost < 0) return result;

    const P = parents(m);
    const r = P[rightmost][topmost];
    const A = ascending_threshold(P, r, topmost);
    const col_r = m[r];
    const offset = Array.from({ length: topmost }, (_, j) => col_last[j] - (col_r[j] ?? 0));

    for (let w = 1; w <= index; ++w) {
        for (let i = r; i < rightmost; ++i) {
            result.push(
                Array.from({ length: Math.max(m[i].length, A[i]) }, (_, y) => {
                    const val = m[i][y] ?? 0;
                    return y < A[i] ? val + offset[y] * w : val;
                }),
            );
        }
    }

    return result;
}

export function infinity_FS(n: number): Expr {
    return [[], Array.from({ length: n + 1 }, () => 1)];
}

interface MountainData {
    m: Expr;
    M: number[][];
    P: number[][];
}

function compute_mountain(m: Expr): MountainData {
    const P = parents(m);
    const h = Math.max(...m.map((col) => col.length));
    const diagram_rows = h + 1;
    const M: number[][] = [];
    for (let i = 0; i < m.length; i++) {
        M.push([]);
        for (let j = diagram_rows - 1; j >= 0; j--) {
            if (j >= P[i].length || P[i][j] < 0) {
                M[i][j] = 1;
            } else {
                const up = M[i][j + 1] ?? 1;
                const left = M[P[i][j]][j] ?? 1;
                M[i][j] = up + left;
            }
        }
    }
    return { m, M, P };
}

export function convert_to_0Y(m: Expr): number[] {
    return compute_mountain(m).M.map((col) => col[0]);
}

export function display_as_0Y(m: Expr): string {
    return is_infinity(m) ? '1,ω' : convert_to_0Y(m).join(',');
}

export function compute_0Y_mountain(seq: number[]): MountainData {
    const P: number[][] = Array.from({ length: seq.length }, () => []);
    const M: number[][] = Array.from({ length: seq.length }, (_, i) => [seq[i]]);
    const m: Expr = Array.from({ length: seq.length }, (_) => []);

    for (let j = 0; ; j++) {
        let has_next = false;
        for (let i = 0; i < seq.length; i++) {
            if (M[i][j] === 1) {
                M[i].push(1);
            } else {
                let p = j === 0 ? i - 1 : P[i][j - 1];
                while (p >= 0) {
                    if (M[i][j] > M[p][j]) break;
                    p = j === 0 ? p - 1 : P[p][j - 1];
                }
                if (p >= 0) {
                    P[i].push(p);
                    M[i].push(M[i][j] - M[p][j]);
                    m[i].push((m[p][j] ?? 0) + 1);
                    has_next = true;
                } else {
                    throw new Error('Illegal 0Y sequence: ' + seq);
                }
            }
        }
        if (!has_next) break;
    }
    return { M, P, m };
}

export function from_display_as_0Y(str: string): Expr {
    if (str === 'Limit' || str === '1,ω' || str === '1,w') return INFINITY();
    const result = str.split(',').map((s) => parseInt(s.trim(), 10));
    if (result.find(Number.isNaN) !== undefined) throw new Error('Illegal omega-Y sequence');
    return compute_0Y_mountain(result).m;
}

function entry_display_simple(e: number): string {
    let str = '' + e;
    return str.length > 1 ? '(' + str + ')' : str;
}

function column_display_simple(col: number[]): string {
    let N = index_of_last(col, (x) => x > 0) + 1;
    if (N === 0) return '0';
    return col.slice(0, N).map(entry_display_simple).join('');
}

export function display_simple(m: Expr): string {
    if (is_infinity(m)) return 'Limit';
    return m.map(column_display_simple).join(' ');
}

export function from_display_simple(s: string, std: boolean = false): Expr {
    if (s === 'Limit') return INFINITY();

    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_value(): number {
        if (i < s.length && s[i] === '(') {
            i++;
            const start = i;
            while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
            if (start === i) error();
            if (i >= s.length || s[i] !== ')') error();
            const v = parseInt(s.substring(start, i), 10);
            i++;
            return v;
        }
        if (i < s.length && s[i] >= '0' && s[i] <= '9') {
            const v = s.charCodeAt(i) - 48;
            i++;
            return v;
        }
        error();
    }

    function parse_entry(): number {
        return parse_value();
    }

    function parse_column(): Expr[number] {
        const col: Expr[number] = [];
        while (i < s.length && s[i] !== ' ') {
            col.push(parse_entry());
        }
        return col;
    }

    function parse_expr(): Expr {
        const result: Expr = [];
        while (i < s.length) {
            skip_spaces();
            if (i >= s.length) break;
            if (s[i] === '0' && (i + 1 >= s.length || s[i + 1] === ' ')) {
                result.push([]);
                i++;
                continue;
            }
            result.push(parse_column());
        }
        return result;
    }

    skip_spaces();
    if (i + 5 <= s.length && s.substring(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY();
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return std ? standardize(result) : normalize(result);
}

export interface DiagramData {
    current_equiv: '0Y' | 'BMS' | undefined;
    invert_vertical?: boolean;
}

function compute_bm_mountain_diagram(
    m: Expr,
    current_equiv: DiagramData['current_equiv'] & string,
): MountainDiagramData {
    const { M, P } = compute_mountain(m);
    const h = M[0].length - 1; // 行数 - 1

    const line_height = 40;

    const sorted_verticals: (string | undefined)[] = [];
    const heights: number[] = [];
    for (let vj = 0; vj <= h; vj++) {
        sorted_verticals.push(undefined);
        heights.push(vj * line_height); // 统一行高，与 MN 一致
    }

    const entries: (string | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: h + 1 }, () => undefined),
    );
    const left_legs: ([number, number] | undefined)[][] = Array.from({ length: m.length }, () =>
        Array.from({ length: h + 1 }, () => undefined),
    );

    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j <= h; j++) {
            const val = current_equiv === '0Y' ? M[i][j] : ((m[i] ?? [])[j] ?? 0);
            entries[i][j] = '' + val;
        }
        // left legs: 从上方元素 (j+1) 指向其父项
        for (let j = 0; j < P[i].length; j++) {
            if (P[i][j] >= 0 && j + 1 <= h) {
                left_legs[i][j + 1] = [P[i][j], j];
            }
        }
    }

    return { sorted_verticals, heights, line_heights: [], entries, left_legs };
}

const draw_diagram_control_BM: DiagramControl<Expr, DiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (m: Expr, _data: DiagramData): Diagram | undefined => {
        if (is_infinity(m) || m.length === 0) return undefined;
        const mountain = compute_bm_mountain_diagram(m, _data.current_equiv ?? 'BMS');
        return draw_mountain_diagram(mountain, { WV: 0, invert_vertical: _data.invert_vertical ?? false });
    },
    handle_action: (data: DiagramData, action): DiagramData | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'down') return { ...data, invert_vertical: true };
            if (action.direction === 'up') return { ...data, invert_vertical: false };
        }
        return null;
    },
};

const draw_diagram_control_0Y: DiagramControl<Expr, DiagramData> = {
    ...draw_diagram_control_BM,
    draw_diagram: (m: Expr, _data: DiagramData): Diagram | undefined => {
        if (is_infinity(m) || m.length === 0) return undefined;
        const mountain = compute_bm_mountain_diagram(m, _data.current_equiv ?? '0Y');
        return draw_mountain_diagram(mountain, { WV: 0, invert_vertical: _data.invert_vertical ?? false });
    },
};

export const BM4: NotationDefinition<Expr> = {
    id: 'bm4',
    name: 'Bashicu matrix system',
    simple_name: 'BMS',
    category_id: 'category-bm-like',
    display: { plain: display, from_display },
    display_equiv: {
        '0Y': {
            plain: display_as_0Y,
            from_display: from_display_as_0Y,
        },
        simple: {
            plain: display_simple,
            from_display: from_display_simple,
            name_id: 'display.simple',
        },
    },
    is_limit: is_limit,
    compare,
    draw_diagram: draw_diagram_control_BM,

    ...Y_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),

    credit_text_id: 'credit.bashicu',
    init: () => [INFINITY(), []],

    debug: { compute_0Y_mountain },
};

export const seq_0Y: NotationDefinition<Expr> = {
    id: '0y',
    name: '0-Y sequence',
    simple_name: '0Y',
    category_id: 'category-y',
    display: { plain: display_as_0Y, from_display: from_display_as_0Y },
    display_equiv: {
        BMS: {
            plain: display,
            from_display,
        },
    },
    is_limit: is_limit,
    compare,
    draw_diagram: draw_diagram_control_0Y,

    ...Y_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),

    credit_text_id: 'credit.yukito',
    init: () => [INFINITY(), []],
};
