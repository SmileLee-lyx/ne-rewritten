import { compare, display, from_display, INFINITY, is_infinity, is_limit } from '@/notations/BM-like/BM.ts';
import { type NotationDefinition } from '@/notation-definition.ts';
import { Y_FS_variants } from '@/notations/notation_utils.ts';

// ============ Type Definitions ============

type Matrix = number[][];
type Position = { r: number; c: number };

// ============ Matrix Utilities ============

function is_last_col_zero(matrix: Matrix): boolean {
    if (matrix.length === 0) return true;
    const lastCol = matrix[matrix.length - 1];
    return lastCol.every((v) => v === 0);
}

function generate_limit_matrix(k: number): Matrix {
    const matrix: Matrix = [[0]];
    for (let i = 1; i < k; i++) {
        const col: number[] = [];
        for (let j = i; j >= 1; j--) {
            col.push(j);
        }
        matrix.push(col);
    }
    return matrix;
}

// ============ Parent / Predecessor / Expansion ============

function get_predecessor(parentsRM: number[][], r: number, c: number): Position | null {
    if (parentsRM[r][c] !== -1 || r === 0) return null;
    const upRow = r - 1;
    const chainCols: number[] = [];
    let currCol = parentsRM[upRow][c];
    while (currCol !== -1) {
        chainCols.push(currCol);
        currCol = parentsRM[upRow][currCol];
    }

    currCol = parentsRM[upRow][c];
    while (currCol !== -1) {
        if (parentsRM[upRow][currCol] !== -1 && parentsRM[r][currCol] === -1) {
            return { r, c: currCol };
        }
        const nextCol = parentsRM[upRow][currCol];
        if (nextCol === -1) {
            return { r: upRow, c: currCol };
        }
        currCol = nextCol;
    }
    return { r: upRow, c };
}

function construct_matrix_values(parentsColMajor: number[][]): Matrix {
    const cols = parentsColMajor.length;
    const rows = parentsColMajor[0].length;
    const matrix: Matrix = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const p = parentsColMajor[c][r];
            if (p === -1) {
                matrix[c][r] = 0;
            } else {
                matrix[c][r] = matrix[p][r] + 1;
            }
        }
    }
    return matrix;
}

function generate_expansion(
    parentsColMajor: number[][],
    badRow: number,
    badCol: number,
    times: number,
    strong: boolean,
): Matrix {
    const rows = parentsColMajor[0].length;
    const cols = parentsColMajor.length;
    const lastCol = cols - 1;

    let targetRow = -1;
    for (let r = rows - 1; r >= 0; r--) {
        if (parentsColMajor[lastCol][r] !== -1) {
            targetRow = r;
            break;
        }
    }

    const S = badCol;
    const E = lastCol;
    const segmentDist = E - S;
    let finalParentsMatrix: number[][] | null = null;

    // Convert to RowMajor for internal processing
    const parentsRM: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            parentsRM[r][c] = parentsColMajor[c][r];
        }
    }

    if (targetRow === badRow) {
        // Small Expansion
        const expandedParents_RM: number[][] = Array.from({ length: rows }, () => []);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                expandedParents_RM[r].push(parentsRM[r][c]);
            }
        }

        for (let i = 1; i <= times; i++) {
            const shiftAmount = i * segmentDist;
            for (let c = S; c <= E; c++) {
                const newC = c + shiftAmount;
                for (let r = 0; r < rows; r++) {
                    const originalParent = parentsRM[r][c];
                    let newParent = originalParent;

                    if (c === S && r < targetRow) {
                        newParent = parentsRM[r][E] + shiftAmount - segmentDist;
                    } else if (originalParent >= badCol) {
                        newParent = originalParent + shiftAmount;
                    }

                    while (expandedParents_RM[r].length <= newC) expandedParents_RM[r].push(-1);
                    expandedParents_RM[r][newC] = newParent;
                }
            }
        }

        finalParentsMatrix = Array.from({ length: expandedParents_RM[0].length }, () => Array(rows).fill(-1));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < expandedParents_RM[r].length; c++) {
                finalParentsMatrix[c][r] = expandedParents_RM[r][c];
            }
        }
    } else {
        // Full Expansion
        let resultRM: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                resultRM[r][c] = parentsRM[r][c];
            }
        }

        // Step 1: Upper part (Rows < targetRow)
        for (let i = 1; i <= times; i++) {
            const shiftAmount = i * segmentDist;
            for (let c = S + 1; c <= E; c++) {
                for (let r = 0; r < rows; r++) {
                    const originalParent = parentsRM[r][c];
                    let newParentVal = -1;

                    if (!(r === targetRow && c === E)) {
                        newParentVal = originalParent >= badCol ? originalParent + shiftAmount : originalParent;
                    }
                    resultRM[r].push(newParentVal);
                }
            }
        }
        const currentCols = resultRM[0].length;

        // Calculate Valid Candidates
        const parentCol = parentsRM[targetRow][lastCol];
        const validCandidates: Position[] = [];
        let scanNode: Position | null = { r: targetRow, c: parentCol };
        while (scanNode) {
            if (scanNode.r === badRow && scanNode.c > badCol) {
                validCandidates.push(scanNode);
            }
            const pred = get_predecessor(parentsRM, scanNode.r, scanNode.c);
            if (pred === null) break;
            scanNode = pred;
        }

        // Step 2: Identify Rising and Base Items
        const isRising: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
        const isBase: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

        isRising[badRow][badCol] = true;
        let changed = true;
        while (changed) {
            changed = false;
            for (let r = badRow; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (isRising[r][c]) continue;
                    let becomeRising = false;
                    if (r === badRow && strong) {
                        const lowerParent = badRow > 0 ? parentsRM[badRow - 1][c] : c - 1;
                        if (lowerParent !== -1 && isRising[r][lowerParent]) becomeRising = true;
                    }
                    const p = parentsRM[r][c];
                    if (p !== -1 && isRising[r][p]) becomeRising = true;
                    if (!becomeRising && r > badRow) {
                        const upP = parentsRM[r - 1][c];
                        if (upP !== -1 && isRising[r - 1][upP]) becomeRising = true;
                    }
                    if (!becomeRising && r < rows - 1) {
                        if (isRising[r + 1][c]) becomeRising = true;
                    }
                    if (becomeRising) {
                        isRising[r][c] = true;
                        changed = true;
                    }
                }
            }
        }

        const queueBase: number[] = [];
        for (let c = 0; c < cols; c++) {
            if (strong) {
                const lowerParent = badRow > 0 ? parentsRM[badRow - 1][c] : c - 1;
                if (lowerParent === badCol) {
                    isBase[badRow][c] = true;
                }
            } else {
                if (parentsRM[badRow][c] === badCol) {
                    isBase[badRow][c] = true;
                }
            }
            if (isBase[badRow][c]) {
                queueBase.push(c);
            }
        }
        while (queueBase.length > 0) {
            const currParentCol = queueBase.shift()!;
            for (let c = 0; c < cols; c++) {
                if (strong) {
                    const lowerParent = badRow > 0 ? parentsRM[badRow - 1][c] : c - 1;
                    if (lowerParent === currParentCol && !isBase[badRow][c]) {
                        isBase[badRow][c] = true;
                        queueBase.push(c);
                    }
                } else {
                    if (parentsRM[badRow][c] === currParentCol && !isBase[badRow][c]) {
                        isBase[badRow][c] = true;
                        queueBase.push(c);
                    }
                }
            }
        }

        // Step 3: Rising Expansion
        const R = targetRow - badRow;
        const C = lastCol - badCol;
        const finalRows = rows + R * times;
        const finalCols = currentCols;

        for (let r = rows; r < finalRows; r++) {
            resultRM.push(Array(finalCols).fill(-1));
        }

        for (let i = 1; i <= times; i++) {
            const rowShift = R * i;
            const colShift = C * i;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (isRising[r][c]) {
                        const newR = r + rowShift;
                        const newC = c + colShift;
                        let val = parentsRM[r][c];
                        if (val !== -1) val = val + colShift;
                        resultRM[newR][newC] = val;
                    }
                }
            }

            for (let c = 0; c < cols; c++) {
                if (isBase[badRow][c]) {
                    const newC = c + colShift;

                    let baseParent: number;
                    if (strong) {
                        baseParent = badRow > 0 ? parentsRM[badRow - 1][c] : c - 1;
                    } else {
                        baseParent = parentsRM[badRow][c];
                    }

                    const newBaseParent = baseParent !== -1 ? baseParent + colShift : -1;

                    for (let k = 0; k < rowShift; k++) {
                        const newR = badRow + k;
                        resultRM[newR][newC] = newBaseParent;
                    }
                }
            }
        }

        finalParentsMatrix = Array.from({ length: resultRM[0].length }, () => Array(resultRM.length).fill(-1));
        for (let r = 0; r < resultRM.length; r++) {
            for (let c = 0; c < resultRM[0].length; c++) {
                finalParentsMatrix[c][r] = resultRM[r][c];
            }
        }
    }

    return construct_matrix_values(finalParentsMatrix!);
}

function get_bad_item_info(matrix: Matrix): {
    targetRow: number;
    parentCol: number;
    badItem: Position;
    parentsColMajor: number[][];
} | null {
    if (!matrix || matrix.length === 0) return null;
    const cols = matrix.length;
    const rows = Math.max(...matrix.map((c) => c.length));

    // Convert to RowMajor
    const matrixRM: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            matrixRM[r][c] = r < matrix[c].length ? matrix[c][r] : 0;
        }
    }

    // Calculate strict parents (RowMajor)
    const parentsRM: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
    for (let c = 1; c < cols; c++) {
        const val = matrixRM[0][c];
        for (let k = c - 1; k >= 0; k--) {
            if (matrixRM[0][k] < val) {
                parentsRM[0][c] = k;
                break;
            }
        }
    }
    for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const val = matrixRM[r][c];
            let chainIndex: number | null = c;
            while (chainIndex !== null) {
                if (chainIndex !== c && matrixRM[r][chainIndex] < val) {
                    parentsRM[r][c] = chainIndex;
                    break;
                }
                chainIndex = chainIndex !== -1 ? parentsRM[r - 1][chainIndex] : null;
            }
        }
    }

    // Find target item: largest row in last col with parent
    let targetRow = -1;
    const targetCol = cols - 1;
    for (let r = rows - 1; r >= 0; r--) {
        if (parentsRM[r][targetCol] !== -1) {
            targetRow = r;
            break;
        }
    }
    if (targetRow === -1) return null;

    const parentCol = parentsRM[targetRow][targetCol];
    if (parentCol === -1) return null;

    // Build candidates pool and options
    const candidatesPool: Position[] = [];
    const options: Position[] = [];
    let currItem: Position = { r: targetRow, c: parentCol };
    candidatesPool.push(currItem);
    options.push(currItem);

    let pred = get_predecessor(parentsRM, currItem.r, currItem.c);
    while (pred !== null) {
        candidatesPool.push(pred);
        currItem = pred;
        pred = get_predecessor(parentsRM, currItem.r, currItem.c);
    }

    candidatesPool.sort((a, b) => b.c - a.c);

    let prevItemForOptions: Position = { r: targetRow, c: targetCol };
    for (const item of candidatesPool) {
        if (item.r < prevItemForOptions.r) {
            options.push(item);
            prevItemForOptions = item;
        }
    }

    // Convert to ColMajor parent matrix
    const parentsColMajor: number[][] = Array.from({ length: cols }, () => Array(rows).fill(-1));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            parentsColMajor[c][r] = parentsRM[r][c];
        }
    }

    // Calculate standard segment using target parent
    const standardSeg = generate_expansion(parentsColMajor, targetRow, parentCol, 1, true);

    // Find bad item
    let badItem: Position | null = null;
    let foundBadItem = false;
    for (const cand of candidatesPool) {
        const candSeg = generate_expansion(parentsColMajor, cand.r, cand.c, 1, true);
        const cmp = compare(candSeg, standardSeg);

        if (cmp < 0) {
            const rightOptions = options.filter((opt) => opt.c > cand.c);
            if (rightOptions.length > 0) {
                rightOptions.sort((a, b) => a.c - b.c);
                badItem = rightOptions[0];
            } else {
                badItem = options[options.length - 1];
            }
            foundBadItem = true;
            break;
        }
    }

    if (!foundBadItem) {
        badItem = options[options.length - 1];
    }

    return { targetRow, parentCol, badItem: badItem!, parentsColMajor };
}

function expand_normal(matrix: Matrix, times: number): Matrix {
    if (!matrix || matrix.length === 0) return [];

    const cols = matrix.length;
    const isLastColZero = matrix[cols - 1].every((val) => val === 0);
    if (isLastColZero) return matrix.slice(0, cols - 1);

    const info = get_bad_item_info(matrix);
    if (!info) return [];

    const { badItem, parentsColMajor } = info;
    const fullExpandedMatrix = generate_expansion(parentsColMajor, badItem.r, badItem.c, times, false);
    fullExpandedMatrix.pop();
    return fullExpandedMatrix;
}

// ============ Definition ============

export const DSM: NotationDefinition<Matrix> = {
    id: 'dsm',
    name: 'Diagonal Sudden Matrix',
    simple_name: 'DSM',
    category_id: 'category-bm-like',
    display: {
        plain: display,
        from_display,
    },
    is_limit,
    compare,
    ...Y_FS_variants(expand_normal, is_infinity, generate_limit_matrix, is_limit, display),
    credit_text_id: 'credit.dsm',
    init: () => [INFINITY(), []],
};
