import { ref } from 'vue';
import type { Diagram } from '@/core/diagram_types.ts';
import { DiagramAction, DiagramControl } from '@/notation-definition.ts';

const diagram = ref<Diagram | null>(null);
const visible = ref(false);
const pos_x = ref(0);
const pos_y = ref(0);

let current_control: DiagramControl<any, any> | null = null;
let current_expr: any = null;
let current_data: any = null;

function refresh() {
    if (current_control && current_expr !== null) {
        diagram.value = current_control.draw_diagram(current_expr, current_data) ?? null;
    }
}

export function use_diagram() {
    function show<T>(control: DiagramControl<T, any>, expr: T, x: number, y: number, equiv?: string) {
        if (current_control !== control) {
            current_data = { ...control.default_data };
            current_control = control;
        }
        // 若 data 有 current_equiv 字段，则同步传入的等价变体
        if (typeof current_data === 'object' && current_data && 'current_equiv' in current_data) {
            const new_equiv = equiv || undefined;
            if (current_data.current_equiv !== new_equiv) {
                current_data = { ...current_data, current_equiv: new_equiv };
            }
        }
        current_expr = expr;
        diagram.value = control.draw_diagram(expr, current_data) ?? null;
        pos_x.value = x;
        pos_y.value = y;
        visible.value = true;
    }

    function hide() {
        visible.value = false;
    }

    function dispatch_action(action: DiagramAction) {
        if (!current_control?.handle_action) return;
        const new_data = current_control.handle_action(current_data, action);
        if (new_data !== null) {
            current_data = new_data;
            refresh();
        }
    }

    return { diagram, visible, pos_x, pos_y, show, hide, dispatch_action };
}
