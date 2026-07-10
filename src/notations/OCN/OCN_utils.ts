export type DisplayType = 'plain' | 'html' | 'latex';

// ========== OCNDisplay AST ==========

export interface OCNDisplayNumber {
    type: 'number';
    value: number;
}

export interface OCNDisplaySum {
    type: 'sum';
    terms: OCNDisplay[];
}

export interface OCNDisplayMul {
    type: 'mul_nat';
    value: OCNDisplay;
    coe: number;
}

export interface OCNDisplayConst {
    type: 'constant';
    /** 纯文本表示 */
    display: string;
    /** LaTeX 表示 */
    display_latex: string;
    sup?: OCNDisplay;
    sub?: OCNDisplay;
    arg?: OCNDisplay;
}

/** ω^{sup} */
export interface OCNDisplayOmega {
    type: 'omega';
    sup?: OCNDisplay;
}

/** Ω_{sub} */
export interface OCNDisplayOmega0 {
    type: 'Omega';
    sub?: OCNDisplay;
}

/** ψ_{sub}(arg) */
export interface OCNDisplayPsi {
    type: 'psi';
    sub?: OCNDisplay;
    arg?: OCNDisplay;
}

export type OCNDisplay =
    | OCNDisplayNumber
    | OCNDisplaySum
    | OCNDisplayMul
    | OCNDisplayOmega
    | OCNDisplayOmega0
    | OCNDisplayPsi
    | OCNDisplayConst;

// ========== 合并同类项 ==========

/** 合并 sum 中相邻的同类项。同类指 displayOCN(-, 'plain') 结果相同。 */
export function merge_sum(terms: OCNDisplay[]): OCNDisplay {
    if (terms.length === 0) return { type: 'number', value: 0 };
    const result: OCNDisplay[] = [];
    let i = 0;
    while (i < terms.length) {
        let j = i + 1;
        const key = display_OCN(terms[i], 'plain');
        while (j < terms.length && display_OCN(terms[j], 'plain') === key) j++;
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

export function display_OCN(e: OCNDisplay, type: DisplayType): string {
    switch (e.type) {
        case 'number':
            return '' + e.value;

        case 'sum':
            return e.terms.map((t) => display_OCN(t, type)).join('+');

        case 'mul_nat': {
            const v = display_OCN(e.value, type);
            // 序数乘法：value × coe，整数写在右边
            if (type === 'latex') return v + '\\cdot ' + e.coe;
            return v + '·' + e.coe;
        }

        case 'omega':
            return display_OCN(
                {
                    type: 'constant',
                    display: 'ω',
                    display_latex: '\\omega ',
                    sup: e.sup,
                },
                type,
            );

        case 'Omega':
            return display_OCN(
                {
                    type: 'constant',
                    display: 'Ω',
                    display_latex: '\\Omega ',
                    sub: e.sub,
                },
                type,
            );

        case 'psi':
            return display_OCN(
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
            const sup_str = e.sup ? display_OCN(e.sup, type) : undefined;
            const sub_str = e.sub ? display_OCN(e.sub, type) : undefined;
            const arg_str = e.arg ? display_OCN(e.arg, type) : '';

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
