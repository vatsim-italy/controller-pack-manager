import { ListConfig } from "../main";

interface ListConfigCardProps {
    config: ListConfig;
}

const columnIdFromValues = (values: string[]) => values[0] ?? "-";
const isColumnVisible = (values: string[]) => values[2] === "1";

export const ListConfigCard = ({ config }: ListConfigCardProps) => {
    const oneBasedIndex = config.ordered_by_index > 0 ? config.ordered_by_index - 1 : 0;
    const orderedByColumnId = config.columns[oneBasedIndex]?.values?.[0] ?? "Unknown";

    return (
        <article className="rounded-xl border border-secondary-600 bg-dark-header p-4 shadow-md">
            <div className="flex items-start justify-between gap-3 border-b border-secondary-600 pb-3">
                <div>
                    <h3 className="text-lg font-semibold text-white">{config.id}</h3>
                </div>
                <span className="rounded border border-primary-600 bg-primary-600/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-100">
                    Ordered by: {orderedByColumnId}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-secondary-100 md:grid-cols-4">
                <div>
                    <div className="text-xs uppercase tracking-wider text-secondary-500">Visible</div>
                    <div className="mt-1 font-semibold text-white">{config.visible ? "Yes" : "No"}</div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wider text-secondary-500">Header Only</div>
                    <div className="mt-1 font-semibold text-white">{config.header_only ? "Yes" : "No"}</div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wider text-secondary-500">Position</div>
                    <div className="mt-1 font-semibold text-white">X {config.x} • Y {config.y}</div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wider text-secondary-500">Resizable</div>
                    <div className="mt-1 font-semibold text-white">{config.resizable ? "Yes" : "No"}</div>
                </div>
            </div>

            <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary-500">Columns</div>
                <div className="flex flex-wrap gap-2">
                    {config.columns.length > 0 ? (
                        config.columns.map((column, index) => (
                            <span
                                key={`${config.id}-${index}-${column.values.join("|")}`}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${isColumnVisible(column.values)
                                    ? "border-secondary-600 bg-secondary-700 text-secondary-100"
                                    : "border-accent-danger bg-accent-danger/10 text-secondary-500 line-through"
                                    }`}
                            >
                                {index}: {columnIdFromValues(column.values)}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm text-secondary-500">No columns found.</span>
                    )}
                </div>
            </div>
        </article>
    );
};
