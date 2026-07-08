import type { TreeNode } from '@/core/tree.ts';
import { append_sibling, get_bound, prepend_child } from '@/core/tree.ts';
import { NotationDefinition } from '@/notation-definition.ts';

function resolve_fs<T>(notation: NotationDefinition<T>, variant: string): (expr: T, index: number) => T {
    switch (variant) {
        case 'FS':
            return notation.FS;
        case 'FS_alter':
            return notation.FS_alter ?? notation.FS;
        case 'FS_short':
            return notation.FS_short ?? notation.FS_alter ?? notation.FS;
        default:
            return notation.FS;
    }
}

function is_last_child<T>(node: TreeNode<T>): boolean {
    const p = node.parent;
    return p !== null && p.children[p.children.length - 1] === node;
}

function generate_fs<T>(
    node: TreeNode<T>,
    fs: (expr: T, i: number) => T,
    bound: T | undefined,
    compare: (a: T, b: T) => number,
    variant: string,
): T {
    let i: number;
    if (node.fs_state && node.fs_state.variant === variant) {
        i = node.fs_state.index + 1;
    } else {
        i = 0;
    }

    while (true) {
        const res = fs(node.expr, i);
        if (bound === undefined || compare(res, bound) > 0) {
            node.fs_state = { variant, index: i };
            return res;
        }
        i++;
    }
}

function expand_tier_impl<T>(
    node: TreeNode<T>,
    notation: NotationDefinition<T>,
    fs: (expr: T, i: number) => T,
    variant: string,
    tier: number,
    to_parent: boolean,
): TreeNode<T> | undefined {
    const bound = get_bound(node);

    let result_expr: T;
    if (notation.is_limit(node.expr)) {
        result_expr = generate_fs(node, fs, bound, notation.compare, variant);
    } else {
        result_expr = fs(node.expr, 0);
        if (notation.compare(result_expr, node.expr) >= 0) return;
        if (bound !== undefined && notation.compare(result_expr, bound) <= 0) return;
    }

    let new_node: TreeNode<T>;
    if (to_parent) {
        new_node = append_sibling(node, result_expr);
    } else {
        new_node = prepend_child(node, result_expr);
    }

    if (tier > 0) {
        const new_to_parent = to_parent || node.children.length === 1;
        expand_tier_impl(new_node, notation, fs, variant, tier, new_to_parent);
        if (tier > 1) {
            if (new_node.children.length > 0) {
                expand_tier_impl(
                    new_node.children[new_node.children.length - 1],
                    notation,
                    fs,
                    variant,
                    tier - 1,
                    true,
                );
            } else {
                expand_tier_impl(new_node, notation, fs, variant, tier - 1, false);
            }
        }
    }
    return new_node;
}

/**
 * 展开当前节点。
 *
 * @returns 首个创建的节点（可用于聚焦），undefined 表示未展开。
 */
export function expand_item<T>(
    node: TreeNode<T>,
    notation: NotationDefinition<T>,
    variant: string,
    tier = 0,
): TreeNode<T> | undefined {
    const fs = resolve_fs(notation, variant);
    const parent = node.parent;
    const to_parent = parent?.parent !== null && is_last_child(node);
    return expand_tier_impl(node, notation, fs, variant, tier, to_parent);
}
