import { bind2 } from '@/utils.ts';
import { NotationDefinition } from '@/notation-definition.ts';
import {
    Column,
    compare,
    convert_from_layer,
    convert_to_layer,
    display,
    display_marked,
    expand_special,
    Expr,
    from_display,
    from_height,
    INFINITY,
    infinity_FS,
    is_infinity,
    is_limit,
    is_special,
    root,
    root_appending_start,
    root_layer,
    skip_layers,
    tail,
    tail_layer,
    to_height,
    Vertical,
    vertical_compare,
    vertical_diff,
    vertical_increase,
} from '@/notations/BM-like/BTBM.ts';

function ascend_replace(
    expr: Expr,
    start_index: number,
    r: number,
    diff: number,
    t_layer: number | undefined,
    new_tail: Expr,
    critical_vert: Vertical,
): Expr {
    let result: Expr = [];

    for (let i = 0; i < expr.length; i++) {
        if (t_layer === 0 && i === expr.length - 1) {
            result.push(...new_tail);
        } else {
            const col = expr[i];
            const col_index = start_index + i;

            let current_vert: Vertical = [];
            let above_crit = false;
            let ignore_check = false;

            let result_col: Column = [];

            for (let j = 0; j < col.length; j++) {
                const entry = col[j];
                if (!above_crit) {
                    const height = to_height(entry.height, col_index);
                    const new_vert = vertical_increase(current_vert, height);

                    const cmp = vertical_compare(new_vert, critical_vert);
                    if (cmp > 0) {
                        const crit_remaining = vertical_diff(critical_vert, current_vert);
                        for (let h of crit_remaining) {
                            result_col.push({
                                value: entry.value >= r ? entry.value + diff : entry.value,
                                height: from_height(h, start_index + diff),
                            });
                        }
                        above_crit = true;
                    } else {
                        result_col.push({
                            value: entry.value >= r ? entry.value + diff : entry.value,
                            height: from_height(height, start_index + diff),
                        });
                        if (cmp === 0) above_crit = true;
                        if (!(t_layer !== undefined && i === expr.length - 1 && j === col.length - 1)) {
                            continue;
                        }
                    }
                }

                const new_t_layer =
                    t_layer !== undefined && i === expr.length - 1 && j === col.length - 1 ? t_layer - 1 : undefined;

                let new_entry = {
                    value: entry.value >= r ? entry.value + diff : entry.value,
                    height: ascend_replace(entry.height, col_index + 1, r, diff, new_t_layer, new_tail, critical_vert),
                };
                if (!ignore_check) {
                    while (
                        result_col.length > 0 &&
                        result_col[result_col.length - 1].value === new_entry.value &&
                        compare(result_col[result_col.length - 1].height, new_entry.height) < 0
                    ) {
                        result_col.pop();
                    }

                    ignore_check = true;
                }
                result_col.push(new_entry);
            }
            result.push(result_col);
        }
    }

    return result;
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

    const critical_heights = col_tail.slice(0, -1).map(({ height }) => to_height(height, t));
    let critical_vert: Vertical = [];
    for (let h of critical_heights) critical_vert = vertical_increase(critical_vert, h);

    let new_tail: Expr = [];

    for (let j = index; j >= 1; j--) {
        if (ri !== expr_root.length - 1) {
            let new_tail_1 = ascend_replace(
                expr_root.slice(ri + 1),
                r + 1,
                r,
                j * (t - r),
                t_layer - r_layer,
                new_tail,
                critical_vert,
            );
            let new_col = col_tail.slice(0, -1).map(({ value }, k) => ({
                value: value + (j - 1) * (t - r),
                height: from_height(critical_heights[k], r + j * (t - r)),
            }));
            for (let k = appending; k < col_root.length; k++) {
                new_col.push({
                    value: col_root[k].value,
                    height: ascend_replace(col_root[k].height, r + 1, r, j * (t - r), undefined, [], critical_vert),
                });
            }
            new_tail = [new_col, ...new_tail_1];
        } else {
            if (appending === col_root.length) throw new Error('Illegal state');
            let new_col = col_tail.slice(0, -1).map(({ value }, k) => ({
                value: value + (j - 1) * (t - r),
                height: from_height(critical_heights[k], r + j * (t - r)),
            }));
            for (let k = appending; k < col_root.length; k++) {
                new_col.push({
                    value: col_root[k].value,
                    height: ascend_replace(
                        col_root[k].height,
                        r + 1,
                        r,
                        j * (t - r),
                        k === col_root.length - 1 ? t_layer - r_layer - 1 : undefined,
                        new_tail,
                        critical_vert,
                    ),
                });
            }
            new_tail = [new_col];
        }
    }

    return ascend_replace(expr, 0, 0, 0, t_layer, new_tail, []);
}

export const BTBM_weak: NotationDefinition<Expr> = {
    id: 'btbm-weak',
    name: "weak Bubby3's Transfinite BMS (v2)",
    simple_name: 'weak BTBMS',
    category_id: 'category-bm-like',
    description: [
        { id: 'description.btbm-weak.1' },
        { id: 'description.btbm-weak.2' },
        { id: 'description.btbm-weak.3' },
        { id: 'description.btbm-weak.4' },
        { id: 'description.btbm-weak.5' },
        { id: 'description.btbm-weak.6' },
    ],
    display: {
        plain: bind2(display, 'plain'),
        html: bind2(display, 'html'),
        latex: bind2(display, 'latex'),
        from_display,
        name: { id: 'display.index' },
    },
    display_equiv: {
        layer: {
            plain: (e) => display(convert_to_layer(e), 'plain'),
            html: (e) => display(convert_to_layer(e), 'html'),
            latex: (e) => display(convert_to_layer(e), 'latex'),
            from_display: (str) => convert_from_layer(from_display(str)),
            name: { id: 'display.layer' },
        },
        marked: {
            plain: (e) => display_marked(e, 'plain'),
            html: (e) => display_marked(e, 'html'),
            latex: (e) => display_marked(e, 'latex'),
            from_display,
            name: { id: 'display.index-marked' },
        },
    },
    is_limit,
    compare,
    FS,
    init: () => [INFINITY, []],

    credit_text_id: 'credit.btbm',
};
