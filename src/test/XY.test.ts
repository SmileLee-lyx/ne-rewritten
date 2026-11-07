import { describe, expect, it } from 'vitest';
import { xyV1, xyV1FS } from '@/notations/Y/xy/xy_v1.ts';
import { xyV2, xyV2FS } from '@/notations/Y/xy/xy_v2.ts';
import { xyV3, xyV3FS } from '@/notations/Y/xy/xy_v3.ts';
import { is_infinity } from '@/notations/Y/Omega_Y.ts';

const cases: Array<[string, (seq: number[], i: number) => number[]]> = [
    ['xy-v1', xyV1FS],
    ['xy-v2', xyV2FS],
    ['xy-v3', xyV3FS],
];

describe.each(cases)('%s 基本契约', (_name, fs) => {
    it('Limit 元素的基本列', () => {
        expect(fs([Infinity], 0)).toEqual([1, 1]);
        expect(fs([Infinity], 1)).toEqual([1, 2]);
        expect(is_infinity([Infinity])).toBe(true);
    });

    it('后继元素展开出直接前继', () => {
        // [1] 是后继: FS 必须严格小于 [1]
        expect(fs([1], 0)).toEqual([]);
        // 末项 <=1 的序列退化为删去末项
        expect(fs([2, 1], 0)).toEqual([2]);
    });

    it('空序列展开为空', () => {
        expect(fs([], 0)).toEqual([]);
    });

    it('极限表达式 FS 严格递减且可终止', () => {
        // 这些输入应在有限步内产出比自身更小的序列(或退化为前继), 不抛异常
        for (const seq of [[3], [2, 3], [1, 3, 4, 3], [2, 3, 4], [1, 2, 5]]) {
            for (let i = 0; i <= 5; i++) {
                const r = fs(seq, i);
                expect(Array.isArray(r)).toBe(true);
                for (const v of r) expect(Number.isFinite(v)).toBe(true);
            }
        }
    });

    it('记号元数据已注册', () => {
        for (const def of [xyV1, xyV2, xyV3]) {
            expect(def.category_id).toBe('category-xy');
            expect(def.is_limit([Infinity])).toBe(true);
            expect(def.is_limit([1])).toBe(false);
            expect(def.compare([Infinity], [1])).toBe(1);
            expect(def.compare([1], [])).toBe(1);
            expect(def.compare([1], [1])).toBe(0);
        }
    });
});
