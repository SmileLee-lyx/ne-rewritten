import Excel from 'exceljs';
import type { AnalysisEntry } from '@/core/analysis';

export async function export_to_xlsx<T>(
    entries: AnalysisEntry<T>[],
    display: (expr: T) => string,
): Promise<ArrayBuffer> {
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet('analysis');

    for (const entry of entries) {
        const row = [display(entry.expr), ...entry.analysis];
        sheet.addRow(row);
    }

    return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function import_from_xlsx<T>(
    buffer: ArrayBuffer,
    from_display: (str: string) => T,
): Promise<AnalysisEntry<T>[]> {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    const entries: AnalysisEntry<T>[] = [];

    sheet.eachRow((row) => {
        const values = row.values as (string | undefined)[];

        const exprStr = values[1];
        if (exprStr === undefined || exprStr === null || exprStr === '') return;

        let expr: T | undefined;
        try {
            expr = from_display(exprStr);
        } catch (e) {
            console.log('xlsx import: skipped row, from_display failed for "' + exprStr + '"', e);
            if (!(entries as any).skipped) (entries as any).skipped = [];
            (entries as any).skipped.push(exprStr);
        }

        if (expr === undefined) return;

        const analysis: string[] = [];
        for (let i = 2; i < values.length; i++) {
            const v = values[i];
            analysis.push(v ?? '');
        }

        entries.push({ expr, analysis });
    });

    return entries;
}

export function download_buffer(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
