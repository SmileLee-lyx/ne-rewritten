import { NotationCategoryDefinition } from '@/notation-definition.ts';

export const category_sdbms: NotationCategoryDefinition = {
    id: 'category-sdbms',
    name: 'SDBMS',
    simple_name: 'SDBMS',
    parent_id: 'category-mn',
};

export const category_sdbms_test: NotationCategoryDefinition = {
    id: 'category-sdbms-test',
    name: { id: 'category-name.sdbms-test' },
    parent_id: 'category-sdbms',
};
