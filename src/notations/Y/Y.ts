import { deepcopy, lex_compare, number_compare } from '@/utils.ts';
import { is_limit, sequence_display, sequence_from_display } from '@/notations/Y/Omega_Y.ts';
import { NotationDefinition } from '@/notation-definition.ts';

export type Expr = number[];

interface Entry {
    value: number;
    position: number;
    parentIndex: number;
    forcedParent?: boolean;
}

type Row = Entry[];
type Mountain = Row[];

function parseSequenceElement(s: string, i: number): Entry {
    if (s.indexOf('v') == -1 || !isFinite(Number(s.substring(s.indexOf('v') + 1)))) {
        return {
            value: Number(s),
            position: i,
            parentIndex: -1,
        };
    } else {
        return {
            value: Number(s.substring(0, s.indexOf('v'))),
            position: i,
            parentIndex: Math.max(Math.min(i - 1, Number(s.substring(s.indexOf('v') + 1))), -1),
            forcedParent: true,
        };
    }
}

const FS_Y = (() => {
    //FS code by Naruyoko
    const itemSeparatorRegex = /[\t ,]/g;

    function calcMountain(s: string | Row): Mountain {
        let lastLayer: Row;
        if (typeof s == 'string') {
            lastLayer = s.split(itemSeparatorRegex).map(parseSequenceElement);
        } else lastLayer = s;
        const calculatedMountain = [lastLayer];
        while (true) {
            //assign parents
            let hasNextLayer = false;
            for (let i = 0; i < lastLayer.length; i++) {
                if (lastLayer[i].forcedParent) {
                    if (lastLayer[i].parentIndex != -1) hasNextLayer = true;
                    continue;
                }
                let p;
                if (calculatedMountain.length == 1) {
                    p = lastLayer[i].position + 1;
                } else {
                    p = 0;
                    while (calculatedMountain[calculatedMountain.length - 2][p].position < lastLayer[i].position + 1)
                        p++;
                }
                while (true) {
                    if (p < 0) break;
                    let j;
                    if (calculatedMountain.length == 1) {
                        p--;
                        j = p - 1;
                    } else {
                        //ignoring
                        p = calculatedMountain[calculatedMountain.length - 2][p].parentIndex;
                        if (p < 0) break;
                        j = 0;
                        while (
                            lastLayer[j].position <
                            calculatedMountain[calculatedMountain.length - 2][p].position - 1
                        )
                            j++;
                    }
                    if (j < 0 || (j < lastLayer.length - 1 && lastLayer[j].position + 1 != lastLayer[j + 1].position))
                        break;
                    if (lastLayer[j].value < lastLayer[i].value) {
                        lastLayer[i].parentIndex = j;
                        hasNextLayer = true;
                        break;
                    }
                }
            }
            if (!hasNextLayer) break;
            const currentLayer: Row = [];
            calculatedMountain.push(currentLayer);
            for (let i = 0; i < lastLayer.length; i++) {
                if (lastLayer[i].parentIndex != -1) {
                    currentLayer.push({
                        value: lastLayer[i].value - lastLayer[lastLayer[i].parentIndex].value,
                        position: lastLayer[i].position - 1,
                        parentIndex: -1,
                    });
                }
            }
            lastLayer = currentLayer;
        }
        return calculatedMountain;
    }

    function calcDiagonal(mountain: Mountain) {
        const diagonal = [];
        const diagonalTree = [];
        for (let i = 0; i < mountain[0].length; i++) {
            //only one diagonal exists for each left-side-up diagonal line
            for (let j = mountain.length - 1; j >= 0; j--) {
                //prioritize the top
                let k = 0;
                while (mountain[j][k] && mountain[j][k].position + j < i) k++;
                if (!mountain[j][k] || mountain[j][k].position + j != i) continue;
                let height = j;
                let lastIndex = k;
                while (true) {
                    if (height == 0) {
                        lastIndex = mountain[height][lastIndex].parentIndex;
                    } else {
                        let l = 0; //find right-down
                        while (mountain[height - 1][l].position != mountain[height][lastIndex].position + 1) l++;
                        l = mountain[height - 1][l].parentIndex; //go to its parent=left-down
                        let m = 0; //find up-left of that=left
                        while (mountain[height][m].position < mountain[height - 1][l].position - 1) m++;
                        if (mountain[height][m].position == mountain[height - 1][l].position - 1) {
                            //left exists
                            lastIndex = m;
                        } else {
                            height--;
                            lastIndex = l;
                        }
                    }
                    if (!mountain[height][lastIndex] || mountain[height][lastIndex].parentIndex == -1) {
                        diagonal.push(mountain[j][k].value);
                        diagonalTree.push(
                            (mountain[height][lastIndex] ? mountain[height][lastIndex].position : -1) + height,
                        );
                        break;
                    }
                }
                break;
            }
        }
        const pw: number[] = [];
        for (let i = 0; i < diagonal.length; i++) {
            let p = -1;
            for (let j = i - 1; j >= 0; j--) {
                if (diagonal[j] < diagonal[i]) {
                    p = j;
                    break;
                }
            }
            pw.push(p);
        }
        const r: string[] = [];
        for (let i = 0; i < diagonal.length; i++) {
            let p = i;
            while (true) {
                p = diagonalTree[p];
                if (p < 0 || diagonal[p] < diagonal[i]) break;
            }
            if (p == pw[i]) r.push('' + diagonal[i]);
            else r.push(diagonal[i] + 'v' + p);
        }
        //console.log(diagonalTree);
        return r.join(',');
    }

    function getBadRoot(s: string | Mountain): number {
        let mountain: Mountain;
        if (typeof s == 'string') mountain = calcMountain(s);
        else mountain = deepcopy(s);
        const diagonal = calcMountain(calcDiagonal(mountain));
        if (diagonal[0][diagonal[0].length - 1].value != 1) {
            return getBadRoot(diagonal);
        } else {
            for (let i = mountain.length - 1; i >= 0; i--) {
                if (mountain[i][mountain[i].length - 1].position + i == mountain[0].length - 1)
                    return mountain[i - 1][mountain[i - 1][mountain[i - 1].length - 1].parentIndex].position + i - 1;
            }
        }
        return NaN;
    }

    function expand(s: string | Mountain, n: number, stringify: boolean) {
        let mountain: Mountain;
        if (typeof s == 'string') mountain = calcMountain(s);
        else mountain = deepcopy(s);
        let result = deepcopy(mountain);
        if (mountain[0][mountain[0].length - 1].parentIndex == -1) {
            result[0].pop();
        } else {
            let cutHeight = mountain.length - 1;
            while (mountain[cutHeight][mountain[cutHeight].length - 1].position + cutHeight != mountain[0].length - 1)
                cutHeight--;
            const actualCutHeight = cutHeight;
            const badRootSeam = getBadRoot(mountain);
            let badRootHeight;
            const diagonal = calcMountain(calcDiagonal(mountain));
            let newDiagonal: Mountain;
            const yamakazi = diagonal[0][diagonal[0].length - 1].value == 1; //Yamakazi-Funka duality
            if (yamakazi) {
                newDiagonal = deepcopy(diagonal);
                newDiagonal[0].pop();
                for (let i = 0; i < n; i++) {
                    for (let j = badRootSeam; j < mountain[0].length - 1; j++) {
                        newDiagonal[0].push(newDiagonal[0][j]); //who cares about mountains in diagonal?
                    }
                }
                cutHeight--;
                badRootHeight = cutHeight;
            } else {
                newDiagonal = expand(diagonal, n, false) as Mountain;
                badRootHeight = mountain.length - 1;
                while (true) {
                    let i = 0;
                    while (
                        mountain[badRootHeight][i] &&
                        mountain[badRootHeight][i].position + badRootHeight < badRootSeam
                    )
                        i++;
                    if (
                        mountain[badRootHeight][i] &&
                        mountain[badRootHeight][i].position + badRootHeight == badRootSeam
                    )
                        break;
                    badRootHeight--;
                }
            }
            for (let i = 0; i <= actualCutHeight; i++) result[i].pop(); //cut child
            if (!result[result.length - 1].length) result.pop();
            const afterCutHeight = result.length;
            const afterCutLength = result[0].length;
            let badRootSeamHeight = afterCutHeight - 1;
            while (true) {
                let l = 0;
                while (
                    mountain[badRootSeamHeight][l] &&
                    mountain[badRootSeamHeight][l].position + badRootSeamHeight < badRootSeam
                )
                    l++;
                if (
                    mountain[badRootSeamHeight][l] &&
                    mountain[badRootSeamHeight][l].position + badRootSeamHeight == badRootSeam
                )
                    break;
                badRootSeamHeight--;
            }
            badRootSeamHeight++;
            //Create Mt.Fuji shell
            for (let i = 1; i <= n; i++) {
                //iteration
                for (let j = badRootSeam; j < afterCutLength; j++) {
                    //seam
                    let isAscending;
                    let p = 0; //simplified; may not work
                    while (mountain[badRootHeight][p].position + badRootHeight < j) p++;
                    if (mountain[badRootHeight][p].position + badRootHeight == j) {
                        while (true) {
                            if (
                                !mountain[badRootHeight][p] ||
                                mountain[badRootHeight][p].position + badRootHeight < badRootSeam
                            ) {
                                isAscending = false;
                                break;
                            }
                            if (mountain[badRootHeight][p].position + badRootHeight == badRootSeam) {
                                isAscending = true;
                                break;
                            }
                            p = mountain[badRootHeight][p].parentIndex;
                        }
                    } else {
                        isAscending = false;
                    }
                    let seamHeight = afterCutHeight - 1;
                    while (true) {
                        let l = 0;
                        while (mountain[seamHeight][l] && mountain[seamHeight][l].position + seamHeight < j) l++;
                        if (mountain[seamHeight][l] && mountain[seamHeight][l].position + seamHeight == j) break;
                        seamHeight--;
                    }
                    seamHeight++;
                    const isReplacingCut = j == badRootSeam;
                    //console.log([j,seamHeight]);
                    if (isAscending) {
                        for (let k = 0; k < seamHeight + (cutHeight - badRootHeight) * i; k++) {
                            if (!result[k]) result.push([]);
                            if (k < badRootHeight) {
                                //Bb
                                let sy = k;
                                let sx;
                                if (isReplacingCut) {
                                    sx = mountain[sy].length - 1;
                                } else {
                                    sx = 0;
                                    while (mountain[sy][sx].position + sy < j) sx++;
                                }
                                const sourceParentIndex = mountain[sy][sx].parentIndex;
                                const parentShifts = i - (isReplacingCut ? 1 : 0);
                                const parentPosition = mountain[sy][sourceParentIndex]
                                    ? mountain[sy][sourceParentIndex].position +
                                      parentShifts *
                                          (afterCutLength - badRootSeam) *
                                          (mountain[sy][sourceParentIndex].position + sy >= badRootSeam ? 1 : 0) -
                                      (k - sy)
                                    : -1;
                                let parentIndex = 0;
                                while (result[k][parentIndex] && result[k][parentIndex].position < parentPosition)
                                    parentIndex++;
                                if (!result[k][parentIndex] || result[k][parentIndex].position != parentPosition)
                                    parentIndex = -1;
                                result[k].push({
                                    value:
                                        parentIndex == -1
                                            ? newDiagonal[0][j + (afterCutLength - badRootSeam) * i].value
                                            : NaN,
                                    position: j + (afterCutLength - badRootSeam) * i - k,
                                    parentIndex: parentIndex,
                                    forcedParent: mountain[sy][sx].forcedParent,
                                });
                            } else if (
                                k <=
                                badRootHeight + (cutHeight - badRootHeight) * (i - (isReplacingCut ? 1 : 0))
                            ) {
                                //Br replace
                                let sy = badRootHeight;
                                let sx;
                                if (!yamakazi && isReplacingCut) {
                                    sx = mountain[sy].length - 1;
                                } else {
                                    sx = 0;
                                    while (mountain[sy][sx].position + sy < j) sx++;
                                }
                                const sourceParentIndex = mountain[sy][sx].parentIndex;
                                const parentShifts = i - (isReplacingCut ? 1 : 0);
                                const parentPosition = mountain[sy][sourceParentIndex]
                                    ? mountain[sy][sourceParentIndex].position +
                                      parentShifts *
                                          (afterCutLength - badRootSeam) *
                                          (mountain[sy][sourceParentIndex].position + sy >= badRootSeam ? 1 : 0) -
                                      (k - sy)
                                    : -1;
                                let parentIndex = 0;
                                while (result[k][parentIndex] && result[k][parentIndex].position < parentPosition)
                                    parentIndex++;
                                if (!result[k][parentIndex] || result[k][parentIndex].position != parentPosition)
                                    parentIndex = -1;
                                result[k].push({
                                    value:
                                        parentIndex == -1
                                            ? newDiagonal[0][j + (afterCutLength - badRootSeam) * i].value
                                            : NaN,
                                    position: j + (afterCutLength - badRootSeam) * i - k,
                                    parentIndex: parentIndex,
                                    forcedParent: mountain[sy][sx].forcedParent,
                                });
                            } else if (isReplacingCut && k <= badRootHeight + (cutHeight - badRootHeight) * i) {
                                //Br extend
                                let sy = k - (cutHeight - badRootHeight) * (i - 1);
                                let sx;
                                if (!yamakazi && isReplacingCut) {
                                    sx = mountain[sy].length - 1;
                                } else {
                                    sx = 0;
                                    while (mountain[sy][sx].position + sy < j) sx++;
                                }
                                const sourceParentIndex = mountain[sy][sx].parentIndex;
                                const parentShifts = i - (isReplacingCut ? 1 : 0);
                                const parentPosition = mountain[sy][sourceParentIndex]
                                    ? mountain[sy][sourceParentIndex].position +
                                      parentShifts *
                                          (afterCutLength - badRootSeam) *
                                          (mountain[sy][sourceParentIndex].position + sy >= badRootSeam ? 1 : 0) -
                                      (k - sy)
                                    : -1;
                                let parentIndex = 0;
                                while (result[k][parentIndex] && result[k][parentIndex].position < parentPosition)
                                    parentIndex++;
                                if (!result[k][parentIndex] || result[k][parentIndex].position != parentPosition)
                                    parentIndex = -1;
                                result[k].push({
                                    value:
                                        parentIndex == -1
                                            ? newDiagonal[0][j + (afterCutLength - badRootSeam) * i].value
                                            : NaN,
                                    position: j + (afterCutLength - badRootSeam) * i - k,
                                    parentIndex: parentIndex,
                                    forcedParent: mountain[sy][sx].forcedParent,
                                });
                            } else {
                                //Be
                                //if (isReplacingCut) console.warn("Climbing doesn't all the way. Makes sense.");
                                let sy = k - (cutHeight - badRootHeight) * i;
                                let sx;
                                if (!yamakazi && isReplacingCut) {
                                    sx = mountain[sy].length - 1;
                                } else {
                                    sx = 0;
                                    while (mountain[sy][sx].position + sy < j) sx++;
                                }
                                const sourceParentIndex = mountain[sy][sx].parentIndex;
                                const parentShifts = i - (isReplacingCut ? 1 : 0);
                                const parentPosition = mountain[sy][sourceParentIndex]
                                    ? mountain[sy][sourceParentIndex].position +
                                      parentShifts *
                                          (afterCutLength - badRootSeam) *
                                          (mountain[sy][sourceParentIndex].position + sy >= badRootSeam ? 1 : 0) -
                                      (k - sy)
                                    : -1;
                                let parentIndex = 0;
                                while (result[k][parentIndex] && result[k][parentIndex].position < parentPosition)
                                    parentIndex++;
                                if (!result[k][parentIndex] || result[k][parentIndex].position != parentPosition)
                                    parentIndex = -1;
                                result[k].push({
                                    value:
                                        parentIndex == -1
                                            ? newDiagonal[0][j + (afterCutLength - badRootSeam) * i].value
                                            : NaN,
                                    position: j + (afterCutLength - badRootSeam) * i - k,
                                    parentIndex: parentIndex,
                                    forcedParent: mountain[sy][sx].forcedParent,
                                });
                            }
                        }
                    } else {
                        if (isReplacingCut) console.warn('Cut child and not connected to bad root. Makes sense.');
                        for (let k = 0; k < seamHeight; k++) {
                            if (!result[k]) result.push([]);
                            //Bb
                            let sy = k;
                            let sx;
                            if (isReplacingCut) {
                                sx = mountain[sy].length - 1;
                            } else {
                                sx = 0;
                                while (mountain[sy][sx].position + sy < j) sx++;
                            }
                            const sourceParentIndex = mountain[sy][sx].parentIndex;
                            const parentShifts = i - (isReplacingCut ? 1 : 0);
                            const parentPosition = mountain[sy][sourceParentIndex]
                                ? mountain[sy][sourceParentIndex].position +
                                  parentShifts *
                                      (afterCutLength - badRootSeam) *
                                      (mountain[sy][sourceParentIndex].position + sy >= badRootSeam ? 1 : 0) -
                                  (k - sy)
                                : -1;
                            let parentIndex = 0;
                            while (result[k][parentIndex] && result[k][parentIndex].position < parentPosition)
                                parentIndex++;
                            if (!result[k][parentIndex] || result[k][parentIndex].position != parentPosition)
                                parentIndex = -1;
                            result[k].push({
                                value:
                                    parentIndex == -1
                                        ? newDiagonal[0][j + (afterCutLength - badRootSeam) * i].value
                                        : NaN,
                                position: j + (afterCutLength - badRootSeam) * i - k,
                                parentIndex: parentIndex,
                                forcedParent: mountain[sy][sx].forcedParent,
                            });
                        }
                    }
                }
            }
        }
        //Build number from ltr, ttb
        for (let i = result.length - 1; i >= 0; i--) {
            if (!result[i].length) {
                result.pop();
                continue;
            }
            for (let j = 0; j < result[i].length; j++) {
                if (!isNaN(result[i][j].value)) continue;
                let k = 0; //find left-up
                while (result[i + 1][k].position < result[i][j].position - 1) k++;
                if (result[i + 1][k].position !== result[i][j].position - 1) throw Error('Mountain not complete');
                result[i][j].value = result[i][result[i][j].parentIndex].value + result[i + 1][k].value;
            }
        }
        let rr;
        if (stringify) {
            rr = [];
            for (let i = 0; result[0] && i < result[0].length; i++) {
                rr.push(result[0][i].value + (result[0][i].forcedParent ? 'v' + result[0][i].parentIndex : ''));
            }
            rr = rr.join(',');
        } else {
            rr = result;
        }
        return rr;
    }

    //Naruyoko's code ends here
    return (seq: Expr, index: number) => {
        if ('' + seq === 'Infinity') return [1, 1 + index];
        return (expand('' + seq, index, true) as string).split(',').map((e) => +e);
    };
})();

const data: Record<string, Expr[]> = {};

export const Y_seq: NotationDefinition<Expr> = {
    id: 'y-seq',
    name: 'Y sequence',
    simple_name: 'Y',
    category_id: 'category-y',
    display: { plain: sequence_display, from_display: sequence_from_display },
    is_limit: is_limit,
    compare: (a, b) => lex_compare(a, b, number_compare),
    FS: (m: Expr, index: number): Expr => {
        const key = '' + m;
        if (key === 'Infinity') return [1, 1 + index];
        if (!data[key]) data[key] = [];
        else if (data[key][index] !== undefined) return data[key][index];
        return (data[key][index] = FS_Y(m, index));
    },
    credit_text_id: 'credit.yukito',

    init: () => [[Infinity], [1], []],
};
