import {
  useEditorPanelConfig,
  useConfig,
  useElementData,
  useElementColumns,
} from '@sigmacomputing/plugin';
import type { WorkbookElementData, WorkbookElementColumns } from '@sigmacomputing/plugin';

export interface ColumnMeta {
  id: string;
  name: string;
  type: string;
}

export interface SigmaDataState {
  rows: Record<string, unknown>[];
  columnMeta: ColumnMeta[];
  isConnected: boolean;
  rowCount: number;
}

export function useSigmaData(): SigmaDataState {
  useEditorPanelConfig([
    { name: 'source', type: 'element' },
    { name: 'cols', type: 'column', source: 'source', allowMultiple: true },
  ]);

  const source: string | undefined = useConfig('source');
  const rawData: WorkbookElementData = useElementData('source') ?? {};
  const rawCols: WorkbookElementColumns = useElementColumns('source') ?? {};

  const colIds = Object.keys(rawData);
  const numRows = colIds.length > 0 ? (rawData[colIds[0]]?.length ?? 0) : 0;
  const isConnected = Boolean(source && numRows > 0);

  const columnMeta: ColumnMeta[] = Object.values(rawCols).map((col) => ({
    id: col.id,
    name: col.name,
    type: col.columnType,
  }));

  const rows: Record<string, unknown>[] = Array.from({ length: numRows }, (_, i) =>
    Object.fromEntries(colIds.map((id) => [rawCols[id]?.name ?? id, rawData[id][i]]))
  );

  return { rows, columnMeta, isConnected, rowCount: numRows };
}
