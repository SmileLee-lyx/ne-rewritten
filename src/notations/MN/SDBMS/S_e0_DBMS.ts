import { lex_compare, number_compare, tuple_lex_compare } from '@/utils.ts';
import { DiagramControl, NotationDefinition, html_to_latex } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { draw_mountain_diagram, MountainShape } from '@/notations/draw_mountain_diagram.ts';
import type { MountainViewSource } from '@/notations/mountain_view.ts';
import type { DiagramData } from '@/notations/MN/SDBMS/S1DBMS.ts';

export type Height = [number, Height][] | 0;
export type HeightEntry = [number, Height];
export type Entry = [number, Height];
export type Column = Entry[];
export type Expr = Column[];
type DisplayType = 'plain' | 'html';

export const INFINITE_HEIGHT: Height = [];
export const INFINITY: Expr = [[], [[0, INFINITE_HEIGHT]]];
// An unbounded grid has no greatest member; this is distinct from both 0 and [].
export const ABOVE_ALL = Symbol('ABOVE_ALL');
type GridResult = Height | undefined | typeof ABOVE_ALL;
type Seed = { height: Height; source?: number };

export function is_infinity(expr: Expr): boolean {
    if (expr === INFINITY) return true;
    if (expr.length !== 2 || expr[0].length !== 0 || expr[1].length !== 1) return false;
    const [r, h] = expr[1][0];
    return r === 0 && h !== 0 && h.length === 0;
}

export function compare_height(h1: Height, h2: Height): number {
    if (h1 === h2) return 0;
    if (h1 === 0) return -1;
    if (h2 === 0) return 1;
    return lex_compare(h1, h2, (a, b) => a[0] - b[0] || compare_height(a[1], b[1]), false) || 0;
}

function compare_entry(a: Entry, b: Entry): number {
    return tuple_lex_compare(a, b, [number_compare, compare_height]);
}

export function compare_column(a: Column, b: Column): number {
    return lex_compare(a, b, compare_entry);
}

export function compare(a: Expr, b: Expr): number {
    if (a === b) return 0;
    if (is_infinity(a)) return 1;
    if (is_infinity(b)) return -1;
    return lex_compare(a, b, compare_column);
}

function tail(h: Height): Height {
    if (h === 0) return 0;
    if (h.length === 0) throw new Error('An infinite height has no finite tail');
    return h[h.length - 1][1];
}

function max_height(a: Height, b: Height): Height {
    return compare_height(a, b) >= 0 ? a : b;
}

function finite_result(h: GridResult): Height {
    if (h === undefined || h === ABOVE_ALL || (h !== 0 && h.length === 0))
        throw new Error('Expected a bounded nonempty grid query');
    return h;
}

function validate_height(h: Height, bound: number): void {
    if (h === 0) return;
    if (!Array.isArray(h) || h.length === 0) throw new Error('Expected a finite height (zero is 0)');
    let previous_anchor = -1;
    let previous_child: Height = INFINITE_HEIGHT;
    for (const [a, p] of h) {
        if (!Number.isSafeInteger(a) || a <= previous_anchor || a > bound)
            throw new Error('Height anchors must increase and refer to the allowed prefix');
        validate_height(p, a);
        if (compare_height(p, previous_child) >= 0) throw new Error('Child heights must strictly decrease');
        previous_anchor = a;
        previous_child = p;
    }
}

function validate_shape(expr: Expr): void {
    for (let i = 0; i < expr.length; i++) {
        let previous_parent = i;
        let previous_height: Height = 0;
        for (const [r, h] of expr[i]) {
            if (!Number.isSafeInteger(r) || r < 0 || r >= previous_parent)
                throw new Error('Compressed parents must strictly decrease and point left');
            validate_height(h, r);
            if (compare_height(h, previous_height) <= 0) throw new Error('Entry heights must strictly increase');
            previous_parent = r;
            previous_height = h;
        }
    }
}

/** note-7, e0_dbms_local_queries_7.md §§2–6. Caches belong to this fixed left environment. */
export function create_queries(expr: Expr) {
    if (is_infinity(expr)) throw new Error('Queries require a finite environment');
    validate_shape(expr);
    const cache = new Map<string, unknown>();
    function memo<T>(name: string, a: number, n: number, h: Height, compute: () => T): T {
        const key = name + ':' + a + ':' + n + ':' + JSON.stringify(h);
        if (cache.has(key)) return cache.get(key) as T;
        const result = compute();
        cache.set(key, result);
        return result;
    }

    function column(a: number): Column {
        if (!Number.isSafeInteger(a) || a < 0 || a >= expr.length) throw new Error('Unknown query root');
        return expr[a];
    }

    function tail_bound(r: number, n: number, h: Height): Height {
        return memo('tail', r, n, h, () => {
            let result = h;
            for (let k = 0; k < n && result !== 0; k++) result = grid_head(r, k, result);
            return result;
        });
    }

    function seed_max(a: number, n: number): Seed {
        return memo('max', a, n, 0, () => {
            const col = column(a);
            if (col.length === 0) return { height: 0 };
            const [r, h] = col[col.length - 1];
            return { height: tail_bound(r, n, h), source: r };
        });
    }

    function seed_member(a: number, n: number, h: Height): Seed | undefined {
        return memo('seed_member', a, n, h, () => {
            if (h === 0) return { height: 0 };
            if (h.length === 0 || h[h.length - 1][0] >= a) return undefined;
            const maximum = seed_max(a, n);
            const compared = compare_height(h, maximum.height);
            if (compared > 0) return undefined;
            if (compared === 0) return maximum;
            for (const [r, upper] of column(a)) {
                if (compare_height(h, tail_bound(r, n, upper)) <= 0 && grid_member(r, n, h))
                    return { height: h, source: r };
            }
            return undefined;
        });
    }

    function bounded_below(r: number, n: number, upper: Height, cap: Height): Height | undefined {
        if (cap === 0) return undefined;
        if (compare_height(upper, cap) < 0) return upper;
        return finite_result(grid_below(r, n, cap));
    }

    function seed_below(a: number, n: number, cap: Height): Seed | undefined {
        return memo('seed_below', a, n, cap, () => {
            if (cap === 0) return undefined;
            const maximum = seed_max(a, n);
            if (compare_height(maximum.height, cap) < 0) return maximum;
            let result: Seed = { height: 0 };
            for (const [r, h] of column(a)) {
                const q = bounded_below(r, n, tail_bound(r, n, h), cap);
                if (q !== undefined && compare_height(q, result.height) > 0) result = { height: q, source: r };
            }
            return result;
        });
    }

    function grid_member(a: number, n: number, h: Height): boolean {
        return memo('member', a, n, h, () => {
            if (h === 0) return true;
            if (h.length === 0) return false;
            const [b, p] = h[h.length - 1];
            if (b < a) return seed_member(a, n, h) !== undefined;
            if (b > a || !grid_member(a, n + 1, p)) return false;
            const u = h.slice(0, -1);
            return u.length === 0 || (seed_member(a, n, u) !== undefined && compare_height(p, tail(u)) < 0);
        });
    }

    // h is certified by a seed component or a grid membership query.
    function grid_head(a: number, n: number, h: Height): Height {
        return memo('head', a, n, h, () => {
            if (h === 0) return 0;
            const p = tail(h);
            if (p !== 0 && p[0][0] === a) return p; // Strong diagonal early stop.
            const [b] = h[h.length - 1];
            if (b < a) {
                const source = seed_member(a, n, h)?.source;
                if (source === undefined) throw new Error('Height is not a grid member');
                return grid_head(source, n, h);
            }
            if (b !== a) throw new Error('Height exceeds its grid root');
            if (h.length === 1) return max_height(p, seed_max(a, n + 1).height);
            const lower = seed_below(a, n, h.slice(0, -1))!;
            return lower.height === 0 ? p : max_height(p, grid_head(lower.source!, n, lower.height));
        });
    }

    function grid_below(a: number, n: number, cap: Height): GridResult {
        return memo('below', a, n, cap, () => {
            if (cap === 0) return undefined;
            if (cap.length === 0 || cap[0][0] > a) return ABOVE_ALL;
            const lower = seed_below(a, n, cap)!.height;
            let j = 0;
            while (j < cap.length && cap[j][0] < a) j++;
            const u = cap.slice(0, j);
            if (u.length > 0 && seed_member(a, n, u) === undefined) return lower;
            let cut: Height;
            if (j === cap.length) cut = tail(u);
            else if (u.length === 0) cut = cap[j][1];
            else if (cap[j][0] > a) cut = tail(u);
            else cut = compare_height(cap[j][1], tail(u)) < 0 ? cap[j][1] : tail(u);
            if (cut === 0) return lower;
            return [...u, [a, finite_result(grid_below(a, n + 1, cut))]];
        });
    }

    function grid_prev(a: number, n: number, h: Height): Height | undefined {
        return memo('prev', a, n, h, () => {
            if (h === 0) return undefined;
            if (!grid_member(a, n, h)) throw new Error('Cannot descend a nonmember height');
            const [b, p] = h[h.length - 1];
            if (p !== 0) {
                const u = b === a ? h.slice(0, -1) : h;
                return [...u, [a, finite_result(grid_prev(a, n + 1, p))]];
            }
            if (b < a) return seed_below(a, n, h)!.height;
            return h.length === 1 ? seed_max(a, n).height : seed_below(a, n, h.slice(0, -1))!.height;
        });
    }

    // The upward counterpart is used only by Y input. Each finite seed component
    // supplies its least point above the cap; its enclosing gap then supplies
    // the least new point. Like grid_below, same-root calls enter a child tree.
    function seed_above(a: number, n: number, cap: Height): Height | undefined {
        return memo('seed_above', a, n, cap, () => {
            let result: Height | undefined;
            for (const [r, h] of column(a)) {
                const upper = tail_bound(r, n, h);
                if (compare_height(upper, cap) <= 0) continue;
                const q = grid_above(r, n, cap);
                if (q === undefined || compare_height(q, upper) > 0) throw new Error('Missing bounded successor');
                if (result === undefined || compare_height(q, result) < 0) result = q;
            }
            return result;
        });
    }

    function grid_above(a: number, n: number, cap: Height): Height | undefined {
        return memo('above', a, n, cap, () => {
            if (cap !== 0 && (cap.length === 0 || cap[0][0] > a)) return undefined;
            const upper = seed_above(a, n, cap);
            const u = upper === undefined ? [] : upper;
            if (u === 0) throw new Error('Zero cannot be an upper seed');
            if (upper !== undefined && tail(upper) === 0) return upper;
            const first: Height = [...u, [a, 0]];
            if (compare_height(first, cap) > 0) return first;
            if (cap === 0 || cap.length <= u.length || cap[u.length][0] !== a) return upper;
            const p = cap[u.length][1];
            const q = cap.length > u.length + 1 && grid_member(a, n + 1, p) ? p : grid_above(a, n + 1, p);
            if (q === undefined || (upper !== undefined && compare_height(q, tail(upper)) >= 0)) return upper;
            return [...u, [a, q]];
        });
    }

    function lower_tail(a: number, n: number, height_cap: Height, tail_cap: Height): Height | undefined {
        if (height_cap === 0 || tail_cap === 0) return undefined;
        let result: Height = 0;
        for (const [r, h] of column(a)) {
            const z = bounded_below(r, 0, h, height_cap);
            if (z === undefined) continue;
            const q = bounded_below(r, n, tail_bound(r, n, z), tail_cap);
            if (q !== undefined) result = max_height(result, q);
        }
        return result;
    }

    return {
        seed_max,
        seed_member,
        seed_below,
        grid_member,
        grid_head,
        tail_bound,
        grid_below,
        grid_prev,
        grid_above,
        lower_tail,
    };
}

export function validate_expr(expr: Expr): void {
    if (is_infinity(expr)) return;
    const queries = create_queries(expr);
    for (const col of expr)
        for (const [r, h] of col)
            if (!queries.grid_member(r, 0, h)) throw new Error('Compressed endpoint is not in its parent grid');
}

export function infinity_FS(index: number): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    let h: Height = 0;
    for (let i = 0; i <= index; i++) h = [[0, h]];
    return [[], [[0, h]]];
}

export function is_limit(expr: Expr): boolean {
    return is_infinity(expr) || (expr.length > 0 && expr[expr.length - 1].length > 0);
}

function height(col: Column): Height {
    return col.length === 0 ? 0 : col[col.length - 1][1];
}

function merge_column(col1: Column, col2: Column): Column {
    const h = height(col1);
    return [...col1, ...col2.filter(([, h2]) => compare_height(h2, h) > 0)];
}

function copy_value(value: number, r: number, offset: number): number {
    return value >= r ? value + offset : value;
}

export function copy_height(h: Height, r: number, offset: number): Height {
    return h === 0 ? 0 : h.map(([a, p]) => [copy_value(a, r, offset), copy_height(p, r, offset)]);
}

function copy_column(col: Column, r: number, offset: number): Column {
    return col.map(([a, h]) => [copy_value(a, r, offset), copy_height(h, r, offset)]);
}

export function compute_new_height(h: Height, expr: Expr, r: number): Height | undefined {
    return create_queries(expr).grid_prev(r, 0, h);
}

export function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid fundamental sequence index');
    if (is_infinity(expr)) return infinity_FS(index);
    if (expr.length === 0) return [];
    const right = expr.length - 1;
    const col = expr[right];
    if (col.length === 0) return expr.slice(0, -1);
    const [r, h] = col[col.length - 1];
    const new_h = finite_result(compute_new_height(h, expr, r));
    let new_col = col.slice(0, -1);
    if (new_h !== 0) new_col = merge_column(new_col, [[r, new_h]]);
    new_col = merge_column(new_col, expr[r]);
    const result = expr.slice(0, -1).concat([new_col]);
    for (let w = 1; w <= index; w++)
        for (let i = r + 1; i <= right; i++) result.push(copy_column(result[i], r, (right - r) * w));
    if (shorter) result.pop();
    return result;
}

function truncate(expr: Expr): Expr {
    const right = expr.length - 1;
    const top = expr[right].length - 1;
    const result = expand(expr, 0, false);
    if (result[right].length <= top) return result;
    result[right] = result[right].slice(0, result[right][top][0] === expr[right][top][0] ? top + 1 : top);
    return result;
}

export function height_display(h: Height, is_inner: boolean = false): string {
    if (h === 0) return '0';
    if (h.length === 0) return '∞';
    if (is_inner && h.length === 1 && h[0][1] === 0) return '' + (h[0][0] + 1);
    return '(' + h.map(([a, p]) => a + 1 + '@' + height_display(p, true)).join(',') + ')';
}

function entry_display([v, h]: Entry, type: DisplayType): string {
    return type === 'html' ? v + 1 + '<sup>' + height_display(h) + '</sup>' : v + 1 + '^' + height_display(h);
}

function column_display(col: Column, type: DisplayType, index?: number): string {
    const content = col.length === 0 ? '0' : col.map((entry) => entry_display(entry, type)).join(',');
    if (index === undefined) return '(' + content + ')';
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + (col.length === 0 ? '' : content) + ':' + index + ')';
}

export function display(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';
    return expr.map((col) => column_display(col, type)).join('');
}

export function display_marked(expr: Expr, type: DisplayType = 'plain', start_index: number = 1): string {
    if (is_infinity(expr)) return 'Limit';
    return expr.map((col, i) => column_display(col, type, start_index + i)).join('');
}

export function from_display(str: string): Expr {
    const s = str.replace(/\s+/g, '');
    if (s === 'Limit') return INFINITY;
    let i = 0;
    function error(): never {
        throw new Error('Illegal input string: ' + str);
    }
    function read(token: string): void {
        if (s[i] !== token) error();
        i++;
    }
    function parse_number(): number {
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        const value = Number(s.slice(start, i));
        if (start === i || !Number.isSafeInteger(value)) error();
        return value;
    }
    function parse_height_entry(allow_abbreviation: boolean = false): HeightEntry {
        const a = parse_number();
        if (a < 1) error();
        if (allow_abbreviation && s[i] !== '@') return [a - 1, 0];
        read('@');
        return [a - 1, parse_height(true)];
    }
    function parse_height(is_inner: boolean = false): Height {
        if (s[i] === '0' || s[i] === '∅') {
            i++;
            return 0;
        }
        if (s[i] === '∞') {
            i++;
            return [];
        }
        if (s[i] !== '(') return [parse_height_entry(is_inner)];
        i++;
        const result: HeightEntry[] = [];
        if (s[i] !== ')') {
            result.push(parse_height_entry());
            while (s[i] === ',') {
                i++;
                result.push(parse_height_entry());
            }
        }
        read(')');
        return result;
    }
    const result: Expr = [];
    while (i < s.length) {
        read('(');
        const col: Column = [];
        if (s[i] === '0') i++;
        else if (s[i] !== ')' && s[i] !== ':') {
            while (true) {
                const r = parse_number();
                if (r < 1) error();
                read('^');
                col.push([r - 1, parse_height()]);
                if (s[i] !== ',') break;
                i++;
            }
        }
        if (s[i] === ':') {
            i++;
            parse_number();
        }
        read(')');
        result.push(col);
    }
    // The two-column expression with an infinite height is the same Limit.
    if (is_infinity(result)) return INFINITY;
    validate_expr(result);
    return result;
}

/** Cantor normal form below ε₀; coefficients are exact positive integers. */
export type Ordinal = [Ordinal, bigint][];

export function compare_ordinal(a: Ordinal, b: Ordinal): number {
    return lex_compare(a, b, ([p, k], [q, l]) => compare_ordinal(p, q) || (k < l ? -1 : k > l ? 1 : 0));
}

export function add_ordinal(a: Ordinal, b: Ordinal): Ordinal {
    if (b.length === 0) return a;
    let i = a.length;
    while (i > 0 && compare_ordinal(a[i - 1][0], b[0][0]) < 0) i--;
    if (i > 0 && compare_ordinal(a[i - 1][0], b[0][0]) === 0)
        return [...a.slice(0, i - 1), [b[0][0], a[i - 1][1] + b[0][1]], ...b.slice(1)];
    return [...a.slice(0, i), ...b];
}

export function display_ordinal(a: Ordinal, type: DisplayType = 'plain'): string {
    if (a.length === 0) return '0';
    return a
        .map(([p, k]) => {
            if (p.length === 0) return '' + k;
            const is_one = p.length === 1 && p[0][0].length === 0 && p[0][1] === 1n;
            const exponent = display_ordinal(p, type);
            const power = is_one
                ? 'ω'
                : type === 'html'
                  ? 'ω<sup>' + exponent + '</sup>'
                  : 'ω^' + (p.length === 1 && p[0][0].length === 0 ? exponent : '(' + exponent + ')');
            return power + (k === 1n ? '' : '·' + k);
        })
        .join('+');
}

function create_values(queries: ReturnType<typeof create_queries>) {
    const cache = new Map<string, Ordinal>();
    function value(h: Height, n: number = 0): Ordinal {
        if (h === 0) return [];
        if (h.length === 0) throw new Error('An infinite height has no ε₀ CNF');
        const key = n + ':' + JSON.stringify(h);
        const cached = cache.get(key);
        if (cached !== undefined) return cached;
        const [a, p] = h[h.length - 1];
        // Empty construction stem [] is the infinite cap, not zero.
        const z = queries.seed_below(a, n, h.slice(0, -1))!.height;
        const result = add_ordinal(value(z, n), [[value(p, n + 1), 1n]]);
        cache.set(key, result);
        return result;
    }
    return value;
}

export function height_value(expr: Expr, h: Height, n: number = 0): Ordinal {
    return create_values(create_queries(expr))(h, n);
}

export type SepDbms = Ordinal;
export type EntryDbms = [number, SepDbms];
export type ColumnDbms = EntryDbms[];
export type ExprDbms = ColumnDbms[];
const INFINITY_DBMS: ExprDbms = Infinity as any;

export function convert_to_dbms_data(expr: Expr): [Entry[][], ExprDbms] {
    const queries = create_queries(expr);
    const value = create_values(queries);
    const mountain: Entry[][] = [];
    const dbms: ExprDbms = [];
    for (const col of expr) {
        const points: Entry[] = [];
        const separators: ColumnDbms = [];
        for (let j = col.length - 1; j >= 0; j--) {
            const [r, upper] = col[j];
            const lower: Height = j === 0 ? 0 : col[j - 1][1];
            let current = upper;
            while (compare_height(current, lower) > 0) {
                points.push([r, current]);
                separators.push([r, value(tail(current), 1)]);
                current = finite_result(queries.grid_prev(r, 0, current));
            }
        }
        mountain.push(points.reverse());
        dbms.push(separators.reverse());
    }
    return [mountain, dbms];
}

export function convert_to_dbms(expr: Expr): ExprDbms {
    return is_infinity(expr) ? INFINITY_DBMS : convert_to_dbms_data(expr)[1];
}

export function dbms_sep_display(s: SepDbms, type: DisplayType = 'plain'): string {
    if (s.length === 0) return ',';
    if (s.length === 1 && s[0][0].length === 0) return ','.repeat(Number(s[0][1]) + 1);
    const [p, k] = s[0];
    if (
        p.length === 1 &&
        p[0][0].length === 0 &&
        p[0][1] === 1n &&
        (s.length === 1 || (s.length === 2 && s[1][0].length === 0))
    )
        return ';'.repeat(Number(k)) + ','.repeat(s.length === 1 ? 0 : Number(s[1][1]));
    return '{' + display_ordinal(s, type) + '}';
}

function dbms_entry_display([v, s]: EntryDbms, type: DisplayType = 'plain'): string {
    return dbms_sep_display(s, type) + (v + 1);
}

export function dbms_display(expr: ExprDbms, type: DisplayType = 'plain'): string {
    if (expr === INFINITY_DBMS) return 'Limit';
    return expr
        .map(
            (col) =>
                '(' + (col.length === 0 ? '0' : col.map((entry) => dbms_entry_display(entry, type)).join('')) + ')',
        )
        .join('');
}

export function dbms_display_marked(
    expr: ExprDbms,
    type: DisplayType | 'latex' = 'plain',
    start_index: number = 1,
): string {
    if (expr === INFINITY_DBMS) return 'Limit';
    return expr
        .map((col, i) => {
            const content =
                col.length === 0
                    ? '0'
                    : col.map((entry) => dbms_entry_display(entry, type === 'plain' ? 'plain' : 'html')).join('');
            if (type === 'latex') return '(' + html_to_latex(content) + ')_{' + (start_index + i) + '}';
            return type === 'html'
                ? '(' + content + ")<sub><span style='color:#888'>" + (start_index + i) + '</span></sub>'
                : '(' + content + ':' + (start_index + i) + ')';
        })
        .join('');
}

export function dbms_column_verticals(col: ColumnDbms): Ordinal[] {
    let current: Ordinal = [];
    return col.map(([, s]) => {
        current = add_ordinal(current, [[s, 1n]]);
        return current;
    });
}

function dbms_find_index_below_row(rows: Ordinal[], row: Ordinal): number {
    let l = 0,
        r = rows.length;
    while (l < r) {
        const m = (l + r) >>> 1;
        if (compare_ordinal(rows[m], row) < 0) l = m + 1;
        else r = m;
    }
    return l;
}

export function dbms_compute_parent(expr: ExprDbms, rows: Ordinal[][], [i, j]: [number, number]): [number, number] {
    const pi = expr[i][j][0];
    return [pi, dbms_find_index_below_row(rows[pi], rows[i][j])];
}

export function convert_dbms_to_layer(expr: ExprDbms): ExprDbms {
    if (expr === INFINITY_DBMS) return expr;
    const rows = expr.map(dbms_column_verticals);
    const result: ExprDbms = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = expr[i].map(([, s], j) => {
            const [pi, pj] = dbms_compute_parent(expr, rows, [i, j]);
            return [pj === expr[pi].length ? 0 : result[pi][pj][0] + 1, s];
        });
    }
    return result;
}

export function dbms_to_y_mountain(expr: ExprDbms): bigint[][] {
    const rows = expr.map(dbms_column_verticals);
    const result: bigint[][] = [];
    for (let i = 0; i < expr.length; i++) {
        const col: bigint[] = [];
        col[expr[i].length] = 1n;
        for (let j = expr[i].length - 1; j >= 0; j--) {
            const [pi, pj] = dbms_compute_parent(expr, rows, [i, j]);
            col[j] = col[j + 1] + result[pi][pj];
        }
        result.push(col);
    }
    return result;
}

export function to_y_sequence(expr: Expr): bigint[] {
    return dbms_to_y_mountain(convert_to_dbms(expr)).map((col) => col[0]);
}

function display_as_Y(expr: ExprDbms): string {
    return expr === INFINITY_DBMS
        ? 'Limit'
        : dbms_to_y_mountain(expr)
              .map((col) => col[0])
              .join(',');
}

type YNode = { height: Height; value: bigint; parent?: [number, number] };

/** First-smaller-parent construction (note-7, standard transport §2). */
export function from_y_seq(target: (number | bigint)[]): Expr {
    const values = target.map((v) => {
        if ((typeof v === 'number' && !Number.isSafeInteger(v)) || v <= 0)
            throw new Error('Expected positive integers');
        return BigInt(v);
    });
    if (values.length === 0) return [];
    if (values[0] !== 1n) throw new Error('A Y sequence must start with 1');
    const result: Expr = [[]];
    const mountain: YNode[][] = [[{ height: 0, value: 1n }]];
    function index_at_or_below(col: YNode[], h: Height): number {
        let l = 0,
            r = col.length;
        while (l + 1 < r) {
            const m = (l + r) >>> 1;
            if (compare_height(col[m].height, h) <= 0) l = m;
            else r = m;
        }
        return l;
    }
    function next_candidate([a, j]: [number, number]): [number, number] {
        if (j === 0) return [a - 1, 0];
        const node = mountain[a][j];
        const r = node.parent![0];
        return [r, index_at_or_below(mountain[r], node.height)];
    }
    for (let i = 1; i < values.length; i++) {
        const queries = create_queries(result.slice());
        const nodes: YNode[] = [{ height: 0, value: values[i] }];
        const col: Column = [];
        while (nodes[nodes.length - 1].value > 1n) {
            const current = nodes[nodes.length - 1];
            let candidate: [number, number] =
                current.parent === undefined
                    ? [i - 1, 0]
                    : [current.parent[0], index_at_or_below(mountain[current.parent[0]], current.height)];
            while (candidate[0] >= 0 && mountain[candidate[0]][candidate[1]].value >= current.value)
                candidate = next_candidate(candidate);
            if (candidate[0] < 0) throw new Error('Missing smaller parent');
            const [a, j] = candidate;
            const h = queries.grid_above(a, 0, current.height);
            if (h === undefined) throw new Error('Missing parent-grid successor');
            nodes.push({ height: h, value: current.value - mountain[a][j].value, parent: candidate });
            if (col.length > 0 && col[col.length - 1][0] === a) col[col.length - 1] = [a, h];
            else col.push([a, h]);
        }
        result.push(col);
        mountain.push(nodes);
    }
    return result;
}

function from_display_y_seq(str: string): Expr {
    if (str.trim() === 'Limit') return INFINITY;
    if (str.trim() === '') return [];
    return from_y_seq(
        str.split(',').map((part) => {
            if (!/^\s*[1-9]\d*\s*$/.test(part)) throw new Error('Illegal Y input: ' + str);
            return BigInt(part.trim());
        }),
    );
}

function build_s_e0_dbms_mountain_source(expr: Expr, current_equiv?: string): MountainViewSource | undefined {
    if (is_infinity(expr) || expr.length === 0) return undefined;
    const is_dbms = current_equiv === 'dbms' || current_equiv === 'm dbms';
    const is_m = current_equiv === 'm' || current_equiv === 'm dbms';
    const is_l_dbms = current_equiv === 'l dbms';
    const is_y = current_equiv === 'Y';
    const [mountain, dbms] = convert_to_dbms_data(expr);
    const rows = dbms.map(dbms_column_verticals);
    const layered = is_l_dbms ? convert_dbms_to_layer(dbms) : [];
    const y = is_y ? dbms_to_y_mountain(dbms) : [];
    const shape: MountainShape<Ordinal> = [];
    for (let i = 0; i < expr.length; i++) {
        shape[i] = [{ vertical: [], text: is_y ? '' + y[i][0] : is_m ? ':' + (i + 1) : '*' }];
        for (let j = 0; j < dbms[i].length; j++) {
            shape[i][j + 1] = {
                vertical: rows[i][j],
                text: is_dbms
                    ? dbms_entry_display(dbms[i][j], 'html')
                    : is_l_dbms
                      ? dbms_entry_display(layered[i][j], 'html')
                      : is_y
                        ? '' + y[i][j + 1]
                        : entry_display(mountain[i][j], 'html'),
                leg_target: dbms_compute_parent(dbms, rows, [i, j]),
            };
        }
    }
    return {
        shape,
        layout: {
            vertical_display: (v) => display_ordinal(v, 'html'),
            vertical_compare: compare_ordinal,
            separator_count: () => 1,
        },
        display_html_row_label: true,
        display_html_entry: true,
    };
}

export const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (expr, data) => {
        const source = build_s_e0_dbms_mountain_source(expr, data.current_equiv);
        if (!source) return undefined;
        return draw_mountain_diagram(source.shape, source.layout, {
            invert_vertical: data.invert_vertical ?? false,
            display_html_row_label: source.display_html_row_label,
            display_html_entry: true,
            column_width: data.current_equiv === undefined || data.current_equiv === 'm' ? 100 : 30,
        });
    },
    handle_action: (data, action) =>
        action.direction === 'down'
            ? { ...data, invert_vertical: true }
            : action.direction === 'up'
              ? { ...data, invert_vertical: false }
              : null,
};

export const S_e0_DBMS: NotationDefinition<Expr> = {
    id: 's-e0-dbms',
    name: 'S ε₀ DBMS',
    category_id: 'category-sdbms',
    display: {
        plain: (m) => display(m),
        html: (m) => display(m, 'html'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        m: {
            plain: (m) => display_marked(m),
            html: (m) => display_marked(m, 'html'),
            from_display,
            name: { id: 'display.index-marked' },
        },
        dbms: {
            plain: (m) => dbms_display(convert_to_dbms(m)),
            html: (m) => dbms_display(convert_to_dbms(m), 'html'),
            name: { id: 'display.dbms' },
        },
        'm dbms': {
            plain: (m) => dbms_display_marked(convert_to_dbms(m)),
            html: (m) => dbms_display_marked(convert_to_dbms(m), 'html'),
            latex: (m) => dbms_display_marked(convert_to_dbms(m), 'latex'),
            name: { id: 'display.marked-dbms' },
        },
        'l dbms': {
            plain: (m) => dbms_display(convert_dbms_to_layer(convert_to_dbms(m))),
            html: (m) => dbms_display(convert_dbms_to_layer(convert_to_dbms(m)), 'html'),
            name: { id: 'display.layered-dbms' },
        },
        Y: { plain: (m) => display_as_Y(convert_to_dbms(m)), from_display: from_display_y_seq },
    },
    ...MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display, compare_column, truncate),
    is_limit,
    compare,
    draw_diagram: draw_diagram_control,
    mountain_view: (expr, data) => build_s_e0_dbms_mountain_source(expr, data?.current_equiv),
    description: [{ id: 'description.s-e0-dbms.1' }],
    credit_text_id: 'credit.up2dbms-v2',
    init: () => [INFINITY, [[]], []],
    debug: { create_queries, height_value, convert_to_dbms_data, to_y_sequence, from_y_seq, validate_expr },
};
