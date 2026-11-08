
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
    chain: Entry[];
    dim_seq: number[];
}

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
        const e: Entry = { value, row, cloumn, no, parent, head, foot, chain: [], dim_seq: [] };
        this.data.push(e);
        return e;
    }
    makeRoot(): Entry {
        return this.make(0, [1], -1);
    }
}

interface Memo {
    seqs: Entry[][];
    ns: number[];
    ds: number[][];
    exs: number[][];
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

function isEqualSequnce(s1: Entry[], s2: Entry[]): boolean {
    if (s1.length !== s2.length) return false;
    for (let i = 0; i < s1.length; i++) {
        if (s1[i].value !== s2[i].value) return false;
        const p1 = s1[i].parent;
        const p2 = s2[i].parent;
        const c1 = p1 != null ? p1.cloumn : -1;
        const c2 = p2 != null ? p2.cloumn : -1;
        if (c1 !== c2) return false;
    }
    return true;
}

function drawMountain(m: Entry[][], d: number[], arena: Arena): void {
    for (let i = 0; i < m.length; i++) {
        let it = m[i][0];
        while (it.value > 1) {
            if (isDimensionLimited(it, d)) break;
            const pv = it.parent != null ? it.parent.value : 0;
            const footVal = it.value - pv;
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
    }
}

function setElementNo(m: Entry[][], b: Entry): void {
    for (let i = 0; i < m.length; i++) {
        for (let j = 0; j < m[i].length; j++) {
            const e = m[i][j];
            if (i === b.cloumn) {
                e.no = j + 1;
            } else if (i < b.cloumn || (e.value <= 1 && j === 0)) {
                e.no = 0;
            } else if (
                e.value > 1 &&
                e.parent != null &&
                compareRow(e.row, e.parent.row) === 0
            ) {
                e.no = e.parent.no;
            } else if (e.head != null && e.head.parent != null) {
                e.no = e.head.parent.no;
            } else {
                e.no = 0;
            }
        }
    }
}

function getReferenceChain(it: Entry | null): Entry[] {
    const c: Entry[] = [];
    if (it == null) return c;
    while (true) {
        c.unshift(it);
        if (it.value <= 1 && compareRow(it.row, [0]) === 0) break;
        if (it.value > 1 && it.parent != null && compareRow(it.row, it.parent.row) === 0) {
            it = it.parent;
        } else if (
            it.head != null &&
            it.head.parent != null &&
            it.head.parent.foot != null &&
            compareRow(it.row, it.head.parent.foot.row) >= 0
        ) {
            it = it.head.parent.foot;
        } else if (it.head != null && it.head.parent != null) {
            it = it.head.parent;
        } else {
            break;
        }
    }
    return c;
}

function getMainDimensionSequence(c: Entry[], t: Entry, arena: Arena): Entry[] {
    const s: Entry[] = [];
    for (const e of c) s.push(arena.make(e.row.length, [0], e.cloumn));
    s.push(arena.make(t.row.length + 1, [0], t.cloumn));
    for (let i = 0; i < s.length; i++) {
        if (s[i].value <= 1) {
            s[i].parent = arena.makeRoot();
            continue;
        }
        let found = false;
        for (let j = i - 1; j >= 0; j--) {
            if (s[j].value < s[i].value) {
                s[i].parent = s[j];
                found = true;
                break;
            }
        }
        if (!found) s[i].parent = arena.makeRoot();
    }
    return s;
}

function getBootCloumn(s: Entry[], d: number[], arena: Arena): number {
    const m: Entry[][] = [];
    for (const e of s) m.push([e]);
    drawMountain(m, d, arena);
    if (m.length === 0 || m[m.length - 1].length < 2) return -1;
    const t = m[m.length - 1][m[m.length - 1].length - 2];
    const b = t.parent;
    // d.length==1 分支(X-Y 用 d=[1,0,1] 不命中, 保留以忠实移植)
    if (d.length === 1 && t.foot != null && t.foot.value > 1) {
        const o: Entry[] = [];
        for (const col of m) {
            const last = col[col.length - 1];
            let p: Entry;
            if (last.value <= 1) p = arena.makeRoot();
            else if (
                last.parent != null &&
                last.parent.cloumn >= 0 &&
                last.parent.cloumn < o.length
            )
                p = o[last.parent.cloumn];
            else p = arena.makeRoot();
            o.push(arena.make(last.value, [0], col[0].cloumn, 0, p));
        }
        return getBootCloumn(o, d, arena);
    }
    if (b == null) return -1;
    if (t.row.length === b.row.length || d.length < 3) return b.cloumn;
    const chain = getReferenceChain(b);
    const mds = getMainDimensionSequence(chain, t, arena);
    return getBootCloumn(mds, d, arena);
}

function copyElement(op: Entry[], head: Entry, maxRow: number[], d: number[], arena: Arena): void {
    if (
        head.parent != null &&
        head.parent.cloumn < 0 &&
        head.head != null &&
        head.head.parent != null &&
        compareRow(head.head.parent.row, maxRow) < 0
    ) {
        head.parent = head.head.parent;
    }
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
            if (foot.parent != null && foot.parent.foot != null) {
                foot.parent = foot.parent.foot;
            }
        }
        op.push(foot);
        head = foot;
    }
}

function copyCloumn(
    m: Entry[][],
    b: Entry,
    j: number,
    i: number,
    len: number,
    ex: number[],
    d: number[],
    arena: Arena,
): void {
    const l = m.length;
    m.push([]);
    const newCol = m[m.length - 1];
    const srcCol = m[j];
    for (let k = 0; k < srcCol.length; k++) {
        const src = srcCol[k];
        let maxRow: number[];
        if (src.dim_seq.length > 0) {
            const beg = [1];
            const kk = i < src.dim_seq.length ? src.dim_seq[i] : 0;
            let rowDif: number[];
            if (src.row.length === 0) rowDif = [];
            else if (src.row[0] - 1 === 0) rowDif = [];
            else rowDif = [src.row[0] - 1];
            for (let jj = 1; jj + 1 < src.row.length; jj++) rowDif.push(src.row[jj]);
            for (let z = kk - 1; z > 0; z--) beg.push(0);
            maxRow = rowAddition(beg, rowDif);
        } else if (src.no > 0) {
            const bc = b.cloumn + len * (i + 1);
            maxRow = src.row.slice();
            if (
                bc >= 0 &&
                bc < m.length &&
                b.cloumn >= 0 &&
                b.cloumn < m.length &&
                src.no >= 1 &&
                src.no - 1 < m[b.cloumn].length
            ) {
                const baseCol = m[bc];
                const bsrc = m[b.cloumn][src.no - 1];
                for (let kk = baseCol.length - 1; kk >= 0; kk--) {
                    if (baseCol[kk].no > src.no) continue;
                    maxRow = rowAddition(baseCol[kk].row, rowDifference(src.row, bsrc.row));
                    break;
                }
            }
        } else {
            maxRow = src.row.slice();
        }
        if (compareRow(d, [0]) === 0) maxRow = src.row.slice();
        let head: Entry;
        if (newCol.length === 0) {
            const par = src.parent != null ? src.parent : arena.makeRoot();
            head = arena.make(0, [0], l, srcCol[0].no, par);
        } else {
            head = arena.make(0, getFootRow(newCol[newCol.length - 1], d), l, src.no, src.parent, newCol[newCol.length - 1]);
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
        copyElement(newCol, newCol[newCol.length - 1], maxRow, d, arena);
    }
    let lastVal: number;
    if (ex.length > 0) {
        const eidx = j + len * i + len;
        lastVal = eidx >= 0 && eidx < ex.length ? ex[eidx] : 0;
    } else {
        lastVal = srcCol[srcCol.length - 1].value;
    }
    newCol[newCol.length - 1].value = lastVal;
    for (let k = newCol.length - 1; k > 0; k--) {
        const p = newCol[k - 1].parent;
        if (p != null) {
            newCol[k - 1].value = newCol[k].value + p.value;
        }
    }
}

function expandElementDimensionSequence(
    m: Entry[][],
    b: Entry,
    t: Entry,
    n: number,
    d: number[],
    arena: Arena,
    memo: Memo,
): void {
    if (b.row.length === t.row.length || d.length < 3) return;
    if (b.chain.length === 0 || t.parent == null || t.parent.chain.length === 0) return;
    for (let i = b.cloumn + 1; i < m.length; i++) {
        for (let j = 0; j < m[i].length; j++) {
            const it = m[i][j];
            if (it.no < b.no || it.row.length <= b.row.length) continue;
            const refchain = getReferenceChain(it);
            const index = refchain.length;
            const c: Entry[] = [];
            for (const e of refchain) c.push(arena.make(e.row.length, [0], 0));
            const tailStart = b.chain.length;
            const tpchain = t.parent.chain;
            if (tailStart < tpchain.length) {
                for (let k = tailStart; k < tpchain.length; k++) {
                    c.push(arena.make(tpchain[k].row.length, [0], 0));
                }
            }
            it.dim_seq = [];
            for (let k = 0; k < c.length; k++) {
                c[k].row = [0];
                c[k].cloumn = k;
                if (c[k].value <= 1) c[k].parent = arena.makeRoot();
                if (k === index) {
                    if (b.chain.length - 1 < c.length) {
                        c[k].parent = c[b.chain.length - 1];
                    }
                    continue;
                }
                for (let kk = k; kk >= 0; kk--) {
                    if (c[kk].value < c[k].value) {
                        c[k].parent = c[kk];
                        break;
                    }
                }
            }
            const last = arena.make(t.row.length + 1, [0], c.length);
            if (t.parent.chain.length - 1 < c.length) {
                last.parent = c[t.parent.chain.length - 1];
            }
            c.push(last);
            const len = c.length - b.chain.length;
            let ex: number[] = [];
            for (let k = 0; k < memo.seqs.length; k++) {
                if (
                    memo.ns[k] >= n &&
                    compareRow(memo.ds[k], d) === 0 &&
                    isEqualSequnce(c, memo.seqs[k])
                ) {
                    ex = memo.exs[k];
                    break;
                }
            }
            if (ex.length === 0) {
                ex = expandImpl(c, n, d, arena, memo);
                memo.seqs.push(c);
                memo.ns.push(n);
                memo.ds.push(d);
                memo.exs.push(ex);
            }
            for (let k = 1; k <= n; k++) {
                const eidx = index - 1 + len * k;
                it.dim_seq.push(eidx >= 0 && eidx < ex.length ? ex[eidx] : 0);
            }
        }
    }
}

function expandImpl(s: Entry[], n: number, d: number[], arena: Arena, memo: Memo): number[] {
    if (s.length === 0) return [];
    if (s[s.length - 1].value <= 1) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    const c = getBootCloumn(s, d, arena);
    const m: Entry[][] = [];
    for (const e of s) {
        let p: Entry;
        if (e.parent != null && e.parent.cloumn >= 0 && e.parent.cloumn < m.length) {
            p = m[e.parent.cloumn][0];
        } else {
            p = arena.makeRoot();
        }
        m.push([arena.make(e.value, [0], e.cloumn, 0, p)]);
    }
    drawMountain(m, d, arena);
    if (m[m.length - 1].length < 2) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    const t = m[m.length - 1][m[m.length - 1].length - 2];
    let b = t.parent;
    if (b == null) {
        const result: number[] = [];
        for (let i = 0; i + 1 < s.length; i++) result.push(s[i].value);
        return result;
    }
    if (c < b.cloumn && c >= 0 && c < m.length && m[c].length > 0) {
        b = m[c][m[c].length - 1];
    }
    const len = t.cloumn - b.cloumn;
    setElementNo(m, b);
    if (d.length > 2) {
        b.chain = getReferenceChain(b);
        if (t.parent != null) {
            t.parent.chain = getReferenceChain(t.parent);
        }
        expandElementDimensionSequence(m, b, t, n, d, arena, memo);
    }
    let ex: number[] = [];
    if (t.foot != null && t.foot.value > 1) {
        const o: Entry[] = [];
        for (const col of m) {
            const last = col[col.length - 1];
            let p: Entry;
            if (last.value <= 1) p = arena.makeRoot();
            else if (last.parent != null && last.parent.cloumn >= 0 && last.parent.cloumn < o.length)
                p = o[last.parent.cloumn];
            else p = arena.makeRoot();
            o.push(arena.make(last.value, [0], col[0].cloumn, 0, p));
        }
        for (const e of m[m.length - 1]) e.value--;
        ex = expandImpl(o, n, d, arena, memo);
    } else {
        m[m.length - 1].pop();
        if (t.foot != null) t.foot = null;
        for (const e of m[m.length - 1]) e.value--;
        if (t.parent != null && t.parent.parent != null) {
            t.parent = t.parent.parent;
        }
    }
    if (b.cloumn >= 0 && b.cloumn < m.length && t.cloumn >= 0 && t.cloumn < m.length) {
        const bcol = b.cloumn;
        const tcol = t.cloumn;
        for (let i = b.no; i < m[bcol].length; i++) {
            const src = m[bcol][i];
            const ne = arena.make(src.value, src.row, t.cloumn, src.no, src.parent, m[tcol][m[tcol].length - 1], null);
            m[tcol].push(ne);
            if (m[tcol].length >= 2) {
                m[tcol][m[tcol].length - 2].foot = ne;
            }
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = b.cloumn + 1; j <= t.cloumn; j++) {
            if (j < 0 || j >= m.length) continue;
            copyCloumn(m, b, j, i, len, ex, d, arena);
        }
    }
    const result: number[] = [];
    for (const col of m) result.push(col.length === 0 ? 0 : col[0].value);
    return result;
}

const D_XY = [1, 0, 1];
const data: Record<string, Expr[]> = {};

export function xyV2FS(seq: Expr, index: number): Expr {
    if (is_infinity(seq)) return [1, index + 1];
    if (seq.length === 0) return [];
    const key = '' + seq;
    if (!data[key]) data[key] = [];
    else if (data[key][index] !== undefined) return data[key][index];
    let n = index;
    if (n > 10) n = 10;
    const arena = new Arena();
    const memo: Memo = { seqs: [], ns: [], ds: [], exs: [] };
    const s = toSequence(seq, arena);
    return (data[key][index] = expandImpl(s, n, D_XY, arena, memo));
}

export const xyV2: NotationDefinition<Expr> = {
    id: 'xy-v2',
    name: 'X-Y V2',
    simple_name: 'XY V2',
    category_id: 'category-xy',
    display: {
        plain: sequence_display,
        from_display: sequence_from_display,
    },
    is_limit,
    compare: seq_compare,
    FS: (seq, index) => xyV2FS(seq, index),
    credit_text_id: 'credit.yukito',

    init: () => [INFINITY(), [1], []],
};
