import type { ViewEdge } from './views.ts';
export const ipdCore: {
    plain(raw: string): string;
    parse(raw: string): string;
    fs(raw: string, n: number): string;
    compare(a: string, b: string): number;
    isLimit(raw: string): boolean;
    counts(raw: string): string;
    treeHtml(raw: string): string;
    graph(raw: string): { columns: number; edges: ViewEdge[] } | null;
};
