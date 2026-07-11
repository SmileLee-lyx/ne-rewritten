import { createApp, reactive, watch } from 'vue';
import App from '@/App.vue';
import { BM4, seq_0Y } from '@/notations/BM-like/BM.ts';
import { omega } from '@/notations/Misc/Omega.ts';
import { TBM } from '@/notations/BM-like/TBM.ts';
import { Y_seq } from '@/notations/Y/Y.ts';
import {
    category_y_omega,
    omega_Y_actual,
    omega_Y_medium,
    omega_Y_strong,
    omega_Y_weak,
} from '@/notations/Y/Omega_Y.ts';
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
import { LPMS, LPTSS } from '@/notations/BM-like/LPMS.ts';
import { wMM } from '@/notations/BM-like/wMM.ts';
import { CMS } from '@/notations/BM-like/CMS.ts';
import { BLM } from '@/notations/BM-like/BLM.ts';
import {
    get_generator_state,
    init_generator,
    list_notations,
    register_category,
    register_notation,
    registry_version,
    set_generator_state,
} from '@/core/registry.ts';
import { DEFAULT_SETTINGS, Settings } from '@/core/settings.ts';
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
import { category_n_mn } from '@/notations/SMN/n_MN.ts';
import { SA_omega2_MN } from '@/notations/SMN/SA_omega2_MN.ts';
import { S_omega2_MN } from '@/notations/SMN/S_omega2_MN.ts';
import { S_omega_pow_omega_MN } from '@/notations/SMN/S_omega_pow_omega_MN.ts';
import { BOCF_EBO } from '@/notations/OCN/BOCF_EBO.ts';
import { NOCF_EBO } from '@/notations/OCN/NOCF_EBO.ts';
import { Minus1_Y } from '@/notations/Y/minus1_Y.ts';
import { T_Minus1_Y } from '@/notations/Y/T_minus1_Y.ts';
import { category_bm_minus1_y_nss } from '@/notations/BM-like/Minus1_Y_nSS.ts';
import { category_bm_t_minus1_y_nss } from '@/notations/BM-like/T_Minus1_Y_nSS.ts';
import { category_bm_bt_minus1_y_nss } from '@/notations/BM-like/BT_Minus1_Y_nSS.ts';
import { category_bm_bt_star_minus1_y_nss } from '@/notations/BM-like/BT_star_Minus1_Y_nSS.ts';
import { category_bm_btl_minus1_y_nss } from '@/notations/BM-like/BTL_Minus1_Y_nSS.ts';
import { MOCF_EBO } from '@/notations/OCN/MOCF_EBO.ts';
import { Inacc_OCF } from '@/notations/OCN/Inacc_OCF.ts';
import { UPS1_1r5 } from '@/notations/OCN/UPS1_1r5.ts';
import { VeblenPhi } from '@/notations/Misc/Veblen.ts';
import { category_hypcos_w2mn, category_mn } from '@/notations/MN/categories.ts';
import { category_smile_mn } from '@/notations/SMN/categories.ts';
import { category_ton } from '@/notations/TON/categories.ts';
import { category_asan } from '@/notations/aSAN/categories.ts';
import { category_den } from '@/notations/DEN/categories.ts';
import { category_bm_like } from '@/notations/BM-like/categories.ts';
import { category_y } from '@/notations/Y/categories.ts';
import { category_ocf, category_ocn } from '@/notations/OCN/categories.ts';
import { finite_Mahlo_OCF } from '@/notations/OCN/finite_Mahlo_OCF.ts';
import { cOCF } from '@/notations/OCN/cOCF.ts';
import { n_shifted_psi } from '@/notations/OCN/n_shifted_psi.ts';

const SETTINGS_KEY_NAME = 'ne-settings';

function load_settings(): Partial<Settings> {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY_NAME);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return {};

        // 迁移: v1 display_html_mode(boolean) → v2 display_mode(string)
        if ('display_html_mode' in parsed && !('display_mode' in parsed)) {
            parsed.display_mode = parsed.display_html_mode ? 'html' : 'plain';
            delete parsed.display_html_mode;
        }

        // 迁移: 移除已废弃的 shown_notations
        delete (parsed as any).shown_notations;

        return parsed;
    } catch {
        return {};
    }
}

const settings: Settings = reactive({
    ...DEFAULT_SETTINGS,
    ...load_settings(),
});

set_generator_state(settings.generator_state ?? {});

watch(
    () => settings,
    (val) => {
        localStorage.setItem(SETTINGS_KEY_NAME, JSON.stringify(val));
    },
    { deep: true },
);

// generator 状态变更时同步回 settings（由 settings 的 deep watch 自动保存）
watch(
    () => registry_version.value,
    () => {
        settings.generator_state = { ...get_generator_state() };
    },
);

register_notation(omega);
register_notation(VeblenPhi);
register_category(category_ocf);
register_notation(BOCF_EBO);
register_notation(MOCF_EBO);
register_notation(NOCF_EBO);
register_notation(Inacc_OCF);
register_notation(finite_Mahlo_OCF);
register_category(category_y);
register_notation(Minus1_Y);
register_notation(T_Minus1_Y);
register_notation(seq_0Y);
register_notation(Y_seq);
register_category(category_y_omega);
register_notation(omega_Y_weak);
register_notation(omega_Y_actual);
register_notation(omega_Y_medium);
register_notation(omega_Y_strong);
register_category(category_bm_like);
register_notation(BM4);
register_notation(TBM);
register_notation(BHM);
register_notation(BSM);
register_notation(BLM);
register_notation(UPMS);
register_notation(LPMS);
register_notation(LPTSS);
register_notation(wMM);
register_notation(CMS);
register_category(category_bm_minus1_y_nss);
init_generator(category_bm_minus1_y_nss);
register_category(category_bm_t_minus1_y_nss);
init_generator(category_bm_t_minus1_y_nss);
register_category(category_bm_bt_minus1_y_nss);
init_generator(category_bm_bt_minus1_y_nss);
register_category(category_bm_bt_star_minus1_y_nss);
init_generator(category_bm_bt_star_minus1_y_nss);
register_category(category_bm_btl_minus1_y_nss);
init_generator(category_bm_btl_minus1_y_nss);
register_category(category_mn);
register_category(category_n_mn);
init_generator(category_n_mn);
register_notation(omega_MN);
register_notation(T_omega_MN);
register_category(category_hypcos_w2mn);
register_notation(A_omega2_MN2);
register_notation(wA_omega2_MN2);
register_notation(A_omega2_MN3);
register_notation(wA_omega2_MN3);
register_category(category_smile_mn);
register_notation(SA_omega2_MN);
register_notation(S_omega2_MN);
register_notation(S_omega_pow_omega_MN);
register_category(category_den);
register_notation(DEN);
register_notation(DEN2);
register_notation(DEN3);
register_category(category_ocn);
register_notation(LMN);
register_notation(LON);
register_notation(UPS1_1r5);
register_notation(cOCF);
register_notation(n_shifted_psi);
register_category(category_ton);
register_notation(TON_DRC);
register_notation(TON_DRP);
register_notation(TON_DoR);
register_notation(TON_DRPC);
register_notation(TON_I);
register_notation(TON_IBP);
register_notation(TON_main);
register_notation(TON_MC);
register_notation(TON_MPC);
register_category(category_asan);
register_notation(aSAN);
register_notation(aSAN2);
register_notation(aSAN3);
register_notation(aSAN_tilde3plus);

window.notations ??= {};
for (let notation of list_notations()) {
    window.notations[notation.id] = notation;
}

const app = createApp(App);

app.provide(SETTINGS_KEY, settings);

app.mount('#app');
