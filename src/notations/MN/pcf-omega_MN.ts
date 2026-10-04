import {
    anti_lex_compare,
    bind2,
    boolean_compare,
    lex_compare,
    max_by_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';

type Vertical = number[];
type Entry = [number, Vertical];
type Column = Entry[];
type Expr = Column[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length !== 0 && expr[expr.length - 1].length !== 0;
}

type DisplayType = 'plain' | 'html';

function vertical_cantor_display(v: Vertical, type: DisplayType): string {
    const result: string[] = [];
    for (let j = v.length - 1; j >= 0; j--) {
        const c = v[j];
        if (c > 0) {
            if (j === 0) result.push('' + c);
            else {
                const prim = j > 1 ? (type === 'html' ? 'ω<sup>' + j + '</sup>' : 'ω^' + j) : 'ω';
                result.push(c > 1 ? prim + (type === 'html' ? c : '*' + c) : prim);
            }
        }
    }
    if (result.length === 0) return '0';
    return result.join('+');
}

function entry_display([p, v]: Entry, type: DisplayType): string {
    return p + 1 + ':' + vertical_cantor_display(v, type);
}

function col_display(col: Column, type: DisplayType): string {
    return '(' + col.map(bind2(entry_display, type)).join(',') + ')';
}

function display(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';

    return expr.map(bind2(col_display, type)).join('');
}

function from_display(str: string): Expr {
    let i = 0;
    const s = str;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function parse_number(): number {
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_omega_term(): [number, number] {
        i++;
        skip_spaces();

        let m = 1;
        if (i < s.length && s[i] === '^') {
            i++;
            skip_spaces();
            if (i < s.length && s[i] === '(') {
                i++;
                skip_spaces();
                m = parse_number();
                skip_spaces();
                if (i >= s.length || s[i] !== ')') error();
                i++;
            } else {
                m = parse_number();
            }
            skip_spaces();
        }

        let n = 1;
        if (i < s.length && s[i] === '*') {
            i++;
            skip_spaces();
            n = parse_number();
        }

        return [m, n];
    }

    function parse_vertical_term(): [number, number] {
        if (i < s.length && (s[i] === 'ω' || s[i] === 'w')) return parse_omega_term();
        return [0, parse_number()];
    }

    function parse_vertical(): Vertical {
        let result: Vertical = [];
        while (true) {
            skip_spaces();
            const [m, n] = parse_vertical_term();
            if (n > 0) result = vertical_add(result, [...Array<number>(m).fill(0), n]);
            skip_spaces();
            if (i >= s.length || s[i] !== '+') break;
            i++;
        }
        return result;
    }

    function parse_entry(): Entry {
        skip_spaces();
        const p = parse_number() - 1;
        skip_spaces();
        if (p < 0 || i >= s.length || s[i] !== ':') error();
        i++;
        return [p, parse_vertical()];
    }

    function parse_column(): Column {
        i++;
        skip_spaces();
        const col: Column = [];
        if (i < s.length && s[i] === ')') {
            i++;
            return col;
        }

        while (true) {
            col.push(parse_entry());
            skip_spaces();
            if (i >= s.length) error();
            if (s[i] === ',') {
                i++;
                continue;
            }
            if (s[i] !== ')') error();
            i++;
            return col;
        }
    }

    skip_spaces();
    if (i + 5 <= s.length && s.substring(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY;
    }

    const result: Expr = [];
    while (true) {
        skip_spaces();
        if (i >= s.length) break;
        if (s[i] !== '(') error();
        result.push(parse_column());
    }
    return result;
}

function vertical_compare(v1: Vertical, v2: Vertical): number {
    return anti_lex_compare(v1, v2, number_compare);
}

function entry_compare(e1: Entry, e2: Entry): number {
    return tuple_lex_compare(e1, e2, [number_compare, vertical_compare]);
}

function column_compare(col1: Column, col2: Column): number {
    return lex_compare(col1, col2, entry_compare);
}

function compare(expr1: Expr, expr2: Expr): number {
    if (is_infinity(expr1) || is_infinity(expr2)) {
        return boolean_compare(is_infinity(expr1), is_infinity(expr2));
    }
    return lex_compare(expr1, expr2, column_compare);
}

function magma_verticals(expr: Expr, r: number): Vertical[] {
    const result: Vertical[] = Array(expr.length);
    result.fill([]);

    for (let i = r + 1; i < expr.length; i++) {
        const col = expr[i];

        for (let j = 0; j < col.length; j++) {
            const [p, v] = col[j];
            if (p < r) break;
            if (p === r) {
                result[i] = v;
                break;
            }
            const mv_p = result[p];
            if (vertical_compare(mv_p, v) <= 0) {
                if (vertical_compare(result[i], mv_p) < 0) result[i] = mv_p;
                break;
            }
            result[i] = v;
        }
    }
    return result;
}

function vertical_increase(v: Vertical, s: number): Vertical {
    if (v.length <= s) return [...Array<number>(s).fill(0), 1];
    const result = v.slice();
    result[s]++;
    result.fill(0, 0, s);
    return result;
}

function vertical_decrease(v: Vertical): Vertical {
    const s = top_sep(v);
    if (v[s] === 1 && s === v.length - 1) return [];
    const result = v.slice();
    result[s]--;
    return result;
}

function vertical_add(v: Vertical, a: Vertical): Vertical {
    if (v.length < a.length) return a;
    if (a.length === 0) return v;
    return [...a.slice(0, -1), v[a.length - 1] + a[a.length - 1], ...v.slice(a.length)];
}

function vertical_sub(v: Vertical, base: Vertical): Vertical {
    if (v.length > base.length) return v;
    if (v.length < base.length) return [];
    let j = v.length - 1;
    while (j >= 0) {
        if (v[j] < base[j]) return [];
        if (v[j] > base[j]) return [...v.slice(0, j), v[j] - base[j]];
        j--;
    }
    return [];
}

function top_sep(v: Vertical): number {
    return v.findIndex((c) => c > 0);
}

function find_index_below_row(col: Column, v: Vertical): number {
    let l = 0,
        r = col.length;
    while (l < r) {
        const m = (l + r + 1) >> 1;
        if (vertical_compare(v, col[m - 1][1]) > 0) l = m;
        else r = m - 1;
    }
    return l;
}

function base_vertical(expr: Expr, top: Vertical, r: number): Vertical {
    let bottom = vertical_decrease(top);
    let i = r;
    while (true) {
        const col = expr[i];
        const j = find_index_below_row(col, top);
        bottom = max_by_compare(vertical_compare, bottom, j === 0 ? [] : col[j - 1][1]);
        if (j === col.length) return bottom;
        i = col[j][0];
    }
}

function stretch(v: Vertical, threshold: Vertical, target: Vertical, w: number): Vertical {
    if (vertical_compare(v, threshold) <= 0) return v;
    let result = v;
    for (let j = 0; j < w; j++) result = vertical_add(target, vertical_sub(result, threshold));
    return result;
}

function normalize_col(col: Column): Column {
    const result: Column = [];
    let current: Vertical = [];
    for (let i = 0; i < col.length; i++) {
        if (vertical_compare(col[i][1], current) > 0) {
            current = col[i][1];
            result.push(col[i]);
        }
    }
    return result;
}

function copy_column(
    col: Column,
    r: number,
    threshold: Vertical,
    target: Vertical,
    magma: Vertical,
    offset: number,
    w: number,
): Column {
    const result: Column = [];

    const stretched_magma = stretch(magma, threshold, target, w);

    for (let j = 0; j < col.length; j++) {
        const [p, v] = col[j];
        const p1 = p >= r ? p + offset * w : p;
        if (vertical_compare(v, magma) <= 0) {
            result.push([p1, stretch(v, threshold, target, w)]);
        } else if (p < r) {
            result.push([p1, v]);
        } else {
            result.push([p1, max_by_compare(vertical_compare, v, stretched_magma)]);
        }
    }

    return normalize_col(result);
}

function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const up = expr[right].length - 1;

    const [r, top] = expr[right][up];
    const s = top_sep(top);
    const threshold = base_vertical(expr, top, r);
    const target_candidate = s === 0 ? threshold : vertical_increase(threshold, s - 1);

    const result = expr.slice(0, -1);
    result[right] = normalize_col([...expr[right].slice(0, -1), [r, target_candidate], ...expr[r]]);

    const prev_vert = up === 0 ? [] : expr[right][up - 1][1];
    const target = max_by_compare(vertical_compare, target_candidate, prev_vert);

    const magma = magma_verticals(expr, r);

    const offset = right - r;
    for (let w = 1; w <= index; w++) {
        for (let j = r + 1; j <= right; j++) {
            result.push(copy_column(result[j], r, threshold, target, magma[j], offset, w));
        }
    }
    if (shorter) result.pop();
    return result;
}

function truncate(expr: Expr): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const up = expr[right].length - 1;

    const [r, top] = expr[right][up];
    const threshold = base_vertical(expr, top, r);
    const result = expr.slice(0, -1);
    result[right] = normalize_col([...expr[right].slice(0, -1), [r, threshold]]);
    return result;
}

function infinity_FS(index: number): Expr {
    return [[], [[0, [...Array<number>(index).fill(0), 1]]]];
}

type Entry_MN = [number, number];
type Column_MN = Entry_MN[];
type Expr_MN = Column_MN[];

const INFINITY_mn: Expr_MN = Infinity as any;

function is_infinity_mn(expr: Expr_MN): boolean {
    return expr === INFINITY_mn;
}

function convert_to_mn(expr: Expr): Expr_MN {
    if (is_infinity(expr)) return INFINITY_mn;

    const result: Expr_MN = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = [];
        for (let j = 0; j < expr[i].length; j++) {
            const part: Column_MN = [];
            const [p, v] = expr[i][j];
            let current = v;
            const base = j === 0 ? [] : expr[i][j - 1][1];
            while (true) {
                if (vertical_compare(current, base) <= 0) break;
                const s = top_sep(current);
                part.push([p, s]);
                current = base_vertical(expr, current, p);
            }

            result[i].push(...part.reverse());
        }
    }
    return result;
}

function mn_entry_display([p, s]: Entry_MN): string {
    return ','.repeat(s + 1) + (p + 1);
}

function mn_column_display(col: Column_MN): string {
    return '(' + col.map(mn_entry_display).join('') + ')';
}

function mn_display(expr: Expr_MN): string {
    if (is_infinity_mn(expr)) return 'Limit';

    return expr.map(mn_column_display).join('');
}

function mn_from_display(str: string): Expr_MN {
    if (str === 'Limit') return INFINITY_mn;

    let i = 0;

    function error(): never {
        throw new Error('Illegal input string: ' + str);
    }

    function skip_spaces(): void {
        while (i < str.length && str[i] === ' ') i++;
    }

    function skip_index(): void {
        if (i < str.length && str[i] === ':') {
            i++;
            skip_spaces();
            while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        }
    }

    function parse_sep(): number {
        let count = 0;
        while (i < str.length && str[i] === ',') {
            count++;
            i++;
        }
        return count === 0 ? 0 : count - 1;
    }

    function parse_number(): number {
        const start = i;
        while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        if (start === i) error();
        return parseInt(str.substring(start, i), 10);
    }

    function parse_parenthesized_column(): Column_MN {
        i++;
        const col: Column_MN = [];
        skip_spaces();
        while (i < str.length && str[i] !== ')' && str[i] !== ':') {
            skip_spaces();
            const sep = parse_sep();
            skip_spaces();
            const v = parse_number();
            col.push([v - 1, sep]);
            skip_spaces();
        }
        skip_index();
        skip_spaces();
        if (i >= str.length || str[i] !== ')') error();
        i++;
        return col;
    }

    function parse_unparenthesized_column(): Column_MN {
        skip_spaces();
        if (i >= str.length) error();
        if (
            str[i] === '0' &&
            (i + 1 >= str.length ||
                str[i + 1] === ':' ||
                str[i + 1] === ' ' ||
                str[i + 1] === '(' ||
                str[i + 1] === ',')
        ) {
            i++;
            skip_index();
            return [];
        }
        const col: Column_MN = [];
        while (i < str.length && str[i] !== ' ' && str[i] !== '(' && str[i] !== ':') {
            if (str[i] === ',') {
                const sep = parse_sep();
                skip_spaces();
                const v = parse_number();
                col.push([v - 1, sep]);
            } else {
                error();
            }
        }
        skip_index();
        return col;
    }

    const result: Expr_MN = [];
    skip_spaces();
    while (i < str.length) {
        if (str[i] === '(') {
            result.push(parse_parenthesized_column());
        } else {
            result.push(parse_unparenthesized_column());
        }
        skip_spaces();
    }
    return result;
}

function convert_from_mn(expr: Expr_MN): Expr {
    if (is_infinity_mn(expr)) return INFINITY;

    const result: Expr = [];
    for (let i = 0; i < expr.length; i++) {
        const col: Column = [];
        let current: Vertical = [];
        for (let j = 0; j < expr[i].length; j++) {
            const [p, s] = expr[i][j];
            current = vertical_increase(current, s);
            if (j + 1 < expr[i].length && expr[i][j + 1][0] === p) continue;
            col.push([p, current]);
        }
        result[i] = col;
    }
    return result;
}

export const pcf_omega_mn: NotationDefinition<Expr> = {
    id: 'pcf-omega-mn',
    name: "PCF's ωMN",
    category_id: 'category-mn',
    display: {
        plain: (m) => display(m, 'plain'),
        html: (m) => display(m, 'html'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        MN: {
            plain: (m) => mn_display(convert_to_mn(m)),
            from_display: (str) => convert_from_mn(mn_from_display(str)),
        },
    },
    ...MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display, column_compare, truncate),
    is_limit,
    compare,

    credit_text_id: 'credit.pcf-omega-mn',

    init: () => [INFINITY, [[]], []],
};
