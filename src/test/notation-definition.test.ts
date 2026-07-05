import { describe, expect, it } from 'vitest';
import { html_to_latex } from '@/notation-definition.ts';

describe('html_to_latex', () => {
    it('escape LaTeX special chars', () => {
        expect(html_to_latex('a_b')).toBe('a\\_b');
        expect(html_to_latex('a^b')).toBe('a\\^{}b');
        expect(html_to_latex('a{b}c')).toBe('a\\{b\\}c');
        expect(html_to_latex('a}b{c')).toBe('a\\}b\\{c');
        expect(html_to_latex('a\\b')).toBe('a\\textbackslash b');
    });

    it('basic sub and sup', () => {
        expect(html_to_latex('a<sub>1</sub>')).toBe('a_{1}');
        expect(html_to_latex('a<sup>2</sup>')).toBe('a^{2}');
        expect(html_to_latex('a<sub>1</sub><sup>2</sup>')).toBe('a_{1}^{2}');
    });

    it('nested sub', () => {
        expect(html_to_latex('a<sub>b<sub>c</sub>d</sub>e')).toBe('a_{b_{c}d}e');
    });

    it('nested sup', () => {
        expect(html_to_latex('a<sup>b<sup>c</sup>d</sup>e')).toBe('a^{b^{c}d}e');
    });

    it('sub contains sup', () => {
        expect(html_to_latex('a<sub>b<sup>c</sup></sub>')).toBe('a_{b^{c}}');
    });

    it('sup contains sub', () => {
        expect(html_to_latex('a<sup>b<sub>c</sub></sup>')).toBe('a^{b_{c}}');
    });

    it('complex mixed nesting', () => {
        expect(html_to_latex('ω<sup>ω<sub>1</sub></sup>')).toBe('\\omega ^{\\omega _{1}}');
    });

    it('multiple sibling tags', () => {
        expect(html_to_latex('a<sub>1</sub>b<sub>2</sub>c')).toBe('a_{1}b_{2}c');
    });

    it('escape inside tags', () => {
        expect(html_to_latex('a<sub>b_c</sub>')).toBe('a_{b\\_c}');
        expect(html_to_latex('a<sup>b^c</sup>')).toBe('a^{b\\^{}c}');
    });

    it('plain text with no tags', () => {
        expect(html_to_latex('abc123')).toBe('abc123');
        expect(html_to_latex('Ω')).toBe('\\Omega ');
        expect(html_to_latex('ω')).toBe('\\omega ');
        expect(html_to_latex('ψ')).toBe('\\psi ');
    });

    it('empty string', () => {
        expect(html_to_latex('')).toBe('');
    });
});
