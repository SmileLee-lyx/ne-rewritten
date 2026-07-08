import type { TreeNode } from '@/core/tree.ts';
import type { TreeNodeExtra } from '@/core/extra.ts';

/** 最后一次聚焦的节点 path */
let last_path: string | undefined;

export function set_last_focus(path: string): void {
    last_path = path;
}

export function get_last_focus(): string | undefined {
    return last_path;
}

/** 平滑滚动到元素约上方第 3 行处 */
function scroll_into_view(el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - 60;
    window.scrollTo({ top, behavior: 'smooth' });
}

/** 通过 data-tree-path 查找并聚焦（阻止默认滚动，手动平滑滚动） */
export function focus_node(path: string): void {
    const el = document.querySelector<HTMLInputElement>(`[data-tree-path="${path}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    scroll_into_view(el);
}

/**
 * 聚焦节点输入框。
 * 若 DOM 已存在则直接聚焦，否则设 focus_on_mounted 标志。
 */
export function focus_node_input<T>(node: TreeNode<T>): void {
    const path = node.path ?? '' + node.index;
    const el = document.querySelector<HTMLInputElement>(`[data-tree-path="${path}"]`);
    if (el) {
        el.focus({ preventScroll: true });
        scroll_into_view(el);
        return;
    }
    const ed = (node.extraData ??= {}) as TreeNodeExtra;
    ed.focus_on_mounted = true;
}
