import { createApp, reactive, watch } from 'vue';
import App from '@/App.vue';
import { BM4, seq_0Y } from '@/notations/BM-like/BM.ts';
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
import { list_notations, register_notation } from '@/core/registry';
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
import { n_MN } from '@/notations/SMN/n_MN.ts';
import { SA_omega2_MN } from '@/notations/SMN/SA_omega2_MN.ts';
import { S_omega2_MN } from '@/notations/SMN/S_omega2_MN.ts';
import { S_omega_pow_omega_MN } from '@/notations/SMN/S_omega_pow_omega_MN.ts';
import { BOCF_EBO } from '@/notations/OCN/BOCF_EBO.ts';
import { NOCF_EBO } from '@/notations/OCN/NOCF_EBO.ts';
import { Minus1_Y } from '@/notations/Y/minus1_Y.ts';
import { T_Minus1_Y } from '@/notations/Y/T_minus1_Y.ts';
import { Minus1_Y_nSS } from '@/notations/BM-like/Minus1_Y_nSS.ts';
import { T_Minus1_Y_nSS } from '@/notations/BM-like/T_Minus1_Y_nSS.ts';
import { BT_Minus1_Y_nSS } from '@/notations/BM-like/BT_Minus1_Y_nSS.ts';
import { BTstar_Minus1_Y_nSS } from '@/notations/BM-like/BTstar_Minus1_Y_nSS.ts';
import { BTL_Minus1_Y_nSS } from '@/notations/BM-like/BTL_Minus1_Y_nSS.ts';

register_notation(omega);
register_notation(BM4);
register_notation(TBM);
register_notation(Minus1_Y);
register_notation(T_Minus1_Y);
register_notation(seq_0Y);
register_notation(Y_seq);
register_notation(omega_Y_weak);
register_notation(omega_Y_actual);
register_notation(omega_Y_medium);
register_notation(omega_Y_strong);
register_notation(Minus1_Y_nSS(0));
register_notation(Minus1_Y_nSS(1));
register_notation(Minus1_Y_nSS(2));
register_notation(Minus1_Y_nSS(3));
register_notation(T_Minus1_Y_nSS(0));
register_notation(T_Minus1_Y_nSS(1));
register_notation(T_Minus1_Y_nSS(2));
register_notation(T_Minus1_Y_nSS(3));
register_notation(BT_Minus1_Y_nSS(0));
register_notation(BT_Minus1_Y_nSS(1));
register_notation(BT_Minus1_Y_nSS(2));
register_notation(BT_Minus1_Y_nSS(3));
register_notation(BTstar_Minus1_Y_nSS(1));
register_notation(BTstar_Minus1_Y_nSS(2));
register_notation(BTstar_Minus1_Y_nSS(3));
register_notation(BTL_Minus1_Y_nSS(1));
register_notation(BTL_Minus1_Y_nSS(2));
register_notation(BTL_Minus1_Y_nSS(3));
register_notation(omega_MN);
register_notation(n_MN(1));
register_notation(n_MN(2));
register_notation(n_MN(3));
register_notation(T_omega_MN);
register_notation(A_omega2_MN2);
register_notation(wA_omega2_MN2);
register_notation(A_omega2_MN3);
register_notation(wA_omega2_MN3);
register_notation(SA_omega2_MN);
register_notation(S_omega2_MN);
register_notation(S_omega_pow_omega_MN);
register_notation(BHM);
register_notation(BSM);
register_notation(UPMS);
register_notation(LPMS);
register_notation(DEN);
register_notation(DEN2);
register_notation(DEN3);
register_notation(LMN);
register_notation(LON);
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
register_notation(BOCF_EBO);
register_notation(NOCF_EBO);

window.notations ??= {};
for (let notation of list_notations()) {
    window.notations[notation.id] = notation;
}

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

function init_notation_lists(settings: Settings) {
    if (settings.shown_notations.length === 0 && settings.hidden_notations.length === 0) {
        // 首次加载：用所有记号
        settings.shown_notations = list_notations().map((n) => n.id);
    } else {
        // 已有配置：新记号追加到 shown 尾部
        const all_ids = new Set(list_notations().map((n) => n.id));
        const known = new Set([...settings.shown_notations, ...settings.hidden_notations]);
        for (const id of all_ids) {
            if (!known.has(id)) settings.shown_notations.push(id);
        }
    }
}

const settings: Settings = reactive({
    ...DEFAULT_SETTINGS,
    ...load_settings(),
});
init_notation_lists(settings);

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
