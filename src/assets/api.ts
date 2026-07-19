export type NotationDisplay<T> = (a: T) => string;

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

    /** Key into the i18n table for credit text displayed below the notation tree. */
    credit_text_id?: string;

    /** Debug helpers — not consumed by the app but accessible at runtime. */
    debug?: Record<string, any>;
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

export interface DiagramControl<T, DataType> {
    default_data: DataType;
    draw_diagram: (expr: T, data: DataType) => Diagram | undefined;
    handle_action?: (data: DataType, action: DiagramAction) => DataType | null;
}

export interface Rgba {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export type Element =
    | {
          type: 'circle';
          x: number;
          y: number;
          r: number;
          stroke: boolean;
          stroke_color?: Rgba;
          fill: boolean;
          fill_color?: Rgba;
          width?: number;
      }
    | {
          type: 'line';
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          stroke: boolean;
          stroke_color?: Rgba;
          width?: number;
      }
    | {
          type: 'text';
          x: number;
          y: number;
          text: string;
          fill: boolean;
          fill_color?: Rgba;
          size?: number;
          align?: 'left' | 'center' | 'right';
      };

export interface ExtraText {
    text: string;
    x: number;
    y: number;
    size?: number;
    color?: Rgba;
    align?: 'left' | 'center' | 'right';
    display_html?: boolean;
}

export interface Diagram {
    width: number;
    height: number;
    elements: Element[];
    extra_text: ExtraText[];
}
