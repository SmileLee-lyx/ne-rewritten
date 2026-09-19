import { boolean_compare, deepcopy, lex_compare, lex_compare_by, number_compare, tuple_lex_compare } from '@/utils.ts';
import { DiagramControl, NotationDefinition } from '@/notation-definition.ts';
import { MN_FS_variants } from '@/notations/notation_utils.ts';
import { Diagram } from '@/core/diagram_types.ts';
import { draw_mountain_diagram, MountainShape } from '@/notations/draw_mountain_diagram.ts';
import type { MountainViewSource } from '@/notations/mountain_view.ts';
import { DiagramData } from '@/notations/MN/SDBMS/S1DBMS.ts';

type HeightPos = number | 'w';
type HeightEntry = [number, HeightPos];
type Height = HeightEntry[];
type Entry = [number, Height];
type Column = Entry[];
type Expr = Column[];

const INFINITY: Expr = Infinity as any;

function is_infinity(expr: Expr): boolean {
    return expr === INFINITY;
}

function infinity_FS(index: number): Expr {
    const result: Expr = [[]];
    for (let i = 0; i < index; ++i) {
        result.push([[i, [[i, 'w']]]]);
    }
    return result;
}

function is_limit(expr: Expr): boolean {
    if (is_infinity(expr)) return true;
    return expr.length > 0 && expr[expr.length - 1].length > 0;
}

function compare_height_pos(hp1: number | 'w', hp2: number | 'w'): number {
    if (hp1 === 'w' || hp2 === 'w') {
        return boolean_compare(hp1 === 'w', hp2 === 'w');
    }
    return number_compare(hp1, hp2);
}

function compare_height(h1: Height, h2: Height): number {
    return lex_compare(h1, h2, lex_compare_by(compare_height_pos), false);
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

function height_entry_display([v, p]: HeightEntry): string {
    const d_p = p === 'w' ? 'ω' : '' + (p + 1);
    return v + 1 + '@' + d_p;
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

    /** 行高的值: 数字 n 的内部值 = n - 1。本版本的高度无 ω 等特殊值。 */
    function parse_height_value(): number {
        return parse_number() - 1;
    }

    /**
     * 行高的位置: 数字 n 为列标, 内部位置 = n - 1(与 display 的 'p + 1' 互逆);
     * 或 'w' / 'ω' 表示第 ω 个 pos(内部存 'w')。
     * 本记号在 indexed SωDBMS 的基础上增加了第 ω 个 pos, 故位置可以是 ω。
     */
    function parse_height_pos(): number | 'w' {
        skip_spaces();
        if (i < s.length && (s[i] === 'ω' || s[i] === 'w')) {
            i++;
            return 'w';
        }
        return parse_number() - 1;
    }

    /**
     * 行高的单项 'v@p': v 为值(见 parse_height_value), p 为位置(见 parse_height_pos)。
     * 内部按 [值, 位置] 存放(注意本版本与 v1/v2 的 [位置, 值] 顺序相反)。
     */
    function parse_height_item(): HeightEntry {
        const v = parse_height_value();
        skip_spaces();
        if (i >= s.length || s[i] !== '@') error();
        i++;
        return [v, parse_height_pos()];
    }

    /**
     * 解析行高: 形如 '(项,项,…)', 每项为 'v@p'(见 parse_height_item), 空为 '()'。
     * 另容忍多一层外层括号(历史上 display 的 plain 曾输出 'v^((…))'), 使单/双括号都能解析。
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
        if (i < s.length && s[i] === '(') {
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

function height(col: Column): Height | undefined {
    if (col.length === 0) return undefined;
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
        let h = height(col1);
        return [...col1, ...(h === undefined ? col2 : filter_height_greater(col2, h))];
    }
    return merge_column(merge_column(cols[0], cols[1]), ...cols.slice(2));
}

function copy_value<T extends number | 'w'>(value: T, r: number, offset: number): T;

function copy_value(value: number | 'w', r: number, offset: number): number | 'w' {
    return value === 'w' ? 'w' : value >= r ? value + offset : value;
}

function copy_height_entry([v, p]: HeightEntry, r: number, offset: number): HeightEntry {
    return [copy_value(v, r, offset), copy_value(p, r, offset)];
}

function copy_height(h: Height, r: number, offset: number): Height {
    return h.map((he) => copy_height_entry(he, r, offset));
}

function copy_entry(entry: Entry, r: number, offset: number): Entry {
    return [copy_value(entry[0], r, offset), copy_height(entry[1], r, offset)];
}

function copy_column(col: Column, r: number, offset: number): Column {
    return col.map((entry) => copy_entry(entry, r, offset));
}

function height_fill_dec(h: Height, p: number | 'w', v: number): Height {
    const new_h = h.slice();
    while (new_h.length > 0 && new_h[new_h.length - 1][0] >= v) new_h.pop();
    new_h.push([v, p]);

    return new_h;
}

function find_maximal_entry_below(expr: Expr, i: number, h: Height, r: number): Entry | undefined {
    if (r !== i) {
        const e = find_maximal_entry_below(expr, r, h, r);
        if (e === undefined) return undefined;
        return find_maximal_entry_below(expr, i, e[1], e[0]);
    }

    const j = expr[i].findIndex(([, hj]) => compare_height(hj, h) > 0);
    if (j === -1) {
        if (expr[i].length === 0) return undefined;
        return expr[i][expr[i].length - 1];
    }
    const lower = j === 0 ? undefined : expr[i][j - 1][1];
    const new_value = expr[i][j][0];
    const upper = descend_height_to_value(expr, h, new_value);
    if (upper !== undefined && (lower === undefined || compare_height(upper, lower) > 0)) {
        return [expr[i][j][0], upper];
    }
    return expr[i][j - 1];
}

function descend_height_to_value(expr: Expr, h: Height, v: number): Height | undefined {
    const j = h.findIndex(([v1]) => v1 > v);

    if (j === -1) {
        return h;
    }

    if (j === 0) {
        const rh = h[0][0];
        const col_rh = expr[rh];
        const new_h = height(col_rh);
        if (new_h === undefined) return undefined;
        return descend_height_to_value(expr, new_h, v);
    }

    const [, p_bound] = h[j - 1];
    const new_p: HeightPos = find_lower_height_pos(expr, h, p_bound, v)!;
    return height_fill_dec(h, new_p, v);
}

function find_lower_height_pos(expr: Expr, h: Height, p: HeightPos, r: number): HeightPos | undefined {
    if (p === 'w') {
        return r;
    }

    const bound = find_maximal_entry_below(expr, p, h, r);
    if (bound === undefined) return undefined;

    const [r1, h1] = bound;
    const [v1, p1] = h1[h1.length - 1];
    if (p1 === 'w') return undefined;
    if (v1 === p1) return v1;
    return find_lower_height_pos(expr, h1, v1, r1);
}

function compute_new_height(h: Height, expr: Expr, r: number): Height | undefined {
    const [v, p] = h[h.length - 1];

    let new_p = find_lower_height_pos(expr, h, p, r);

    if (new_p !== undefined) {
        return height_fill_dec(h, new_p, r);
    } else {
        return find_maximal_entry_below(expr, v, h, r)?.[1];
    }
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

    for (let w = 1; w <= index; w++) {
        for (let i = r + 1; i <= right; i++) {
            result.push(copy_column(result[i], r, (right - r) * w));
        }
    }
    if (shorter) result.pop();
    return result;
}

function layered_top_separator(expr: Expr, h: Height, r: number): HeightPos {
    const [, p] = h[h.length - 1];
    if (p === 'w') return p;

    let layer = -1;
    let current: number | undefined = p;
    while (current !== undefined) {
        current = find_lower_height_pos(expr, h, current, r) as number | undefined;
        layer++;
    }
    return layer;
}

type Entry_DBMS = [number, HeightPos];
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
            const s = layered_top_separator(expr, current, v);
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
    const d_s = s === 'w' ? ';' : ','.repeat(s + 1);
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

type Vertical_DBMS = HeightPos[];

function compare_dbms_vertical(v1: Vertical_DBMS, v2: Vertical_DBMS): number {
    return lex_compare(v1, v2, compare_height_pos);
}

function dbms_vertical_increase(v: Vertical_DBMS, s: HeightPos): Vertical_DBMS {
    const result = deepcopy(v);
    while (result.length > 0 && compare_height_pos(result[result.length - 1], s) < 0) result.pop();
    result.push(s);
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
    if (is_infinity_dbms(matrix)) return '1,3,13';
    return dbms_to_y_mountain(matrix)
        .map((col) => col[0])
        .join(',');
}

function to_y_sequence(expr: Expr): number[] {
    return dbms_to_y_mountain(convert_to_dbms(expr)).map((col) => col[0]);
}

function dbms_vertical_display(v: Vertical_DBMS): string {
    return v.map((x) => (x === 'w' ? ';' : ','.repeat(x + 1))).join('/');
}

/** 由表达式与等价表示算出"形状 + 布局选项":画布版与 HTML 版共用这一份数据。 */
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
            separator_count: (higher, lower) => 1,
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

// 从极限展开, 查找 to_y_seq 等于 target 的表达式
function from_y_seq(target: number[]): Expr {
    if (target.length === 0) return [];
    if (target[0] !== 1) throw new Error('Illegal argument');
    if (target.length === 1) return [[]];
    if (!target.every((x) => Number.isInteger(x) && x > 0)) throw new Error('Illegal argument');

    let bound: Expr = [[]];
    let [mountain, dbms] = convert_to_dbms_data(bound);
    let V = dbms.map(dbms_column_verticals);
    let y_mountain = dbms_to_y_mountain(dbms);

    bound = INFINITY; // 初始时, bound 是 INFINITY. 缓存的各项数据都初始化为空.

    // 假设: to_y_seq(bound) 和 target 仅在 bound 的末位不同.
    while (true) {
        const right = bound.length - 1;

        // 首先尝试直接截断山脉. 注意 INFINITY 跳过这步.

        if (!is_infinity(bound)) {
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
        }

        // 进行展开. 展开其实是线性的, 代价远低于 to_dbms 和 y_mountain. 只需对后两者进行重用.

        let bound_fs_index = 0;
        let bound_fs = is_infinity(bound) ? infinity_FS(bound_fs_index) : expand(bound, bound_fs_index, false);
        let mountain_fs = mountain.slice(0, -1);
        let dbms_fs = dbms.slice(0, -1);
        let V_fs = V.slice(0, -1);
        let y_mountain_fs = y_mountain.slice(0, -1);

        // 不断生成并比较基本列

        let compared = is_infinity(bound) ? 0 : right;
        while (true) {
            if (compared === target.length) return bound_fs.slice(0, compared);
            if (compared === bound_fs.length) {
                bound_fs_index++;
                bound_fs = is_infinity(bound) ? infinity_FS(bound_fs_index) : expand(bound, bound_fs_index, false);
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
    if (lex_compare(seq, [1, 3, 13], number_compare) === 0) return INFINITY;
    return from_y_seq(seq);
}

function truncate(expr: Expr): Expr {
    const right = expr.length - 1;
    const top = expr[right].length - 1;
    const result = expand(expr, 0, false);
    if (result[right].length <= top) return result;
    result[right] = result[right].slice(0, result[right][top][0] === expr[right][top][0] ? top + 1 : top);
    return result;
}

export const S_omega_p1_DBMS: NotationDefinition<Expr> = {
    id: 's-omega+1-dbms',
    name: 'S ω+1 DBMS',
    category_id: 'category-sdbms-test',
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
