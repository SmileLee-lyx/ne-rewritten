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
