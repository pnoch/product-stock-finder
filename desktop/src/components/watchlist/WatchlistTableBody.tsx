import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import type { WatchlistRow } from "../../lib/watchlist-rows";

export function WatchlistTableBody({
  rows,
  virtualRows,
  selectionMode,
  rowVirtualizer,
  renderRow,
}: {
  rows: WatchlistRow[];
  virtualRows: VirtualItem[];
  selectionMode: boolean;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  renderRow: (
    product: Extract<WatchlistRow, { kind: "product" }>["product"],
    virtual?: {
      ref: (el: HTMLTableRowElement | null) => void;
      index: number;
    },
  ) => React.ReactNode;
}) {
  const colSpan = selectionMode ? 9 : 8;
  const last = virtualRows[virtualRows.length - 1];
  const remainder = last ? rowVirtualizer.getTotalSize() - last.end : 0;

  return (
    <tbody>
      {virtualRows.length > 0 && virtualRows[0].start > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={colSpan}
            style={{ height: virtualRows[0].start, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {virtualRows.map((vr) => {
        const row = rows[vr.index];
        if (!row) return null;
        if (row.kind === "header") {
          return (
            <tr
              key={row.key}
              ref={rowVirtualizer.measureElement}
              data-index={vr.index}
              aria-rowindex={vr.index + 1}
            >
              <th
                scope="rowgroup"
                colSpan={colSpan}
                className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/60 text-left"
              >
                {row.title} · {row.count}
              </th>
            </tr>
          );
        }
        return renderRow(row.product, {
          ref: rowVirtualizer.measureElement,
          index: vr.index,
        });
      })}
      {remainder > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: remainder, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </tbody>
  );
}
