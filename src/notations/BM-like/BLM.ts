import { type NotationDefinition } from '@/notation-definition.ts';
import { compare, display, from_display, is_limit, normalize, standardize } from '@/notations/BM-like/BM.ts';

export const BLM: NotationDefinition<any> = {
    id: 'blm',
    name: 'Bashicu large matrix',
    simple_name: 'BLM',
    category_id: 'category-bm-like',
    display: {
        plain: display,
        from_display,
    },
    is_limit,
    compare,
    FS: (() => {
        var data: any = {},
            expand = (b: any, a: any) => {
                var d3 = b.length - 1,
                    d2 = b[0].length - 1,
                    b2 = Array(d3 + 1).fill(Array(d2 + 1).fill(0)),
                    c = Array(d2 + 1).fill(0),
                    c2 = Array(d3 + 1).fill(0),
                    c3 = Array(d2 + 1).fill(0),
                    d7 = 0,
                    d8 = 0,
                    d9 = 0,
                    d18 = 0,
                    d19 = 0;
                for (var d4 = 0; d4 <= d2; ++d4) {
                    if (0 < b[d3][d4] && !b[d3][d4 + 1]) {
                        for (var d5 = 0; d5 <= d3; ++d5) {
                            for (var d6 = 0; d6 <= d4; ++d6) {
                                if (b[d3 - d5][d6] < b[d3][d6] - c[d6]) {
                                    if (d6 < d4) {
                                        c[d6] = b[d3][d6] - b[d3 - d5][d6];
                                    } else {
                                        if (!d7) d8 = d5;
                                        ++d9;
                                        if (c[d4] + 1 < b[d3][d6] - b[d3 - d5][d6]) ++c[d4];
                                        c2[d9] = d5;
                                        for (var d10 = 0; d10 <= d4; ++d10) {
                                            b2[d3 - d5][d10] = d9;
                                        }
                                        for (var d11 = 0; d11 <= d4; ++d11) {
                                            for (var d12 = d3 - d5 + 1; d12 <= d3; ++d12) {
                                                for (var d13 = d12; d13 >= d3 - d5; --d13) {
                                                    for (var d14 = 0; d14 <= d11; ++d14) {
                                                        if (b[d13][d14] < b[d12][d14] - c3[d14]) {
                                                            if (d11 === d14) {
                                                                if (0 < b2[d13][d11] && !b2[d12][d11])
                                                                    b2[d12][d11] = d9;
                                                                d13 = d3 - d5;
                                                            } else {
                                                                c3[d14] = b[d12][d14] - b[d13][d14];
                                                            }
                                                        } else {
                                                            d14 = d11;
                                                        }
                                                    }
                                                }
                                                for (var d15 = 0; d15 <= d4; ++d15) {
                                                    c3[d15] = 0;
                                                }
                                            }
                                        }
                                        for (var d16 = 0; d16 <= d8; ++d16) {
                                            for (var d17 = 0; d17 <= d2; ++d17) {
                                                d18 = 0;
                                                if (0 < b2[d3 - d8 + d16][d17]) {
                                                    if (d17 < d4 + 1)
                                                        d18 = b[d3 - c2[b2[d3 - d8 + d16][d17]]][d17] - b[d3 - d5][d17];
                                                }
                                                if (
                                                    b[d3 - d5 + d16][d17] < b[d3 - d8 + d16][d17] - d18 ||
                                                    (1 < d5 - d7 && 0 < d7)
                                                ) {
                                                    d16 = d7;
                                                    d17 = d2;
                                                    d19 = 1;
                                                    d5 = d3;
                                                    --d9;
                                                } else if (b[d3 - d8 + d16][d17] - d18 < b[d3 - d5 + d16][d17]) {
                                                    d16 = d7;
                                                    d17 = d2;
                                                }
                                            }
                                        }
                                        if (!d19) d7 = d5;
                                        else d19 = 0;
                                    }
                                } else {
                                    d6 = d4;
                                }
                            }
                        }
                        d4 = d2;
                    }
                }
                for (var d20 = 0; d20 <= d2; ++d20) {
                    if (0 < b[d3][d20 + 1]) {
                        c[d20] = b[d3][d20] - b[d3 - d7][d20];
                    } else {
                        c[d20] = b[d3][d20] - b[d3 - d7][d20] - 1;
                        d20 = d2;
                    }
                }
                var result = b.slice(0, d3).map((col: any) => col.slice());
                for (var d21 = 1; d21 <= a * d7; ++d21) {
                    if (!result[d3]) result[d3] = [];
                    if (!b2[d3]) b2[d3] = [];
                    for (var d22 = 0; d22 <= d2; ++d22) {
                        if (0 < b2[d3 - d7][d22] && b2[d3 - d7][d22] < d9 + 1) {
                            result[d3][d22] = result[d3 - d7][d22] + c[d22];
                        } else {
                            result[d3][d22] = result[d3 - d7][d22];
                        }
                        b2[d3][d22] = b2[d3 - d7][d22];
                    }
                    ++d3;
                }
                if (d2 > 0 && result.every((column: any) => column[d2] === 0))
                    result = result.map((column: any) => column.slice(0, d2));
                return result;
            };
        return (m: any, FSterm: any): any => {
            if ('' + m === 'Infinity') return [[], Array(FSterm + 1).fill(1)];
            if (m.length === 0) return [];
            var datakey = display(m);
            if (!data[datakey]) data[datakey] = [];
            else if (data[datakey][FSterm] !== undefined) return data[datakey][FSterm];
            return (data[datakey][FSterm] = normalize(expand(standardize(m), FSterm)));
        };
    })(),
    init: (): any => [[[Infinity]], []],
};
