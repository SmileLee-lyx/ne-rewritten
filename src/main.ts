import { createApp, reactive, watch } from 'vue';
import App from '@/App.vue';
import { BM4 } from '@/notations/BM-like/BM.ts';
import { omega } from '@/notations/Omega';
import { TBM } from '@/notations/BM-like/TBM.ts';
import { Y_seq } from '@/notations/Y/Y.ts';
import { omega_Y_actual, omega_Y_medium, omega_Y_strong, omega_Y_weak } from '@/notations/Y/Omega_Y.ts';
import { omega_MN } from '@/notations/MN/Omega_MN.ts';
import { T_omega_MN } from '@/notations/MN/T_omega_MN.ts';
import { BHM } from '@/notations/BM-like/BHM.ts';
import { BSM } from '@/notations/BM-like/BSM.ts';
import { DEN } from '@/notations/DEN/DEN.ts';
import { DEN2 } from '@/notations/DEN/DEN2.ts';
import { DEN3 } from '@/notations/DEN/DEN3.ts';
import { aSAN } from '@/notations/aSAN/aSAN.ts';
import { LMN } from '@/notations/OCN/LMN.ts';
import { LON } from '@/notations/OCN/LON.ts';
import { UPMS } from '@/notations/BM-like/UPMS.ts';
import { LPMS } from '@/notations/BM-like/LPMS.ts';
import { register_notation } from '@/core/registry';
import { DEFAULT_SETTINGS, Settings } from '@/core/settings';
import { SETTINGS_KEY } from '@/composables/use_settings.ts';
import { A_omega2_MN2, wA_omega2_MN2 } from '@/notations/MN/Aw2MN2.ts';
import { A_omega2_MN3, wA_omega2_MN3 } from '@/notations/MN/Aw2MN3.ts';
import { TON_DRC } from '@/notations/TON/TON_DRC.ts';
import { TON_DRP } from '@/notations/TON/TON_DRP.ts';
import { TON_DoR } from '@/notations/TON/TON_DoR.ts';
import { TON_DRPC } from '@/notations/TON/TON_DRPC.ts';
import { TON_I } from '@/notations/TON/TON_I.ts';
import { TON_IBP } from '@/notations/TON/TON_IBP.ts';
import { TON_main } from '@/notations/TON/TON_main.ts';
import { TON_MC } from '@/notations/TON/TON_MC.ts';
import { TON_MPC } from '@/notations/TON/TON_MPC.ts';
import { aSAN2 } from '@/notations/aSAN/aSAN2.ts';
import { aSAN3 } from '@/notations/aSAN/aSAN3.ts';
import { aSAN_tilde3plus } from '@/notations/aSAN/aSAN_tilde3plus.ts';

register_notation(omega);
register_notation(BM4);
register_notation(TBM);
register_notation(Y_seq);
register_notation(omega_Y_weak);
register_notation(omega_Y_actual);
register_notation(omega_Y_medium);
register_notation(omega_Y_strong);
register_notation(omega_MN);
register_notation(T_omega_MN);
register_notation(A_omega2_MN2);
register_notation(wA_omega2_MN2);
register_notation(A_omega2_MN3);
register_notation(wA_omega2_MN3);
register_notation(BHM);
register_notation(BSM);
register_notation(DEN);
register_notation(DEN2);
register_notation(DEN3);
register_notation(LMN);
register_notation(LON);
register_notation(UPMS);
register_notation(LPMS);
register_notation(TON_DRC);
register_notation(TON_DRP);
register_notation(TON_DoR);
register_notation(TON_DRPC);
register_notation(TON_I);
register_notation(TON_IBP);
register_notation(TON_main);
register_notation(TON_MC);
register_notation(TON_MPC);
register_notation(aSAN);
register_notation(aSAN2);
register_notation(aSAN3);
register_notation(aSAN_tilde3plus);

window.notations ??= {};
window.notations.Omega = omega;
window.notations.BM4 = BM4;
window.notations.TBM = TBM;

const SETTINGS_KEY_NAME = 'ne-settings';

function load_settings(): Partial<Settings> {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY_NAME);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return {};
        return parsed;
    } catch {
        return {};
    }
}

const settings: Settings = reactive({
    ...DEFAULT_SETTINGS,
    ...load_settings(),
});

watch(
    () => settings,
    (val) => {
        localStorage.setItem(SETTINGS_KEY_NAME, JSON.stringify(val));
    },
    { deep: true },
);

const app = createApp(App);

app.provide(SETTINGS_KEY, settings);

app.mount('#app');
