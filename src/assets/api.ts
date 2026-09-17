export type NotationDisplay<T> = (a: T) => string;

/** 调试校验函数: 输入表达式, 返回是否通过。 */
export type TestFunc<T> = (expr: T) => boolean;

export type NotationDisplaySpec<T> =
    | NotationDisplay<T>
    | {
          plain: NotationDisplay<T>;
          html?: NotationDisplay<T>;
          latex?: NotationDisplay<T>;
          from_display?: (str: string) => T;
      };

export interface NotationDefinition<T> {
    id: string;
    name: string;
    simple_name?: string;
    description?: string | string[];
    category_id?: string;
    display: NotationDisplaySpec<T>;
    display_equiv?: Record<string, NotationDisplaySpec<T>>;
    is_limit: (a: T) => boolean;
    compare: (a: T, b: T) => number;
    FS: (a: T, index: number) => T;
    FS_alter?: (a: T, index: number) => T;
    FS_short?: (a: T, index: number) => T;
    draw_diagram?: DiagramControl<T, any>;

    /**
     * 山脉图(可选): 返回"形状 + 布局"的纯结构数据, 供山脉图面板渲染成 HTML 表格形式的山脉图。
     * 与 draw_diagram 共用同一份数据, 但不涉及像素, 也不涉及上下翻转(HTML 版固定按行标小者在上绘制)。
     * undefined 表示该表达式没有山脉图。
     */
    mountain_view?: (expr: T, data: any) => MountainViewSource | undefined;

    init: () => T[];

    debug?: Record<string, any>;

    /**
     * Debug 校验器(仅调试用): 存在时, 每次展开创建新节点都会对该表达式运行;
     * 返回 false 时仅在控制台打印警告, 节点照常创建。
     * 可写单个 TestFunc, 也可写 Record<string, TestFunc<T>>——后者会运行其中全部校验函数,
     * 并在未通过时额外打印所有未通过的字段名。
     * 每次建节点都有调用开销, 正式发布(或分发给他人)前请删除该字段。
     */
    debug_verification?: TestFunc<T> | Record<string, TestFunc<T>>;
}

export interface NotationCategoryGenerator {
    start: number;
    initial: number;
    create: (n: number) => NotationDefinition<any>;
}

export interface NotationCategoryDefinition {
    id: string;
    name: string;
    simple_name?: string;
    parent_id?: string;
    generator?: NotationCategoryGenerator;
}

export type DiagramAction = {
    type: 'scroll';
    direction: 'up' | 'down' | 'left' | 'right';
    step: number;
};

export type DiagramControlSetting =
    | {
          type: 'boolean';
          name: string;
          field_name: string;
      }
    | {
          type: 'number';
          name: string;
          min?: number;
          max?: number;
          field_name: string;
      }
    | {
          type: 'info';
          name: string;
      };

export interface DiagramControl<T, DataType> {
    default_data: DataType;
    draw_diagram: (expr: T, data: DataType) => Diagram | undefined;
    settings?: DiagramControlSetting[];
    handle_action?: (data: DataType, action: DiagramAction) => DataType | null;
}

export interface Rgba {
    r: number;
    g: number;
    b: number;
    a?: number;
}

/** 图的颜色规格: 直接给 Rgba, 或用 type 引用当前主题 palette 中的颜色 (如 'text' | 'background' | 'red' | 'gray')。 */
export type ColorSpec = { type: string } | { color: Rgba };

export type Element =
    | {
          type: 'circle';
          x: number;
          y: number;
          r: number;
          stroke: boolean;
          stroke_color?: ColorSpec;
          fill: boolean;
          fill_color?: ColorSpec;
          width?: number;
      }
    | {
          type: 'line';
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          stroke: boolean;
          stroke_color?: ColorSpec;
          width?: number;
      }
    | {
          type: 'text';
          x: number;
          y: number;
          text: string;
          fill: boolean;
          fill_color?: ColorSpec;
          size?: number;
          align?: 'left' | 'center' | 'right';
      };

export interface ExtraText {
    text: string;
    x: number;
    y: number;
    size?: number;
    color?: ColorSpec;
    align?: 'left' | 'center' | 'right';
    display_html?: boolean;
}

export interface Diagram {
    width: number;
    height: number;
    elements: Element[];
    extra_text: ExtraText[];
}

// ============ 山脉图 ============
// 以下类型与 draw_mountain_diagram 一并提供给自定义记号; draw_mountain_diagram 由运行环境注入, 可直接调用。

/** 山脉图中的一个节点。节点出现在 shape 中即表示该格有节点; 不在 shape 中的格子留空。 */
export interface MountainNode<V> {
    /** 该节点所在的行高向量(记号自己的载体类型)。 */
    vertical: V;
    /** 该格显示的文字。 */
    text: string;
    /** 左腿折线的落点, 写作 shape[i][j] 的下标; 省略或越界表示无左腿。 */
    leg_target?: [number, number];
}

/** 山脉形状: shape[i] 为第 i 列的节点; 列序即显示顺序(左→右), 列内顺序任意。 */
export type MountainShape<V> = MountainNode<V>[][];

/** 布局选项: 把记号自己的行高语义翻译成布局量。 */
export interface MountainLayoutOptions<V> {
    /** 行高向量 → 显示字符串; 同时作为值语义去重键, 并作为 row_label 的默认值。 */
    vertical_display: (v: V) => string;
    /** 行高向量的次序, 决定行的上下关系。 */
    vertical_compare: (a: V, b: V) => number;
    /** 相邻两行之间的分割线数量(纯布局量, 0 表示两行紧邻且无分割线)。 */
    separator_count: (higher: V, lower: V) => number;
    /** 行标文字; 返回 undefined 表示该行不显示标号。默认为 vertical_display。 */
    row_label?: (v: V, index: number) => string | undefined;
    /** 额外强制纳入排序、但没有节点落在其上的行高向量。 */
    extra_verticals?: V[];
    /** 单行基准高度(默认 40)。 */
    row_height?: number;
    /** 每条额外分割线的高度增量(默认 5)。 */
    row_gap?: number;
}

/** 绘制选项: 只影响画布呈现, 与布局无关。 */
export interface MountainDiagramOptions {
    /** 列宽(默认 30)。 */
    column_width?: number;
    /** 左侧行标列的宽度(默认 50)。 */
    row_label_width?: number;
    /** 连线两端的偏移(默认 10), 使线与节点文字之间留出空隙。 */
    connector_offset?: number;
    /** 图上下的留白(默认 10)。 */
    outer_padding?: number;
    /** 字号(默认 14)。 */
    font_size?: number;
    /** 是否上下翻转。 */
    invert_vertical?: boolean;
    /** 行标是否按 HTML 显示。 */
    display_html_row_label?: boolean;
    /** 节点文字是否按 HTML 显示。 */
    display_html_entry?: boolean;
}

/** 山脉图面板所需的数据: 与画布版共用同一份"形状 + 布局", 但不含像素与上下翻转。 */
export interface MountainViewSource<V = any> {
    shape: MountainShape<V>;
    layout: MountainLayoutOptions<V>;
    /** 行标是否按 HTML 渲染(对应画布版的 display_html_row_label)。 */
    display_html_row_label?: boolean;
    /** 格子文字是否按 HTML 渲染(对应画布版的 display_html_entry)。 */
    display_html_entry?: boolean;
}

/**
 * 绘制山脉图: 由"形状 + 布局选项"算出并绘制, 返回可交给 draw_diagram 的图表。
 *
 * 该函数由运行环境注入, 在自定义记号脚本中可直接调用(无需 import)。
 * 同一份 shape/layout 也可以直接交给 mountain_view, 由山脉图面板渲染成 HTML 表格。
 */
declare function draw_mountain_diagram<V>(
    shape: MountainShape<V>,
    layout: MountainLayoutOptions<V>,
    draw?: MountainDiagramOptions,
): Diagram | undefined;
