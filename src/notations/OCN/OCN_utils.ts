export type DisplayType = 'plain' | 'html' | 'latex';

// ========== OCNDisplay AST ==========

interface OCNDisplayNumber {
    type: 'number';
    value: number;
}

interface OCNDisplaySum {
    type: 'sum';
    terms: OCNDisplayIR[];
}

interface OCNDisplayMul {
    type: 'mul_nat';
    value: OCNDisplayIR;
    coe: number;
}

interface OCNDisplayConst {
    type: 'constant';
    /** 纯文本表示 */
    display: string;
    /** LaTeX 表示 */
    display_latex: string;
    sup?: OCNDisplayIR;
    sub?: OCNDisplayIR;
    arg?: OCNDisplayIR;
}

/** ω^{sup} */
interface OCNDisplayOmega {
    type: 'omega';
    sup?: OCNDisplayIR;
}

/** Ω_{sub} */
interface OCNDisplayOmega0 {
    type: 'Omega';
    sub?: OCNDisplayIR;
}

/** ψ_{sub}(arg) */
interface OCNDisplayPsi {
    type: 'psi';
    sub?: OCNDisplayIR;
    arg?: OCNDisplayIR;
}

export type OCNDisplayIR =
    | OCNDisplayNumber
    | OCNDisplaySum
    | OCNDisplayMul
    | OCNDisplayOmega
    | OCNDisplayOmega0
    | OCNDisplayPsi
    | OCNDisplayConst;

// ========== 合并同类项 ==========

/** 合并 sum 中相邻的同类项。同类指 displayOCN(-, 'plain') 结果相同。 */
export function merge_sum(terms: OCNDisplayIR[]): OCNDisplayIR {
    if (terms.length === 0) return { type: 'number', value: 0 };
    const result: OCNDisplayIR[] = [];
    let i = 0;
    while (i < terms.length) {
        let j = i + 1;
        const key = display_OCN_IR(terms[i], 'plain');
        while (j < terms.length && display_OCN_IR(terms[j], 'plain') === key) j++;
        const count = j - i;
        if (count === 1) {
            result.push(terms[i]);
        } else if (key === '1') {
            result.push({ type: 'number', value: count });
        } else {
            result.push({ type: 'mul_nat', value: terms[i], coe: count });
        }
        i = j;
    }
    if (result.length === 0) return { type: 'number', value: 0 };
    if (result.length === 1) return result[0];
    return { type: 'sum', terms: result };
}

// ========== 渲染 ==========

export function display_OCN_IR(e: OCNDisplayIR, type: DisplayType): string {
    switch (e.type) {
        case 'number':
            return '' + e.value;

        case 'sum':
            return e.terms.map((t) => display_OCN_IR(t, type)).join('+');

        case 'mul_nat': {
            const v = display_OCN_IR(e.value, type);
            // 序数乘法：value × coe，整数写在右边
            if (type === 'latex') return v + '\\cdot ' + e.coe;
            return v + '·' + e.coe;
        }

        case 'omega':
            return display_OCN_IR(
                {
                    type: 'constant',
                    display: 'ω',
                    display_latex: '\\omega ',
                    sup: e.sup,
                },
                type,
            );

        case 'Omega':
            return display_OCN_IR(
                {
                    type: 'constant',
                    display: 'Ω',
                    display_latex: '\\Omega ',
                    sub: e.sub,
                },
                type,
            );

        case 'psi':
            return display_OCN_IR(
                {
                    type: 'constant',
                    display: 'ψ',
                    display_latex: '\\psi ',
                    sub: e.sub,
                    arg: e.arg,
                },
                type,
            );

        case 'constant': {
            const name = type === 'latex' ? e.display_latex : e.display;
            const sup_str = e.sup ? display_OCN_IR(e.sup, type) : undefined;
            const sub_str = e.sub ? display_OCN_IR(e.sub, type) : undefined;
            const arg_str = e.arg ? display_OCN_IR(e.arg, type) : '';

            let result = name;
            if (sup_str !== undefined) {
                if (type === 'html') result += '<sup>' + sup_str + '</sup>';
                else if (type === 'latex') result += '^{' + sup_str + '}';
                else result += '{' + sup_str + '}';
            }
            if (sub_str !== undefined) {
                if (type === 'html') result += '<sub>' + sub_str + '</sub>';
                else if (type === 'latex') result += '_{' + sub_str + '}';
                else result += '[' + sub_str + ']';
            }
            if (e.arg) result += '(' + arg_str + ')';
            return result;
        }
    }
}

/** 辅助函数：传入 to_OCN_display 转换函数，返回 DisplaySpec 对象 */
export function make_OCN_display<T>(to_ir: (e: T) => OCNDisplayIR): {
    plain: (e: T) => string;
    html: (e: T) => string;
    latex: (e: T) => string;
} {
    return {
        plain: (e) => display_OCN_IR(to_ir(e), 'plain'),
        html: (e) => display_OCN_IR(to_ir(e), 'html'),
        latex: (e) => display_OCN_IR(to_ir(e), 'latex'),
    };
}
