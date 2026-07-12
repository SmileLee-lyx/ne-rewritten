import { computed, reactive, ref } from 'vue';
import { on_registry_change } from '@/core/registry.ts';
import { Notifier } from '@/composables/use_notify.ts';

interface UiState {
    configMode: boolean;
    isFlashing: boolean;
    flashShowSimple: boolean;
}

const state = reactive<UiState>({
    configMode: false,
    isFlashing: false,
    flashShowSimple: false,
});

const showHotkeys = ref(false);
const showTips = ref(false);
const showColorTheme = ref(false);
const showReset = ref(false);
const showUserDefined = ref(false);

// registry 变更通知器
const registry_notifier = new Notifier();
on_registry_change(() => registry_notifier.notify());

export function use_ui_states() {
    let flash_timer: ReturnType<typeof setInterval> | null = null;

    function start_flash() {
        state.isFlashing = true;
        state.flashShowSimple = false;
        flash_timer = setInterval(() => {
            state.flashShowSimple = !state.flashShowSimple;
        }, 800);
    }

    function stop_flash() {
        state.isFlashing = false;
        if (flash_timer !== null) {
            clearInterval(flash_timer);
            flash_timer = null;
        }
    }

    return {
        configMode: computed(() => state.configMode),
        setConfigMode: (v: boolean) => {
            state.configMode = v;
        },
        toggleConfigMode: () => {
            state.configMode = !state.configMode;
        },
        isFlashing: computed(() => state.isFlashing),
        flashShowSimple: computed(() => state.flashShowSimple),
        start_flash,
        stop_flash,
        showHotkeys,
        showTips,
        showColorTheme,
        showReset,
        showUserDefined,
        registry_notifier,
    };
}
