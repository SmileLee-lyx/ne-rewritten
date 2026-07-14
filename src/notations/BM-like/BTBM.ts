import {
    bind2,
    boolean_compare,
    Comparator,
    lex_compare,
    lex_compare_by,
    number_compare,
    object_lex_compare_by,
} from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';

type Expr = Column[];
type Column = Entry[];
type Entry = { value: number; height: Expr };

type ExprData<T extends object> = ColumnData<T>[];
type ColumnData<T extends object> = EntryData<T>[];
type EntryData<T extends object> = T & { height: ExprData<T> };

type Height = ExprData<{ value: number; mark: boolean }>;
type Vertical = Height[];

const INFINITY: Expr = Symbol('infinity') as any;
const INFINITY_height: Height = INFINITY as any;

function is_infinity(e: Expr | Height): boolean {
    return e === INFINITY;
}

function infinity_FS(index: number): Expr {
    if (index === 0) return [[]];
    let col: Column = [{ value: index - 1, height: [] }];
    for (let i = index - 1; i > 0; i--) {
        col = [{ value: i - 1, height: [col] }];
    }
    return [[], col];
}

function to_height(e: Expr, r: number): Height {
    const result: Height = [];

    for (let i = 0; i < e.length; i++) {
        const col = e[i];

        const result_col: Height[number] = [];

        for (const entry of col) {
            const p = entry.value;
            let mark: boolean, value: number;
            if (p < r) {
                [mark, value] = [false, p];
            } else {
                [mark, value] = [true, p - r];
            }
            result_col.push({
                mark,
                value,
                height: to_height(entry.height, r),
            });
        }

        result.push(result_col);
    }

    return result;
}

function from_height(h: Height, r: number): Expr {
    const result: Expr = [];

    for (let i = 0; i < h.length; i++) {
        const col = h[i];

        const result_col: Column = [];

        for (const entry of col) {
            const { mark, value } = entry;
            result_col.push({
                value: value + (mark ? r : 0),
                height: from_height(entry.height, r),
            });
        }

        result.push(result_col);
    }

    return result;
}

function height_compare(a: Height, b: Height): number {
    if (is_infinity(a) || is_infinity(b)) return boolean_compare(is_infinity(a), is_infinity(b));
    return lex_compare(a, b, lex_compare_by(height_entry_comparator));
}

const height_entry_comparator = object_lex_compare_by(
    { mark: boolean_compare, value: number_compare, height: height_compare },
    ['mark', 'value', 'height'],
);

function has_next_layer<T extends object>(expr: ExprData<T>): boolean {
    const right = expr.length - 1;
    if (right === -1) return false;
    const top = expr[right].length - 1;
    return top !== -1;
}

function next_layer<T extends object>(expr: ExprData<T>): ExprData<T> {
    const right = expr.length - 1;
    const top = expr[right].length - 1;
    return expr[right][top].height;
}

function skip_layers<T extends object>(expr: ExprData<T>, l: number): ExprData<T> {
    for (let i = 0; i < l; i++) expr = next_layer(expr);
    return expr;
}

function tail_layer(expr: Expr): number {
    if (!has_next_layer(expr)) return -1;
    return 1 + tail_layer(next_layer(expr));
}

function tail(expr: Expr, t_layer: number): number {
    let current_left = 0;
    let current = expr;
    for (let i = 0; i < t_layer; i++) {
        current_left += current.length;
        current = next_layer(current);
    }
    return current_left + current.length - 1;
}

function root(expr: Expr, t_layer: number): number {
    const current = skip_layers(expr, t_layer);
    return current[current.length - 1][current[current.length - 1].length - 1].value;
}

function root_layer(expr: Expr, r: number): [l: number, ri: number] {
    let current = expr;
    let current_left = 0;
    let current_layer = 0;
    while (true) {
        if (r < current_left + current.length) {
            return [current_layer, r - current_left];
        }
        current_left += current.length;
        current = next_layer(current);
        current_layer++;
    }
}

function ascend_replace(expr: Expr, r: number, diff: number, t_layer: number | undefined, new_tail: Expr): Expr {
    let result: Expr = [];

    for (let i = 0; i < expr.length; i++) {
        if (t_layer === 0 && i === expr.length - 1) {
            result.push(...new_tail);
        } else {
            const col = expr[i];
            let result_col: Column = [];
            for (let j = 0; j < col.length; j++) {
                const entry = col[j];
                const new_t_layer =
                    t_layer !== undefined && i === expr.length - 1 && j === col.length - 1 ? t_layer - 1 : undefined;
                result_col.push({
                    value: entry.value >= r ? entry.value + diff : entry.value,
                    height: ascend_replace(entry.height, r, diff, new_t_layer, new_tail),
                });
            }
            result.push(result_col);
        }
    }

    return result;
}

function is_special(expr: Expr, t_layer: number): boolean {
    if (t_layer === 0) return false;
    let current = expr;
    let current_left = 0;
    for (let i = 0; i < t_layer; i++) {
        current_left += current.length;
        current = next_layer(current);
    }
    if (current[current.length - 1].length !== 1) return false;
    const entry = current[current.length - 1][0];
    return entry.height.length === 0 && entry.value === current_left - 1;
}

function expand_special(expr: Expr, t_layer: number, index: number): Expr {
    let result = expr.slice(0, -1);
    let col = expr[expr.length - 1];
    let result_col = col.slice(0, -1);
    let entry = col[col.length - 1];
    if (t_layer > 1) {
        let new_entry = {
            value: entry.value,
            height: expand_special(entry.height, t_layer - 1, index),
        };
        result_col.push(new_entry);
    } else {
        let new_entry = {
            value: entry.value,
            height: entry.height.slice(0, -1),
        };
        result_col.push(...Array<Entry>(index).fill(new_entry));
    }
    result.push(result_col);
    return result;
}

function root_appending_start(col_root: Column, r: number, col_tail: Column, t: number): number {
    let heights_root = col_root.map(({ height }) => to_height(height, r));
    let heights_tail = col_tail.slice(0, -1).map(({ height }) => to_height(height, t));
    let ir = 0,
        it = 0;
    while (ir !== heights_root.length && it !== heights_tail.length) {
        const cmp = height_compare(heights_root[ir], heights_tail[it]);
        if (cmp >= 0) it++;
        if (cmp <= 0) ir++;
    }
    return ir;
}

function is_limit(expr: Expr): boolean {
    return is_infinity(expr) || (expr.length > 0 && expr[expr.length - 1].length > 0);
}

function FS(expr: Expr, index: number): Expr {
    if (is_infinity(expr)) return infinity_FS(index);
    if (expr.length === 0) return expr;
    const t_layer = tail_layer(expr);
    if (t_layer < 0) return expr.slice(0, -1);

    if (is_special(expr, t_layer)) {
        return expand_special(expr, t_layer, index);
    }

    const t = tail(expr, t_layer);
    const r = root(expr, t_layer);
    const [r_layer, ri] = root_layer(expr, r);

    const expr_root = skip_layers(expr, r_layer);
    const col_root = expr_root[ri];
    const expr_tail = skip_layers(expr_root, t_layer - r_layer);
    const col_tail = expr_tail[expr_tail.length - 1];

    const appending = root_appending_start(col_root, r, col_tail, t);

    let new_tail: Expr = [];

    for (let j = index; j >= 1; j--) {
        if (ri !== expr_root.length - 1) {
            let new_tail_1 = ascend_replace(expr_root.slice(ri + 1), r, j * (t - r), t_layer - r_layer, new_tail);
            let new_col = ascend_replace([col_tail.slice(0, -1)], r, (j - 1) * (t - r), undefined, [])[0];
            for (let k = appending; k < col_root.length; k++) {
                new_col.push({
                    value: col_root[k].value,
                    height: ascend_replace(col_root[k].height, r, j * (t - r), undefined, []),
                });
            }
            new_tail = [new_col, ...new_tail_1];
        } else {
            if (appending === col_root.length) throw new Error('Illegal state');
            let new_col = ascend_replace([col_tail.slice(0, -1)], r, (j - 1) * (t - r), undefined, [])[0];
            for (let k = appending; k < col_root.length; k++) {
                new_col.push({
                    value: col_root[k].value,
                    height: ascend_replace(
                        col_root[k].height,
                        r,
                        j * (t - r),
                        k === col_root.length - 1 ? t_layer - r_layer - 1 : undefined,
                        new_tail,
                    ),
                });
            }
            new_tail = [new_col];
        }
    }

    return ascend_replace(expr, 0, 0, t_layer, new_tail);
}

function display(expr: Expr, html: boolean): string {
    if (is_infinity(expr)) return 'Limit';

    return expr.map(bind2(display_column, html)).join('');
}

function display_column(col: Column, html: boolean) {
    if (col.length === 0) return '(0)';
    return '(' + col.map(bind2(display_entry, html)).join(',') + ')';
}

type DMT = 'plain' | 'html' | 'latex';

function display_marked(expr: Expr, type: DMT, start_index: number = 1): string {
    if (is_infinity(expr)) return 'Limit';
    let idx = start_index;
    const parts: string[] = [];
    for (const col of expr) {
        parts.push(display_column_marked(col, type, idx));
        idx++;
    }
    return parts.join('');
}

function display_column_marked(col: Column, type: DMT, index: number): string {
    if (col.length === 0) {
        if (type === 'plain') return '(:' + index + ')';
        if (type === 'html') return "(0)<sub><span style='color:#888'>" + index + '</span></sub>';
        return '(0)_{\\color{gray}' + index + '}';
    }
    const content = col.map((e) => display_entry_marked(e, type, index)).join(',');
    if (type === 'plain') return '(' + content + ':' + index + ')';
    if (type === 'html') return '(' + content + ")<sub><span style='color:#888'>" + index + '</span></sub>';
    return '(' + content + ')_{\\color{gray}' + index + '}';
}

function display_entry_marked(entry: Entry, type: DMT, col_index: number): string {
    const v_display = '' + (entry.value + 1);
    if (entry.height.length === 0) return v_display;
    const h_display = display_marked(entry.height, type, col_index + 1);
    if (type === 'html') return v_display + '<sup>' + h_display + '</sup>';
    if (type === 'latex') return v_display + '^{' + h_display + '}';
    return v_display + '^' + h_display;
}

function display_entry(entry: Entry, html: boolean): string {
    const v_display = '' + (entry.value + 1);
    if (entry.height.length === 0) return v_display;
    const h_display = display(entry.height, html);
    return html ? v_display + '<sup>' + h_display + '</sup>' : v_display + '^' + h_display;
}

function from_display(s: string): Expr {
    let i = 0;

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

    function parse_expr(): Expr {
        const result: Expr = [];
        skip_spaces();
        while (i < s.length && s[i] === '(') {
            result.push(parse_column());
            skip_spaces();
        }
        return result;
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
        // 删去列尾的 0 项（显示值 0 = 内部值 -1）
        while (entries.length > 0 && entries[entries.length - 1].value === -1) entries.pop();
        return entries;
    }

    function parse_entry(): Entry {
        const v = parse_number() - 1; // display 为 1-based，内部为 0-based
        skip_spaces();
        if (i < s.length && s[i] === '^') {
            i++;
            return { value: v, height: parse_expr() };
        }
        return { value: v, height: [] };
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

function compare(a: Expr, b: Expr): number {
    return lex_compare(a, b, lex_compare_by(entry_comparator));
}

const entry_comparator: Comparator<Entry> = object_lex_compare_by(
    {
        value: number_compare,
        height: compare,
    },
    ['value', 'height'],
);

type LayerColumn = { value: number; parent: number; height: Height }[];

function vertical_increase(vert: Vertical, h_diff: Height): Vertical {
    const result = [...vert];
    while (result.length > 0 && height_compare(result[result.length - 1], h_diff) < 0) {
        result.pop();
    }
    result.push(h_diff);
    return result;
}

function convert_to_layer(e: Expr, parsed_stack: LayerColumn[] = []): Expr {
    if (is_infinity(e)) return e;

    const lS = parsed_stack.length;
    const result: Expr = [];

    for (let i = 0; i < e.length; i++) {
        const iS = parsed_stack.length;

        const col = e[i];
        const parsed_col: LayerColumn = [];

        let current_vertical: Vertical = [];

        for (let j = 0; j < col.length; j++) {
            const entry = col[j];
            const parent = entry.value;
            const height = to_height(entry.height, iS);

            let kp = 0,
                ki = 0;
            while (kp !== parsed_stack[parent].length && ki !== current_vertical.length) {
                const cmp = height_compare(parsed_stack[parent][kp].height, current_vertical[ki]);
                if (cmp <= 0) kp++;
                if (cmp >= 0) ki++;
            }
            if (kp === parsed_stack[parent].length) {
                parsed_col.push({ value: 0, parent, height });
            } else {
                while (kp <= parsed_stack[parent].length) {
                    if (kp === parsed_stack[parent].length) {
                        parsed_col.push({ value: 0, parent, height });
                        break;
                    }
                    const cmp = height_compare(parsed_stack[parent][kp].height, height);
                    if (cmp < 0) {
                        parsed_col.push({
                            value: parsed_stack[parent][kp].value + 1,
                            parent,
                            height: parsed_stack[parent][kp].height,
                        });
                    } else {
                        parsed_col.push({ value: parsed_stack[parent][kp].value + 1, parent, height });
                        break;
                    }
                    kp++;
                }
            }
            current_vertical = vertical_increase(current_vertical, height);
        }
        parsed_stack.push(parsed_col);

        const result_col: Column = [];
        for (let parsed_entry of parsed_col) {
            const height_expr = from_height(parsed_entry.height, iS);
            result_col.push({
                value: parsed_entry.value,
                height: convert_to_layer(height_expr, parsed_stack),
            });
        }

        result.push(result_col);
    }

    parsed_stack.splice(lS);
    return result;
}

// computes parent of lower, and value of upper
function parent_info(
    parsed: LayerColumn,
    vertical: Vertical,
): {
    lower_parent: number | undefined;
    higher_value: number;
} {
    let ip = 0,
        iv = 0;
    let lower_parent: number | undefined = undefined;
    while (ip !== parsed.length && iv !== vertical.length) {
        const cmp = height_compare(parsed[ip].height, vertical[iv]);
        if (cmp >= 0) {
            lower_parent = parsed[ip].parent;
            iv++;
        }
        if (cmp <= 0) ip++;
    }
    return { lower_parent, higher_value: parsed[ip]?.value ?? -1 };
}

function convert_from_layer(e: Expr, parsed_stack: LayerColumn[] = []): Expr {
    if (is_infinity(e)) return e;

    const lS = parsed_stack.length;
    const result: Expr = [];

    for (let i = 0; i < e.length; i++) {
        const iS = parsed_stack.length;

        const col = e[i];
        const parsed_col: LayerColumn = [];
        parsed_stack.push(parsed_col);

        const result_col: Column = [];
        let current_vertical: Vertical = [];

        for (let j = 0; j < col.length; j++) {
            const entry = col[j];

            let parent = j === 0 ? iS - 1 : parsed_col[j - 1].parent;
            while (parent >= 0) {
                let { lower_parent, higher_value } = parent_info(parsed_stack[parent], current_vertical);
                if (higher_value < entry.value) break;
                parent = lower_parent ?? parent - 1;
            }

            parsed_col.push({
                value: entry.value,
                parent,
                height: INFINITY_height,
            });

            const height_expr = convert_from_layer(entry.height, parsed_stack);
            const height = to_height(height_expr, iS);
            parsed_col[j].height = height;

            while (result_col.length > 0) {
                const top = result_col[result_col.length - 1];
                if (top.value === parent && compare(top.height, height_expr) < 0) {
                    result_col.pop();
                } else {
                    break;
                }
            }

            result_col.push({ value: parent, height: height_expr });
            current_vertical = vertical_increase(current_vertical, height);
        }

        result.push(result_col);
    }

    parsed_stack.splice(lS);
    return result;
}

export const BTBM: NotationDefinition<Expr> = {
    id: 'btbm',
    name: 'Branching Transfinite BMS',
    simple_name: 'BTBMS',
    category_id: 'category-bm-like',
    display: {
        plain: bind2(display, false),
        html: bind2(display, true),
        from_display,
        name_id: 'display.index',
    },
    display_equiv: {
        layer: {
            plain: (e) => display(convert_to_layer(e), false),
            html: (e) => display(convert_to_layer(e), true),
            from_display: (str) => convert_from_layer(from_display(str)),
            name_id: 'display.layer',
        },
        marked: {
            plain: (e) => display_marked(e, 'plain'),
            html: (e) => display_marked(e, 'html'),
            latex: (e) => display_marked(e, 'latex'),
            from_display,
            name_id: 'display.index-marked',
        },
    },
    is_limit,
    compare,
    FS,
    init: () => [INFINITY, []],
};
