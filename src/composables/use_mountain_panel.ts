import { ref } from 'vue';
import { get_notation } from '@/core/registry.ts';
import { resolve_display } from '@/notation-definition.ts';

/**
 * 山脉图面板的全局状态(与 use_diagram 同风格的模块级单例):
 * 面板可在任意组件里通过 use_mountain_panel().open(...) 打开,由 App.vue 统一挂载。
 */
const visible = ref(false);
const notation_id = ref('');
/** 输入框内容:表达式的某种显示形式的字符串。 */
const text = ref('');
/** 输入等价表示(空 = 原记号),用于解析输入框内容。 */
const input_equiv = ref<string | undefined>(undefined);
/** 绘图等价表示(空 = 原记号),作为 mountain_view 的 current_equiv。 */
const draw_equiv = ref<string | undefined>(undefined);

/** 用指定等价表示的显示形式把表达式写回字符串;无法序列化时退化为空串。 */
function serialize(id: string, equiv: string | undefined, expr: unknown): string {
    const notation = get_notation(id);
    if (!notation || expr === undefined) return '';
    const spec = equiv && notation.display_equiv?.[equiv] ? notation.display_equiv[equiv] : notation.display;
    try {
        return resolve_display(spec).plain(expr as never);
    } catch {
        return '';
    }
}

export function use_mountain_panel() {
    function open(id: string, expr: unknown, input_equiv_id?: string, draw_equiv_id?: string) {
        notation_id.value = id;
        input_equiv.value = input_equiv_id;
        // 绘图等价表示由调用方按"图表使用等价表示"设置算好传入(resolve_diagram_equiv);
        // undefined 表示"按原记号绘制", 是合法取值, 不能回退成 input_equiv_id。
        draw_equiv.value = draw_equiv_id;
        text.value = serialize(id, input_equiv_id, expr);
        visible.value = true;
    }

    /** 切换输入等价表示时,把当前表达式按新等价表示重新写出。 */
    function set_input_equiv(equiv: string | undefined, expr: unknown) {
        input_equiv.value = equiv;
        const rewritten = serialize(notation_id.value, equiv, expr);
        if (rewritten !== '') text.value = rewritten;
    }

    function close() {
        visible.value = false;
    }

    return { visible, notation_id, text, input_equiv, draw_equiv, open, set_input_equiv, close };
}
