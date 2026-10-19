import {
    anti_lex_compare,
    bind2,
    boolean_compare,
    compare_undefined_last_by,
    deepcopy,
    lex_compare,
    number_compare,
    tuple_lex_compare,
} from '@/utils.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { Diagram } from '@/core/diagram_types.ts';
import { draw_mountain_diagram, MountainShape } from '@/notations/draw_mountain_diagram.ts';
import type { MountainViewSource } from '@/notations/mountain_view.ts';
import { DiagramData } from '@/notations/MN/SDBMS/S1DBMS.ts';

type Height = [number, number];
type Entry = [number, Height];
type Column = Entry[];
type Expr = Column[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function infinity_FS(index: number): Expr {
    const result: Expr = [[]];
    for (let i = 0; i < index; i++) {
        result.push([[i, [i, i + 1]]]);
    }
    return result;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function compare_height(h1: Height, h2: Height): number {
    return anti_lex_compare(h1, h2, compare_undefined_last_by(number_compare));
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

function height_display([h0, h1]: Height): string {
    const d_h0 = '' + (h0 + 1);
    return '(' + h1 + ',' + d_h0 + ')';
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

    /**
     * 行高: '(h1,h0)', 内部按 [h0, h1] 存放(见 height_display)。
     * 显示时第 1 分量 h1 原样写出, 第 2 分量写 h0 + 1。
     */
    function parse_height(): Height {
        skip_spaces();
        if (i >= s.length || s[i] !== '(') error();
        i++;
        const h1 = parse_number();
        skip_spaces();
        if (i >= s.length || s[i] !== ',') error();
        i++;
        const h0 = parse_number() - 1;
        skip_spaces();
        if (i >= s.length || s[i] !== ')') error();
        i++;
        return [h0, h1];
    }

    function parse_entry(): Entry {
        const v = parse_number() - 1;
        skip_spaces();
        // 上标一律带括号, 故允许省略 '^': '2^(1,1)' 与 '2(1,1)' 等价。
        if (i < s.length && s[i] === '^') {
            i++;
            return [v, parse_height()];
        }
        if (i < s.length && s[i] === '(') {
            return [v, parse_height()];
        }
        // '(0)' 这类不带上标的写法: 以哨兵行高 [0, -1] 占位(h1 = -1 不合法, 不会与 [0, 0] 等合法值混淆),
        // 列尾删去仍按 v = -1 判
        return [v, [0, -1]];
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

function height(col: Column): Height | undefined {
    if (col.length === 0) return undefined;
    return col[col.length - 1][1];
}

function height_to_height1(h: Height | undefined): number {
    return h?.[1] ?? 0;
}

function height1(col: Column): number {
    return height_to_height1(height(col));
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
        let h = height(col1);
        return [...col1, ...(h === undefined ? col2 : filter_height_greater(col2, h))];
    }
    return merge_column(merge_column(cols[0], cols[1]), ...cols.slice(2));
}

function copy_value(value: number, r: number, offset: number, up: boolean): number {
    return value > r || (value === r && up) ? value + offset : value;
}

function copy_height(h: Height, r: number, offset: number, up: boolean): Height {
    return [copy_value(h[0], r, offset, up), h[1]];
}

function copy_entry(entry: Entry, r: number, offset: number, up: boolean): Entry {
    return [copy_value(entry[0], r, offset, up), copy_height(entry[1], r, offset, up)];
}

function copy_column(col: Column, r: number, offset: number, up: boolean): Column {
    return col.map((entry) => copy_entry(entry, r, offset, up));
}

function top_separator([v, h1]: Height, expr: Expr): 0 | 1 {
    return height1(expr[v]) < h1 ? 1 : 0;
}

function compute_new_height(h: Height, expr: Expr, r: number): Height | undefined {
    const [v, h1] = h;

    const col_rh = expr[v];
    const hj = col_rh.findIndex(([, hv]) => compare_height(h, hv) <= 0);

    if (hj === -1) {
        if (height1(col_rh) < h1) return [r, h1 - 1];

        return height(col_rh);
    } else {
        const new_value = col_rh[hj][0];
        let new_h: Height = [new_value, h1];
        if (hj > 0) {
            const lower = col_rh[hj - 1][1];
            if (compare_height(lower, new_h) > 0) {
                new_h = lower;
            }
        }
        return new_h;
    }
}

type RelColumn = RelEntry[];
type RelValue = [boolean, number];
type RelHeight = [RelValue, number];
type RelEntry = [RelValue, RelHeight];

function compare_rel_column(a: RelColumn, b: RelColumn): number {
    return lex_compare(a, b, compare_rel_entry);
}

function compare_rel_entry(a: RelEntry, b: RelEntry): number {
    return tuple_lex_compare(a, b, [compare_rel_value, compare_rel_height]);
}

function compare_rel_height(a: RelHeight, b: RelHeight): number {
    return tuple_lex_compare(a, b, [compare_rel_value, number_compare]);
}

function compare_rel_value(a: RelValue, b: RelValue): number {
    return tuple_lex_compare(a, b, [boolean_compare, number_compare]);
}

function to_rel_value(v: number, r: number): RelValue {
    return v >= r ? [true, v - r] : [false, v];
}

function to_rel_height([h0, h1]: Height, r: number): RelHeight {
    return [to_rel_value(h0, r), h1];
}

function to_rel_entry(entry: Entry, r: number): RelEntry {
    return [to_rel_value(entry[0], r), to_rel_height(entry[1], r)];
}

function to_rel_column(col: Column, r: number): RelColumn {
    return col.map((entry) => to_rel_entry(entry, r));
}

function height_after(col: Column, r: number): Height | undefined {
    const j = col.findLastIndex((entry) => entry[0] >= r);
    if (j === -1) return undefined;
    return col[j][1];
}

function parent_at(col: Column, h: Height | undefined): number {
    if (h === undefined) return col[0]?.[0] ?? -1;
    const j = col.findIndex((entry) => compare_height(entry[1], h) >= 0);
    return j === -1 ? -1 : col[j][0];
}

function discard_after(col: Column, r: number): Column {
    return col.filter((entry) => entry[0] <= r);
}

function compute_up(expr: Expr, r: number, h: Height): boolean[] {
    const right = expr.length - 1;

    const result: boolean[] = Array(expr.length);
    result.fill(false, 0, r);
    result[r] = true;

    for (let i = r + 1; i <= right; i++) {
        const col = expr[i];

        const h_root = height_after(col, r);

        if (h_root === undefined || compare_height(h_root, h) < 0) {
            result[i] = false;
            continue;
        }

        const h_proj = height_after(col, r + 1);

        if (h_proj !== undefined && compare_height(h_proj, h) >= 0) {
            result[i] = result[parent_at(col, h)];
            continue;
        }

        if (h_proj !== undefined) {
            let p_proj = i;
            let next: number;
            while ((next = parent_at(expr[p_proj], h_proj)) !== r) p_proj = next;

            if (!result[p_proj]) {
                result[i] = false;
                continue;
            }
        }

        const h_proj_threshold: Height = h_proj === undefined ? [0, 0] : [h_proj[0] + 1, h_proj[1]];

        const X_start = i;
        let Y_start = right;
        {
            let next: number;
            while ((next = parent_at(expr[Y_start], h_proj_threshold)) !== r) Y_start = next;
        }

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

    // compute lnz-1

    const h = tr_entry[1];

    const new_h = compute_new_height(h, expr, r);

    let new_col = expr[right].slice(0, -1);
    if (new_h !== undefined) new_col = merge_column(new_col, [[r, new_h]]);
    new_col = merge_column(new_col, expr[r]);

    const result: Expr = expr.slice(0, -1);
    result.push(new_col);

    const up = compute_up(expr, r, h);

    for (let w = 1; w <= index; w++) {
        for (let i = r + 1; i <= right; i++) {
            result.push(copy_column(result[i], r, (right - r) * w, up[i]));
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

    return convert_to_dbms_data(expr)[1];
}

function convert_to_dbms_data(expr: Expr): [Entry[][], Expr_DBMS] {
    const result: Entry[][] = [];
    const result_dbms: Expr_DBMS = [];

    for (let i = 0; i < expr.length; i++) {
        const [result_i, result_dbms_i] = convert_to_dbms_data_column(expr, i);
        result[i] = result_i;
        result_dbms[i] = result_dbms_i;
    }

    return [result, result_dbms];
}

function convert_to_dbms_data_column(expr: Expr, i: number): [Entry[], Column_DBMS] {
    const result: Entry[] = [];
    const result_dbms: Column_DBMS = [];
    for (let j = expr[i].length - 1; j >= 0; j--) {
        const v = expr[i][j][0];
        let current: Height | undefined = expr[i][j][1];
        while (true) {
            if (current === undefined || (j > 0 && compare_height(current, expr[i][j - 1][1]) <= 0)) break;
            const s = top_separator(current, expr);
            result.push([v, current]);
            result_dbms.push([v, s]);
            current = compute_new_height(current, expr, v);
        }
    }
    result.reverse();
    result_dbms.reverse();
    return [result, result_dbms];
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

function dbms_column_display_marked(col: Column_DBMS, index: number, type: DisplayType): string {
    const content = col.length === 0 ? '0' : col.map((entry) => dbms_entry_display(entry)).join('');
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + content + ':' + index + ')';
}

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

type Expr_RMN = [number, Vertical_DBMS][][];

const INFINITY_rmn: Expr_RMN = Infinity as any;

function is_infinity_rmn(expr: Expr_RMN): boolean {
    return expr === INFINITY_rmn;
}

function dbms_to_rmn(expr: Expr_DBMS): Expr_RMN {
    if (is_infinity_dbms(expr)) return INFINITY_rmn;

    const V = expr.map(dbms_column_verticals);
    const result: Expr_RMN = [];
    for (let i = 0; i <= expr.length - 1; i++) {
        const col: Expr_RMN[number] = [];

        for (let j = 0; j < expr[i].length; j++) {
            if (j + 1 === expr[i].length || expr[i][j][0] !== expr[i][j + 1][0]) {
                col.push([expr[i][j][0], V[i][j]]);
            }
        }

        result[i] = col;
    }
    return result;
}

function vertical_cantor_display(v: Vertical_DBMS, type: DisplayType): string {
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

function rmn_entry_display([v, vt]: Expr_RMN[number][number], type: DisplayType): string {
    return v + 1 + ':' + vertical_cantor_display(vt, type);
}

function rmn_col_display(col: Expr_RMN[number], type: DisplayType): string {
    return '(' + col.map(bind2(rmn_entry_display, type)).join(',') + ')';
}

function rmn_display(expr: Expr_RMN, type: DisplayType): string {
    if (is_infinity_rmn(expr)) return 'Limit';

    return expr.map(bind2(rmn_col_display, type)).join('');
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

function dbms_to_y_mountain_column(expr: Expr_DBMS, V: Vertical_DBMS[][], y_mountain: number[][], i: number): number[] {
    const result = [];
    result[expr[i].length] = 1;
    for (let j = expr[i].length - 1; j >= 0; j--) {
        const [pi, pj] = dbms_compute_parent(expr, V, [i, j]);
        result[j] = y_mountain[pi][pj] + result[j + 1];
    }
    return result;
}

function dbms_to_y_mountain(expr: Expr_DBMS): number[][] {
    const V = expr.map(dbms_column_verticals);
    const result: number[][] = [];
    for (let i = 0; i < expr.length; i++) {
        result[i] = dbms_to_y_mountain_column(expr, V, result, i);
    }
    return result;
}

function display_as_Y(matrix: Expr_DBMS): string {
    if (is_infinity_dbms(matrix)) return '1,4';
    return dbms_to_y_mountain(matrix)
        .map((col) => col[0])
        .join(',');
}

function to_y_sequence(expr: Expr): number[] {
    return dbms_to_y_mountain(convert_to_dbms(expr)).map((col) => col[0]);
}

function dbms_vertical_display(v: Vertical_DBMS): string {
    const result: string[] = [];
    for (let i = 0; i < v.length; i++) {
        for (let j = 0; j < v[i]; j++) {
            result.push(','.repeat(i + 1));
        }
    }
    return result.toReversed().join('/');
}

function build_SDBMS_mountain_source(expr: Expr, current_equiv: string | undefined): MountainViewSource | undefined {
    if (is_infinity(expr) || expr.length === 0) return undefined;

    const is_dbms = current_equiv === 'dbms' || current_equiv === 'm dbms';
    const is_m = current_equiv === 'm' || current_equiv === 'm dbms';
    const is_l_dbms = current_equiv === 'l dbms';
    const is_y = current_equiv === 'Y';

    const [mountain, dbms] = convert_to_dbms_data(expr);
    const V = dbms.map(dbms_column_verticals);
    const layered = is_l_dbms ? convert_dbms_to_layer(dbms) : [];
    const y = is_y ? dbms_to_y_mountain(dbms) : [];

    const shape: MountainShape<Vertical_DBMS> = [];

    for (let i = 0; i < expr.length; i++) {
        shape[i] = [
            {
                vertical: [],
                text: is_y ? '' + y[i][0] : is_m ? ':' + (i + 1) : '*',
            },
        ];

        for (let j = 0; j < dbms[i].length; j++) {
            shape[i][j + 1] = {
                vertical: V[i][j],
                text: is_dbms
                    ? dbms_entry_display(dbms[i][j])
                    : is_l_dbms
                      ? dbms_entry_display(layered[i][j])
                      : is_y
                        ? '' + y[i][j + 1]
                        : entry_display(mountain[i][j], 'html'),
                leg_target: dbms_compute_parent(dbms, V, [i, j]),
            };
        }
    }

    return {
        shape,
        layout: {
            vertical_display: dbms_vertical_display,
            vertical_compare: compare_dbms_vertical,
            separator_count: () => 1,
        },
        display_html_entry: true,
    };
}

function draw_SDBMS_diagram(
    expr: Expr,
    current_equiv: string | undefined,
    invert_vertical: boolean,
): Diagram | undefined {
    const source = build_SDBMS_mountain_source(expr, current_equiv);
    if (!source) return undefined;
    const is_original = current_equiv === undefined || current_equiv === 'm';
    return draw_mountain_diagram(source.shape, source.layout, {
        invert_vertical,
        display_html_entry: source.display_html_entry,
        column_width: is_original ? 100 : 30,
    });
}

// 从极限展开, 查找 to_y_seq 等于 target 的表达式
function from_y_seq(target: number[]): Expr {
    if (target.length === 0) return [];
    if (target[0] !== 1) throw new Error('Illegal argument');
    if (target.length === 1) return [[]];
    if (!target.every((x) => Number.isInteger(x) && x > 0)) throw new Error('Illegal argument');

    let bound: Expr = infinity_FS(target[1] - 1); // 初始时, to_y_seq(bound) = (1, target[1]+1)
    let [mountain, dbms] = convert_to_dbms_data(bound);
    let V = dbms.map(dbms_column_verticals);
    let y_mountain = dbms_to_y_mountain(dbms);

    // 假设: to_y_seq(bound) 和 target 仅在 bound 的末位不同.
    while (true) {
        const right = bound.length - 1;

        // 首先尝试直接截断山脉.

        let new_l = dbms[right].length;
        while (new_l > 0 && y_mountain[right][0] - y_mountain[right][new_l - 1] + 1 > target[right]) {
            new_l--;
        }

        if (new_l !== dbms[right].length) {
            bound = deepcopy(bound);
            const [v, h] = mountain[right][new_l - 1];
            while (bound[right][bound[right].length - 1][0] < v) bound[right].pop();
            bound[right][bound[right].length - 1][1] = h;
        }

        // 进行展开. 展开其实是线性的, 代价远低于 to_dbms 和 y_mountain. 只需对后两者进行重用.

        let bound_fs_index = 0;
        let bound_fs = expand(bound, bound_fs_index, false);
        let mountain_fs = mountain.slice(0, -1);
        let dbms_fs = dbms.slice(0, -1);
        let V_fs = V.slice(0, -1);
        let y_mountain_fs = y_mountain.slice(0, -1);

        // 不断生成并比较基本列

        let compared = right;
        while (true) {
            if (compared === target.length) return bound_fs.slice(0, compared);
            if (compared === bound_fs.length) {
                bound_fs_index++;
                bound_fs = expand(bound, bound_fs_index, false);
            }
            const [next, dbms_next] = convert_to_dbms_data_column(bound_fs, compared);
            mountain_fs.push(next);
            dbms_fs.push(dbms_next);
            V_fs.push(dbms_column_verticals(dbms_next));
            y_mountain_fs.push(dbms_to_y_mountain_column(dbms_fs, V_fs, y_mountain_fs, compared));

            if (y_mountain_fs[compared][0] > target[compared]) {
                break;
            }

            if (y_mountain_fs[compared][0] < target[compared]) {
                throw new Error('Not standard');
            }

            compared++;
        }

        [bound, mountain, dbms, V, y_mountain] = [
            bound_fs.slice(0, compared + 1),
            mountain_fs,
            dbms_fs,
            V_fs,
            y_mountain_fs,
        ];
    }
}

function from_display_y_seq(str: string): Expr {
    const seq = str.split(',').map((x) => Number(x.trim()));
    if (!seq.every(Number.isInteger)) throw new Error('Illegal input: ' + str);
    if (lex_compare(seq, [1, 4], number_compare) >= 0) return INFINITY;
    return from_y_seq(seq);
}

export const draw_diagram_control: DiagramControl<Expr, DiagramData> = {
    default_data: { current_equiv: undefined, invert_vertical: undefined },
    draw_diagram: (_expr, _data) => draw_SDBMS_diagram(_expr, _data.current_equiv, _data.invert_vertical ?? false),
    handle_action: (data: DiagramData, action): DiagramData | null => {
        if (action.type === 'scroll') {
            if (action.direction === 'down') {
                return { ...data, invert_vertical: true };
            } else if (action.direction === 'up') {
                return { ...data, invert_vertical: false };
            }
        }
        return null;
    },
};

function truncate(expr: Expr): Expr {
    const right = expr.length - 1;
    const top = expr[right].length - 1;
    const result = expand(expr, 0, false);
    if (result[right].length <= top) return result;
    result[right] = result[right].slice(0, result[right][top][0] === expr[right][top][0] ? top + 1 : top);
    return result;
}

export const UP2DBMS_v2c: NotationDefinition<Expr> = {
    id: 'up2dbms-v2c',
    name: 'UP2DBMS v2c',
    description: [
        { id: 'description.up2dbms-v2c.1' },
        { id: 'description.up2dbms-v2c.2' },
        { id: 'description.up2dbms-v2c.3' },
    ],
    category_id: 'category-upmn',
    display: {
        plain: (m) => display(m, 'plain'),
        html: (m) => display(m, 'html'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        m: {
            plain: (m) => display_marked(m, 'plain'),
            html: (m) => display_marked(m, 'html'),
            from_display,
            name: { id: 'display.index-marked' },
        },
        RMN: {
            plain: (m) => rmn_display(dbms_to_rmn(convert_to_dbms(m)), 'plain'),
            html: (m) => rmn_display(dbms_to_rmn(convert_to_dbms(m)), 'html'),
        },
        dbms: {
            plain: (m) => dbms_display(convert_to_dbms(m)),
            name: { id: 'display.dbms' },
        },
        'm dbms': {
            plain: (m) => dbms_display_marked(convert_to_dbms(m), 'plain'),
            html: (m) => dbms_display_marked(convert_to_dbms(m), 'html'),
            name: { id: 'display.marked-dbms' },
        },
        'l dbms': {
            plain: (m) => dbms_display(convert_dbms_to_layer(convert_to_dbms(m))),
            name: { id: 'display.layered-dbms' },
        },
        Y: {
            plain: (m) => display_as_Y(convert_to_dbms(m)),
            from_display: from_display_y_seq,
        },
    },
    ...MN_FS_variants(expand, is_infinity, infinity_FS, is_limit, display, compare_column, truncate),
    is_limit,
    compare,

    draw_diagram: draw_diagram_control,
    mountain_view: (expr, data) => build_SDBMS_mountain_source(expr, data?.current_equiv),

    credit_text_id: 'credit.up2dbms-v2',

    init: () => [INFINITY, [[]], []],
};
