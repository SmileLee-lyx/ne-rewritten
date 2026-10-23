import { describe, expect, it } from 'vitest';
import { display_simple, from_display_simple } from '@/notations/BM-like/BM.ts';
import { UPMS } from '@/notations/BM-like/UPMS.ts';
import { UPMS_EDIT } from '@/notations/BM-like/UPMS_edit.ts';

const FULL_SUFFIX = '0 111 221 311 421 521';
const TRUNCATED_X = '0 111 221 311 421 531 111 221 321';
const TRUNCATED_COPY = '32 411 521 611 721 831 431 541';

describe('UPMS (edit) 提升判定', () => {
    // 小矩阵用于隔离判定分支，不主张它们是标准项。
    it('X 没有截断点时仍比较完整后缀，X < Y 时不提升', () => {
        const matrix = from_display_simple(FULL_SUFFIX);
        const original = structuredClone(matrix);

        // 第二行：X 从列 1 起直到末列，Y 从列 3 起。
        // 相对化后的第三列分别为 211、221，故 X < Y。
        expect(display_simple(UPMS_EDIT.FS(matrix, 1))).toBe('0 111 221 311 421 52 611 721 811 921');
        expect(display_simple(UPMS.FS(matrix, 1))).toBe('0 111 221 311 421 52 631 741 831 941');
        expect(matrix).toEqual(original);
    });

    it('X < Y 时整段不提升，即使段内某列单独检验可通过；右边界列继续判定', () => {
        const matrix = from_display_simple(TRUNCATED_X);
        const prefix = '0 111 221 311 421 531 111 221';

        // X 是列 [1, 6)，Y 是列 [6, 9)。列 3 单独检验可通过，仍必须被抑制。
        // 列 6 恰在 X 之外，且自己的 X = Y，应恢复提升。
        expect(display_simple(UPMS_EDIT.FS(matrix, 1))).toBe(`${prefix} ${TRUNCATED_COPY}`);
        expect(display_simple(UPMS.FS(matrix, 1))).toBe(`${prefix} 32 411 521 631 741 851 431 541`);
    });

    it('保留已经通过的较低行，未通过的列也不能继续提升更高行', () => {
        const matrix = from_display_simple('0 1111 2211 3111 4211 5311 1111 2211 3211');
        expect(display_simple(UPMS_EDIT.FS(matrix, 1))).toBe(
            '0 1111 2211 3111 4211 5311 1111 2211 321 4111 5211 6111 7211 8311 4321 5421',
        );
    });

    it('坏根不在首列时仍正确定位 X 和复制块', () => {
        const matrix = from_display_simple('0 1 211 321 411 521 621');
        expect(display_simple(UPMS_EDIT.FS(matrix, 1))).toBe('0 1 211 321 411 521 62 711 821 911 (10)21');
    });

    it.each([
        ['完整 X = Y，包含末列的提升标记', '0 111 221', '0 111 22 331'],
        ['完整 X 以 Y 为真前缀', '0 111 221 311 421', '0 111 221 311 42 531 641 731'],
        ['截断 X 是 Y 的真前缀', '0 111 22 321 431', '0 111 22 321 43 511 62 721'],
    ])('%s', (_, input, expected) => {
        expect(display_simple(UPMS_EDIT.FS(from_display_simple(input), 1))).toBe(expected);
    });

    it.each([
        [
            '37 列无截断输入',
            '0 111 221 331 211 321 43 541 651 761 641 111 221 33 441 551 661 511 621 73 841 951 (10)61 941 311 421 53 641 751 861 711 821 93 (10)41 (11)51 (12)61 (11)21',
        ],
        [
            '37 列重复块输入',
            '0 111 221 331 211 321 43 541 651 761 621 111 221 33 441 551 661 511 621 73 841 951 (10)61 921 111 221 33 441 551 661 511 621 73 841 951 (10)61 921',
        ],
    ])('%s：已有研究例子中失败的区段整行不提升', (_, input) => {
        const matrix = from_display_simple(input);
        const result = UPMS_EDIT.FS(matrix, 1);
        const copied_columns = result.slice(matrix.length - 1);

        // 两例在列 11 的第二行失败；重复块例还会在列 24 再次失败。
        expect(copied_columns.slice(11).map((col) => col[1])).toEqual(matrix.slice(11, -1).map((col) => col[1]));
        expect(copied_columns[1]).toEqual([matrix[matrix.length - 1][0] + 1, 3, 1]);
    });
});

describe('UPMS (edit) 基本列接口', () => {
    it('多个副本及 FS_alter / FS_short 共用修复后的提升结果', () => {
        const matrix = from_display_simple(TRUNCATED_X);
        const prefix = '0 111 221 311 421 531 111 221';
        const second_copy = '64 711 821 911 (10)21 (11)31 751 861';

        expect(display_simple(UPMS_EDIT.FS(matrix, 0))).toBe(prefix);
        expect(display_simple(UPMS_EDIT.FS(matrix, 2))).toBe(`${prefix} ${TRUNCATED_COPY} ${second_copy}`);
        expect(display_simple(UPMS_EDIT.FS_alter!(matrix, 0))).toBe(`${prefix} 32`);
        expect(display_simple(UPMS_EDIT.FS_alter!(matrix, 1))).toBe(`${prefix} ${TRUNCATED_COPY} 64`);
        expect(display_simple(UPMS_EDIT.FS_short!(matrix, 0))).toBe(prefix);
        expect(display_simple(UPMS_EDIT.FS_short!(matrix, 1))).toBe(`${prefix} 32`);
        expect(display_simple(UPMS_EDIT.FS_short!(matrix, 2))).toBe(`${prefix} ${TRUNCATED_COPY}`);
    });

    it.each([
        ['', ''],
        ['0 0', '0'],
        ['0 111 0', '0 111'],
        ['Limit', '0 111'],
        ['0 11 11', '0 11 1 21 2 31'],
    ])('保留基础展开 %s', (input, expected) => {
        expect(display_simple(UPMS_EDIT.FS(from_display_simple(input), 2))).toBe(expected);
    });
});
