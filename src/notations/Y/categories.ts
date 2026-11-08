import { NotationCategoryDefinition } from '@/notation-definition.ts';

export const category_y: NotationCategoryDefinition = {
    id: 'category-y',
    name: 'Y sequence',
    simple_name: 'Y',
};

export const category_y_variants: NotationCategoryDefinition = {
    id: 'category-y-variants',
    parent_id: 'category-y',
    name: 'Limit Variants',
};

export const category_xy: NotationCategoryDefinition = {
    id: 'category-xy',
    parent_id: 'category-y',
    name: 'X-Y Notation',
};
