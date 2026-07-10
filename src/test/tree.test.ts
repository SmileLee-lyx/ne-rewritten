import { describe, expect, it } from 'vitest';
import {
    append_sibling,
    find_next,
    find_prev,
    get_bound,
    init_dataset,
    last_descendant,
    next_sibling,
    prepend_child,
    TreeNode,
} from '@/core/tree';

import { NotationDefinition } from '@/notation-definition.ts';

// ---------------------------------------------------------------------------
// 辅助：构造一棵标准测试树
// index 从左到右递增（首子最小，末子最大）。
//        root
//        ├── A (idx=0)
//        │   ├── B (idx=0)
//        │   │   ├── C (idx=0)
//        │   │   └── D (idx=1)
//        │   └── E (idx=1)
//        │       └── F (idx=0)
//        └── G (idx=1)
//            └── H (idx=0)
// ---------------------------------------------------------------------------

function build_test_tree(): TreeNode<string> {
    const c: TreeNode<string> = {
        expr: 'C',
        children: [],
        parent: null!,
        index: 0,
    };
    const d: TreeNode<string> = {
        expr: 'D',
        children: [],
        parent: null!,
        index: 1,
    };
    const b: TreeNode<string> = {
        expr: 'B',
        children: [c, d],
        parent: null!,
        index: 0,
    };
    c.parent = b;
    d.parent = b;

    const f: TreeNode<string> = {
        expr: 'F',
        children: [],
        parent: null!,
        index: 0,
    };
    const e: TreeNode<string> = {
        expr: 'E',
        children: [f],
        parent: null!,
        index: 1,
    };
    f.parent = e;

    const a: TreeNode<string> = {
        expr: 'A',
        children: [b, e],
        parent: null!,
        index: 0,
    };
    b.parent = a;
    e.parent = a;

    const h: TreeNode<string> = {
        expr: 'H',
        children: [],
        parent: null!,
        index: 0,
    };
    const g: TreeNode<string> = {
        expr: 'G',
        children: [h],
        parent: null!,
        index: 1,
    };
    h.parent = g;

    const root: TreeNode<string> = {
        expr: '',
        children: [a, g],
        parent: null,
        index: -1,
    };
    a.parent = root;
    g.parent = root;

    return root;
}

// ---------------------------------------------------------------------------
// init_dataset
// ---------------------------------------------------------------------------

describe('init_dataset', () => {
    it('从 notation.init 构建根树', () => {
        const notation: NotationDefinition<number> = {
            id: 'test',
            name: 'test',
            display: (n: number) => '' + n,
            is_limit: (n: number) => n % 2 === 0,
            compare: (a: number, b: number) => a - b,
            FS: (n: number, _i: number) => n - 1,
            init: () => [100, 200],
        };
        const root = init_dataset(notation);
        expect(root.children.length).toBe(2);
        // init_dataset 按 i 分配 index（递增）
        expect(root.children[0].expr).toBe(100);
        expect(root.children[0].index).toBe(0);
        expect(root.children[1].expr).toBe(200);
        expect(root.children[1].index).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// prepend_child
// ---------------------------------------------------------------------------

describe('prepend_child', () => {
    it('prepend 得到负 index，已有节点不变', () => {
        // 已有子节点 A(0)，B(1)，C(2)
        const parent: TreeNode<string> = {
            expr: 'P',
            children: [
                { expr: 'A', children: [], parent: null!, index: 0 },
                { expr: 'B', children: [], parent: null!, index: 1 },
                { expr: 'C', children: [], parent: null!, index: 2 },
            ],
            parent: null,
            index: -1,
        };
        parent.children.forEach((c) => (c.parent = parent));

        const child = prepend_child(parent, 'X');

        expect(child.index).toBe(-1);
        expect(child.expr).toBe('X');
        expect(parent.children.length).toBe(4);
        // 原有节点 index 不变
        expect(parent.children[0].expr).toBe('X');
        expect(parent.children[0].index).toBe(-1);
        expect(parent.children[1].index).toBe(0); // A
        expect(parent.children[2].index).toBe(1); // B
        expect(parent.children[3].index).toBe(2); // C

        // array_pos = node.index - first_child.index
        const first = parent.children[0].index; // -1
        expect(parent.children.map((c) => c.index - first)).toEqual([0, 1, 2, 3]);
    });

    it('空 children 也能插入', () => {
        const parent: TreeNode<string> = {
            expr: 'P',
            children: [],
            parent: null,
            index: 0,
        };
        const child = prepend_child(parent, 'X');
        expect(parent.children.length).toBe(1);
        expect(child.index).toBe(0);
        expect(parent.children[0].expr).toBe('X');
    });
});

// ---------------------------------------------------------------------------
// append_sibling
// ---------------------------------------------------------------------------

describe('append_sibling', () => {
    it('追加末兄，index 递增', () => {
        // 模拟展开 3 次得到 A[-2, -1, 0]（即 A3, A2, A1）
        const parent: TreeNode<string> = {
            expr: 'P',
            children: [
                { expr: 'A3', children: [], parent: null!, index: -2 },
                { expr: 'A2', children: [], parent: null!, index: -1 },
                { expr: 'A1', children: [], parent: null!, index: 0 },
            ],
            parent: null,
            index: -1,
        };
        parent.children.forEach((c) => (c.parent = parent));

        // 展开末子 A1 得到 A11，追加为兄弟
        const child = append_sibling(parent.children[2]!, 'A11');
        expect(child.expr).toBe('A11');
        expect(child.index).toBe(1); // last(0) + 1
        expect(parent.children.length).toBe(4);
        expect(parent.children[3].expr).toBe('A11');

        // array_pos 正确
        const first = parent.children[0].index;
        expect(parent.children.map((c) => c.index - first)).toEqual([0, 1, 2, 3]);
    });

    it('追加多次得到递增正 index', () => {
        const parent: TreeNode<string> = {
            expr: 'P',
            children: [{ expr: 'A', children: [], parent: null!, index: 0 }],
            parent: null,
            index: -1,
        };
        parent.children[0].parent = parent;

        const b = append_sibling(parent.children[0]!, 'B');
        expect(b.index).toBe(1);

        const c = append_sibling(b!, 'C');
        expect(c.index).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// last_descendant
// ---------------------------------------------------------------------------

describe('last_descendant', () => {
    it('一路走到最深', () => {
        const root = build_test_tree();
        // A → E → F（右子 E 比 B 深）
        expect(last_descendant(root.children[0]).expr).toBe('F');
        // G → H
        expect(last_descendant(root.children[1]).expr).toBe('H');
    });

    it('叶子节点返回自身', () => {
        const leaf: TreeNode<string> = {
            expr: 'X',
            children: [],
            parent: null,
            index: 0,
        };
        expect(last_descendant(leaf).expr).toBe('X');
    });
});

// ---------------------------------------------------------------------------
// next_sibling
// ---------------------------------------------------------------------------

describe('next_sibling', () => {
    it('有右兄弟时返回它', () => {
        const root = build_test_tree();
        const a = root.children[0];
        const g = root.children[1];
        expect(next_sibling(a)?.expr).toBe('G');
        expect(next_sibling(g)).toBeUndefined();
    });

    it('skip=2 可上溯到叔伯', () => {
        const root = build_test_tree();
        const h = root.children[1].children[0]; // H
        // H 无右兄弟，skip=2 → G 的下一个兄弟 → undefined
        expect(next_sibling(h, 2)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// find_next（先根遍历）
// ---------------------------------------------------------------------------

describe('find_next', () => {
    const root = build_test_tree();
    // 跳过 root（expr 无意义），从 A 开始
    const a = root.children[0];
    const b = a.children[0];
    const c = b.children[0];
    const d = b.children[1];
    const e = a.children[1];
    const f = e.children[0];
    const g = root.children[1];
    const h = g.children[0];

    it('skip=0：先根遍历', () => {
        expect(find_next(a)?.expr).toBe('B');
        expect(find_next(b)?.expr).toBe('C');
        expect(find_next(c)?.expr).toBe('D');
        expect(find_next(d)?.expr).toBe('E'); // 上溯到 B 的下一兄 E
        expect(find_next(e)?.expr).toBe('F');
        expect(find_next(f)?.expr).toBe('G'); // F 无子无兄，上溯到 A 的下一兄 G
        expect(find_next(g)?.expr).toBe('H');
        expect(find_next(h)).toBeUndefined();
    });

    it('skip=1：跳过子节点', () => {
        expect(find_next(a, 1)?.expr).toBe('G'); // A → (skip B,E) → G
        expect(find_next(b, 1)?.expr).toBe('E'); // B → (skip C,D) → E
        expect(find_next(c, 1)?.expr).toBe('D'); // C → D (右兄弟)
        expect(find_next(e, 1)?.expr).toBe('G'); // E → (skip F, 上溯) → G
    });

    it('skip=2：跳过同深度节点', () => {
        // C、D 同深度，skip=2 都到父层下一兄 E
        expect(find_next(c, 2)?.expr).toBe('E');
        expect(find_next(d, 2)?.expr).toBe('E');
        // H 是最后一个节点
        expect(find_next(h, 2)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// find_prev
// ---------------------------------------------------------------------------

describe('find_prev', () => {
    const root = build_test_tree();
    const a = root.children[0];
    const b = a.children[0];
    const c = b.children[0];
    const d = b.children[1];
    const e = a.children[1];
    const f = e.children[0];
    const g = root.children[1];
    const h = g.children[0];

    it('skip=0：先根遍历逆序', () => {
        expect(find_prev(h)?.expr).toBe('G');
        expect(find_prev(g)?.expr).toBe('F'); // G 前一兄 A 的第末后代 F
        expect(find_prev(f)?.expr).toBe('E');
        expect(find_prev(e)?.expr).toBe('D'); // E 前兄 B 的第末后代 D
        expect(find_prev(d)?.expr).toBe('C');
        expect(find_prev(c)?.expr).toBe('B');
        expect(find_prev(b)?.expr).toBe('A');
        expect(find_prev(a)).toBeUndefined(); // A 是 root 首子 → undefined
    });

    it('skip=1：跳过更深的节点', () => {
        expect(find_prev(d, 1)?.expr).toBe('C'); // D → C（同级前一个）
        expect(find_prev(f, 1)?.expr).toBe('E'); // F → E（父级）
        expect(find_prev(e, 1)?.expr).toBe('B'); // E → B（前一个同级，不进入子树）
        expect(find_prev(h, 1)?.expr).toBe('G'); // H → G（父级）
    });

    it('skip=2：永远是父节点', () => {
        expect(find_prev(b, 2)?.expr).toBe('A'); // B → A
        expect(find_prev(c, 2)?.expr).toBe('B'); // C → B
        expect(find_prev(f, 2)?.expr).toBe('E'); // F → E
        expect(find_prev(a, 2)?.parent).toBeNull(); // A 的父是 root（容器）
    });
});

// ---------------------------------------------------------------------------
// get_bound
// ---------------------------------------------------------------------------

describe('get_bound', () => {
    it('有孩子时 bound = 首个子节点 expr', () => {
        const root = build_test_tree();
        expect(get_bound(root.children[0])).toBe('B'); // A 的 bound = B
    });

    it('无孩时 bound = 先根遍历下一节点 expr', () => {
        const root = build_test_tree();
        // C 无子，下一项是右兄 D
        expect(get_bound(root.children[0].children[0].children[0])).toBe('D');
        // F 无子无兄，上溯到 G
        expect(get_bound(root.children[0].children[1].children[0])).toBe('G');
    });

    it('叶子且无兄弟时 bound = undefined', () => {
        const root = build_test_tree();
        expect(get_bound(root.children[1].children[0])).toBeUndefined(); // H 的 bound
    });
});
