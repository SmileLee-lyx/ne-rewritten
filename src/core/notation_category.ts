import type { NotationDefinition } from '@/notation-definition.ts';

export interface NotationCategoryGenerator {
    start: number;
    initial: number;
    create: (n: number) => NotationDefinition<any>;
}

export interface NotationCategoryDefinition {
    id: string;
    name: string;
    parent_id?: string;
    generator?: NotationCategoryGenerator;
}
