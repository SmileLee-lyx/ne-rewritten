import { list_notations } from '@/core/registry';

export interface NotationCategory {
    id: string;
    name: string;
    /** 这类包含的记号 ID 列表。 */
    notation_ids: string[];
}

/** 构建记号分类列表（固定两层：分类 → 记号）。 */
export function build_categories(): NotationCategory[] {
    const all_ids = list_notations().map((n) => n.id);

    return [
        {
            id: 'all-notations',
            name: 'All notations',
            notation_ids: all_ids,
        },
        {
            id: 'y',
            name: 'Y sequence',
            notation_ids: ['0y', 'y-seq', 'omega-y-weak', 'omega-y-actual', 'omega-y-medium', 'omega-y-strong'],
        },
        {
            id: 'bm-like',
            name: 'BM-like',
            notation_ids: ['bm4', 'tbm', 'bhm', 'bsm', 'upms', 'lpms'],
        },
        {
            id: 'den',
            name: 'DEN',
            notation_ids: ['den', 'den2', 'den3'],
        },
        {
            id: 'ocn',
            name: 'OCN',
            notation_ids: ['lmn', 'lon', 'bocf-ebo', 'nocf-ebo'],
        },
        {
            id: 'mn',
            name: 'MN',
            notation_ids: [
                'omega-mn',
                't-omega-mn',
                'a-omega2-mn-2',
                'weak-a-omega2-mn-2',
                'a-omega2-mn-3',
                'weak-a-omega2-mn-3',
                '1-MN',
                '2-MN',
                '3-MN',
                'SA-omega2-MN',
                'S-omega2-MN',
                'S-omega^omega-MN',
            ],
        },
        {
            id: 'ton',
            name: 'TON',
            notation_ids: [
                'ton-drc',
                'ton-drp',
                'ton-dr',
                'ton-drpc',
                'ton-i',
                'ton-ibp',
                'ton-m',
                'ton-mc',
                'ton-mpc',
            ],
        },
        {
            id: 'asan',
            name: 'aSAN',
            notation_ids: ['asan-1', 'asan-2', 'asan-3', 'asan-tilde3plus'],
        },
        {
            id: 'other',
            name: 'Other',
            notation_ids: ['omega'],
        },
        {
            id: 'legacy',
            name: 'original NE',
            notation_ids: [
                'bm4',
                'tbm',
                'bhm',
                'bsm',
                'upms',
                'lpms',
                'y-seq',
                'omega-y-weak',
                'omega-y-actual',
                'omega-y-medium',
                'omega-y-strong',
                't-omega-mn',
                'a-omega2-mn-2',
                'weak-a-omega2-mn-2',
                'a-omega2-mn-3',
                'weak-a-omega2-mn-3',
                'den',
                'den2',
                'den3',
                'lmn',
                'lon',
                'ton-drc',
                'ton-drp',
                'ton-dr',
                'ton-drpc',
                'ton-i',
                'ton-ibp',
                'ton-m',
                'ton-mc',
                'ton-mpc',
                'asan-1',
                'asan-2',
                'asan-3',
                'asan-tilde3plus',
            ],
        },
    ];
}
