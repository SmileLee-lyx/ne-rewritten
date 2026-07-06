import { NotationDefinition } from '@/notation-definition.ts';
import { boolean_compare, deepcopy, lex_compare, number_compare, object_lex_compare_by } from '@/utils.ts';

type Entry = { value: number; starred: boolean };
export type Expr = Entry[];

export const INFINITY: Expr = Symbol('infinity') as any;

export function is_infinity(e: Expr): boolean {
    return e === INFINITY;
}

export function infinity_FS(index: number): Expr {
    return Array.from({ length: index }, (_, i) => ({ value: i, starred: i >= 2 }));
}

function parseSequence(str: string): Expr {
    if (!str.trim()) return [];
    const parts = str.split(',').map((s) => s.trim());
    return parts.map((part) => {
        let starred = false;
        if (part.endsWith('*')) {
            starred = true;
            part = part.slice(0, -1);
        }
        const value = parseInt(part, 10);
        if (isNaN(value)) throw new Error(`无效数字: ${part}`);
        return { value, starred };
    });
}

function formatSequence(seq: Expr): string {
    if (is_infinity(seq)) return 'Limit';
    return seq.map((item) => (item.starred ? item.value + '*' : '' + item.value)).join(', ');
}

function extractValues(seq: Expr): number[] {
    return seq.map((item) => item.value);
}

// ========== 基础算法 ==========
function computeLeftLess(values: number[]): number[] {
    const n = values.length;
    const leftLess = new Array<number>(n).fill(-1);
    const stack: number[] = [];
    for (let i = 0; i < n; i++) {
        while (stack.length && values[stack[stack.length - 1]] >= values[i]) stack.pop();
        leftLess[i] = stack.length ? stack[stack.length - 1] : -1;
        stack.push(i);
    }
    return leftLess;
}

function getAncestorChain(seq: Expr, leftLess: number[]): number[] {
    const chain: number[] = [];
    let idx = seq.length - 1;
    while (idx !== -1) {
        chain.push(idx);
        if (idx === 0) break;
        idx = leftLess[idx];
    }
    chain.reverse();
    return chain;
}

function getDirectItemSet(seq: Expr, leftLess: number[], startIdx: number): Set<number> {
    const n = seq.length;
    const directSet = new Set<number>();
    directSet.add(startIdx);
    for (let j = startIdx + 1; j < n; j++) {
        const parent = leftLess[j];
        if (parent === -1) continue;
        if (seq[j].starred && directSet.has(parent)) {
            directSet.add(j);
        }
    }
    return directSet;
}

function getDirectSegmentIndices(seq: Expr, leftLess: number[], startIdx: number): number[] {
    const directSet = getDirectItemSet(seq, leftLess, startIdx);
    if (directSet.size === 0) return [startIdx];
    const maxDirectIdx = Math.max(...directSet);
    let candidateIdx = -1;
    let candidateValue = Infinity;
    for (let i = maxDirectIdx + 1; i < seq.length; i++) {
        if (!directSet.has(i)) {
            const parent = leftLess[i];
            if (parent !== -1 && directSet.has(parent)) {
                const val = seq[i].value;
                if (val < candidateValue) {
                    candidateValue = val;
                    candidateIdx = i;
                }
            }
        }
    }
    if (candidateIdx !== -1) {
        const stopIdx = candidateIdx > maxDirectIdx ? candidateIdx : maxDirectIdx;
        const segment: number[] = [];
        for (let i = startIdx; i <= stopIdx; i++) segment.push(i);
        return segment;
    } else {
        const segment: number[] = [];
        for (let i = startIdx; i <= maxDirectIdx; i++) segment.push(i);
        return segment;
    }
}

function getDirectSegmentAsSeq(seq: Expr, leftLess: number[], startIdx: number): Expr {
    return getDirectSegmentIndices(seq, leftLess, startIdx).map((i) => ({ ...seq[i] }));
}

function getDirectSegmentRange(seq: Expr, leftLess: number[], startIdx: number): { start: number; end: number } {
    const indices = getDirectSegmentIndices(seq, leftLess, startIdx);
    if (indices.length === 0) return { start: startIdx, end: startIdx };
    return { start: indices[0], end: indices[indices.length - 1] };
}

function ensureLastStarred(seq: Expr): Expr {
    const newSeq = deepcopy(seq);
    if (newSeq.length && !newSeq[newSeq.length - 1].starred) newSeq[newSeq.length - 1].starred = true;
    return newSeq;
}

function normalize(seq: Expr): Expr {
    if (!seq.length) return [];
    const base = seq[0].value;
    return seq.map((item) => ({ value: item.value - base, starred: item.starred }));
}

function getSubseq(seq: Expr, chain: number[], k: number): Expr {
    const start = chain[k];
    const sub = deepcopy(seq.slice(start));
    if (sub.length) sub[0].starred = false;
    return sub;
}

// ========== 投影比较 ==========
function compareProjectionRaw(a: Expr, b: Expr): number {
    const a2 = ensureLastStarred(a),
        b2 = ensureLastStarred(b);
    const vA = extractValues(a2),
        vB = extractValues(b2);
    const llA = computeLeftLess(vA),
        llB = computeLeftLess(vB);
    const chainA = getAncestorChain(a2, llA),
        chainB = getAncestorChain(b2, llB);
    const sA = chainA.length - 1,
        sB = chainB.length - 1;
    if (sA !== sB) return sA - sB;
    if (sA === 0) return 0;

    const subA = getSubseq(a2, chainA, sA - 1),
        subB = getSubseq(b2, chainB, sB - 1);

    const normA = normalize(subA),
        normB = normalize(subB);
    return compare(normA, normB);
}

function isDirectSegmentLess(a: Expr, b: Expr): boolean {
    const a2 = normalize(ensureLastStarred(a));
    const b2 = normalize(ensureLastStarred(b));
    const minLen = Math.min(a2.length, b2.length);
    for (let i = 0; i < minLen; i++) {
        if (a2[i].value !== b2[i].value) return a2[i].value < b2[i].value;
        if (a2[i].starred !== b2[i].starred) return a2[i].starred < b2[i].starred;
    }
    return a2.length < b2.length;
}

// ========== 父段映射 ==========
function buildParentSegmentMap(seq: Expr, leftLess: number[]): Map<number, number> {
    const n = seq.length;
    const parentSegment = new Map<number, number>();
    for (let i = 0; i < n; i++) {
        if (seq[i].starred) continue;
        let p = leftLess[i];
        while (p !== -1 && seq[p].starred) {
            p = leftLess[p];
        }
        if (p !== -1) {
            parentSegment.set(i, p);
        } else {
            parentSegment.set(i, -1);
        }
    }
    return parentSegment;
}

// ========== Dropping 祖先 ==========
function getDroppingAncestor(
    startIdx: number,
    seq: Expr,
    leftLess: number[],
    parentSegmentMap: Map<number, number>,
): number {
    const directSeg = getDirectSegmentAsSeq(seq, leftLess, startIdx);
    if (directSeg.length === 1) {
        return startIdx;
    }
    let current = startIdx;
    let best = current;
    let refIdx = current;
    while (true) {
        const parent = parentSegmentMap.get(current);
        if (parent === -1 || parent === undefined) break;
        const parentSeg = getDirectSegmentAsSeq(seq, leftLess, parent);
        const refSeg = getDirectSegmentAsSeq(seq, leftLess, refIdx);
        if (isDirectSegmentLess(refSeg, parentSeg)) {
            current = parent;
            continue;
        }
        const cmp = compareProjectionRaw(parentSeg, refSeg);
        if (cmp > 0) {
            best = parent;
            refIdx = parent;
            current = parent;
        } else {
            break;
        }
    }
    return best;
}

function getRealBadRoot(seq: Expr, leftLess: number[], candidateIdx: number): number {
    const seg = getDirectSegmentIndices(seq, leftLess, candidateIdx);
    return seg.length ? seg[seg.length - 1] : candidateIdx;
}

// ========== 坏根查找 ==========
function findBadRoot(seq: Expr, leftLess: number[]): number {
    const chain = getAncestorChain(seq, leftLess);
    const directAncestors = chain.filter((idx) => !seq[idx].starred);
    if (directAncestors.length === 0) return 0;
    const directParent = directAncestors[directAncestors.length - 1];
    const lastSegmentSeq = getDirectSegmentAsSeq(seq, leftLess, directParent);
    const parentSegmentMap = buildParentSegmentMap(seq, leftLess);

    const dropOfLast = getDroppingAncestor(directParent, seq, leftLess, parentSegmentMap);
    const dropRangeLast = getDirectSegmentRange(seq, leftLess, dropOfLast);
    const subSeqLast = deepcopy(seq.slice(dropRangeLast.start, seq.length));

    const skipped = new Set();
    let mark = directParent;
    while (true) {
        skipped.add(mark);
        if (mark === dropOfLast) break;
        const p = parentSegmentMap.get(mark);
        if (p === -1 || p === undefined) break;
        mark = p;
    }

    for (let i = directAncestors.length - 2; i >= 0; i--) {
        const currIdx = directAncestors[i];
        if (skipped.has(currIdx)) continue;

        const dropIdx = getDroppingAncestor(currIdx, seq, leftLess, parentSegmentMap);
        const dropRange = getDirectSegmentRange(seq, leftLess, dropIdx);
        const currRange = getDirectSegmentRange(seq, leftLess, currIdx);
        const subSeq = deepcopy(seq.slice(dropRange.start, currRange.end + 1));

        const isSubLessOrEqual = !isDirectSegmentLess(subSeqLast, subSeq);

        let mark2 = currIdx;
        while (true) {
            skipped.add(mark2);
            if (mark2 === dropIdx) break;
            const p = parentSegmentMap.get(mark2);
            if (p === -1 || p === undefined) break;
            mark2 = p;
        }

        if (isSubLessOrEqual) {
            const chainIndices: number[] = [];
            let cur = currIdx;
            while (true) {
                chainIndices.unshift(cur);
                if (cur === dropIdx) break;
                const p = parentSegmentMap.get(cur);
                if (p === -1 || p === undefined) break;
                cur = p;
            }
            let selectedSegStart: number | null = null;
            for (let k = chainIndices.length - 1; k >= 0; k--) {
                const startIdx = chainIndices[k];
                const seg = getDirectSegmentAsSeq(seq, leftLess, startIdx);
                const isLE = !isDirectSegmentLess(lastSegmentSeq, seg);
                if (isLE) {
                    selectedSegStart = startIdx;
                    break;
                }
            }
            if (selectedSegStart === null) {
                selectedSegStart = chainIndices[chainIndices.length - 1];
            }
            const selectedRange = getDirectSegmentRange(seq, leftLess, selectedSegStart);
            return selectedRange.end;
        }
    }

    const fallback = directAncestors[0];
    return getRealBadRoot(seq, leftLess, fallback);
}

// ========== 展开 ==========
function expandOnOriginal(
    seq: Expr,
    m: number,
): {
    expanded: Expr;
    applied: boolean;
    reason: string;
} {
    if (seq.length === 0) return { expanded: [], applied: false, reason: '空序列' };
    const last = seq[seq.length - 1];
    if (last.value === 0) {
        const newSeq = seq.slice(0, -1);
        return { expanded: newSeq, applied: true, reason: '末项为0，直接删除末项' };
    }
    if (!last.starred) {
        const values = extractValues(seq);
        const leftLess = computeLeftLess(values);
        const L = seq.length,
            p = leftLess[L - 1];
        const blockStart = p === -1 ? 0 : p;
        if (blockStart > L - 2)
            return { expanded: seq.slice(0, L - 1), applied: true, reason: '末项无星非0，无复制块' };
        const block = seq.slice(blockStart, L - 1);
        const newSeq = seq.slice(0, L - 1);
        for (let i = 0; i < m; i++) newSeq.push(...deepcopy(block));
        return { expanded: newSeq, applied: true, reason: '末项无星非0，复制父块' };
    }
    // 末项有星
    const values = extractValues(seq);
    const leftLess = computeLeftLess(values);
    const realBadRoot = findBadRoot(seq, leftLess);
    const lastValue = last.value;
    const d = lastValue - seq[realBadRoot].value;
    let newSeq = seq.slice(0, -1);
    const block = seq.slice(realBadRoot, seq.length - 1);
    for (let i = 0; i < m; i++) {
        const offset = d * (i + 1);
        newSeq.push(...block.map((item) => ({ value: item.value + offset, starred: item.starred })));
    }
    return { expanded: newSeq, applied: true, reason: `末项有星，坏根=${realBadRoot}` };
}

// ========== 辅助函数 ==========
function compactStrings(arr: string[]): string {
    if (arr.length === 0) return '';
    const result: string[] = [];
    let i = 0;
    while (i < arr.length) {
        let j = i + 1;
        while (j < arr.length && arr[j] === arr[i]) j++;
        const count = j - i;
        const str = arr[i];
        if (count === 1) {
            result.push(str);
        } else {
            if (str === '1') {
                result.push(count.toString());
            } else {
                result.push(str + '\\times ' + count);
            }
        }
        i = j;
    }
    return result.join(' + ');
}

function renderSequenceToLatex(seq: Expr, baseDepth = 0, enableColor = true, reverse = false, aftMode = false) {
    if (is_infinity(seq)) return '\\text{Limit}';

    const depthColors = [
        '', // depth 0 无色
        '#80d0ff', // 亮蓝
        '#80ff80', // 亮绿
        '#ff80c0', // 亮粉
        '#ffe066', // 亮黄
        '#c080ff', // 亮紫
        '#80ffff', // 亮青
        '#ff8080', // 亮红
    ];

    function getColorCmd(depth: number) {
        if (depth === 0) return '';
        const idx = ((depth - 1) % (depthColors.length - 1)) + 1;
        return '\\textcolor{' + depthColors[idx] + '}';
    }

    if (!seq || seq.length === 0) return '';

    const values = extractValues(seq);
    const leftLess = computeLeftLess(values);
    const parentSegmentMap = buildParentSegmentMap(seq, leftLess);

    // 获取所有直接段（无星项）及其范围
    const directSegments: { start: number; end: number; index: number }[] = [];
    for (let i = 0; i < seq.length; i++) {
        if (!seq[i].starred) {
            const range = getDirectSegmentRange(seq, leftLess, i);
            directSegments.push({ start: range.start, end: range.end, index: i });
        }
    }
    directSegments.sort((a, b) => a.start - b.start);

    // 过滤：移除完全被其他段包含的段
    const filteredSegments: { start: number; end: number; index: number }[] = [];
    for (let i = 0; i < directSegments.length; i++) {
        const seg = directSegments[i];
        let contained = false;
        for (let j = 0; j < directSegments.length; j++) {
            if (i === j) continue;
            const other = directSegments[j];
            if (other.start < seg.start && other.end > seg.end) {
                contained = true;
                break;
            }
        }
        if (!contained) {
            filteredSegments.push(seg);
        }
    }

    const nodeSegments = filteredSegments.map((s) => s.index);
    nodeSegments.sort((a, b) => a - b);

    const completeMap = new Map<number, { start: number; end: number }>();
    for (const node of nodeSegments) {
        const range = getDirectSegmentRange(seq, leftLess, node);
        completeMap.set(node, { start: range.start, end: range.end });
    }

    const forestParentMap = new Map<number, number>();
    const forestChildrenMap = new Map<number, number[]>();
    for (const node of nodeSegments) {
        let cur = node;
        let foundParent = null;
        while (true) {
            const parent = parentSegmentMap.get(cur);
            if (parent === -1 || parent === undefined) break;
            if (nodeSegments.includes(parent)) {
                foundParent = parent;
                break;
            }
            cur = parent;
        }
        if (foundParent !== null) {
            forestParentMap.set(node, foundParent);
            if (!forestChildrenMap.has(foundParent)) forestChildrenMap.set(foundParent, []);
            forestChildrenMap.get(foundParent)!.push(node);
        } else {
            forestParentMap.set(node, -1);
        }
    }
    for (const [_, children] of forestChildrenMap) {
        children.sort((a, b) => a - b);
    }
    const roots = nodeSegments.filter((n) => forestParentMap.get(n) === -1);

    if (nodeSegments.length === 0 || roots.length === 0) {
        return '[' + seq.map((item) => item.value + (item.starred ? '*' : '')).join(',') + ']';
    }

    // ----- 计算 dropping 祖先及其深度（相对于本序列） -----
    const dropAncestorMap = new Map<number, number>();
    for (const node of nodeSegments) {
        dropAncestorMap.set(node, getDroppingAncestor(node, seq, leftLess, parentSegmentMap));
    }

    const relDepthMap = new Map<number, number>();
    for (const node of nodeSegments) {
        const drop = dropAncestorMap.get(node)!;
        const isRoot = forestParentMap.get(node) === -1;
        if (isRoot) {
            relDepthMap.set(node, 0);
        } else if (drop === node) {
            const parentNode = forestParentMap.get(node)!;
            const parentDepth = relDepthMap.get(parentNode)!;
            relDepthMap.set(node, parentDepth + 1);
        } else {
            relDepthMap.set(node, relDepthMap.get(drop)!);
        }
    }

    // 最终深度 = 相对深度 + baseDepth
    const finalDepthMap = new Map<number, number>();
    for (const node of nodeSegments) {
        finalDepthMap.set(node, relDepthMap.get(node)! + baseDepth);
    }

    // ----- 辅助函数（与原逻辑完全相同） -----
    function getCompleteSeq(node: number): Expr {
        const comp = completeMap.get(node)!;
        const compSeq = deepcopy(seq.slice(comp.start, comp.end + 1));
        if (compSeq.length === 0) return [];
        const base = compSeq[0].value;
        return compSeq.map((item) => ({ value: item.value - base, starred: item.starred }));
    }

    function matchP(seq: Expr) {
        if (seq.length === 1 && seq[0].value === 0 && !seq[0].starred) {
            return '1';
        }
        if (seq.length < 2) return null;
        if (seq[0].value !== 0 || seq[0].starred) return null;
        for (let i = 1; i < seq.length; i++) {
            if (!(seq[i].value === i && seq[i].starred)) return null;
        }
        const k = seq.length - 2;
        return kToSymbol(k, false);
    }

    function kToSymbol(k: number, omitOmega: boolean): string {
        if (k === 0) return omitOmega ? '' : '\\mathrm{\\Omega}';
        if (k === 1) return '\\mathrm{\\alpha}';
        if (k === 2) return '\\mathrm{S}';
        return '\\mathrm{P}_{' + k + '}';
    }

    // ----- 辅助：生成序数词 -----
    function ordinal(m: number): string {
        if (m === 1) return '';
        if (m % 10 === 1 && m % 100 !== 11) return m + '\\mathrm{st}';
        if (m % 10 === 2 && m % 100 !== 12) return m + '\\mathrm{nd}';
        if (m % 10 === 3 && m % 100 !== 13) return m + '\\mathrm{rd}';
        return m + '\\mathrm{th}';
    }

    // ----- 修改后的 renderNode（使用所有参数） -----
    function renderNode(node: number, enableColor: boolean, reverse: boolean, aftMode: boolean): string {
        const children = forestChildrenMap.get(node) || [];
        const isLeaf = children.length === 0;
        const compSeq = getCompleteSeq(node);

        let result: string | undefined;

        // 第一步：P 模式匹配
        if (isLeaf) {
            const matched = matchP(compSeq);
            if (matched) {
                result = matched;
            }
        } else {
            const starCopy = deepcopy(compSeq);
            if (starCopy.length > 0) {
                starCopy[starCopy.length - 1].starred = true;
            }
            const matched = matchP(starCopy);
            if (matched) {
                const childrenLatex = compactStrings(children.map((c) => renderNode(c, enableColor, reverse, aftMode)));
                result = `\\psi_{${matched}}( ${childrenLatex} )`;
            }
        }

        if (result === undefined) {
            // 第二步：'其次' 处理
            const values = compSeq.map((item) => item.value);
            const leftLess = computeLeftLess(values);
            const childMap = new Map<number, number[]>();
            for (let i = 0; i < compSeq.length; i++) {
                const p = leftLess[i];
                if (p !== -1) {
                    if (!childMap.has(p)) childMap.set(p, []);
                    childMap.get(p)!.push(i);
                }
            }
            let pIdx = -1;
            for (let i = 0; i < compSeq.length; i++) {
                if (childMap.has(i) && childMap.get(i)!.length > 1) {
                    pIdx = i;
                    break;
                }
            }
            if (pIdx === -1) {
                result = '[' + compSeq.map((item) => item.value + (item.starred ? '*' : '')).join(',') + ']';
            } else {
                const P = compSeq[pIdx].value;
                const childrenList = childMap.get(pIdx)!;
                const c_last = childrenList[childrenList.length - 1];

                // 特殊分支
                const lastIdx = compSeq.length - 1;
                if (!compSeq[lastIdx].starred && childrenList.length >= 2) {
                    const lastBlock = compSeq.slice(c_last);
                    const lastBlockStar = lastBlock.map((item) => ({ ...item }));
                    lastBlockStar[lastBlockStar.length - 1].starred = true;
                    const prevIdx = childrenList[childrenList.length - 2];
                    const prevBlock = compSeq.slice(prevIdx, c_last);

                    if (compare(lastBlockStar, prevBlock) <= 0) {
                        const starSeq = deepcopy(compSeq);
                        starSeq[starSeq.length - 1].starred = true;
                        const currentDepth = finalDepthMap.get(node);
                        const S1_str = renderSequenceToLatex(starSeq, currentDepth, enableColor, reverse, aftMode);
                        if (isLeaf) {
                            result = S1_str;
                        } else {
                            const childrenLatex = compactStrings(
                                children.map((c) => renderNode(c, enableColor, reverse, aftMode)),
                            );
                            result = `\\psi_{${S1_str}}( ${childrenLatex} )`;
                        }
                    }
                }

                if (result === undefined) {
                    // ---- 正常情况 ----
                    const childIndices = childrenList;
                    const numChildren = childIndices.length;

                    function getBlock(i: number): Expr {
                        const idx = childIndices[i];
                        const nextIdx = i + 1 < numChildren ? childIndices[i + 1] : compSeq.length;
                        return compSeq.slice(idx, nextIdx);
                    }

                    const k = P;
                    const headSeq = compSeq.slice(0, pIdx);
                    const lastBlock = getBlock(numChildren - 1);
                    const S2_seq = headSeq.concat(compSeq[pIdx], lastBlock);

                    // 构建 S3 序列
                    let S3_seq = null;
                    if (numChildren >= 2) {
                        const prevBlock = getBlock(numChildren - 2);
                        S3_seq = headSeq.concat(compSeq[pIdx], prevBlock);
                    }

                    const currentDepth = finalDepthMap.get(node);
                    const S2_str = renderSequenceToLatex(S2_seq, currentDepth, enableColor, reverse, aftMode);
                    // const S3_str = S3_seq ? renderSequenceToLatex(S3_seq, currentDepth, enableColor, reverse, aftMode) : null;

                    // 无颜色版本用于比较
                    // const S2_str_noColor = renderSequenceToLatex(S2_seq, currentDepth, false, reverse, aftMode);
                    const S3_str_noColor = S3_seq
                        ? renderSequenceToLatex(S3_seq, currentDepth, false, reverse, aftMode)
                        : null;

                    // 构造 S2star
                    const S2star_seq = S2_seq.map((item) => ({ ...item }));
                    if (S2star_seq.length > 0) {
                        S2star_seq[S2star_seq.length - 1].starred = true;
                    }
                    const S2star_str = renderSequenceToLatex(S2star_seq, currentDepth, enableColor, reverse, aftMode);
                    const S2star_str_noColor = renderSequenceToLatex(S2star_seq, currentDepth, false, reverse, aftMode);

                    const childrenLatex = isLeaf
                        ? ''
                        : compactStrings(children.map((c) => renderNode(c, enableColor, reverse, aftMode)));
                    const childrenLatex_noColor = isLeaf
                        ? ''
                        : compactStrings(children.map((c) => renderNode(c, false, reverse, aftMode)));

                    // ---- 计算 m（叶节点）或 l（非叶节点） ----
                    let m;
                    let startIdx;
                    if (isLeaf) {
                        m = 1;
                        startIdx = numChildren - 1;
                        for (let i = numChildren - 2; i >= 0; i--) {
                            const block1 = getBlock(i);
                            const block2 = getBlock(i + 1);
                            if (
                                block1.length === block2.length &&
                                block1.every(
                                    (item, idx) =>
                                        item.value === block2[idx].value && item.starred === block2[idx].starred,
                                )
                            ) {
                                m++;
                                startIdx = i;
                            } else {
                                break;
                            }
                        }
                    } else {
                        // 非叶节点：先计算 l
                        const psiPart_noColor = `\\psi_{${S2star_str_noColor}}( ${childrenLatex_noColor} )`;
                        let l = 0;
                        if (S3_str_noColor !== null && numChildren >= 2 && psiPart_noColor === S3_str_noColor) {
                            l = 1;
                            let tempIdx = numChildren - 3;
                            while (tempIdx >= 0) {
                                const blockA = getBlock(tempIdx);
                                const blockB = getBlock(tempIdx + 1);
                                if (
                                    blockA.length === blockB.length &&
                                    blockA.every(
                                        (item, idx) =>
                                            item.value === blockB[idx].value && item.starred === blockB[idx].starred,
                                    )
                                ) {
                                    l++;
                                    tempIdx--;
                                } else {
                                    break;
                                }
                            }
                        }
                        m = l + 1;
                        // 重新定义 S1 的起始索引
                        startIdx = numChildren - 1 - l; // 第一个相同块的索引
                    }

                    // ---- 构建 S1_str（如果有 Y） ----
                    let finalS1_str = null;
                    if (isLeaf) {
                        if (startIdx > 0) {
                            const endIdx = childIndices[startIdx];
                            const S1_seq = compSeq.slice(0, endIdx);
                            finalS1_str = renderSequenceToLatex(S1_seq, currentDepth, enableColor, reverse, aftMode);
                        }
                    } else {
                        if (startIdx > 0) {
                            const newEndIdx = childIndices[startIdx];
                            const newS1_seq = compSeq.slice(0, newEndIdx);
                            finalS1_str = renderSequenceToLatex(newS1_seq, currentDepth, enableColor, reverse, aftMode);
                        }
                    }

                    const X = isLeaf ? S2_str : `\\psi_{${S2star_str}}( ${childrenLatex} )`;
                    const Y = finalS1_str;

                    // ---- 根据 aftMode 和 reverse 构建最终字符串 ----
                    let resultStr;
                    if (aftMode) {
                        // aftMode 分支

                        let subSymbol = kToSymbol(k, true);
                        let aftPart = subSymbol ? '\\mathrm{aft}_{' + subSymbol + '}' : '\\mathrm{aft}';

                        let ord = ordinal(m);

                        if (Y) {
                            // 有 Y
                            if (reverse) {
                                // Y aft_k mth_k X
                                let middle = aftPart;
                                if (ord !== '') {
                                    let ordWithSub = subSymbol ? ord + '_{' + subSymbol + '}' : ord;
                                    middle += '\\ ' + ordWithSub;
                                }
                                resultStr = Y + '\\ ' + middle + '\\ ' + X;
                            } else {
                                // mth_k X aft_k Y
                                let prefix = '';
                                if (ord !== '') {
                                    prefix = (subSymbol ? ord + '_{' + subSymbol + '}' : ord) + '\\ ';
                                }
                                resultStr = prefix + X + '\\ ' + aftPart + '\\ ' + Y;
                            }
                        } else {
                            // 无 Y：mth_k X（m不可能为1）
                            let subscript = subSymbol ? '_{' + subSymbol + '}' : '';
                            let pPart = ord + subscript;
                            resultStr = pPart + '\\ ' + X;
                        }
                    } else {
                        // 非 aftMode：使用横线，反转时变成 Y p_k - X（有Y）或 p_k - X（无Y）
                        let pPart;
                        if (m === 1) pPart = 'p_{' + k + '}';
                        else pPart = 'p^{' + m + '}_{' + k + '}';
                        if (Y) {
                            resultStr = reverse ? Y + '\\ ' + pPart + '-' + X : X + '-' + pPart + '\\ ' + Y;
                        } else {
                            resultStr = reverse ? pPart + '-' + X : X + '-' + pPart;
                        }
                    }

                    result = resultStr;
                }
            }
        }

        // 颜色包裹
        if (enableColor) {
            const depth = finalDepthMap.get(node)!;
            const colorCmd = getColorCmd(depth);
            if (colorCmd) {
                return colorCmd + '{' + result + '}';
            }
        }
        return result;
    }

    // 获取根节点渲染结果并压缩
    const rootLatexArray = roots.map((r) => renderNode(r, enableColor, reverse, aftMode));
    const forestLatex = compactStrings(rootLatexArray);

    return forestLatex;
}

// ========== Expr 层面的函数 ==========
function compare(a: Expr, b: Expr): number {
    return lex_compare(
        a,
        b,
        object_lex_compare_by(
            {
                value: number_compare,
                starred: boolean_compare,
            },
            ['value', 'starred'],
        ),
    );
}

function is_limit(e: Expr): boolean {
    if (is_infinity(e)) return true;
    if (e.length === 0) return false;
    return e[e.length - 1].value !== 0;
}

function FS(e: Expr, index: number): Expr {
    if (is_infinity(e)) return infinity_FS(index);
    return expandOnOriginal(e, index).expanded;
}

// ========== 记号定义 ==========
export const UPSr5: NotationDefinition<Expr> = {
    id: 'ups-r5',
    name: 'UPSr5',
    display: {
        plain: formatSequence,
        from_display: parseSequence,
    },
    display_equiv: {
        POCN: {
            plain: formatSequence,
            latex: (e) => renderSequenceToLatex(e, 0, false, false, true),
        },
        colored: {
            plain: formatSequence,
            latex: (e) => renderSequenceToLatex(e, 0, true, false, true),
        },
    },
    is_limit,
    compare,
    FS,
    credit_text_id: 'credit.upsr5',
    init: () => [INFINITY, []],
};
