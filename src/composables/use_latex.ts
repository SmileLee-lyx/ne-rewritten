import { ref } from 'vue';
import katex from 'katex';
import { ast_to_latex, parse_latex } from '@/core/latex_ast';
import 'katex/dist/katex.min.css';

const html = ref('');
const visible = ref(false);
const pos_x = ref(0);
const pos_y = ref(0);

export function use_latex() {
    function show(input: string, x: number, y: number) {
        if (input === '') {
            visible.value = false;
            return;
        }
        try {
            const expr = parse_latex(input);
            const latex = ast_to_latex(expr);
            html.value = katex.renderToString(latex, {
                throwOnError: false,
                displayMode: false,
            });
            pos_x.value = x;
            pos_y.value = y;
            visible.value = true;
        } catch {
            visible.value = false;
        }
    }

    function hide() {
        visible.value = false;
    }

    return { html, visible, pos_x, pos_y, show, hide };
}
