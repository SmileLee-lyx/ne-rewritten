
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

interface Entry {
    value: number;
    row: number[];
    cloumn: number;
    idx: number;
    no: number;
    id: number;
    parent: Entry | null;
    head: Entry | null;
    foot: Entry | null;
    ref: Entry | null;
}

class Arena {
    private data: Entry[] = [];
    make(
        value: number,
        row: number[],
        cloumn: number,
        idx: number,
        no: number,
        id: number,
        parent: Entry | null = null,
        head: Entry | null = null,
        foot: Entry | null = null,
        ref: Entry | null = null,
    ): Entry {
        const e: Entry = {
            value, row, cloumn, idx, no, id, parent, head, foot, ref,
        };
        this.data.push(e);
        return e;
    }
    makeRoot(): Entry {
        return this.make(0, [1], -1, 0, 0, 0);
    }
}

/** rowGenerator(n): [1] 后接 (n-1) 个 0。 */
function rowGenerator(n: number): number[] {
    const row = [1];
    for (let i = 1; i < n; i++) row.push(0);
    return row;
}

/** v3 行比较: 逐元素优先, 长者为大。 */
function compareRow(r1: number[], r2: number[]): number {
    let i = 0;
    for (; i < r1.length && i < r2.length; i++) {
        if (r1[i] > r2[i]) return 1;
        if (r1[i] < r2[i]) return -1;
    }
    if (r1.length > i) return 1;
    if (r2.length > i) return -1;
    return 0;
}

/** 以第二元素比较"维度"(长度<=1 视为 1)。 */
function compareDimension(r1: number[], r2: number[]): number {
    const a = r1.length <= 1 ? 1 : r1[1];
    const b = r2.length <= 1 ? 1 : r2[1];
    return a - b;
}

function rowAddition(r1: number[], r2: number[]): number[] {
    if (r2.length <= 1 || r2[1] === 1) {
        return r1.concat(r2);
    }
    if (r1.length <= 1 || r1[1] < r2[1]) return r2.slice();
    let i = 1;
    while (++i < r1.length) {
        if (r1[i] < r2[1]) break;
    }
    const out = r1.slice(0, i);
    if (r2.length > 1) out.push(...r2.slice(1));
    return out;
}

function rowDifference(r1: number[], r2: number[]): number[] {
    if (compareRow(r1, r2) <= 0) return [];
    if (r1.length > 1 && r1[1] === 1) {
        if (r1.length >= r2.length) return r1.slice(0, r1.length - r2.length);
        return [];
    }
    let i = 0;
    for (; i < r1.length && i < r2.length; i++) {
        if (r1[i] > r2[i]) break;
    }
    if (i < r1.length && r1[i] === 1) {
        return r1.slice(i);
    }
    const out: number[] = [1];
    if (i < r1.length) out.push(...r1.slice(i));
    return out;
}

/** proc(d): v3 中为恒等。 */
function proc(d: number[]): number[] {
    return d;
}

function divide(d: number[]): number[][] {
    const dd = d.length > 1 ? d.slice(1) : [];
    const ret: number[][] = [];
    for (let i = 0; i + 1 < dd.length; i++) {
        let v = dd[i];
        while (v-- > 0) ret.push(rowGenerator(dd.length - i));
    }
    if (dd.length > 0 && dd[dd.length - 1] !== 0) ret.push([dd[dd.length - 1]]);
    return ret;
}

function merge(d: number[][]): number[] {
    if (d.length === 0) return [];
    const ret = rowGenerator(d[0].length);
    ret[0] -= 1;
    for (let i = 0; i + 1 < d.length; i++) {
        ret[ret.length - d[i].length]++;
    }
    ret[ret.length - d[d.length - 1].length] += d[d.length - 1][0];
    ret.unshift(0);
    return ret;
}

/** v3 中恒为 false。 */
function isDimensionLimited(_it: Entry, _d: number[]): boolean {
    return false;
}

function getFootRow(it: Entry, d: number[]): number[] {
    let row: number[] = [];
    if (it.parent != null) {
        row = rowDifference(it.row, it.parent.row);
    }
    if (
        row.length === 0 ||
        d.length === 0 ||
        (d.length === 1 && d[0] === 0) ||
        (d.length === 2 && d[0] === 0) ||
        (d.length === 3 && d[0] === 1 && d[1] === 0 && d[2] === 1)
    ) {
        return rowAddition(it.row, [1]);
    }
    if (row.length === 1) return rowAddition(it.row, [1, 2]);
    return rowAddition(it.row, [1, row[1] + 1]);
}

function setElementRefrence(m: Entry[][]): void {
    for (const col of m) {
        for (const el of col) {
            if (el.row.length <= 1 && el.value <= 1) continue;
            if (el.parent != null && compareRow(el.row, el.parent.row) === 0) {
                el.ref = el.parent;
            } else if (
                el.head != null &&
                el.head.parent != null &&
                el.head.parent.foot != null &&
                compareRow(el.head.parent.foot.row, el.row) <= 0
            ) {
                el.ref = el.head.parent.foot;
                while (el.ref != null && compareRow(el.ref.row, el.row) === 0) {
                    el.ref = el.ref.ref;
                }
            } else if (el.head != null && el.head.parent != null) {
                el.ref = el.head.parent;
            }
        }
    }
}

function setElementNo(m: Entry[][], b: Entry | null): void {
    let id = 0;
    const bCol = b != null ? b.cloumn : -1;
    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j < m[i].length; j++) {
            const it = m[i][j];
            if (i === bCol) it.no = j + 1;
            else if (i < bCol || (it.value <= 1 && j === 0)) it.no = 0;
            else it.no = it.ref != null ? it.ref.no : 0;
            if (i > bCol) it.id = id++;
            if (i === bCol || i === m.length - 1) it.id = it.no;
        }
    }
}

function getReferenceChain(it: Entry | null): Entry[] {
    const c: Entry[] = [];
    while (it != null) {
        c.unshift(it);
        if (it.value <= 1 && it.row.length === 1) break;
        it = it.ref;
    }
    return c;
}

function toSequence(s: number[], arena: Arena): Entry[] {
    const seq: Entry[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] <= 1) {
            const root = arena.makeRoot();
            seq.push(arena.make(s[i], [], i, 0, 0, 0, root));
            continue;
        }
        let found = false;
        for (let j = i - 1; j >= 0; j--) {
            if (s[j] < s[i]) {
                seq.push(arena.make(s[i], [], i, 0, 0, 0, seq[j]));
                found = true;
                break;
            }
        }
        if (!found) {
            const root = arena.makeRoot();
            seq.push(arena.make(s[i], [], i, 0, 0, 0, root));
        }
    }
    return seq;
}

function drawMountain(s: Entry[], d: number[], arena: Arena): Entry[][] {
    const m: Entry[][] = [];
    for (const e of s) {
        let parent: Entry;
        if (e.parent != null && e.parent.cloumn >= 0) {
            parent = m[e.parent.cloumn][0];
        } else {
            parent = arena.makeRoot();
        }
        const first = arena.make(e.value, [1], e.cloumn, 0, 0, 0, parent);
        m.push([first]);
    }
    for (let i = 0; i < m.length; i++) {
        let it = m[i][0];
        while (it.value > 1) {
            if (isDimensionLimited(it, d)) break;
            const pv = it.parent != null ? it.parent.value : 0;
            const footVal = it.value - pv;
            if (footVal >= it.value) break;
            const fr = getFootRow(it, d);
            const foot = arena.make(footVal, fr, i, it.idx + 1, 0, 0, null, it);
            m[i].push(foot);
            let p = it.parent;
            if (p != null && p.foot != null && compareRow(p.foot.row, foot.row) <= 0) {
                p = p.foot;
            }
            while (p != null && p.value >= foot.value) p = p.parent;
            foot.parent = p;
            it = foot;
        }
    }
    return m;
}

function getOds(m: Entry[][], arena: Arena): Entry[] {
    const o: Entry[] = [];
    for (const col of m) {
        const last = col[col.length - 1];
        let parent: Entry;
        if (last.value <= 1) parent = arena.makeRoot();
        else if (last.parent != null && last.parent.cloumn >= 0) parent = o[last.parent.cloumn];
        else parent = arena.makeRoot();
        o.push(arena.make(last.value, [1], col[0].cloumn, 0, 0, 0, parent));
    }
    return o;
}

function getMds(m: Entry[][], arena: Arena): Entry[] {
    const last = m[m.length - 1][m[m.length - 1].length - 1];
    const chain = getReferenceChain(last);
    const seq: number[] = [];
    for (const e of chain) seq.push(e.row.length <= 1 ? 1 : e.row[1]);
    return toSequence(seq, arena);
}

function getBootIndex(s: Entry[], d: number[], arena: Arena): [number, number] {
    const m = drawMountain(s, d, arena);
    setElementRefrence(m);
    let t = m[m.length - 1][m[m.length - 1].length - 1];
    if (t.value === 1 && t.head != null) t = t.head;
    const b = t.parent;

    // 分支一: 跨维度且 proc(d) 为单元素 → 递归求外层序列的坏根
    if (b != null && t.value - b.value > 1 && proc(d).length === 1) {
        const o = getOds(m, arena);
        let subD: number[];
        if (d.length === 1 || divide(d).length === 1) subD = d;
        else {
            const div = divide(d);
            const sub = div.slice(1);
            subD = merge(sub);
        }
        const [bootFirst] = getBootIndex(o, subD, arena);
        return [bootFirst, m[bootFirst].length - 1];
    }
    // 分支二: 坏根维度低于 t → 沿参考链在主维度序列上递归
    if (b != null && compareDimension(b.row, t.row) < 0) {
        const ch = getReferenceChain(t);
        let dd: number[] = [0, 1];
        if (d.length === 3 && d[0] === 1 && d[1] === 0 && d[2] === 1) dd = d;
        const mds = getMds(m, arena);
        const [bootFirst] = getBootIndex(mds, dd, arena);
        const c = ch[bootFirst].cloumn;
        return [c, m[c][m[c].length - 1].idx];
    }
    return [b != null ? b.cloumn : -1, b != null ? b.idx : 0];
}

function copyElement(
    m: Entry[][],
    b: Entry | null,
    t: Entry,
    it: Entry,
    op: Entry[],
    i: number,
    d: number[],
    arena: Arena,
): void {
    const bCol = b != null ? b.cloumn : -1;
    if (it.value <= 1 && it.row.length > 1) {
        it.parent = it.ref;
        while (it.parent != null && it.parent.value > 1) it.parent = it.parent.ref;
    }
    const minRow = it.row.length > 1 && op.length > 0 ? getFootRow(op[op.length - 1], d) : [1];
    // 参考实现中 max_row 最终恒等于 it.row(后续块被无条件覆盖), 这里直接取 it.row。
    const maxRow = it.row;
    let row = minRow;
    while (compareRow(row, maxRow) <= 0) {
        const e = arena.make(it.value, row, m.length - 1, op.length, it.no, it.id);
        op.push(e);
        if (op.length > 1) {
            op[op.length - 1].head = op[op.length - 2];
            op[op.length - 2].foot = op[op.length - 1];
        }
        const pcol = it.parent != null ? it.parent.cloumn : -1;
        const pc = pcol >= bCol ? m.length - 1 + pcol - it.cloumn : pcol;
        let p: Entry | null;
        if (pc >= 0 && pc < m.length && m[pc].length > 0) p = m[pc][m[pc].length - 1];
        else p = arena.makeRoot();
        while (p != null && compareRow(p.row, row) > 0) p = p.head;
        op[op.length - 1].parent = p;
        row = getFootRow(op[op.length - 1], d);
    }
    void t;
    void i;
}

function copyCloumn(
    m: Entry[][],
    b: Entry | null,
    t: Entry,
    c: number,
    i: number,
    ex: number[],
    d: number[],
    arena: Arena,
): void {
    let it = m[c][0];
    m.push([]);
    const newCol = m[m.length - 1];
    while (true) {
        copyElement(m, b, t, it, newCol, i, d, arena);
        if (it.foot != null) it = it.foot;
        else break;
    }
    const newIdx = m.length - 1;
    newCol[newCol.length - 1].value = ex.length > 0 && newIdx < ex.length ? ex[newIdx] : it.value;
    it = newCol[newCol.length - 1];
    while (it.head != null) {
        if (it.head.parent != null) {
            it.head.value = it.value + it.head.parent.value;
        }
        it = it.head;
    }
}

function expandDimensionSequnece(
    m: Entry[][],
    b: Entry,
    t: Entry,
    n: number,
    d: number[],
    arena: Arena,
): void {
    if (compareDimension(b.row, t.row) >= 0) return;
    let dd: number[] = [0, 1];
    if (d.length === 3 && d[0] === 1 && d[1] === 0 && d[2] === 1) dd = d;
    const s = getMds(m, arena);
    const c = getBootIndex(s, dd, arena)[0];

    for (let i = b.cloumn + 1; i <= t.cloumn; i++) {
        if (i < 0 || i >= m.length) continue;
        for (let j = 0; j < m[i].length; j++) {
            if (i === t.cloumn && j === m[t.cloumn].length - 1) return;
            const it = m[i][j];
            if (it.no !== b.no || it.ref == null) continue;
            if (compareDimension(rowDifference(it.row, it.ref.row), b.row) <= 0) continue;

            const ds = s.slice();
            let pos = 1;
            const diffRow = rowDifference(it.row, it.ref.row);
            {
                const val = diffRow.length < 2 ? 1 : diffRow[1];
                const ne = arena.make(val, [], c + 1, 0, 0, 0, ds[c]);
                ds.splice(c + 1, 0, ne);
            }
            let cur: Entry | null = it;
            while (cur != null && cur.ref != null && cur.ref.cloumn > b.cloumn) {
                cur = cur.ref;
                const ref = cur.ref;
                if (ref == null) break;
                const dr = rowDifference(cur.row, ref.row);
                if (compareDimension(dr, b.row) <= 0) continue;
                const val = dr.length < 2 ? 1 : dr[1];
                const ne = arena.make(val, [], c + 1, 0, 0, 0, ds[c]);
                ds.splice(c + 1, 0, ne);
                ds[c + 2].parent = ds[c + 1];
                pos++;
            }
            for (let k = 0; k < ds.length; k++) {
                ds[k].cloumn = k;
                let par = ds[k].parent;
                while (par != null && ds[k].value <= par.value) {
                    par = par.parent;
                }
                ds[k].parent = par;
            }

            const it2 = m[i][j];
            const len = ds.length - 1 - c;
            const ex = expandImpl(ds, n, dd, false, arena);
            for (let ii = 0; ii < n; ii++) {
                const exIdx = c + len * (ii + 1) + pos;
                // offset = [1, ex[exIdx]] —— 本移植中 offset 为只写, 不影响末值, 记录备查。
                void exIdx;
                void ex;
            }
            void it2;
        }
    }
}

function expandImpl(s: Entry[], n: number, d: number[], f: boolean, arena: Arena): number[] {
    void f;
    if (s.length === 0) return [];
    if (s[s.length - 1].value <= 1) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    const [bootCol, bootIdx] = getBootIndex(s, d, arena);
    const m = drawMountain(s, d, arena);
    // 退化输入(坏根为合成根 / 山建不起来): 与 v1/v2 一致退化为"删去末项"。
    if (bootCol < 0 || bootCol >= m.length || bootIdx >= m[bootCol].length) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    let b = m[bootCol][bootIdx];
    let t = m[m.length - 1][m[m.length - 1].length - 1];
    if (t.value === 1 && t.head != null) t = t.head;

    setElementRefrence(m);
    setElementNo(m, b);
    expandDimensionSequnece(m, b, t, n, d, arena);

    let ex: number[] = [];
    if (t.value - b.value > 1 && proc(d).length === 1) {
        const o = getOds(m, arena);
        let subD: number[];
        if (d.length === 1 || divide(d).length === 1) subD = d;
        else {
            const div = divide(d);
            const sub = div.slice(1);
            subD = merge(sub);
        }
        ex = expandImpl(o, n, subD, false, arena);
    } else if (t.foot != null) {
        m[m.length - 1].pop();
        t.foot = null;
        if (t.parent != null) t.parent = t.parent.parent;
    }
    for (const e of m[m.length - 1]) e.value--;

    const bCol = b.cloumn;
    const tCol = t.cloumn;
    if (bCol >= 0 && bCol < m.length && tCol >= 0 && tCol < m.length) {
        const bColSz = m[bCol].length;
        for (let i = b.no; i < bColSz; i++) {
            const newIdx = t.idx + 1;
            const src = m[bCol][i];
            const head = m[tCol][m[tCol].length - 1];
            const e = arena.make(src.value, src.row, tCol, newIdx, src.no, src.no, src.parent, head, null, src);
            m[tCol].push(e);
            if (m[tCol].length >= 2) {
                m[tCol][m[tCol].length - 2].foot = e;
            }
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = bCol + 1; j <= tCol; j++) {
            if (j >= 0 && j < m.length) copyCloumn(m, b, t, j, i, ex, d, arena);
        }
    }
    const result: number[] = [];
    for (const col of m) result.push(col.length === 0 ? 0 : col[0].value);
    return result;
}

const D_XY = [1, 0, 1];
const data: Record<string, Expr[]> = {};

export function xyV3FS(seq: Expr, index: number): Expr {
    if (is_infinity(seq)) return [1, index + 1];
    if (seq.length === 0) return [];
    const key = '' + seq;
    if (!data[key]) data[key] = [];
    else if (data[key][index] !== undefined) return data[key][index];
    let n = index;
    if (n > 10) n = 10;
    const arena = new Arena();
    const s = toSequence(seq, arena);
    return (data[key][index] = expandImpl(s, n, D_XY, false, arena));
}

export const xyV3: NotationDefinition<Expr> = {
    id: 'xy-v3',
    name: 'X-Y V3',
    simple_name: 'XY V3',
    category_id: 'category-xy',
    display: {
        plain: sequence_display,
        from_display: sequence_from_display,
    },
    is_limit,
    compare: seq_compare,
    FS: (seq, index) => xyV3FS(seq, index),
    credit_text_id: 'credit.yukito',

    init: () => [INFINITY(), [1], []],
};
