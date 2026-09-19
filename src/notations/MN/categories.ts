import { NotationCategoryDefinition } from '@/notation-definition.ts';

export const category_mn: NotationCategoryDefinition = {
    id: 'category-mn',
    name: 'Mountain Notation',
    simple_name: 'MN',
};
export const category_hypcos_w2mn: NotationCategoryDefinition = {
    id: 'category-hypcos-w2mn',
    name: "HypCos's ω2MN",
    simple_name: 'HypCos',
    parent_id: 'category-mn',
};

export const category_ta0_mn: NotationCategoryDefinition = {
    id: 'category-ta0-mn',
    name: "test_alpha0's e0MN",
    simple_name: 'ta0',
    parent_id: 'category-mn',
};
