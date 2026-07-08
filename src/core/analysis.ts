import type { TreeNode } from '@/core/tree.ts';
import { find_prev, last_descendant } from '@/core/tree.ts';
import type { TreeNodeExtra } from '@/core/extra.ts';
import { expand_item } from '@/core/expander.ts';
import { NotationDefinition, resolve_display } from '@/notation-definition.ts';

/** 单个导出条目。expr 保留原始类型，不做字符串化。 */
export interface AnalysisEntry<T> {
    expr: T;
    analysis: string[];
}

/**
 * 先根遍历树（递增序），收集所有有 analysis 内容的节点。
 */
export function export_analysis<T>(root: TreeNode<T>): AnalysisEntry<T>[] {
    const result: AnalysisEntry<T>[] = [];

    function walk(nodes: TreeNode<T>[]) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            walk(node.children);
            const ed = node.extraData as TreeNodeExtra | undefined;
            if (ed?.analysis?.some((a) => a !== undefined)) {
                result.push({
                    expr: node.expr,
                    analysis: [...ed.analysis],
                });
            }
        }
    }

    walk(root.children);
    return result;
}

/**
 * 从 AnalysisEntry[] 导入分析。
 *
 * 树尚未展开时，遍历 entries 并在树中定位（必要时展开），
 * 找到匹配节点后写入 analysis。
 *
 * @returns 按 entries 顺序匹配到的节点列表。
 */
export function import_analysis<T>(
    root: TreeNode<T>,
    entries: AnalysisEntry<T>[],
    notation: NotationDefinition<T>,
    variant: string,
    max_find_fs: number = 100,
): TreeNode<T>[] {
    const matched: TreeNode<T>[] = [];
    let node = last_descendant(root);
    let index = 0;

    while (index < entries.length) {
        const cmp = notation.compare(node.expr, entries[index].expr);

        if (cmp === 0) {
            const ed = (node.extraData ??= {}) as TreeNodeExtra;
            if (!Array.isArray(ed.analysis)) ed.analysis = [];
            ed.analysis.length = 0;
            ed.analysis.push(...entries[index].analysis);
            matched.push(node);
            index++;
        } else if (cmp > 0) {
            if (node.fs_state && node.fs_state.index >= max_find_fs) {
                console.log(
                    'import: skipped (max_find_fs reached — possible non-standard expression):',
                    resolve_display(notation.display).plain(entries[index].expr),
                );
                index++;
                continue;
            }
            const created = expand_item(node, notation, variant);
            if (!created) {
                console.log(
                    'import: skipped (expand failed — expression order may be wrong):',
                    resolve_display(notation.display).plain(entries[index].expr),
                );
                index++;
                continue;
            }
            node = created;
        } else {
            const prev = find_prev(node, 0);
            if (!prev) {
                console.log(
                    'import: skipped (no matching node — contact author if notation implementation is correct):',
                    resolve_display(notation.display).plain(entries[index].expr),
                );
                index++;
                continue;
            }
            node = prev;
        }
    }

    return matched;
}
