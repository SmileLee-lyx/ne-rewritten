import { boolean_compare, lex_compare, number_compare, tuple_lex_compare } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';

type Entry = [number, number];
type Column = Entry[];
type Expr = Column[];

/** DBMS 矩阵: 每列是若干 0-based 列标(与 mn 的 0-based 约定一致, 显示时 +1)。 */
type Expr_DBMS = number[][];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function infinity_FS(index: number): Expr {
    const result: Expr = [[]];
    for (let i = 0; i < index; i++) {
        result.push([[i, i]]);
    }
    return result;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function compare_entry(entry1: Entry, entry2: Entry): number {
    return lex_compare(entry1, entry2, number_compare);
}

function compare_column(col1: Column, col2: Column): number {
    return lex_compare(col1, col2, compare_entry);
}

function compare(expr1: Expr, expr2: Expr): number {
    return lex_compare(expr1, expr2, compare_column);
}

type DisplayType = 'plain' | 'html';

function entry_display([v, s]: Entry, type: DisplayType): string {
    const d_v = v + 1;
    const d_s = s + 1;
    if (type === 'html') return d_v + '<sup>' + d_s + '</sup>';
    return d_v + '^' + d_s;
}

function column_display(col: Column, type: DisplayType): string {
    if (col.length === 0) return '(0)';
    return '(' + col.map((entry) => entry_display(entry, type)).join(',') + ')';
}

function display(expr: Expr, type: DisplayType = 'plain'): string {
    if (is_infinity(expr)) return 'Limit';
    return expr.map((col) => column_display(col, type)).join('');
}

export function display_marked(expr: Expr, type: DisplayType, start_index: number = 1): string {
    if (is_infinity(expr)) return 'Limit';
    const parts: string[] = [];
    let index = start_index;
    for (const col of expr) {
        parts.push(column_display_marked(col, type, index));
        index++;
    }
    return parts.join('');
}

function column_display_marked(col: Column, type: DisplayType, index: number): string {
    if (col.length === 0) {
        if (type === 'html') return "(0)<sub><span style='color:#888'>" + index + '</span></sub>';
        return '(:' + index + ')';
    }
    const content = col.map((entry) => entry_display(entry, type)).join(',');
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + content + ':' + index + ')';
}

export function from_display(str: string): Expr {
    let i = 0;
    const s = str;

    function error(): never {
        throw new Error('Illegal input string: ' + s);
    }

    function skip_spaces(): void {
        while (i < s.length && s[i] === ' ') i++;
    }

    function skip_index(): void {
        if (i < s.length && s[i] === ':') {
            i++;
            skip_spaces();
            while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        }
    }

    function parse_number(): number {
        skip_spaces();
        const start = i;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
        if (start === i) error();
        return parseInt(s.substring(start, i), 10);
    }

    function parse_entry(): Entry {
        const x = parse_number() - 1;
        skip_spaces();
        if (i < s.length && s[i] === '^') {
            i++;
            return [x, parse_number() - 1];
        }
        return [x, -1]; // '(0)' 这类省略上标的形式, 稍后作为空列处理
    }

    function parse_column(): Column {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;

        const entries: Entry[] = [];
        skip_spaces();
        if (i < s.length && s[i] !== ')' && s[i] !== ':') {
            entries.push(parse_entry());
            skip_spaces();
            while (i < s.length && s[i] === ',') {
                i++;
                skip_spaces();
                if (i < s.length && s[i] === ')') break;
                entries.push(parse_entry());
                skip_spaces();
            }
        }

        skip_spaces();
        skip_index();
        skip_spaces();
        if (i >= s.length || s[i] !== ')') error();
        i++;
        while (entries.length > 0 && entries[entries.length - 1][0] === -1) entries.pop();
        return entries;
    }

    function parse_expr(): Expr {
        const result: Expr = [];
        skip_spaces();
        while (i < s.length && s[i] === '(') {
            result.push(parse_column());
            skip_spaces();
        }
        return result;
    }

    skip_spaces();
    if (i + 5 <= s.length && s.substring(i, i + 5) === 'Limit') {
        i += 5;
        skip_spaces();
        if (i !== s.length) error();
        return INFINITY;
    }

    const result = parse_expr();
    skip_spaces();
    if (i !== s.length) error();
    return result;
}

function height(col: Column): number {
    if (col.length === 0) return -1;
    return col[col.length - 1][1];
}

function filter_height_greater(col: Column, h0: number): Column {
    return col.filter(([, h]) => h > h0);
}

function merge_column(...cols: Column[]): Column {
    if (cols.length === 0) return [];
    if (cols.length === 1) return cols[0];
    if (cols.length === 2) {
        const col1 = cols[0];
        const col2 = cols[1];
        return [...col1, ...filter_height_greater(col2, height(col1))];
    }
    return merge_column(merge_column(cols[0], cols[1]), ...cols.slice(2));
}

function copy_value(value: number, r: number, offset: number, up: boolean): number {
    return value > r || (value === r && up) ? value + offset : value;
}

function copy_entry(entry: Entry, r: number, offset: number, up: boolean): Entry {
    return [copy_value(entry[0], r, offset, up), copy_value(entry[1], r, offset, up)];
}

function copy_column(col: Column, r: number, offset: number, up: boolean): Column {
    return col.map((entry) => copy_entry(entry, r, offset, up));
}

type RelColumn = RelEntry[];
type RelEntry = [boolean, number, boolean, number];

function compare_rel_column(a: RelColumn, b: RelColumn) {
    return lex_compare(a, b, compare_rel_entry);
}

function compare_rel_entry(a: RelEntry, b: RelEntry): number {
    return tuple_lex_compare(a, b, [boolean_compare, number_compare, boolean_compare, number_compare]);
}

function to_rel_value(v: number, r: number): [boolean, number] {
    return v >= r ? [true, v - r] : [false, v];
}

function to_rel_entry(entry: Entry, r: number): RelEntry {
    return [...to_rel_value(entry[0], r), ...to_rel_value(entry[1], r)];
}

function to_rel_column(col: Column, r: number): RelColumn {
    return col.map((entry) => to_rel_entry(entry, r));
}

function height_after(col: Column, r: number): number {
    const j = col.findLastIndex((entry) => entry[0] >= r);
    if (j === -1) return -1;
    return col[j][1];
}

function parent_at(col: Column, h: number): number {
    const j = col.findIndex((entry) => entry[1] >= h);
    if (j === -1) return -1;
    return col[j][0];
}

function discard_after(col: Column, r: number): Column {
    return col.filter((entry) => entry[0] <= r);
}

function compute_up(expr: Expr, r: number, h: number): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, r);
    result[r] = true;

    const h0 = height(expr[h]);

    for (let i = r + 1; i < expr.length; i++) {
        // perform UP check

        let col = expr[i];

        if (height_after(col, r) < h) {
            result[i] = false;
            continue;
        }

        const h_test = height_after(col, r + 1);

        if (h_test >= h0) {
            result[i] = result[parent_at(col, h0)];
            continue;
        }

        const X_start = i;
        let Y_start = right;
        let next: number;
        while ((next = parent_at(expr[Y_start], h_test)) !== r) Y_start = next;

        if (Y_start <= X_start) {
            result[i] = X_start === Y_start;
            continue;
        }

        const X0 = discard_after(expr[X_start], r);
        const Y0 = discard_after(expr[Y_start], r);
        const cmp_0 = compare_column(X0, Y0);
        if (cmp_0 !== 0) {
            result[i] = cmp_0 > 0;
            continue;
        }

        for (let k = 1; Y_start + k < expr.length; k++) {
            const Xk = to_rel_column(expr[X_start + k], X_start);
            const Yk = to_rel_column(expr[Y_start + k], Y_start);
            const cmp = compare_rel_column(Xk, Yk);
            if (cmp !== 0) {
                result[i] = cmp > 0;
                break;
            }
        }

        if (result[i] === undefined) {
            result[i] = true;
        }
    }

    return result;
}

function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const top = expr[right].length - 1;
    const tr_entry = expr[right][top];
    const r = tr_entry[0];
    const h = tr_entry[1];

    const new_h = height(expr[h]);

    const result: Expr = expr.slice(0, -1);
    result.push(merge_column(expr[right].slice(0, -1), [[r, new_h]], expr[r]));

    const up = compute_up(expr, r, h);

    for (let w = 1; w <= index; w++) {
        for (let i = r + 1; i <= right; i++) {
            result.push(copy_column(result[i], r, (right - r) * w, up[i]));
        }
    }
    if (shorter) result.pop();
    return result;
}

function compute_layered_heights(expr: Expr): number[] {
    const heights: number[] = [];
    for (let i = 0; i < expr.length; i++) {
        let h = 0;
        for (const [, y] of expr[i]) {
            const entry_height = heights[y] + 1;
            if (entry_height > h) h = entry_height;
        }
        heights[i] = h;
    }
    return heights;
}

export function convert_to_layered_height(expr: Expr): Expr {
    if (is_infinity(expr)) return expr;
    const heights = compute_layered_heights(expr);
    return expr.map((col) => col.map(([x, y]) => [x, heights[y]]));
}

const INFINITY_dbms: Expr_DBMS = Infinity as any;

function is_infinity_dbms(matrix: Expr_DBMS): boolean {
    return matrix === INFINITY_dbms;
}

export function convert_to_dbms(expr: Expr): Expr_DBMS {
    if (is_infinity(expr)) return INFINITY_dbms;
    const heights = compute_layered_heights(expr);
    return expr.map((col, i) => {
        const h = heights[i];
        const bms_column: number[] = [];
        for (let level = 1; level <= h; level++) {
            for (const [x, y] of col) {
                if (heights[y] + 1 >= level) {
                    bms_column.push(x);
                    break;
                }
            }
        }
        return bms_column;
    });
}

function display_dbms_column(col: number[], index?: number, type: DisplayType = 'plain'): string {
    const content = col.map((v) => ',' + (v + 1)).join('');
    if (index === undefined) return '(' + content + ')';
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + content + ':' + index + ')';
}

/** dbms 的显示: 各列依次拼接。 */
export function display_dbms(matrix: Expr_DBMS): string {
    if (is_infinity_dbms(matrix)) return 'Limit';
    return matrix.map((col) => display_dbms_column(col)).join('');
}

export function display_dbms_marked(matrix: Expr_DBMS, type: DisplayType = 'plain', start_index: number = 1): string {
    if (is_infinity_dbms(matrix)) return 'Limit';
    const parts: string[] = [];
    let index = start_index;
    for (const col of matrix) {
        parts.push(display_dbms_column(col, index, type));
        index++;
    }
    return parts.join('');
}

export function convert_dbms_to_layer(matrix: Expr_DBMS): Expr_DBMS {
    if (is_infinity_dbms(matrix)) return matrix;
    const depth_map: Expr_DBMS = [];
    for (let i = 0; i < matrix.length; i++) {
        depth_map[i] = [];
        for (let j = 0; j < matrix[i].length; j++) {
            const pi = matrix[i][j];
            depth_map[i][j] = j >= matrix[pi].length ? 0 : 1 + depth_map[pi][j];
        }
    }
    return depth_map;
}

function dbms_to_Y_mountain(matrix: Expr_DBMS): number[][] {
    const M: number[][] = [];
    for (let i = 0; i < matrix.length; i++) {
        M[i] = [];
        M[i][matrix[i].length] = 1;
        for (let j = matrix[i].length - 1; j >= 0; j--) {
            const up = M[i][j + 1] ?? 1;
            const left = M[matrix[i][j]][j] ?? 1;
            M[i][j] = up + left;
        }
    }
    return M;
}

function display_as_Y(matrix: Expr_DBMS): string {
    if (is_infinity_dbms(matrix)) return '1,3';
    return dbms_to_Y_mountain(matrix)
        .map((col) => col[0])
        .join(',');
}

export const UP1DBMS: NotationDefinition<Expr> = {
    id: 'up1dbms',
    name: 'UP1DBMS',
    category_id: 'category-upmn-test',
    display: {
        plain: (m) => display(m, 'plain'),
        html: (m) => display(m, 'html'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        'layered height': {
            plain: (m) => display(convert_to_layered_height(m), 'plain'),
            html: (m) => display(convert_to_layered_height(m), 'html'),
            name: { id: 'display.layered-height' },
        },
        marked: {
            plain: (m) => display_marked(m, 'plain'),
            html: (m) => display_marked(m, 'html'),
            from_display,
            name: { id: 'display.index-marked' },
        },
        'marked layered height': {
            plain: (m) => display_marked(convert_to_layered_height(m), 'plain'),
            html: (m) => display_marked(convert_to_layered_height(m), 'html'),
            name: { id: 'display.marked-layered-height' },
        },
        dbms: {
            plain: (m) => display_dbms(convert_to_dbms(m)),
            name: { id: 'display.dbms' },
        },
        'marked dbms': {
            plain: (m) => display_dbms_marked(convert_to_dbms(m), 'plain'),
            html: (m) => display_dbms_marked(convert_to_dbms(m), 'html'),
            name: { id: 'display.marked-dbms' },
        },
        'layered dbms': {
            plain: (m) => display_dbms(convert_dbms_to_layer(convert_to_dbms(m))),
            name: { id: 'display.layered-dbms' },
        },
        Y: {
            plain: (m) => display_as_Y(convert_to_dbms(m)),
        },
    },
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    credit_text_id: 'credit.up1mn',

    init: () => [INFINITY, []],
};
