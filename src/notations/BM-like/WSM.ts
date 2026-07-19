import { NotationDefinition } from '@/notation-definition.ts';

const INFINITY: string = Infinity as any;

function is_infinity(str: string): boolean {
    return '' + str === '' + INFINITY;
}

class WSM {
    parent: number[][];

    constructor(parentMatrix: number[][]) {
        this.parent = parentMatrix.map((col) => [...col]);
    }

    static fromString(inputStr: string): WSM {
        const { matrix } = WSM.parse(inputStr);
        return WSM.fromValue(matrix);
    }

    static fromValue(valueMatrix: number[][]): WSM {
        const rows = valueMatrix.length > 0 ? valueMatrix[0].length : 0;
        const cols = valueMatrix.length;
        if (rows === 0 || cols === 0) return new WSM([]);

        const parent = Array.from({ length: cols }, () => Array(rows).fill(-1));
        const virtualParent = Array(cols).fill(-1);
        for (let c = 1; c < cols; c++) virtualParent[c] = c - 1;

        const getAncestors = (col: number, row: number, parentMat: number[][]): number[] => {
            const ancestors: number[] = [];
            let p = parentMat[col][row];
            while (p !== -1) {
                ancestors.push(p);
                p = parentMat[p][row];
            }
            return ancestors;
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let belowAncestors: number[] = [];
                if (r === 0) {
                    let p = virtualParent[c];
                    while (p !== -1) {
                        belowAncestors.push(p);
                        p = virtualParent[p];
                    }
                } else {
                    belowAncestors = getAncestors(c, r - 1, parent);
                }
                const curVal = valueMatrix[c][r];
                let best = -1;
                for (const anc of belowAncestors) {
                    if (valueMatrix[anc][r] < curVal) {
                        best = anc;
                        break;
                    }
                }
                parent[c][r] = best;
            }
        }
        return new WSM(parent);
    }

    static fromWorm(worm: number[]): WSM {
        const n = worm.length;
        if (n === 0) return new WSM([]);
        const aux = [worm.slice()];
        const parentRows: number[][] = [];

        const row0: number[] = [];
        for (let c = 0; c < n; c++) {
            let best = -1;
            for (let p = c - 1; p >= 0; p--) {
                if (aux[0][p] < aux[0][c]) {
                    best = p;
                    break;
                }
            }
            row0.push(best);
        }
        parentRows.push(row0);

        let i = 0;
        while (true) {
            const auxNext: number[] = [];
            const row = parentRows[i];
            for (let c = 0; c < n; c++) {
                if (row[c] !== -1) {
                    auxNext.push(aux[i][c] - aux[i][row[c]]);
                } else {
                    auxNext.push(1);
                }
            }
            aux.push(auxNext);

            if (auxNext.every((v) => v === 1)) {
                break;
            }

            const nextRow: number[] = [];
            for (let c = 0; c < n; c++) {
                let ancestors: number[] = [];
                let p = parentRows[i][c];
                while (p !== -1) {
                    ancestors.push(p);
                    p = parentRows[i][p];
                }
                let maxCol = -1;
                for (const anc of ancestors) {
                    if (aux[i + 1][anc] < aux[i + 1][c]) {
                        if (anc > maxCol) maxCol = anc;
                    }
                }
                nextRow.push(maxCol);
            }
            parentRows.push(nextRow);
            i++;
        }

        const parentCols = Array.from({ length: n }, (_, c) => parentRows.map((row) => row[c]));
        return new WSM(parentCols);
    }

    static parse(inputStr: string): { matrix: number[][]; rows: number; cols: number } {
        const colRegex = /\(([^)]*)\)/g;
        let match: RegExpExecArray | null;
        const columns: number[][] = [];
        while ((match = colRegex.exec(inputStr)) !== null) {
            const content = match[1];
            if (content.trim() === '') {
                columns.push([0]);
            } else {
                const nums = content.split(',').map((n) => parseInt(n.trim(), 10));
                if (nums.some(isNaN)) {
                    columns.push([0]);
                } else {
                    columns.push(nums);
                }
            }
        }
        let maxRows = 0;
        for (const col of columns) {
            if (col.length > maxRows) maxRows = col.length;
        }
        for (const col of columns) {
            while (col.length < maxRows) col.push(0);
        }
        return { matrix: columns, rows: maxRows, cols: columns.length };
    }

    static format(matrix: number[][]): string {
        if (!matrix || matrix.length === 0) return '';
        return matrix
            .map((col) => {
                let trimmed = [...col];
                while (trimmed.length > 1 && trimmed[trimmed.length - 1] === 0) {
                    trimmed.pop();
                }
                return '(' + trimmed.join(',') + ')';
            })
            .join('');
    }

    static clone(matrix: number[][]): number[][] {
        return matrix.map((col) => [...col]);
    }

    static getGenerationColumn(colIdx: number, lnzRow: number, parentMat: number[][], lastColIdx: number): number[] {
        return parentMat[lastColIdx].map((v, r) => {
            if (r >= lnzRow) {
                return parentMat[colIdx][r];
            }
            return v;
        });
    }

    static copyColumns(
        parentMat: number[][],
        refCol: number,
        start: number,
        end: number,
        shiftAmount: number,
    ): number[][] {
        const result: number[][] = [];
        for (let c = start; c <= end; c++) {
            const newCol: number[] = [];
            for (let r = 0; r < parentMat[c].length; r++) {
                const p = parentMat[c][r];
                if (p === -1) {
                    newCol.push(-1);
                } else {
                    newCol.push(p < refCol ? p : p + shiftAmount);
                }
            }
            result.push(newCol);
        }
        return result;
    }

    getAncestorsAt(col: number, row: number): number[] {
        const ancestors: number[] = [];
        let p = this.parent[col][row];
        while (p !== -1) {
            ancestors.push(p);
            p = this.parent[p][row];
        }
        return ancestors;
    }

    trialExpand(refCol: number, lnzRowVal: number, lastColIdx: number, genColToUse: number[]): number[][] {
        const newMat = WSM.clone(this.parent);
        if (refCol + 1 <= lastColIdx) {
            const shiftAmount = lastColIdx - refCol;
            const copied = WSM.copyColumns(this.parent, refCol, refCol + 1, lastColIdx, shiftAmount);
            for (const col of copied) {
                newMat.push(col);
            }
        }
        for (let r = 0; r < newMat[lastColIdx].length; r++) {
            if (r >= lnzRowVal) {
                newMat[lastColIdx][r] = genColToUse[r];
            }
        }
        return newMat;
    }

    static compareParentMatrices(matA: number[][], matB: number[][]): number {
        const maxCols = Math.max(matA.length, matB.length);
        const maxRows = Math.max(matA.length > 0 ? matA[0].length : 0, matB.length > 0 ? matB[0].length : 0);
        for (let c = 0; c < maxCols; c++) {
            const colA = c < matA.length ? matA[c] : [];
            const colB = c < matB.length ? matB[c] : [];
            const maxR = Math.max(colA.length, colB.length);
            for (let r = 0; r < maxR; r++) {
                const pA = r < colA.length ? colA[r] : -1;
                const pB = r < colB.length ? colB[r] : -1;
                if (pA !== pB) {
                    if (pA === -1) return -1;
                    if (pB === -1) return 1;
                    return pA - pB;
                }
            }
        }
        return matA.length - matB.length;
    }

    expand(times: number): {
        wsm: WSM;
        badRoot: number;
        candidateRoots: number[];
        trialResults: { [key: string]: number[][] };
        originalRoot: number;
        lnzRow: number;
        lastCol: number;
        genCol: number[];
        smallerRoots: number[];
        pendingRoots: number[];
    } {
        const parent = this.parent;
        const cols = parent.length;
        if (cols === 0) {
            return {
                wsm: new WSM([]),
                badRoot: -1,
                candidateRoots: [],
                trialResults: {},
                originalRoot: -1,
                lnzRow: -1,
                lastCol: -1,
                genCol: [],
                smallerRoots: [],
                pendingRoots: [],
            };
        }

        const rows = parent[0].length;
        const lastCol = cols - 1;

        let lnzRow = -1;
        for (let r = rows - 1; r >= 0; r--) {
            if (parent[lastCol][r] !== -1) {
                lnzRow = r;
                break;
            }
        }
        if (lnzRow === -1) {
            const newParent = parent.slice(0, -1);
            return {
                wsm: new WSM(newParent),
                badRoot: -1,
                candidateRoots: [],
                trialResults: {},
                originalRoot: -1,
                lnzRow: -1,
                lastCol: lastCol,
                genCol: [],
                smallerRoots: [],
                pendingRoots: [],
            };
        }

        const originalRoot = parent[lastCol][lnzRow];
        if (originalRoot === -1) {
            return {
                wsm: new WSM(parent),
                badRoot: -1,
                candidateRoots: [],
                trialResults: {},
                originalRoot: -1,
                lnzRow: lnzRow,
                lastCol: lastCol,
                genCol: [],
                smallerRoots: [],
                pendingRoots: [],
            };
        }

        let origElemRow = -1;
        for (let r = rows - 1; r >= 0; r--) {
            if (parent[originalRoot][r] !== -1) {
                origElemRow = r;
                break;
            }
        }
        if (origElemRow === -1 || origElemRow < lnzRow) {
            origElemRow = lnzRow;
        }

        const genCol = WSM.getGenerationColumn(originalRoot, lnzRow, parent, lastCol);

        const origRootTrial = this.trialExpand(originalRoot, lnzRow, lastCol, genCol);

        let candidateRoots: number[] = [];
        let pendingRoots: number[] = [];
        let trialResults: { [key: string]: number[][] } = {};
        let smallerRoots: number[] = [];
        let smallRoot = -1;
        let badRoot = originalRoot;

        pendingRoots = [originalRoot];
        let p = parent[originalRoot][origElemRow];
        while (p !== -1) {
            pendingRoots.push(p);
            p = parent[p][origElemRow];
        }

        let cond1Cols: number[] = [];
        if (lnzRow > 0) {
            cond1Cols = this.getAncestorsAt(lastCol, lnzRow - 1);
        } else {
            let temp = lastCol;
            const vp = Array(cols).fill(-1);
            for (let c = 1; c < cols; c++) vp[c] = c - 1;
            while (temp !== -1) {
                cond1Cols.push(temp);
                temp = vp[temp];
            }
            cond1Cols = cond1Cols.filter((c) => c !== lastCol);
        }

        const ancestorsSet = new Set<number>();
        let q = parent[originalRoot][origElemRow];
        while (q !== -1) {
            ancestorsSet.add(q);
            q = parent[q][origElemRow];
        }
        const cond2Cols = new Set<number>();
        for (const anc of ancestorsSet) {
            cond2Cols.add(anc);
            for (let c = 0; c < cols; c++) {
                if (parent[c][origElemRow] === anc) {
                    cond2Cols.add(c);
                }
            }
        }

        const cond3Cols: number[] = [];
        for (let c = 0; c < cols; c++) {
            if (c === lastCol) continue;
            const genColC = WSM.getGenerationColumn(c, lnzRow, parent, lastCol);
            let contains = true;
            for (let r = 0; r < rows; r++) {
                const a = genColC[r];
                const b = genCol[r];
                if (a === -1) continue;
                if (a === b) continue;
                let isAncestor = false;
                let pp = b;
                while (pp !== -1) {
                    pp = parent[pp][r];
                    if (pp === a) {
                        isAncestor = true;
                        break;
                    }
                }
                if (!isAncestor) {
                    contains = false;
                    break;
                }
            }
            if (contains) cond3Cols.push(c);
        }

        const set1 = new Set(cond1Cols);
        const set2 = cond2Cols;
        const set3 = new Set(cond3Cols);
        for (const c of set1) {
            if (set2.has(c) && set3.has(c)) {
                candidateRoots.push(c);
            }
        }
        candidateRoots.sort((a, b) => a - b);
        if (!candidateRoots.includes(originalRoot)) {
            candidateRoots.push(originalRoot);
            candidateRoots.sort((a, b) => a - b);
        }
        pendingRoots = pendingRoots.filter((root) => candidateRoots.includes(root));

        trialResults[originalRoot] = origRootTrial;
        for (const cr of candidateRoots) {
            if (cr === originalRoot) continue;
            trialResults[cr] = this.trialExpand(cr, lnzRow, lastCol, genCol);
            const cmp = WSM.compareParentMatrices(trialResults[cr], origRootTrial);
            if (cmp < 0) {
                smallerRoots.push(cr);
            }
        }

        const sortedCandidates = [...candidateRoots].sort((a, b) => a - b);
        for (let i = sortedCandidates.length - 1; i >= 0; i--) {
            const cr = sortedCandidates[i];
            if (cr === originalRoot) continue;
            const cmp = WSM.compareParentMatrices(trialResults[cr], origRootTrial);
            if (cmp < 0) {
                smallRoot = cr;
                break;
            }
        }

        if (smallRoot !== -1) {
            let minRight = Infinity;
            for (const pr of pendingRoots) {
                if (pr > smallRoot && pr < minRight) {
                    minRight = pr;
                }
            }
            if (minRight !== Infinity) {
                badRoot = minRight;
            } else {
                badRoot = pendingRoots.length > 0 ? Math.min(...pendingRoots) : -1;
            }
        } else {
            badRoot = pendingRoots.length > 0 ? Math.min(...pendingRoots) : -1;
        }
        if (badRoot === -1) {
            badRoot = originalRoot;
        }

        let newParent = WSM.clone(parent);
        for (let r = 0; r < newParent[lastCol].length; r++) {
            if (r >= lnzRow) {
                newParent[lastCol][r] = genCol[r];
            }
        }

        if (badRoot + 1 <= lastCol) {
            const copyWidth = lastCol - badRoot;
            for (let k = 1; k <= times; k++) {
                const shiftAmount = k * copyWidth;
                const copied = WSM.copyColumns(newParent, badRoot, badRoot + 1, lastCol, shiftAmount);
                for (const col of copied) {
                    newParent.push(col);
                }
            }
        }

        newParent.pop();

        return {
            wsm: new WSM(newParent),
            badRoot: badRoot,
            candidateRoots: candidateRoots,
            trialResults: trialResults,
            originalRoot: originalRoot,
            lnzRow: lnzRow,
            lastCol: lastCol,
            genCol: genCol,
            smallerRoots: smallerRoots,
            pendingRoots: pendingRoots,
        };
    }

    format(): string {
        const value = this.toValue();
        return WSM.format(value);
    }

    toValue(): number[][] {
        const parentMat = this.parent;
        const valueMat = WSM.clone(parentMat);
        for (let c = 0; c < parentMat.length; c++) {
            for (let r = 0; r < parentMat[c].length; r++) {
                const p = parentMat[c][r];
                if (p === -1) {
                    valueMat[c][r] = 0;
                } else {
                    valueMat[c][r] = valueMat[p][r] + 1;
                }
            }
        }
        return valueMat;
    }

    toWorm(): number[] {
        const parent = this.parent;
        const cols = parent.length;
        if (cols === 0) return [];
        const rows = parent[0].length;
        const val = Array.from({ length: cols }, () => Array(rows).fill(0));

        const rTop = rows - 1;
        for (let c = 0; c < cols; c++) {
            const p = parent[c][rTop];
            if (p === -1) {
                val[c][rTop] = 1;
            } else {
                val[c][rTop] = val[p][rTop] + 1;
            }
        }

        for (let r = rows - 2; r >= 0; r--) {
            for (let c = 0; c < cols; c++) {
                const p = parent[c][r];
                if (p === -1) {
                    val[c][r] = 1;
                } else {
                    val[c][r] = val[p][r] + val[c][r + 1];
                }
            }
        }

        const worm: number[] = [];
        for (let c = 0; c < cols; c++) {
            worm.push(val[c][0]);
        }
        return worm;
    }
}

export const WSMv1_4_1: NotationDefinition<string> = {
    id: 'WSMv1.4.1',
    name: 'WSM v1.4.1',
    simple_name: 'WSM',

    category_id: 'category-bm-like',

    display: {
        plain: (a) => (is_infinity(a) ? 'Limit' : a),
        html: (a) => (is_infinity(a) ? 'Limit' : a),
        latex: (a) => (is_infinity(a) ? '\\text{Limit}' : a),
        from_display: (str) => (str === 'Limit' ? INFINITY : str),
    },

    display_equiv: {
        worm: {
            plain: (a) => {
                if (is_infinity(a)) return 'Limit';
                // a 是字符串，解析为 WSM 并转 worm
                const wsm = WSM.fromString(a);
                return wsm.toWorm().join(',');
            },
            html: (a) => {
                if (is_infinity(a)) return 'Limit';
                const wsm = WSM.fromString(a);
                return wsm.toWorm().join(',');
            },
        },
    },

    is_limit: (a) => {
        if (is_infinity(a)) return true;
        try {
            const wsm = WSM.fromString(a);
            const parent = wsm.parent;
            if (parent.length === 0) return false;
            const lastCol = parent.length - 1;
            for (let r = 0; r < parent[lastCol].length; r++) {
                if (parent[lastCol][r] !== -1) return true;
            }
            return false;
        } catch {
            return false;
        }
    },

    compare: (a, b) => {
        if (is_infinity(a) && is_infinity(b)) return 0;
        if (is_infinity(a)) return 1;
        if (is_infinity(b)) return -1;
        // 两者都是字符串
        try {
            const wsmA = WSM.fromString(a);
            const wsmB = WSM.fromString(b);
            return WSM.compareParentMatrices(wsmA.parent, wsmB.parent);
        } catch {
            return 0;
        }
    },

    FS: (a, i) => {
        if (is_infinity(a)) {
            // 构造特殊矩阵
            if (i === 0) return '';
            const parent: number[][] = [];
            const col0 = Array(i).fill(-1);
            const col1 = Array(i).fill(0);
            parent.push(col0);
            parent.push(col1);
            const wsm = new WSM(parent);
            return wsm.format();
        }
        try {
            const wsm = WSM.fromString(a);
            if (i === 0) {
                const newParent = wsm.parent.slice(0, -1);
                const newWsm = new WSM(newParent);
                return newWsm.format();
            }
            const result = wsm.expand(i);
            return result.wsm.format();
        } catch {
            return '';
        }
    },

    init: () => [INFINITY, ''],

    credit_text_id: 'credit.dsm',
};
