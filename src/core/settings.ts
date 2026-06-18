export type Variant = 'FS' | 'FS_alter' | 'FS_short';

export interface Settings {
    current_notation_id: string;
    tier: number;
    variant: Variant;
    input_width: number;
    show_input: boolean;
    font_family: string;
    display_html_mode: boolean;
    notation_name_mode: 'full' | 'simple';
    equiv_active: Record<string, string | undefined>;
    equiv_hide_original: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
    current_notation_id: 'bm4',
    tier: 0,
    variant: 'FS_short',
    input_width: 180,
    show_input: true,
    font_family: 'Comic Sans MS',
    display_html_mode: true,
    notation_name_mode: 'simple',
    equiv_active: {},
    equiv_hide_original: {},
};
