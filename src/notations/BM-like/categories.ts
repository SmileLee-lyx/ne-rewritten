import { NotationCategoryDefinition } from '@/core/notation_category.ts';

export const category_bm_like: NotationCategoryDefinition = {
    id: 'category-bm-like',
    name: 'Bashicu Matrix-like notation',
    simple_name: 'BM-like',
};

export const category_minus1_y_nss_series: NotationCategoryDefinition = {
    id: 'category-minus1-y-nss-series',
    name: '-1Y-nSS Series',
    simple_name: '-1Y-nSS Series',
    parent_id: 'category-bm-like',
};
