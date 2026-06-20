import type { NotationDefinition } from '@/utils';
import { convert_to_0Y, from_display } from '@/notations/BM-like/BM.ts';
import { sequence_FS_variants } from '@/notations/FS_util.ts';

export type Expr = number[][];

const pseudoInfinity = (expr: Expr): boolean => '' + expr === 'Infinity';
const cloneCol = (col: number[]): number[] => col.slice();
const cloneMatrix = (m: Expr): Expr => m.map(cloneCol);
const isNat = (x: number): boolean => Number.isInteger(x) && x >= 0 && Number.isFinite(x);

const maxRows = (matrix: Expr): number => {
    if (!Array.isArray(matrix) || matrix.length === 0) return 0;
    let rows = 0;
    for (const col of matrix) rows = Math.max(rows, Array.isArray(col) ? col.length : 0);
    return rows;
};

const standardize = (matrix: Expr, rows?: number): Expr => {
    if (!Array.isArray(matrix)) return [];
    const r = rows === undefined ? maxRows(matrix) : rows;
    return matrix.map((col: number[]) => {
        const out = Array.isArray(col) ? col.slice(0, r) : [];
        while (out.length < r) out.push(0);
        return out;
    });
};

const zeroCol = (rows: number): number[] => Array(rows).fill(0);
const onesCol = (rows: number): number[] => Array(rows).fill(1);
const constCol = (a: number, rows: number): number[] => {
    const col = Array(rows).fill(0);
    if (rows > 0) col[0] = a;
    return col;
};

const colValue = (
    matrix: Expr,
    colIndex: number,
    rowIndex: number,
    rows: number = maxRows(matrix),
    missing: number = 0,
): number => {
    if (colIndex < 0 || colIndex >= matrix.length) return missing;
    const col = matrix[colIndex];
    return rowIndex < col.length ? col[rowIndex] : 0;
};

const colCompare = (
    a: number[] | undefined,
    b: number[] | undefined,
    rows: number = Math.max(a ? a.length : 0, b ? b.length : 0),
    missingA: number = 0,
    missingB: number = 0,
): number => {
    for (let r = 0; r < rows; r++) {
        const av = a ? (r < a.length ? a[r] : 0) : missingA;
        const bv = b ? (r < b.length ? b[r] : 0) : missingB;
        if (av < bv) return -1;
        if (av > bv) return 1;
    }
    return 0;
};

const getPhaseColumn = (matrix: Expr, index: number, rows: number): number[] =>
    index >= 0 && index < matrix.length ? matrix[index] : Array(rows).fill(-1);

const phaseColCompare = (matrix: Expr, index: number, col: number[], rows: number): number =>
    colCompare(getPhaseColumn(matrix, index, rows), col, rows, -1, 0);

const phaseColEq = (matrix: Expr, index: number, col: number[], rows: number): boolean =>
    phaseColCompare(matrix, index, col, rows) === 0;
const phaseColLt = (matrix: Expr, index: number, col: number[], rows: number): boolean =>
    phaseColCompare(matrix, index, col, rows) < 0;
const phaseColLe = (matrix: Expr, index: number, col: number[], rows: number): boolean =>
    phaseColCompare(matrix, index, col, rows) <= 0;
const phaseColGt = (matrix: Expr, index: number, col: number[], rows: number): boolean =>
    phaseColCompare(matrix, index, col, rows) > 0;
const phaseColGe = (matrix: Expr, index: number, col: number[], rows: number): boolean =>
    phaseColCompare(matrix, index, col, rows) >= 0;

const phaseColsCompare = (matrix: Expr, startIndex: number, cols: number[][], rows: number): number => {
    for (let i = 0; i < cols.length; i++) {
        const cmp = phaseColCompare(matrix, startIndex + i, cols[i], rows);
        if (cmp) return cmp;
    }
    return 0;
};

const phaseColsLt = (matrix: Expr, startIndex: number, cols: number[][], rows: number): boolean =>
    phaseColsCompare(matrix, startIndex, cols, rows) < 0;

const matrixCompare = (m1: Expr, m2: Expr): number => {
    const inf1 = pseudoInfinity(m1),
        inf2 = pseudoInfinity(m2);
    if (inf1 || inf2) return inf1 === inf2 ? 0 : inf1 ? 1 : -1;
    const rows = Math.max(maxRows(m1), maxRows(m2));
    const len = Math.max(m1.length, m2.length);
    for (let c = 0; c < len; c++) {
        if (c >= m1.length) return -1;
        if (c >= m2.length) return 1;
        const cmp = colCompare(m1[c], m2[c], rows);
        if (cmp) return cmp;
    }
    return 0;
};

const display = (expr: Expr): string => {
    if (pseudoInfinity(expr)) return 'Limit';
    return expr.map((col: number[]) => '(' + col.join(',') + ')').join('');
};

const legal = (matrix: Expr): boolean => {
    if (pseudoInfinity(matrix)) return true;
    if (!Array.isArray(matrix)) return false;
    for (const col of matrix) {
        if (!Array.isArray(col)) return false;
        for (const v of col) if (!isNat(v)) return false;
    }
    if (matrix.length === 0) return true;
    const rows = maxRows(matrix);
    const m = standardize(matrix, rows);
    for (let r = 0; r < rows; r++) if (m[0][r] !== 0) return false;
    for (let c = 0; c < m.length; c++) {
        for (let r = 1; r < rows; r++) if (m[c][r] > m[c][r - 1]) return false;
    }
    return true;
};

interface Ctx {
    m: Expr;
    rows: number;
    cols: number;
    getBParent: (col: number, b: number) => number;
    getAAncestors: (col: number, a: number) => { list: number[]; mask: Uint8Array };
}

const makeCtx = (matrix: Expr, rows: number = maxRows(matrix)): Ctx => {
    const m = standardize(matrix, rows);
    const cols = m.length;
    const parentCache: number[][] = Array.from({ length: rows + 1 }, () => Array(cols).fill(-2));
    const ancCache: ({ list: number[]; mask: Uint8Array } | null)[][] = Array.from({ length: rows + 1 }, () =>
        Array(cols).fill(null),
    );

    const getBParent = (col: number, b: number): number => {
        if (b < 1 || b > rows || col < 0 || col >= cols) return -1;
        const cached = parentCache[b][col];
        if (cached !== -2) return cached;
        const row = b - 1;
        const value = m[col][row];
        const ancestors = getAAncestors(col, b - 1).list;
        let best = -1;
        for (let i = 0; i < ancestors.length; i++) {
            const cand = ancestors[i];
            if (cand >= col) continue;
            if (m[cand][row] < value) {
                best = cand;
                break;
            }
        }
        parentCache[b][col] = best;
        return best;
    };

    const getAAncestors = (col: number, a: number): { list: number[]; mask: Uint8Array } => {
        if (a < 0 || a > rows || col < 0 || col >= cols) return { list: [], mask: new Uint8Array(cols) };
        const cached = ancCache[a][col];
        if (cached) return cached;
        const list: number[] = [];
        const mask = new Uint8Array(cols);
        let current = col,
            guard = 0;
        while (current !== -1 && !mask[current] && guard++ <= cols + 2) {
            list.push(current);
            mask[current] = 1;
            current = a === 0 ? (current > 0 ? current - 1 : -1) : getBParent(current, a);
        }
        return (ancCache[a][col] = { list, mask });
    };

    return { m, rows, cols, getBParent, getAAncestors };
};

const lastNonZeroRow = (matrix: Expr): number => {
    if (matrix.length === 0) return -1;
    const last = matrix[matrix.length - 1];
    for (let r = last.length - 1; r >= 0; r--) if (last[r] !== 0) return r + 1;
    return -1;
};

const lastAllZero = (matrix: Expr): boolean =>
    matrix.length === 0 || matrix[matrix.length - 1].every((v: number) => v === 0);

const computeDelta = (ctx: Ctx, root: number, t: number): number[] => {
    const alpha = ctx.cols - 1;
    const delta = Array(ctx.rows).fill(0);
    for (let r = 0; r < ctx.rows; r++) delta[r] = r >= t - 1 ? 0 : ctx.m[alpha][r] - ctx.m[root][r];
    return delta;
};

const maxEntry = (m: Expr): number => {
    let max = 0;
    for (const col of m) for (const v of col) if (v > max) max = v;
    return max;
};

const findRoot = (ctx: Ctx): { root: number; t: number } | null => {
    const t = lastNonZeroRow(ctx.m);
    if (t < 1) return null;
    const root = ctx.getBParent(ctx.cols - 1, t);
    if (root < 0) return null;
    return { root, t };
};

interface Prep {
    ctx: Ctx;
    root: number;
    t: number;
    alpha: number;
    G: Expr;
    B: Expr;
    B1: Expr;
    B2: Expr;
    delta: number[];
    getVR: (c: number, r: number) => number;
    buildXY: (col: number, k: number) => { X: Expr; Y: Expr; u: number; j: number; uMissing: boolean };
}

const upmsPrepare = (matrix: Expr, rows: number = maxRows(matrix)): Prep | null => {
    const ctx = makeCtx(matrix, rows);
    if (ctx.cols === 0) return null;
    const fr = findRoot(ctx);
    if (!fr) return null;
    const { root, t } = fr;
    const alpha = ctx.cols - 1;
    const G = ctx.m.slice(0, root).map(cloneCol);
    const B = ctx.m.slice(root, alpha).map(cloneCol);
    const delta = computeDelta(ctx, root, t);
    const maxTwice = maxEntry(ctx.m) * 2;

    const vr = new Int8Array(ctx.cols * Math.max(1, ctx.rows));
    vr.fill(-1);
    const vri = (c: number, r: number) => c * Math.max(1, ctx.rows) + r;
    const inBad = (c: number, r: number) => c >= root && c < alpha && r < t - 1;
    const getVR = (c: number, r: number): number => (inBad(c, r) ? vr[vri(c, r)] : -1);
    const setVR = (c: number, r: number, val: number) => {
        vr[vri(c, r)] = val;
    };

    const baseColFor = (col: number, k: number): number[] => {
        const base = Array(ctx.rows).fill(0);
        for (let r = 0; r < ctx.rows; r++) base[r] = r <= k ? ctx.m[col][r] : 0;
        for (let r = 0; r < k; r++) base[r]++;
        return base;
    };

    const buildXY = (col: number, k: number): { X: Expr; Y: Expr; u: number; j: number; uMissing: boolean } => {
        const base = baseColFor(col, k);
        let u = -1;
        let uMissing = false;
        for (let c = col + 1; c <= alpha; c++) {
            if (colCompare(ctx.m[c], base, ctx.rows) < 0) {
                u = c;
                break;
            }
        }
        if (u < 0) {
            u = alpha + 1;
            uMissing = true;
        }

        const Ayk = ctx.m[root][k - 1];
        const alphaAnc = ctx.getAAncestors(alpha, k).list;
        let j = -1;
        for (const c of alphaAnc) {
            if (ctx.m[c][k - 1] === Ayk + 1) {
                j = c;
                break;
            }
        }
        if (j < 0) j = alpha;

        const xStart = col,
            xEnd = u - 1,
            yStart = j,
            yEnd = alpha;
        const X: number[][] = [],
            Y: number[][] = [];
        for (let c = xStart; c <= xEnd; c++) {
            const out = ctx.m[c].slice();
            for (let s = 1; s <= k - 1; s++) {
                const r = s - 1;
                if (getVR(c, r) === 1) out[r] += maxTwice - ctx.m[col][r];
            }
            X.push(out);
        }
        for (let c = yStart; c <= yEnd; c++) {
            const out = ctx.m[c].slice();
            for (let s = 1; s <= k - 1; s++) {
                const r = s - 1;
                if (c === j || ctx.getAAncestors(c, s).mask[j] === 1) out[r] += maxTwice - ctx.m[j][r];
            }
            Y.push(out);
        }
        return { X, Y, u, j, uMissing };
    };

    const matrixLexCompare = (X: number[][], Y: number[][]): number => {
        const len = Math.max(X.length, Y.length);
        for (let c = 0; c < len; c++) {
            const xc = c < X.length ? X[c] : Array(ctx.rows).fill(-1);
            const yc = c < Y.length ? Y[c] : Array(ctx.rows).fill(-1);
            const cmp = colCompare(xc, yc, ctx.rows);
            if (cmp) return cmp;
        }
        return 0;
    };

    for (let row = 0; row < t - 1; row++) {
        const k = row + 1;
        for (let col = root; col < alpha; col++) {
            if (col === root || row === 0) {
                setVR(col, row, 1);
                continue;
            }
            const ancestors = ctx.getAAncestors(col, k);
            let has0 = false;
            for (const a of ancestors.list)
                if (getVR(a, row) === 0) {
                    has0 = true;
                    break;
                }
            const parent = ctx.getBParent(col, k);
            if (ancestors.mask[root] !== 1 || has0 || parent < 0) {
                setVR(col, row, 0);
                continue;
            }
            if (parent !== root) {
                setVR(col, row, 1);
                continue;
            }

            let earlier0 = false;
            for (let r = 0; r < row; r++)
                if (getVR(col, r) === 0) {
                    earlier0 = true;
                    break;
                }
            if (earlier0) {
                setVR(col, row, 0);
                continue;
            }

            let higherEscapes = false;
            for (let r = row + 1; r < t - 1; r++)
                if (ctx.getBParent(col, r + 1) !== root) {
                    higherEscapes = true;
                    break;
                }
            if (higherEscapes) {
                setVR(col, row, 0);
                continue;
            }

            const { X, Y, u, uMissing } = buildXY(col, k);
            if (u === alpha + 1 || uMissing) {
                setVR(col, row, 1);
                continue;
            }
            setVR(col, row, matrixLexCompare(X, Y) < 0 ? 0 : 1);
        }
    }

    const Bhs = (h: number): Expr =>
        B.map((col: number[], local: number) => {
            const original = root + local;
            const out = Array(ctx.rows);
            for (let r = 0; r < ctx.rows; r++)
                out[r] = col[r] + h * delta[r] * (r < t - 1 && getVR(original, r) === 1 ? 1 : 0);
            return out;
        });

    const B1 = Bhs(1),
        B2 = Bhs(2);
    return { ctx, root, t, alpha, G, B, B1, B2, delta, getVR, buildXY };
};

const upmsFS = (matrix: Expr, n: number, rows: number = maxRows(matrix)): Expr => {
    const m = standardize(matrix, rows);
    if (m.length === 0) return [];
    if (lastAllZero(m)) return m.slice(0, -1).map(cloneCol);
    const prep = upmsPrepare(m, rows);
    if (!prep) return [];
    const result: Expr = [...prep.G.map(cloneCol), ...prep.B.map(cloneCol)];
    for (let h = 1; h <= n; h++) {
        const Bh =
            h === 1
                ? prep.B1
                : h === 2
                  ? prep.B2
                  : prep.B.map((col: number[], local: number) => {
                        const original = prep.root + local;
                        return col.map(
                            (v: number, r: number) =>
                                v + h * prep.delta[r] * (r < prep.t - 1 && prep.getVR(original, r) === 1 ? 1 : 0),
                        );
                    });
        for (const col of Bh) result.push(col.slice());
    }
    return standardize(result, rows);
};

const upmsSingle = (matrix: Expr, l: number = Infinity, rows: number = maxRows(matrix)): Expr => {
    const m = standardize(matrix, rows);
    if (m.length === 0 || lastAllZero(m)) return m.slice(0, -1).map(cloneCol);
    const prep = upmsPrepare(m, rows);
    if (!prep) return [];
    const take = Math.min(prep.B1.length, Number.isFinite(l) ? l : prep.B1.length);
    return standardize(
        [...prep.G.map(cloneCol), ...prep.B.map(cloneCol), ...prep.B1.slice(0, take).map(cloneCol)],
        rows,
    );
};

const bmsFS = (matrix: Expr, n: number, rows: number = maxRows(matrix)): Expr => {
    const m = standardize(matrix, rows);
    if (m.length === 0) return [];
    if (lastAllZero(m)) return m.slice(0, -1).map(cloneCol);
    const ctx = makeCtx(m, rows);
    const fr = findRoot(ctx);
    if (!fr) return [];
    const { root, t } = fr;
    const alpha = ctx.cols - 1;
    const G = ctx.m.slice(0, root).map(cloneCol);
    const B = ctx.m.slice(root, alpha).map(cloneCol);
    const delta = computeDelta(ctx, root, t);
    const ancestorContainsRoot = (col: number, rowLabel: number): boolean =>
        ctx.getAAncestors(col, rowLabel).mask[root] === 1;
    const result: Expr = [...G, ...B.map(cloneCol)];
    for (let h = 1; h <= n; h++) {
        for (let local = 0; local < B.length; local++) {
            const original = root + local;
            const out = B[local].map(
                (v: number, r: number) =>
                    v + h * delta[r] * (r < t - 1 && ancestorContainsRoot(original, r + 1) ? 1 : 0),
            );
            result.push(out);
        }
    }
    return standardize(result, rows);
};

const firstDifferentColumn = (X: number[][], Y: number[][], rows: number): number => {
    const len = Math.max(X.length, Y.length);
    for (let i = 0; i < len; i++) {
        const xc = i < X.length ? X[i] : Array(rows).fill(-1);
        const yc = i < Y.length ? Y[i] : Array(rows).fill(-1);
        if (colCompare(xc, yc, rows, -1, -1) !== 0) return i + 1;
    }
    return X.length + 1;
};

const matricesEqual = (X: number[][], Y: number[][], rows: number): boolean =>
    firstDifferentColumn(X, Y, rows) === X.length + 1 && X.length === Y.length;

const columnCPrime = (M: Expr, r: number, n: number, rows: number): number[] => {
    const out = Array(rows).fill(0);
    for (let i = 0; i < rows; i++) out[i] = i < n ? M[r][i] + 1 : 0;
    return out;
};

const columnC = (M: Expr, t: number, n: number, rows: number): number[] => {
    const out = M[t].slice();
    for (let i = 0; i < rows; i++) {
        if (i < n - 1) out[i]++;
        else if (i >= n) out[i] = 0;
    }
    return out;
};

const appendS = (state: { Mp: Expr; rows: number; desc: Uint8Array }, prep: Prep, phase: number): void => {
    const local = phase - prep.root;
    if (local < 0 || local >= prep.B1.length) return;
    const col = prep.B1[local].slice();
    for (let r = 0; r < state.rows; r++) if (state.desc[phase * state.rows + r]) col[r]--;
    state.Mp.push(col);
};

const markSkipRange = (skip: boolean[], from: number, to: number, alpha: number): void => {
    for (let c = from; c <= to && c < alpha; c++) if (c >= 0) skip[c] = true;
};

const findMinParentRoot = (ctx: Ctx, col: number, root: number): number => {
    for (let k = 1; k <= ctx.rows; k++) if (ctx.getBParent(col, k) === root) return k;
    return ctx.rows;
};

const findAdjustedD = (ctx: Ctx, t: number, d: number): number => {
    const idx = t + d - 1;
    if (idx < 0 || idx >= ctx.cols) return d;
    const p1 = ctx.getBParent(idx, 1);
    if (p1 <= t) return d;
    const ancestors = ctx.getAAncestors(idx, 1).list;
    for (const tp of ancestors) {
        if (ctx.getBParent(tp, 1) === t) return tp + 1 - t;
    }
    return d;
};

const lpmsSingle = (matrix: Expr): Expr => {
    let rows = maxRows(matrix);
    let M = standardize(matrix, rows);
    if (M.length === 0) return [];
    if (lastAllZero(M)) return M.slice(0, -1).map(cloneCol);

    // Special contraction for (0^n)(1^n), n>1.
    if (M.length === 2 && rows > 1 && M[0].every((x: number) => x === 0) && M[1].every((x: number) => x === 1)) {
        const nr = rows - 1;
        return [zeroCol(nr), onesCol(nr), Array(nr).fill(2), constCol(3, nr)];
    }

    const prep = upmsPrepare(M, rows);
    if (!prep) return [];
    const { ctx, root: r, t: n, alpha } = prep;
    let Mp: Expr = [...prep.G.map(cloneCol), ...prep.B.map(cloneCol)];
    let mSwitch = true,
        bSwitch = true,
        l = 0;
    const skip: boolean[] = Array(ctx.cols).fill(false);
    const desc = new Uint8Array(ctx.cols * Math.max(1, rows));
    const state = { Mp, rows, desc };
    const cPrime = columnCPrime(M, r, n, rows);
    const last2ParentIsRoot = ctx.getBParent(alpha, 2) === r;

    const markDescent = (col: number, row: number): void => {
        for (let c = 0; c < ctx.cols; c++) {
            if (ctx.getAAncestors(c, row + 1).mask[col] === 1) desc[c * rows + row] = 1;
        }
    };

    for (let t = r; t < alpha; t++) {
        state.Mp = Mp;
        // case 1
        if (skip[t]) continue;

        // case 2
        if (bSwitch) {
            appendS(state, prep, t);
            Mp = state.Mp;
            if (n >= rows || M[r][n] === 0 || phaseColLe(M, t + 1, cPrime, rows)) {
                bSwitch = false;
                l = t + 1 - r;
            }
            continue;
        }

        // case 3
        const nMinusParent = n > 1 ? ctx.getBParent(t, n - 1) : -1;
        const nMinusVR = n > 1 ? prep.getVR(t, n - 2) : 0;
        if (nMinusParent !== r || nMinusVR === 0) {
            appendS(state, prep, t);
            Mp = state.Mp;
            continue;
        }

        const c = columnC(M, t, n, rows);
        // case 4
        if (last2ParentIsRoot) {
            if (n < rows && M[t][n] > 0) {
                appendS(state, prep, t);
                Mp = state.Mp;
                continue;
            }
            if (phaseColEq(M, t + 1, c, rows) && phaseColLe(M, t + 2, c, rows)) {
                if (t + 1 < alpha) skip[t + 1] = true;
                appendS(state, prep, t);
                Mp = state.Mp;
                continue;
            }
            const threshold = constCol(c[0] + 1, rows);
            if (
                phaseColGt(M, t + 1, c, rows) ||
                (phaseColEq(M, t + 1, c, rows) && phaseColGe(M, t + 2, threshold, rows))
            ) {
                appendS(state, prep, t);
                Mp = state.Mp;
                continue;
            }
            if (phaseColLt(M, t + 1, c, rows)) {
                appendS(state, prep, t);
                Mp = state.Mp;
                mSwitch = false;
                let a = M[t][0];
                if (
                    phaseColsLt(M, t + 1, [constCol(a + 1, rows), constCol(a + 2, rows)], rows) &&
                    ctx.getBParent(t, 2) === r
                )
                    mSwitch = true;
                a = Mp.length ? Mp[Mp.length - 1][0] : 0;
                Mp = upmsSingle(Mp, l, rows);
                if (mSwitch) Mp.push(constCol(a + 1, rows));
                continue;
            }
        }

        // case 5
        let k = findMinParentRoot(ctx, t, r);
        let kp = k === 1 ? 2 : k;
        const xy = prep.buildXY(t, kp);
        const eqXY = matricesEqual(xy.X, xy.Y, rows);
        let d = eqXY ? xy.X.length + 1 : firstDifferentColumn(xy.X, xy.Y, rows);
        if (!eqXY) {
            if (xy.uMissing && t + d - 1 >= alpha) {
                d = xy.X.length + 1;
            } else {
                const adjusted = findAdjustedD(ctx, t, d);
                d = xy.uMissing && adjusted === d ? xy.X.length + 1 : adjusted;
            }
        }

        if (d === 1) {
            appendS(state, prep, t);
            Mp = state.Mp;
            continue;
        }

        if (phaseColLt(M, t + d - 1, c, rows)) {
            markSkipRange(skip, t + 1, t + d - 2, alpha);
            mSwitch = false;
            let a = M[t][0];
            if (kp === 2 && phaseColsLt(M, t + d - 1, [constCol(a + 1, rows), constCol(a + 2, rows)], rows))
                mSwitch = true;
            if (t !== r + l) {
                appendS(state, prep, t);
                Mp = state.Mp;
                if (Mp.length) for (let rr = k; rr < rows; rr++) Mp[Mp.length - 1][rr] = 0;
                Mp = upmsSingle(Mp, l, rows);
            }
            a = l > 0 && Mp.length >= l ? Mp[Mp.length - l][0] : Mp.length ? Mp[Mp.length - 1][0] : 0;
            if (mSwitch) Mp.push(constCol(a + 1, rows));
            for (let rr = k - 1; rr <= n - 2 && rr < rows; rr++) markDescent(t, rr);
            continue;
        }

        if (n === 3 && phaseColEq(M, t + d - 1, c, rows) && phaseColLt(M, t + d, c, rows)) {
            markSkipRange(skip, t + 1, t + d - 1, alpha);
            appendS(state, prep, t);
            Mp = state.Mp;
            mSwitch = false;
            let a = M[t][0];
            if (phaseColsLt(M, t + d, [constCol(a + 1, rows), constCol(a + 2, rows)], rows)) mSwitch = true;
            a = Mp.length ? Mp[Mp.length - 1][0] : 0;
            Mp = upmsSingle(Mp, l, rows);
            if (mSwitch) Mp.push(constCol(a + 1, rows));
            continue;
        }

        markSkipRange(skip, t + 1, t + d - 2, alpha);
        if (n === 3 && phaseColEq(M, t + d - 1, c, rows) && phaseColEq(M, t + d, c, rows)) {
            if (t + d - 1 < alpha) skip[t + d - 1] = true;
            if (t + d < alpha) skip[t + d] = true;
        }
        if (n > 3 && phaseColEq(M, t + d - 1, c, rows) && phaseColLt(M, t + d, constCol(c[0] + 1, rows), rows)) {
            if (t + d - 1 < alpha) skip[t + d - 1] = true;
        }
        appendS(state, prep, t);
        Mp = state.Mp;
    }

    if (bSwitch) l = ctx.cols - r - 1;

    if (last2ParentIsRoot) {
        const take = Math.min(l, prep.B2.length);
        for (let i = 0; i < take; i++) Mp.push(prep.B2[i].slice());
        const a = prep.B2.length ? prep.B2[0][0] : Mp.length ? Mp[Mp.length - 1][0] : 0;
        Mp.push(constCol(a + 1, rows));
    } else {
        const blen = ctx.cols - r - 1;
        if (l === blen) {
            const source = Mp[ctx.cols - 1] || Mp[Mp.length - 1] || [0];
            Mp.push(constCol(source[0] + 1, rows));
        }
    }
    return standardize(Mp, rows);
};

const lpmsInfinityFs = (n: number): Expr => {
    return [zeroCol(n), onesCol(n)];
};

const lpmsFS = (() => {
    const cache = new Map<string, Expr>();
    const inner = (expr: Expr, n: number): Expr => {
        n = Math.max(0, Math.floor(n));
        if (pseudoInfinity(expr)) return n === 0 ? [[]] : [zeroCol(n), onesCol(n)];
        if (!legal(expr)) return [];
        const rows = maxRows(expr);
        const M = standardize(expr, rows);
        if (M.length === 0) return [];
        if (lastAllZero(M)) return M.slice(0, -1).map(cloneCol);
        if (rows < 3 || M[M.length - 1][2] === 0) return bmsFS(M, n, rows);
        return inner(lpmsSingle(M), n);
    };
    return (expr: Expr, n: number): Expr => {
        if (pseudoInfinity(expr)) return inner(expr, n);
        const key = display(standardize(expr, maxRows(expr))) + '[' + Math.max(0, Math.floor(n)) + ']';
        if (cache.has(key)) return cloneMatrix(cache.get(key)!);
        const out = inner(expr, n);
        cache.set(key, cloneMatrix(out));
        return out;
    };
})();

const lpmsLimit = (expr: Expr): boolean =>
    pseudoInfinity(expr) || (legal(expr) && !lastAllZero(standardize(expr, maxRows(expr))));

export const LPMS: NotationDefinition<Expr> = {
    id: 'lpms',
    name: 'Lifting projection matrix system',
    simple_name: 'LPMS',
    display: { plain: display, from_display },
    display_equiv: {
        LP0Y: { plain: (m) => (pseudoInfinity(m) ? '1,ω' : '' + convert_to_0Y(m)), from_display },
    },
    is_limit: lpmsLimit,
    compare: matrixCompare,
    ...sequence_FS_variants(lpmsFS, pseudoInfinity, lpmsInfinityFs, lpmsLimit, display),
    init: () => [[[Infinity] as any], []],
};
