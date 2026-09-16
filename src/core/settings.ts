export type Variant = 'FS' | 'FS_alter' | 'FS_short';
export type DisplayMode = 'plain' | 'html' | 'latex';

export interface ExpandSettings {
    FS_index: number;
    notation_id: string;
    notation_equiv: string | undefined;
    variant: Variant;
}

export interface LatexAnalysisSettings {
    subscript_bracket: boolean;
    map_p: boolean;
    map_w: boolean;
    map_e: boolean;
    map_f: boolean;
    map_l: boolean;
    map_W: boolean;
    psi_subscript: boolean;
}

export interface UserScript {
    file_name: string;
    code: string;
    enabled: boolean;
}

/**
 * 初始变体定义: base 记号 X 的第 seq 个变体, 其自定义初始列表。
 * init 存 canonical 字符串(解析→display.plain 回写), 不存 raw expr
 * (JSON.stringify 会把 Infinity 序列化为 null)。
 */
export interface InitVariantDef {
    /** 变体编号(>=1, 同 base 内稠密, 删除回填最小空缺, 不因删除重排他人)。id = `${base_id}$${seq}`。 */
    seq: number;
    /** canonical 初始表达式列表, 严格递减。 */
    init: string[];
}

export interface Settings {
    current_notation_id: string;
    tier: number;
    variant: Variant;
    input_width: number;
    show_input: boolean;
    font_family: string;
    display_mode: DisplayMode;
    notation_name_mode: 'full' | 'simple';
    nav_mode: 'grouped' | 'flat';
    use_delete_to_clear: boolean;
    /** 输入框获得焦点时平滑滚动页面到其位置。 */
    scroll_on_focus: boolean;
    show_diagram: boolean;
    /** 图表使用指定的等价表示绘制, 而非记号当前激活的等价表示。 */
    diagram_use_equiv: boolean;
    /** 图表使用的等价表示: 记号 id → 等价表示 id(缺失或 undefined 表示按原记号绘制)。 */
    diagram_equiv: Record<string, string | undefined>;
    show_latex: boolean;
    show_description: boolean;
    /** 导入时自动展开全部挂载条目。 */
    expand_all_on_import: boolean;
    /** 已勾选"不再显示"的提示 id。 */
    ignored_tip: Record<string, boolean>;
    max_find_fs: number;
    equiv_active: Record<string, string | undefined>;
    equiv_hide_original: Record<string, boolean>;
    shown_equiv: Record<string, Record<string, boolean>>;
    language: 'zh' | 'en';
    color_scheme: string;
    hidden_notations: string[];
    generator_state: Record<string, number>;
    /** 初始变体: base 记号 id → 其变体定义列表(seq 升序)。由 registry 持有, settings 仅作持久化镜像。 */
    variant_state: Record<string, InitVariantDef[]>;
    user_scripts: UserScript[];
    expand: ExpandSettings;
    latex_analysis: LatexAnalysisSettings;
}

export const DEFAULT_SETTINGS: Settings = {
    current_notation_id: 'bm4',
    tier: 0,
    variant: 'FS_short',
    input_width: 180,
    show_input: true,
    font_family: 'Comic Sans MS',
    display_mode: 'html',
    notation_name_mode: 'simple',
    nav_mode: 'grouped',
    use_delete_to_clear: true,
    scroll_on_focus: true,
    show_diagram: true,
    diagram_use_equiv: false,
    diagram_equiv: {},
    show_latex: false,
    show_description: true,
    expand_all_on_import: false,
    ignored_tip: {},
    max_find_fs: 10,
    equiv_active: {},
    equiv_hide_original: {},
    shown_equiv: {},
    language: 'zh',
    color_scheme: 'default',
    hidden_notations: [],
    generator_state: {},
    variant_state: {},
    user_scripts: [],
    expand: { FS_index: 1, notation_id: 'omega', notation_equiv: undefined, variant: 'FS_short' },
    latex_analysis: {
        subscript_bracket: true,
        map_p: false,
        map_w: true,
        map_e: false,
        map_f: false,
        map_l: false,
        map_W: false,
        psi_subscript: false,
    },
};

/**
 * 图表绘制时应当填充的等价表示。
 *
 * 勾选 diagram_use_equiv 时取 diagram_equiv 中为该记号选定的等价表示,
 * 否则取记号当前实际激活的等价表示(equiv_active);undefined 表示按原记号绘制。
 */
export function resolve_diagram_equiv(settings: Settings, notation_id: string): string | undefined {
    if (settings.diagram_use_equiv) return settings.diagram_equiv[notation_id];
    return settings.equiv_active[notation_id];
}
