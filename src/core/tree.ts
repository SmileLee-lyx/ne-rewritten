import { NotationDefinition } from '@/notation-definition.ts';

export interface FsState {
    variant: string;
    index: number;
}

export interface TreeNode<T> {
    expr: T;
    children: TreeNode<T>[];
    parent: TreeNode<T> | null;
    /** 不可变序号，创建时分配，用于 Vue key。首子最小，末子最大。 */
    index: number;
    fs_state?: FsState;
    path?: string;
    /** 附加数据（analysis 等），不被核心逻辑引用。 */
    extraData?: Record<string, unknown>;
}

function array_pos<T>(node: TreeNode<T>): number {
    return node.index - node.parent!.children[0].index;
}

/** 创建树节点，自动计算 path。 */
export function create_node<T>(expr: T, parent: TreeNode<T>, index: number): TreeNode<T> {
    return {
        expr,
        children: [],
        parent,
        index,
        path: parent.path ? parent.path + ',' + index : '' + index,
    };
}

export function init_dataset<T>(notation: NotationDefinition<T>): TreeNode<T> {
    const root: TreeNode<T> = {
        expr: null as unknown as T,
        children: [],
        parent: null,
        index: -1,
    };

    const exprs = notation.init();
    for (let i = 0; i < exprs.length; i++) {
        root.children.push(create_node(exprs[i], root, i));
    }
    return root;
}

/** 将 expr 插入为 node 的首个子节点。index 向左递减（可负）。 */
export function prepend_child<T>(node: TreeNode<T>, expr: T): TreeNode<T> {
    const index = (node.children[0]?.index ?? 1) - 1;
    const child = create_node(expr, node, index);
    node.children.unshift(child);
    return child;
}

/** 将 expr 追加为 node 的末位兄弟。index 向右递增。 */
export function append_sibling<T>(node: TreeNode<T>, expr: T): TreeNode<T> {
    const parent = node.parent!;
    const last_index = parent.children[parent.children.length - 1]?.index ?? -1;
    const child = create_node(expr, parent, last_index + 1);
    parent.children.push(child);
    return child;
}

/**
 * 先根遍历的下一个节点（skip = 0 时的语义）。
 * skip 为 1/2 组合：
 *   bit 0 (1) — 跳过子节点（直接到兄弟）
 *   bit 1 (2) — 跳过同深度（上移一层找下一兄）
 */
export function find_next<T>(node: TreeNode<T>, skip = 0): TreeNode<T> | undefined {
    if (!(skip & 1) && node.children.length > 0) {
        return node.children[0];
    }
    return next_sibling(node, skip);
}

export function find_prev<T>(node: TreeNode<T>, skip = 0): TreeNode<T> | undefined {
    const parent = node.parent;
    if (!parent) return undefined;

    if (skip & 2) return parent;

    const pos = array_pos(node);

    if (pos <= 0) return parent.parent ? parent : undefined;

    const prev = parent.children[pos - 1];
    return skip & 1 ? prev : last_descendant(prev);
}

export function next_sibling<T>(node: TreeNode<T>, skip = 0): TreeNode<T> | undefined {
    const parent = node.parent;
    if (!parent) return undefined;

    if (skip & 2) return next_sibling(parent, 0);

    const pos = array_pos(node);

    if (pos < parent.children.length - 1) {
        return parent.children[pos + 1];
    }
    return next_sibling(parent, 0);
}

export function last_descendant<T>(node: TreeNode<T>): TreeNode<T> {
    let cur = node;
    while (cur.children.length > 0) cur = cur.children[cur.children.length - 1];
    return cur;
}

export function get_bound<T>(node: TreeNode<T>): T | undefined {
    return find_next(node, 0)?.expr;
}
