import type { Rgba } from './diagram_types.ts';

/** Rgba → CSS rgba() 字符串 */
export function css(c: Rgba): string {
    return `rgba(${c.r},${c.g},${c.b},${c.a ?? 1})`;
}

/** 调透明度 */
export function alpha(c: Rgba, a: number): Rgba {
    return { r: c.r, g: c.g, b: c.b, a };
}

/** 线性插值：t=0 → c1, t=1 → c2 */
export function blend(c1: Rgba, c2: Rgba, t: number): Rgba {
    return {
        r: Math.round((1 - t) * c1.r + t * c2.r),
        g: Math.round((1 - t) * c1.g + t * c2.g),
        b: Math.round((1 - t) * c1.b + t * c2.b),
        a: (c1.a ?? 1) * (1 - t) + (c2.a ?? 1) * t,
    };
}

/** 变暗 */
export function darken(c: Rgba, factor: number): Rgba {
    return {
        r: Math.round(c.r * factor),
        g: Math.round(c.g * factor),
        b: Math.round(c.b * factor),
        a: c.a,
    };
}

/** 变亮（各分量加 amount） */
export function lighten(c: Rgba, amount: number): Rgba {
    return {
        r: Math.min(255, c.r + amount),
        g: Math.min(255, c.g + amount),
        b: Math.min(255, c.b + amount),
        a: c.a,
    };
}
