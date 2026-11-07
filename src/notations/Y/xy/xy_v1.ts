
import { NotationDefinition } from '@/notation-definition.ts';
import {
    Expr,
    INFINITY,
    is_infinity,
    is_limit,
    seq_compare,
    sequence_display,
    sequence_from_display,
} from '@/notations/Y/Omega_Y.ts';
import {
    compareRow,
    getFootRow,
    isDimensionLimited,
    rowAddition,
    rowDifference,
} from '@/notations/Y/xy/xy_shared.ts';

interface Entry {
    value: number;
    row: number[];
    cloumn: number;
    no: number;
    parent: Entry | null;
    head: Entry | null;
    foot: Entry | null;
}

/** Arena: JS 中以普通数组持有 Entry, 引用即对象, 不存在 deque 指针失效问题。 */
class Arena {
    private data: Entry[] = [];
    make(
        value: number,
        row: number[],
        cloumn: number,
        no = 0,
        parent: Entry | null = null,
        head: Entry | null = null,
        foot: Entry | null = null,
    ): Entry {
        const e: Entry = { value, row, cloumn, no, parent, head, foot };
        this.data.push(e);
        return e;
    }
    makeRoot(): Entry {
        return this.make(0, [1], -1);
    }
}

function toSequence(s: number[], arena: Arena): Entry[] {
    const seq: Entry[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] <= 1) {
            const root = arena.makeRoot();
            seq.push(arena.make(s[i], [0], i, 0, root));
            continue;
        }
        let found = false;
        for (let j = i - 1; j >= 0; j--) {
            if (s[j] < s[i]) {
                seq.push(arena.make(s[i], [0], i, 0, seq[j]));
                found = true;
                break;
            }
        }
        if (!found) {
            const root = arena.makeRoot();
            seq.push(arena.make(s[i], [0], i, 0, root));
        }
    }
    return seq;
}

function drawMountain(m: Entry[][], d: number[], arena: Arena): Entry[] {
    const o: Entry[] = [];
    for (let i = 0; i < m.length; i++) {
        let it = m[i][0];
        while (it.value > 1) {
            if (isDimensionLimited(it, d)) break;
            const pv = it.parent != null ? it.parent.value : 0;
            const footVal = it.value - pv;
            // 防死循环护栏: 脚值必须严格下降, 否则停止建山(对正常输入无影响)。
            if (footVal >= it.value) break;
            const fr = getFootRow(it, d);
            const foot = arena.make(footVal, fr, it.cloumn, 0, null, it);
            it.foot = foot;
            m[i].push(foot);
            let p = it.parent;
            if (p != null && p.foot != null && compareRow(p.foot.row, foot.row) <= 0) {
                p = p.foot;
            }
            while (p != null && p.value >= foot.value) p = p.parent;
            foot.parent = p;
            it = foot;
        }
        o.push(it);
    }
    return o;
}

function preprocess(m: Entry[][], b: Entry): void {
    const bcol = b.cloumn;
    for (let i = 0; i < m[bcol].length; i++) m[bcol][i].no = i + 1;
    for (let i = bcol + 1; i < m.length; i++) {
        for (let j = 0; j < m[i].length; j++) {
            const e = m[i][j];
            if (e.parent == null || e.parent.cloumn < b.cloumn) e.no = 0;
            else e.no = e.parent.no;
        }
    }
}

function fetchDimensionSequence(it: Entry): number[] {
    const seq: number[] = [];
    seq.push(it.parent != null ? it.parent.row.length : 0);
    seq.push(it.row.length + 1);
    if (it.parent == null) return seq;
    it = it.parent;
    while (it.row.length > 1) {
        const hp = it.head != null ? it.head.parent : null;
        if (hp != null && hp.row.length < seq[0]) seq.unshift(hp.row.length);
        it = it.head != null ? it.head.parent! : null!;
        if (it == null) break;
    }
    return seq;
}

function expandDimensionSequence(
    s: number[],
    n: number,
    d: number[],
    arena: Arena,
): number[] {
    const len = s.length;
    // 末两项差 1: 压入 n 个减一后的末项
    if (len >= 2 && s[len - 1] - s[len - 2] === 1) {
        const p = --s[len - 1];
        let nn = n;
        while (nn-- > 0) s.push(p);
        return s;
    }
    // [0,a]: ω^a-Y(本记号用 d=[1,0,1] 不会命中, 保留以忠实移植)
    if (d.length === 2 && d[0] === 0) {
        if (len >= 2) {
            const p0 = --s[len - 1];
            let b = p0 - s[len - 2];
            if (d[1]) b = Math.min(b, d[1] - 1);
            let p = p0;
            let nn = n;
            while (nn-- > 0) {
                p += b;
                s.push(p);
            }
        }
        return s;
    }
    // X-Y: 在维度序列(转为 Entry 序列)上递归展开
    if (compareRow(d, [1, 0, 1]) === 0) return expandImpl(toSequence(s, arena), n, d, arena);
    if (compareRow(d, [1, 0, 2]) === 0) return expandImpl(toSequence(s, arena), n, [1], arena);
    if (d.length > 2 && d[0] === 0 && d[1] === 0) {
        const sub = d.slice(2);
        return expandImpl(toSequence(s, arena), n, sub, arena);
    }
    // 默认 ω-Y
    if (s.length > 0) {
        const p = --s[s.length - 1];
        let nn = n;
        while (nn-- > 0) s.push(p);
    }
    return s;
}

function calcMaxCopyrow(
    m: Entry[][],
    b: Entry,
    t: Entry,
    it: Entry,
    dimSeq: number[],
    index: number,
    i: number,
    d: number[],
): number[] {
    if (compareRow(d, [0]) === 0 || it.no === 0) return it.row.slice();
    let diff: number[];
    if (
        b.cloumn >= 0 &&
        b.cloumn < m.length &&
        it.no >= 1 &&
        it.no - 1 < m[b.cloumn].length
    ) {
        diff = rowDifference(it.row, m[b.cloumn][it.no - 1].row);
    } else {
        diff = it.row.slice();
    }
    if (
        it.no === b.no &&
        diff.length >= t.row.length &&
        index + i + 1 >= 0 &&
        index + i + 1 < dimSeq.length
    ) {
        const l = dimSeq[index + i + 1] - t.row.length;
        for (let z = 0; z < l; z++) diff.splice(1, 0, 0);
    }
    const pc = t.cloumn + (t.cloumn - b.cloumn) * i;
    let p: Entry | null = null;
    if (pc >= 0 && pc < m.length && m[pc].length > 0) p = m[pc][m[pc].length - 1];
    while (p != null && p.no > it.no) p = p.head;
    return rowAddition(p != null ? p.row : it.row, diff);
}

function copyItem(op: Entry[], head: Entry, maxRow: number[], d: number[], arena: Arena): void {
    if (head.parent == null || head.parent.cloumn < 0) return;
    while (true) {
        const row = getFootRow(head, d);
        if (compareRow(row, maxRow) > 0) return;
        const foot = arena.make(head.value, row, head.cloumn, head.no, head.parent, head);
        head.foot = foot;
        if (
            head.parent != null &&
            head.parent.foot != null &&
            compareRow(head.parent.foot.row, foot.row) <= 0
        ) {
            if (foot.parent != null && foot.parent.foot != null) foot.parent = foot.parent.foot;
        }
        op.push(foot);
        head = foot;
    }
}

function expandImpl(s: Entry[], n: number, d: number[], arena: Arena): number[] {
    if (s.length === 0) return [];
    if (s[s.length - 1].value <= 1) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    const m: Entry[][] = [];
    for (const e of s) m.push([e]);
    const o = drawMountain(m, d, arena);
    let t = o[o.length - 1].head;
    if (t == null) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    let b = t.parent;
    let len = t.cloumn - (b != null ? b.cloumn : -1);
    let dimSeq = fetchDimensionSequence(t);
    const index = dimSeq.length - 1;
    dimSeq = expandDimensionSequence(dimSeq, n, d, arena);

    let ex: number[] = [];
    if (o[o.length - 1].value > 1) {
        const outer: Entry[] = [];
        for (const e of o) {
            let p: Entry;
            if (e.parent != null && e.parent.cloumn >= 0 && e.parent.cloumn < outer.length) {
                p = outer[e.parent.cloumn];
            } else {
                p = arena.makeRoot();
            }
            outer.push(arena.make(e.value, [0], e.cloumn, 0, p));
        }
        ex = expandImpl(outer, n, d, arena);
        if (n > 0) {
            len = (ex.length - o.length) / n;
            const bcol = t.cloumn - len;
            if (bcol >= 0 && bcol < o.length) b = o[bcol];
        }
    } else {
        if (t.foot != null) t.foot = null;
        m[t.cloumn].pop();
    }
    if (b == null) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    preprocess(m, b);
    for (const e of m[t.cloumn]) e.value--;
    for (let i = 0; i < n; i++) {
        for (let j = b.cloumn + 1; j <= t.cloumn; j++) {
            if (j < 0 || j >= m.length) continue;
            const l = m.length;
            const op: Entry[] = [];
            m.push(op);
            const newCol = m[m.length - 1];
            for (let k = 0; k < m[j].length; k++) {
                const src = m[j][k];
                const maxRow = calcMaxCopyrow(m, b, t, src, dimSeq, index, i, d);
                let head: Entry;
                if (newCol.length === 0) {
                    const par = src.parent != null ? src.parent : arena.makeRoot();
                    head = arena.make(0, [0], l, m[j][0].no, par);
                } else {
                    head = arena.make(
                        0,
                        getFootRow(newCol[newCol.length - 1], d),
                        l,
                        src.no,
                        src.parent,
                        newCol[newCol.length - 1],
                    );
                    newCol[newCol.length - 1].foot = head;
                }
                newCol.push(head);
                if (head.parent != null && head.parent.cloumn >= b.cloumn) {
                    const pc = head.parent.cloumn + len * i + len;
                    if (pc >= 0 && pc < m.length && m[pc].length > 0) {
                        head.parent = m[pc][m[pc].length - 1];
                    }
                }
                while (
                    head.parent != null &&
                    head.parent.head != null &&
                    compareRow(head.parent.row, head.row) > 0
                ) {
                    head.parent = head.parent.head;
                }
                copyItem(newCol, newCol[newCol.length - 1], maxRow, d, arena);
            }
            let lastVal: number;
            if (ex.length > 0) {
                const eidx = j + len * i + len;
                lastVal = eidx >= 0 && eidx < ex.length ? ex[eidx] : 0;
            } else {
                lastVal = m[j][m[j].length - 1].value;
            }
            newCol[newCol.length - 1].value = lastVal;
            for (let k = newCol.length - 1; k > 0; k--) {
                const p = newCol[k - 1].parent;
                if (p != null) {
                    newCol[k - 1].value = newCol[k].value + p.value;
                }
            }
        }
    }
    const result: number[] = [];
    for (const col of m) result.push(col.length === 0 ? 0 : col[0].value);
    return result;
}

const D_XY = [1, 0, 1];

/** 模块级缓存: 同一表达式按显示字符串缓存基本列项。 */
const data: Record<string, Expr[]> = {};

export function xyV1FS(seq: Expr, index: number): Expr {
    if (is_infinity(seq)) return [1, index + 1];
    if (seq.length === 0) return [];
    const key = '' + seq;
    if (!data[key]) data[key] = [];
    else if (data[key][index] !== undefined) return data[key][index];
    let n = index;
    if (n > 10) n = 10;
    const arena = new Arena();
    const s = toSequence(seq, arena);
    return (data[key][index] = expandImpl(s, n, D_XY, arena));
}

export const xyV1: NotationDefinition<Expr> = {
    id: 'xy-v1',
    name: 'X-Y V1',
    simple_name: 'XY V1',
    category_id: 'category-xy',
    display: {
        plain: sequence_display,
        from_display: sequence_from_display,
    },
    is_limit,
    compare: seq_compare,
    FS: (seq, index) => xyV1FS(seq, index),
    credit_text_id: 'credit.yukito',

    init: () => [INFINITY(), [1], []],
};
