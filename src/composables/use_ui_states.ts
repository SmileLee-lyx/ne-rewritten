import { computed, reactive, ref } from 'vue';
import { on_registry_change } from '@/core/registry.ts';
import { Notifier } from '@/composables/use_notify.ts';

interface UiState {
    config_mode: boolean;
    is_flashing: boolean;
    flash_show_simple: boolean;
}

const state = reactive<UiState>({
    config_mode: false,
    is_flashing: false,
    flash_show_simple: false,
});

const show_hotkeys = ref(false);
const show_tips = ref(false);
const show_color_theme = ref(false);
const show_reset = ref(false);
const show_user_defined = ref(false);
const show_latex_analysis = ref(false);
const show_api_doc = ref(false);

// registry 变更通知器
const registry_notifier = new Notifier();
on_registry_change(() => registry_notifier.notify());

export function use_ui_states() {
    let flash_timer: ReturnType<typeof setInterval> | null = null;

    function start_flash() {
        state.is_flashing = true;
        state.flash_show_simple = false;
        flash_timer = setInterval(() => {
            state.flash_show_simple = !state.flash_show_simple;
        }, 800);
    }

    function stop_flash() {
        state.is_flashing = false;
        if (flash_timer !== null) {
            clearInterval(flash_timer);
            flash_timer = null;
        }
    }

    return {
        config_mode: computed(() => state.config_mode),
        set_config_mode: (v: boolean) => {
            state.config_mode = v;
        },
        toggle_config_mode: () => {
            state.config_mode = !state.config_mode;
        },
        is_flashing: computed(() => state.is_flashing),
        flash_show_simple: computed(() => state.flash_show_simple),
        start_flash,
        stop_flash,
        show_hotkeys,
        show_tips,
        show_color_theme,
        show_reset,
        show_user_defined,
        show_latex_analysis,
        show_api_doc,
        registry_notifier,
    };
}
