import {
    anti_lex_compare,
    compare_undefined_last_by,
    deepcopy,
    lex_compare,
    lex_compare_by,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import { sequence_FS_variants } from '@/notations/notation_utils.ts';

type HeightEntry = [number | undefined, number | undefined];
type Height = HeightEntry[];
type Entry = [number, Height];
type Column = Entry[];
type Expr = Column[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function infinity_FS(index: number): Expr {
    return [
        [],
        [
            [
                0,
                [
                    [undefined, 0],
                    [index, undefined],
                ],
            ],
        ],
    ];
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function compare_height(h1: Height, h2: Height): number {
    return lex_compare(h1, h2, lex_compare_by(compare_undefined_last_by(number_compare)));
}

function compare_entry(entry1: Entry, entry2: Entry): number {
    return tuple_lex_compare(entry1, entry2, [number_compare, compare_height]);
}

function compare_column(col1: Column, col2: Column): number {
    return lex_compare(col1, col2, compare_entry);
}

function compare(expr1: Expr, expr2: Expr): number {
    return lex_compare(expr1, expr2, compare_column);
}

type DisplayType = 'plain' | 'html';

function height_entry_display([p, v]: HeightEntry): string {
    const d_v = v === undefined ? 'ω' : '' + (v + 1);
    if (p === undefined) return d_v;
    return d_v + '@' + p;
}

function height_display(h: Height): string {
    return '(' + h.map(height_entry_display) + ')';
}

function entry_display([v, h]: Entry, type: DisplayType): string {
    const d_v = v + 1;
    const d_s = height_display(h);
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

/** 单列的标记列标显示: 空列在 plain 下写作 '(:N)'(不带 0), html 下仍保留 (0)。 */
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

    /** 跳过 display_marked 写入的列标(如 ':2'), 其值被舍弃(列标即列的位置)。 */
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

    /** 行高的单项 'v@p': v 为显示值(内部值 + 1), p 为位置(原样)。内部存 [位置, 值]。 */
    function parse_height_item(): [number, number] {
        const v = parse_number() - 1;
        skip_spaces();
        if (i >= s.length || s[i] !== '@') error();
        i++;
        const p = parse_number();
        return [p, v];
    }

    /**
     * 解析行高: 形如 '(v1@p1,v2@p2,…)'。
     * 由于 display 的 plain 产物目前会多包一层括号(形如 'v^((…))'),
     * 这里额外容忍一层外层括号, 使单括号与双括号两种写法都能解析。
     */
    function parse_height(): Height {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;
        skip_spaces();

        let extra_paren = false;
        if (i < s.length && s[i] === '(') {
            extra_paren = true;
            i++;
            skip_spaces();
        }

        const result: Height = [];
        if (i < s.length && s[i] !== ')') {
            result.push(parse_height_item());
            skip_spaces();
            while (i < s.length && s[i] === ',') {
                i++;
                skip_spaces();
                result.push(parse_height_item());
                skip_spaces();
            }
        }

        if (i >= s.length || s[i] !== ')') error();
        i++;
        if (extra_paren) {
            skip_spaces();
            if (i >= s.length || s[i] !== ')') error();
            i++;
        }
        return result;
    }

    function parse_entry(): Entry {
        const v = parse_number() - 1;
        skip_spaces();
        if (i < s.length && s[i] === '^') {
            i++;
            return [v, parse_height()];
        }
        return [v, []]; // '(0)' 这类省略上标的形式, 稍后作为空列处理
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
        // 删去列尾表示 0 的项(显示 0 ↔ 内部 v = -1): 空列的显示形式为 (0)
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

function height(col: Column): Height {
    if (col.length === 0) return [];
    return col[col.length - 1][1];
}

function filter_height_greater(col: Column, h0: Height): Column {
    return col.filter(([, h]) => compare_height(h, h0) > 0);
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

function copy_value(value: number, r: number, offset: number): number;
function copy_value(value: number | undefined, r: number, offset: number): number | undefined;

function copy_value(value: number | undefined, r: number, offset: number): number | undefined {
    return value === undefined ? undefined : value >= r ? value + offset : value;
}

function copy_height_entry([p, v]: HeightEntry, r: number, offset: number): HeightEntry {
    return [p, copy_value(v, r, offset)];
}

function copy_height(h: Height, r: number, offset: number): Height {
    return h.map(([p, v]) => [p, copy_value(v, r, offset)]);
}

function copy_entry(entry: Entry, r: number, offset: number): Entry {
    return [copy_value(entry[0], r, offset), copy_height(entry[1], r, offset)];
}

function copy_column(col: Column, r: number, offset: number): Column {
    return col.map((entry) => copy_entry(entry, r, offset));
}

function find_index_below_height(col: Column, h: Height): number {
    let l = 0,
        r = col.length;
    while (l < r) {
        const m = (l + r + 1) >> 1;
        if (compare_height(h, col[m - 1][1]) > 0) l = m;
        else r = m - 1;
    }
    return l;
}

function top_separator(h: Height): number {
    if (h[h.length - 1][1] === undefined) return h[h.length - 1][0]! + 1;
    return 0;
}

function height_value_at(h: Height, p: number): number | undefined {
    const j = h.findLastIndex(([q]) => q === undefined || q >= p);
    if (j === -1) return -1;
    return h[j][1];
}

function height_above_pos(h: Height, p: number): Height {
    return h.filter(([q]) => q === undefined || q >= p);
}

function height_fill(h: Height, p: number, v: number | undefined): Height {
    const new_h = deepcopy(h);
    while (new_h.length > 1 && new_h[new_h.length - 1][0]! <= p) new_h.pop();
    if (new_h[new_h.length - 1][1] !== v) {
        new_h.push([p, v]);
    }
    return new_h;
}

function height_coincide_above(h1: Height, h2: Height, p: number): boolean {
    return compare_height(height_above_pos(h1, p), height_above_pos(h2, p)) === 0;
}

function compute_new_height(h: Height, expr: Expr, r: number): Height {
    const [p, v] = h[h.length - 1];
    let new_h: Height = h;
    if (v === undefined) {
        if (p === undefined) {
            throw new Error('Illegal state');
        }

        new_h = height_fill(new_h, p, r);
        if (p > 0) {
            new_h = height_fill(new_h, p - 1, undefined);
        }
    } else if (p === undefined) {
        new_h = height(expr[v]);
    } else {
        const col_rh = expr[v];
        const hj = col_rh.findIndex(([, hv]) => compare_height(h, hv) <= 0);
        let new_value: number;
        if (hj > 0 && height_coincide_above(col_rh[hj - 1][1], h, p + 1)) {
            new_value = height_value_at(col_rh[hj - 1][1], p)!;
        } else {
            new_value = col_rh[hj][0];
        }
        new_h = height_fill(new_h, p, new_value);
        if (p > 0) {
            new_h = height_fill(new_h, p - 1, undefined);
        }
    }

    return new_h;
}

function expand(expr: Expr, index: number, shorter: boolean): Expr {
    if (expr.length === 0) return expr;
    const right = expr.length - 1;
    if (expr[right].length === 0) return expr.slice(0, -1);
    const top = expr[right].length - 1;
    const tr_entry = expr[right][top];
    const r = tr_entry[0];

    // compute lnz-1

    const h = tr_entry[1];

    const new_h = compute_new_height(h, expr, r);

    const result: Expr = expr.slice(0, -1);
    result.push(merge_column(expr[right].slice(0, -1), [[r, new_h]], expr[r]));

    for (let w = 1; w <= index; w++) {
        for (let i = r + 1; i <= right; i++) {
            result.push(copy_column(result[i], r, (right - r) * w));
        }
    }
    if (shorter) result.pop();
    return result;
}

type Entry_DBMS = [number, number];
type Column_DBMS = Entry_DBMS[];
type Expr_DBMS = Column_DBMS[];

const INFINITY_dbms: Expr_DBMS = Infinity as any;

function is_infinity_dbms(expr: Expr_DBMS): boolean {
    return expr === INFINITY_dbms;
}

function convert_to_dbms(expr: Expr): Expr_DBMS {
    if (is_infinity(expr)) return INFINITY_dbms;

    const result: Expr_DBMS = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = [];
        for (let j = 0; j < expr[i].length; j++) {
            const part: Column_DBMS = [];

            const v = expr[i][j][0];
            let current = expr[i][j][1];
            while (true) {
                if (current.length === 0 || (j > 0 && compare_height(current, expr[i][j - 1][1]) <= 0)) break;
                const s = top_separator(current);
                current = compute_new_height(current, expr, v);
                part.push([v, s]);
            }

            result[i].push(...part.reverse());
        }
    }
    return result;
}

function dbms_entry_display([v, s]: Entry_DBMS): string {
    const d_v = v + 1;
    const d_s = ','.repeat(s + 1);
    return d_s + d_v;
}

function dbms_column_display(col: Column_DBMS): string {
    if (col.length === 0) return '(0)';
    return '(' + col.map((entry) => dbms_entry_display(entry)).join('') + ')';
}

function dbms_display(expr: Expr_DBMS): string {
    if (is_infinity_dbms(expr)) return 'Limit';
    return expr.map((col) => dbms_column_display(col)).join('');
}

/** dbms 的单列标记列标显示: plain 在括号内以 ':' 追加列标(空列写作 '(0:N)'), html 作灰色下标写在括号之后。 */
function dbms_column_display_marked(col: Column_DBMS, index: number, type: DisplayType): string {
    const content = col.length === 0 ? '0' : col.map((entry) => dbms_entry_display(entry)).join('');
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + content + ':' + index + ')';
}

/** dbms 的标记列标显示: 列标自 start_index 起(1-based)。 */
export function dbms_display_marked(expr: Expr_DBMS, type: DisplayType = 'plain', start_index: number = 1): string {
    if (is_infinity_dbms(expr)) return 'Limit';
    const parts: string[] = [];
    let index = start_index;
    for (const col of expr) {
        parts.push(dbms_column_display_marked(col, index, type));
        index++;
    }
    return parts.join('');
}

type Vertical_DBMS = number[];

function compare_dbms_vertical(v1: Vertical_DBMS, v2: Vertical_DBMS): number {
    return anti_lex_compare(v1, v2, number_compare);
}

function dbms_vertical_increase(v: Vertical_DBMS, s: number): Vertical_DBMS {
    if (v.length <= s) return [...Array<number>(s).fill(0), 1];
    const result = v.slice();
    result[s]++;
    result.fill(0, 0, s);
    return result;
}

function dbms_column_verticals(col: Column_DBMS): Vertical_DBMS[] {
    let current: Vertical_DBMS = [];
    const result: Vertical_DBMS[] = [];
    for (let i = 0; i < col.length; i++) {
        current = dbms_vertical_increase(current, col[i][1]);
        result.push(current);
    }
    return result;
}

function dbms_find_index_below_row(V: Vertical_DBMS[], v: Vertical_DBMS): number {
    let l = 0,
        r = V.length;
    while (l < r) {
        const m = (l + r + 1) >> 1;
        if (compare_dbms_vertical(v, V[m - 1]) > 0) l = m;
        else r = m - 1;
    }
    return l;
}

function dbms_compute_parent(expr: Expr_DBMS, V: Vertical_DBMS[][], [i, j]: [number, number]): [number, number] {
    const pi = expr[i][j][0];
    const pj = dbms_find_index_below_row(V[pi], V[i][j]);
    return [pi, pj];
}

export function convert_dbms_to_layer(om: Expr_DBMS): Expr_DBMS {
    if (is_infinity_dbms(om)) return om;

    const V = om.map(dbms_column_verticals);

    const dm = deepcopy(om);
    for (let i = 0; i < dm.length; i++) {
        const column = dm[i];
        for (let j = 0; j < column.length; j++) {
            const [pi, pj] = dbms_compute_parent(om, V, [i, j]);
            const entry = column[j];
            entry[0] = pj === om[pi].length ? 0 : 1 + dm[pi][pj][0];
        }
    }
    return dm;
}

function dbms_to_y_mountain(expr: Expr_DBMS): number[][] {
    const V = expr.map(dbms_column_verticals);
    const result: number[][] = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = [];
        result[i][expr[i].length] = 1;
        for (let j = expr[i].length - 1; j >= 0; j--) {
            const [pi, pj] = dbms_compute_parent(expr, V, [i, j]);
            result[i][j] = result[pi][pj] + result[i][j + 1];
        }
    }
    return result;
}

function display_as_Y(matrix: Expr_DBMS): string {
    if (is_infinity_dbms(matrix)) return '1,ω';
    return dbms_to_y_mountain(matrix)
        .map((col) => col[0])
        .join(',');
}

export const S_omega_DBMS_v2: NotationDefinition<Expr> = {
    id: 's-omega-dbms-v2',
    name: 'SωDBMS v2',
    category_id: 'category-sdbms',
    display: {
        plain: (m) => display(m, 'plain'),
        html: (m) => display(m, 'html'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        marked: {
            plain: (m) => display_marked(m, 'plain'),
            html: (m) => display_marked(m, 'html'),
            from_display,
            name: { id: 'display.index-marked' },
        },
        dbms: {
            plain: (m) => dbms_display(convert_to_dbms(m)),
            name: { id: 'display.dbms' },
        },
        'marked dbms': {
            plain: (m) => dbms_display_marked(convert_to_dbms(m), 'plain'),
            html: (m) => dbms_display_marked(convert_to_dbms(m), 'html'),
            name: { id: 'display.marked-dbms' },
        },
        'layered dbms': {
            plain: (m) => dbms_display(convert_dbms_to_layer(convert_to_dbms(m))),
            name: { id: 'display.layered-dbms' },
        },
        Y: {
            plain: (m) => display_as_Y(convert_to_dbms(m)),
        },
    },
    ...sequence_FS_variants(expand, is_infinity, infinity_FS, is_limit, display),
    is_limit,
    compare,
    credit_text_id: 'credit.s-omega-dbms',

    init: () => [INFINITY, [[]], []],
};
