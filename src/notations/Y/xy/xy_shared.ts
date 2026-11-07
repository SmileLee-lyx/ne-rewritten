
export interface RowLike {
    row: number[];
    parent: RowLike | null;
    value: number;
}

/** 字典序比较两行: 先比长度(短 < 长), 长度相同再逐元素。r1<r2 返回 -1, 相等 0, r1>r2 返回 1。 */
export function compareRow(r1: number[], r2: number[]): number {
    if (r1.length < r2.length) return -1;
    if (r1.length > r2.length) return 1;
    for (let k = 0; k < r1.length; k++) {
        if (r1[k] < r2[k]) return -1;
        if (r1[k] > r2[k]) return 1;
    }
    return 0;
}

/** 行加法: 与 v1/v2 的 rowAddition 一致(按尾部对齐)。 */
export function rowAddition(r1: number[], r2: number[]): number[] {
    if (r1.length < r2.length) return r2.slice();
    if (r2.length === 0) return r1.slice();
    const k = r1.length - r2.length;
    const b = r2.slice();
    b[0] += r1[k];
    return r1.slice(0, k).concat(b);
}

/** 行减法: 与 v1/v2 的 rowDifference 一致。r1<=r2 返回空行; r1 更长时返回 r1。 */
export function rowDifference(r1: number[], r2: number[]): number[] {
    if (r1.length > r2.length) return r1.slice();
    if (compareRow(r1, r2) <= 0) return [];
    let i = 0;
    while (i < r1.length && i < r2.length && r1[i] === r2[i]) i++;
    const row: number[] = [r1[i] - r2[i]];
    for (let k = i + 1; k < r1.length; k++) row.push(r1[k]);
    return row;
}

/** 计算给定元素"脚"所在的行。 */
export function getFootRow(it: RowLike, d: number[]): number[] {
    const row = [1];
    let diff = 0;
    if (it.parent != null) {
        diff = rowDifference(it.row, it.parent.row).length;
    }
    if (compareRow(d, [0]) > 0) {
        while (diff-- > 0) row.push(0);
    }
    return rowAddition(it.row, row);
}

/** n-Y 的一维限制(X-Y 用 d=[1,0,1] 恒为 false, 保留以忠实移植)。 */
export function isDimensionLimited(it: RowLike, d: number[]): boolean {
    return (
        d.length === 1 &&
        it.row.length === d[0] &&
        (it.parent == null ||
            it.parent.row.length < d[0] ||
            it.row[0] > it.parent.row[0])
    );
}
