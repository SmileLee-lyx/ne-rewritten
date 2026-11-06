/**
 * 模块级显示结果缓存。
 *
 * 树条目渲染等价表示 (display_equiv) 时, 对每个节点每行等价每次渲染都直接调用
 * display 函数, 无任何缓存 —— 上万节点切换等价/display_mode 时会全部重算。
 * 本模块按 `(记号 id, 等价 id, mode, expr_key)` 缓存最终字符串, 使滚动回看、
 * 切回旧等价、切换 display_mode 均为 cache hit。
 *
 * 纯 memoization, 非响应式。缓存的 value 是计算后的字符串, compute 只负责
 * 首次 miss 时生成。超限时删除最旧 10% (Map 保持插入序), 避免整表 clear
 * 导致回滚查看时整批重算。
 */

const cache = new Map<string, string>();
const MAX = 50000;

/** 原始 display 的保留 id。用含 NUL 的哨兵, 不可能与记号定义里的等价 id 冲突。 */
export const ORIGINAL_ID = '\x00original';

export function cached_display(
    nid: string,
    id: string,
    mode: 'plain' | 'html' | 'latex',
    expr_key: string,
    compute: () => string,
): string {
    const key = nid + '\0' + id + '\0' + mode + '\0' + expr_key;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = compute();
    if (cache.size >= MAX) {
        let remaining = Math.ceil(MAX * 0.1);
        for (const k of cache.keys()) {
            if (remaining-- <= 0) break;
            cache.delete(k);
        }
    }
    cache.set(key, value);
    return value;
}
