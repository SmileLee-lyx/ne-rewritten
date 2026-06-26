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
    use_delete_to_clear: boolean;
    max_find_fs: number;
    equiv_active: Record<string, string | undefined>;
    equiv_hide_original: Record<string, boolean>;
    language: 'zh' | 'en';
    shown_notations: string[];
    hidden_notations: string[];
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
    use_delete_to_clear: true,
    max_find_fs: 10,
    equiv_active: {},
    equiv_hide_original: {},
    language: 'zh',
    shown_notations: [],
    hidden_notations: [],
};
