import { append_sibling, get_bound, prepend_child, TreeNode } from '@/core/tree.ts';
import { FsTrialExpansionError } from '@/core/errors.ts';
import { resolve_FS } from '@/core/fs_variants.ts';
import { NotationDefinition, resolve_display, run_debug_verification } from '@/notation-definition.ts';

/**
 * "试展开次数过多"守卫阈值(模块级, 由 main.ts watch settings.max_find_fs 同步)。
 * 语义: 单次展开中"连续"产出 ≤ bound 的项超过该值即视为基本列疑似有误(防非标准导入卡死)。
 */
let max_find_fs_value = 10;

export function set_max_find_fs(value: number): void {
    max_find_fs_value = value;
}

/** 展开过程中的共享上下文: notation 与 variant 同源, fs 由其预解析, 避免四处手传同源参数。 */
interface ExpandCtx<T> {
    notation: NotationDefinition<T>;
    variant: string;
    fs: (expr: T, index: number) => T;
}

function make_ctx<T>(notation: NotationDefinition<T>, variant: string): ExpandCtx<T> {
    return { notation, variant, fs: resolve_FS(notation, variant) };
}

function is_last_child<T>(node: TreeNode<T>): boolean {
    const p = node.parent;
    return p !== null && p.children[p.children.length - 1].index === node.index;
}

function generate_fs<T>(node: TreeNode<T>, ctx: ExpandCtx<T>, bound: T | undefined): T {
    const { notation, variant, fs } = ctx;
    let i: number;
    if (node.fs_state && node.fs_state.variant === variant) {
        i = node.fs_state.index + 1;
    } else {
        i = 0;
    }

    // 只统计"本次调用内连续 ≤ bound"的 reject 数(而非累计绝对 index), 避免合法多次展开误触发。
    let consecutive_reject = 0;
    while (true) {
        if (node.children.length === 0 && consecutive_reject > max_find_fs_value) {
            throw new FsTrialExpansionError('当前节点试展开次数过多, 可能基本列实现有误');
        }
        const res = fs(node.expr, i);
        if (bound === undefined || notation.compare(res, bound) > 0) {
            node.fs_state = { variant, index: i };
            return res;
        }
        i++;
        consecutive_reject++;
    }
}

/**
 * 只"展开一次": 计算 node 越过其列表下一项(bound)的下一个 FS 项并插入。
 *
 * 插入方向(as_sibling, 语义详见 docs/树展开算法.md):
 * - as_sibling=true   → 作为 node 的兄弟插入(追加到父节点子列表尾部; 即"兄弟展开");
 * - as_sibling=false  → 作为 node 的首个子节点插入。
 *
 * 无法展开时返回 undefined(此时上层链停住): 非 limit 后继只能展开出 x 一次、
 * 0 不能展开、或结果不在 bound 之上(病态 gap 视同无法展开; 守卫仅防页面卡死)。
 */
function expand_single<T>(node: TreeNode<T>, ctx: ExpandCtx<T>, as_sibling: boolean): TreeNode<T> | undefined {
    const { notation, fs } = ctx;
    const bound = get_bound(node);

    let result_expr: T;
    if (notation.is_limit(node.expr)) {
        result_expr = generate_fs(node, ctx, bound);
    } else {
        result_expr = fs(node.expr, 0);
        if (notation.compare(result_expr, node.expr) >= 0) return;
        if (bound !== undefined && notation.compare(result_expr, bound) <= 0) return;
    }

    // debug_verification(仅该记号定义时生效): 校验失败仅打印警告, 节点照常创建。
    // 单个函数与 record 形态都支持; record 形态会额外打印所有未通过的字段名。
    if (notation.debug_verification) {
        const { passed, failed } = run_debug_verification(notation.debug_verification, result_expr);
        if (!passed) {
            console.warn(
                '[debug_verification] 展开生成的节点未通过校验(仍已创建)' +
                    (failed.length > 0 ? ' [未通过: ' + failed.join(', ') + ']' : '') +
                    ': ' +
                    resolve_display(notation.display).plain(result_expr),
            );
        }
    }

    const new_node = as_sibling ? append_sibling(node, result_expr) : prepend_child(node, result_expr);
    dispatch_pending(node, new_node, result_expr, notation);
    return new_node;
}

/**
 * 把 node 的挂载条目 (pending_items) 按新节点值 v 分派：
 * - x < v  → 移给 new_node（其区间下段）
 * - x == v → 写入 new_node 的 analysis（重复值沿用覆盖语义）
 * - x > v  → 留在 node（区间上段）
 * pending_items 按 expr 递增有序。
 */
function dispatch_pending<T>(node: TreeNode<T>, new_node: TreeNode<T>, v: T, notation: NotationDefinition<T>): void {
    const pend = node.pending_items;
    if (!pend || pend.length === 0) return;

    // pending 递增有序: 二分查找第一个 expr >= v 的位置
    let lo = 0;
    let hi = pend.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (notation.compare(pend[mid].expr, v) < 0) lo = mid + 1;
        else hi = mid;
    }
    const start = lo;

    if (start > 0) {
        const np = (new_node.pending_items ??= []);
        np.push(...pend.slice(0, start));
    }

    // start 起连续 == v 的段, 取末者 (重复时后写覆盖)
    let end = start;
    while (end < pend.length && notation.compare(pend[end].expr, v) === 0) end++;
    if (end > start) {
        const attach = pend[end - 1];
        const nd_ed = (new_node.extraData ??= {});
        Object.assign(nd_ed, attach.extraData);
    }

    if (end < pend.length) {
        node.pending_items = pend.slice(end);
    } else {
        delete node.pending_items;
    }
}

/**
 * 多层展开的实现(行为自原 NE 保留; 语义说明见 docs/树展开算法.md)。
 *
 * 结构要点:
 * - 带同一 tier 的递归调用构成"兄弟展开链"(tier 不递减): 每步对刚生成的节点
 *   继续 expand_single, 直到其返回 undefined(链终止);
 * - 链内"插入方向"按 next_as_sibling 延续: 一旦进入兄弟展开则保持;
 *   或当某步以子节点插入后 node 恰好只有一个子(children.length===1)时, 链后续项转兄弟展开;
 * - tier > 1 时在链结构上追加 tier-1 的更深层展开(实现细节见文档)。
 */
function expand_tier_impl<T>(
    node: TreeNode<T>,
    ctx: ExpandCtx<T>,
    tier: number,
    as_sibling: boolean,
): TreeNode<T> | undefined {
    const new_node = expand_single(node, ctx, as_sibling);
    if (!new_node) return;

    if (tier > 0) {
        const next_as_sibling = as_sibling || node.children.length === 1;
        expand_tier_impl(new_node, ctx, tier, next_as_sibling);
        if (tier > 1) {
            if (new_node.children.length > 0) {
                expand_tier_impl(new_node.children[new_node.children.length - 1], ctx, tier - 1, true);
            } else {
                expand_tier_impl(new_node, ctx, tier - 1, false);
            }
        }
    }
    return new_node;
}

/**
 * 展开当前节点(tier 语义与 i18n 对应: 0=单次展开, 1=单层/兄弟链到不能, ≥2 多层)。
 *
 * @returns 首个创建的节点（可用于聚焦），undefined 表示未展开。
 */
export function expand_item<T>(
    node: TreeNode<T>,
    notation: NotationDefinition<T>,
    variant: string,
    tier = 0,
): TreeNode<T> | undefined {
    const ctx = make_ctx(notation, variant);
    const parent = node.parent;
    // 兄弟展开的入口条件: node 是其父的末子, 且父本身不是根(存在可插入的兄弟位置)。
    const as_sibling = parent?.parent !== null && is_last_child(node);
    return expand_tier_impl(node, ctx, tier, as_sibling);
}

/** 标准性检查: 上限扫描深度同样使用模块级试展开阈值(max_find_fs_value)。 */
export function check_is_standard<T>(expr: T, notation: NotationDefinition<T>, variant: string): boolean {
    let upper: T | undefined = undefined;
    let upper_fs_index = 0;

    const initial = notation.init();
    for (let e_init of initial) {
        const cmp = notation.compare(e_init, expr);
        if (cmp === 0) return true;
        if (cmp > 0) {
            upper = e_init;
        } else {
            break;
        }
    }
    if (upper === undefined) return false;

    while (true) {
        if (upper_fs_index > max_find_fs_value) return false;
        if (upper_fs_index > 0 && !notation.is_limit(upper)) return false;

        const current = resolve_FS(notation, variant)(upper, upper_fs_index);
        const cmp = notation.compare(current, expr);
        upper_fs_index++;

        if (cmp === 0) {
            return true;
        } else if (cmp > 0) {
            upper = current;
            upper_fs_index = 0;
        }
    }
}
