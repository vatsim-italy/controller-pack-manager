import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { ListConfig } from "../main";

interface ListsSectionProps {
    listConfigs: ListConfig[] | null;
    resumeLayout: ListConfig[] | null;
}

type RadarResolutionKey = "custom" | "1080p" | "2k" | "4k";

type RadarColumn = {
    values: string[];
};

type RadarListConfig = {
    id: string;
    visible: boolean;
    x: number;
    y: number;
    line_number: number;
    ordered_by_index: number;
    columns: RadarColumn[];
};

type DragState = {
    listId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
};

type DropdownState = "closed" | "add-list" | "list-menu";

const RADAR_RESOLUTIONS: Record<RadarResolutionKey, { label: string; width: number; height: number }> = {
    custom: { label: "Custom", width: 1920, height: 1080 },
    "1080p": { label: "1080p (1920×1080)", width: 1920, height: 1080 },
    "2k": { label: "2K (2560×1440)", width: 2560, height: 1440 },
    "4k": { label: "4K (3840×2160)", width: 3840, height: 2160 },
};

const getDetectedResolution = (): { width: number; height: number } => {
    const width = window.screen.width;
    const height = window.screen.height;
    return { width, height };
};

const columnIdFromValues = (values: string[]) => values[0] ?? "-";
const columnWidthChars = (values: string[]) => {
    const parsedWidth = Number.parseInt(values[1] ?? "", 10);
    return Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 6;
};
const isColumnVisible = (values: string[]) => values[2] === "1";
const setColumnVisibility = (values: string[], visible: boolean) => {
    const nextValues = [...values];
    nextValues[2] = visible ? "1" : "0";
    return nextValues;
};
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const placeholderValueForColumn = (columnId: string, widthChars: number) => {
    const fallback = "-".repeat(Math.max(1, widthChars));
    if (!columnId) {
        return fallback;
    }

    if (columnId.length >= widthChars) {
        return columnId.slice(0, widthChars);
    }

    return `${columnId}${" ".repeat(widthChars - columnId.length)}`;
};

export const ListsSection = forwardRef<
    { getCurrentLayout: () => ListConfig[] | null },
    ListsSectionProps
>(({ listConfigs, resumeLayout }, ref) => {
    const detected = useMemo(() => getDetectedResolution(), []);

    const [resolution, setResolution] = useState<RadarResolutionKey>(() => {
        const customRes = RADAR_RESOLUTIONS.custom;
        customRes.width = detected.width;
        customRes.height = detected.height;
        return "custom";
    });
    const [radarLists, setRadarLists] = useState<RadarListConfig[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [dropdownState, setDropdownState] = useState<DropdownState>("closed");
    const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [dropdownDragState, setDropdownDragState] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
    const [listMenuDragOffset, setListMenuDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [addListSearchQuery, setAddListSearchQuery] = useState<string>("");

    const canvasRef = useRef<HTMLDivElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const addListSearchInputRef = useRef<HTMLInputElement | null>(null);

    // Expose getCurrentLayout method via ref
    useImperativeHandle(ref, () => ({
        getCurrentLayout: () => {
            if (!listConfigs) {
                return null;
            }

            // Get currently visible lists
            const visibleLists = radarLists.filter((list) => list.visible);

            if (visibleLists.length === 0) {
                return null;
            }

            // Map radarLists back to ListConfig format by merging with original data
            return visibleLists
                .map((radarList) => {
                    const originalConfig = listConfigs.find((config) => config.id === radarList.id);
                    if (!originalConfig) {
                        return null;
                    }

                    return {
                        ...originalConfig,
                        visible: radarList.visible,
                        x: radarList.x,
                        y: radarList.y,
                        line_number: radarList.line_number,
                        ordered_by_index: radarList.ordered_by_index,
                        columns: radarList.columns.map((col) => ({
                            values: col.values,
                        })),
                    };
                })
                .filter((config): config is ListConfig => config !== null);
        },
    }), [listConfigs, radarLists]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNowFullscreen = Boolean(document.fullscreenElement);
            setIsFullscreen(isNowFullscreen);

            // Prevent scrollbars when fullscreen
            if (isNowFullscreen) {
                document.body.style.overflow = "hidden";
                document.documentElement.style.overflow = "hidden";
            } else {
                document.body.style.overflow = "";
                document.documentElement.style.overflow = "";
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!listConfigs || listConfigs.length === 0) {
            setRadarLists([]);
            setSelectedListId(null);
            return;
        }

        const resumeById = new Map((resumeLayout ?? []).map((config) => [config.id, config]));

        const normalized = listConfigs.map((config) => ({
            // Base pool should not depend on currently selected profile configuration.
            // Resume data, when available, is applied as an overlay.
            id: config.id,
            visible: resumeById.get(config.id)?.visible ?? false,
            x: resumeById.get(config.id)?.x ?? config.x,
            y: resumeById.get(config.id)?.y ?? config.y,
            line_number: 0,
            ordered_by_index:
                resumeById.get(config.id)?.ordered_by_index ?? config.ordered_by_index,
            columns:
                resumeById.get(config.id)?.columns.map((column) => ({ values: [...column.values] }))
                ?? config.columns.map((column) => ({ values: [...column.values] })),
        }));

        setRadarLists(normalized);
        setSelectedListId(null);
    }, [listConfigs, resumeLayout]);

    useEffect(() => {
        if (dropdownState !== "add-list") {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            addListSearchInputRef.current?.focus();
            addListSearchInputRef.current?.select();
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [dropdownState]);

    const activeResolution = RADAR_RESOLUTIONS[resolution];

    const visibleRadarLists = useMemo(
        () => radarLists.filter((listConfig) => listConfig.visible),
        [radarLists]
    );

    const selectedList = useMemo(
        () => radarLists.find((listConfig) => listConfig.id === selectedListId) ?? null,
        [radarLists, selectedListId]
    );

    // Drag handling
    useEffect(() => {
        if (dragState === null) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerId !== dragState.pointerId) {
                return;
            }

            const deltaX = event.clientX - dragState.startClientX;
            const deltaY = event.clientY - dragState.startClientY;

            const nextX = Math.round(clamp(dragState.startX + deltaX, 0, activeResolution.width));
            const nextY = Math.round(clamp(dragState.startY + deltaY, 0, activeResolution.height));

            setRadarLists((previousLists) =>
                previousLists.map((listConfig) =>
                    listConfig.id === dragState.listId
                        ? {
                            ...listConfig,
                            x: nextX,
                            y: nextY,
                            visible: true,
                        }
                        : listConfig
                )
            );
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.pointerId === dragState.pointerId) {
                setDragState(null);
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [activeResolution.height, activeResolution.width, dragState]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if user is typing in an input or textarea
            const target = event.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true") {
                return;
            }

            // F key for fullscreen toggle
            if (event.key.toLowerCase() === "f") {
                event.preventDefault();
                toggleFullscreen();
                return;
            }

            // Press + or A to add list
            if (event.key === "+" || event.key.toLowerCase() === "a") {
                event.preventDefault();
                setDropdownState("add-list");
                setDropdownPos({ x: 10, y: 10 });
                setDropdownDragState({ startX: 10, startY: 10, currentX: 10, currentY: 10 });
                setAddListSearchQuery("");
                return;
            }

            // Delete selected list with Backspace or Delete
            if ((event.key === "Backspace" || event.key === "Delete") && selectedListId) {
                event.preventDefault();
                removeList(selectedListId);
                return;
            }

            // Escape closes dropdowns
            if (event.key === "Escape") {
                setDropdownState("closed");
                setAddListSearchQuery("");
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedListId]);

    const removeList = (listId: string) => {
        setRadarLists((previousLists) =>
            previousLists.map((listConfig) =>
                listConfig.id === listId ? { ...listConfig, visible: false } : listConfig
            )
        );

        if (selectedListId === listId) {
            const nextSelected = radarLists.find((listConfig) => listConfig.id !== listId && listConfig.visible);
            setSelectedListId(nextSelected?.id ?? null);
        }
    };

    const removeAllLists = () => {
        setRadarLists((previousLists) =>
            previousLists.map((listConfig) => ({ ...listConfig, visible: false }))
        );
        setSelectedListId(null);
    };

    const addList = (listId: string) => {
        setRadarLists((previousLists) =>
            previousLists.map((listConfig) => {
                if (listConfig.id !== listId) {
                    return listConfig;
                }

                // Spawn at canvas center
                const nextX = Math.round(activeResolution.width / 2 - 150);
                const nextY = Math.round(activeResolution.height / 2 - 40);

                return {
                    ...listConfig,
                    visible: true,
                    x: clamp(nextX, 0, activeResolution.width - 100),
                    y: clamp(nextY, 0, activeResolution.height - 100),
                };
            })
        );

        setDropdownState("closed");
        setSelectedListId(listId);
    };

    const toggleColumnVisibility = (listId: string, columnIndex: number, visible: boolean) => {
        setRadarLists((previousLists) =>
            previousLists.map((listConfig) => {
                if (listConfig.id !== listId) {
                    return listConfig;
                }

                return {
                    ...listConfig,
                    columns: listConfig.columns.map((column, index) =>
                        index === columnIndex
                            ? {
                                ...column,
                                values: setColumnVisibility(column.values, visible),
                            }
                            : column
                    ),
                };
            })
        );
    };

    const updateSelectedCoordinates = (axis: "x" | "y", value: number) => {
        if (!selectedListId) {
            return;
        }

        setRadarLists((previousLists) =>
            previousLists.map((listConfig) => {
                if (listConfig.id !== selectedListId) {
                    return listConfig;
                }

                const max = axis === "x" ? activeResolution.width : activeResolution.height;
                return {
                    ...listConfig,
                    [axis]: clamp(Math.round(value), 0, max),
                };
            })
        );
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, listConfig: RadarListConfig) => {
        if ((event.target as HTMLElement).closest("button")) {
            return;
        }

        event.preventDefault();
        setSelectedListId(listConfig.id);
        setDropdownState("closed");
        setDragState({
            listId: listConfig.id,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: listConfig.x,
            startY: listConfig.y,
        });
    };

    const handleTitleClick = (event: React.MouseEvent<HTMLButtonElement>, listId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedListId(listId);
        setDropdownState("list-menu");
        setListMenuDragOffset({ x: 0, y: 0 });
        setDropdownPos({
            x: event.currentTarget.getBoundingClientRect().left,
            y: event.currentTarget.getBoundingClientRect().bottom,
        });
    };

    const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>, listId: string) => {
        event.preventDefault();
        event.stopPropagation();
        removeList(listId);
    };

    const toggleFullscreen = async () => {
        if (!rootRef.current || !document.fullscreenEnabled) {
            return;
        }

        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        await rootRef.current.requestFullscreen();
    };

    if (!listConfigs || listConfigs.length === 0) {
        return (
            <div className="rounded-xl border border-secondary-600 bg-dark-header p-6 shadow-md">
                <h2 className="text-xl font-semibold text-white">List Configs</h2>
                <p className="mt-2 text-sm text-secondary-500">No list configurations were detected.</p>
            </div>
        );
    }

    return (
        <div
            ref={rootRef}
            className={`relative flex w-full flex-col overflow-hidden border border-secondary-600 bg-secondary-700 shadow-md ${isFullscreen ? 'h-screen border-0' : 'h-[calc(100vh-180px)]'}`}
        >
            {/* Canvas */}
            <div
                ref={canvasRef}
                className="custom-scrollbar relative flex-1 overflow-auto"
                onClick={() => {
                    if (dropdownState !== "closed") {
                        setDropdownState("closed");
                        setAddListSearchQuery("");
                    }
                }}
                style={{
                    backgroundImage:
                        "linear-gradient(to right, rgb(71 85 105 / 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgb(71 85 105 / 0.35) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            >
                <div style={{ width: `${activeResolution.width}px`, height: `${activeResolution.height}px` }} className="relative">
                    {visibleRadarLists.map((listConfig) => {
                        const visibleColumns = listConfig.columns.filter((column) => isColumnVisible(column.values));
                        const totalWidth = visibleColumns.reduce((sum, column) => sum + columnWidthChars(column.values), 0);

                        return (
                            <div
                                key={listConfig.id}
                                className={`absolute border border-secondary-600 bg-secondary-700 text-secondary-100 shadow-md euroscope-font ${selectedListId === listConfig.id ? "ring-2 ring-primary-600" : ""
                                    }`}
                                style={{
                                    left: `${listConfig.x}px`,
                                    top: `${listConfig.y}px`,
                                    width: `${totalWidth}ch`,
                                }}
                                onPointerDown={(event) => handlePointerDown(event, listConfig)}
                            >
                                <div className="flex items-center justify-between border-b border-secondary-600">
                                    <button
                                        type="button"
                                        className="flex-1 cursor-pointer px-2 py-2 text-left text-sm font-bold uppercase tracking-wide text-secondary-100 hover:bg-secondary-600"
                                        onClick={(event) => handleTitleClick(event, listConfig.id)}
                                    >
                                        {listConfig.id}
                                    </button>
                                    <button
                                        type="button"
                                        className="border-l border-secondary-600 px-2 py-2 text-xs font-bold text-accent-danger hover:bg-secondary-600"
                                        onClick={(event) => handleDeleteClick(event, listConfig.id)}
                                        title="Delete (or press Delete/Backspace)"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <table className="w-full border-collapse text-xs leading-tight">
                                    <thead>
                                        <tr>
                                            {visibleColumns.map((column) => {
                                                const widthChars = columnWidthChars(column.values);
                                                return (
                                                    <th
                                                        key={`${listConfig.id}-header-${column.values.join("|")}`}
                                                        className="border-b border-secondary-600 px-1 py-0.5 text-left font-semibold text-secondary-100"
                                                        style={{ width: `${widthChars}ch`, overflow: "hidden" }}
                                                    >
                                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                                            {columnIdFromValues(column.values)}
                                                        </span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {visibleColumns.map((column) => {
                                                const columnId = columnIdFromValues(column.values);
                                                const widthChars = columnWidthChars(column.values);
                                                return (
                                                    <td
                                                        key={`${listConfig.id}-row-0-${column.values.join("|")}`}
                                                        className="px-1 py-0.5 text-secondary-100"
                                                        style={{ width: `${widthChars}ch`, overflow: "hidden" }}
                                                    >
                                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                                            {placeholderValueForColumn(columnId, widthChars)}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {visibleColumns.length === 0 && (
                                            <tr>
                                                <td className="px-2 py-1 text-xs text-secondary-500">No visible columns</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Header Controls */}
            {!isFullscreen && (
                <div className="flex items-center justify-between gap-3 border-t border-secondary-600 bg-dark-header px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary-500">
                            Canvas: {activeResolution.width} × {activeResolution.height} | Lists: {visibleRadarLists.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-secondary-100">
                            <span className="text-secondary-500">Resolution</span>
                            <select
                                className="rounded border border-secondary-500 bg-secondary-700 px-2 py-1 text-xs text-secondary-100"
                                value={resolution}
                                onChange={(event) => setResolution(event.target.value as RadarResolutionKey)}
                            >
                                {Object.entries(RADAR_RESOLUTIONS).map(([key, preset]) => (
                                    <option key={key} value={key}>
                                        {preset.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="button"
                            className="relative border border-secondary-500 bg-secondary-700 px-2 py-1 text-secondary-100 hover:bg-secondary-600"
                            onClick={() => {
                                setDropdownState("add-list");
                                setDropdownPos({ x: 10, y: 60 });
                                setDropdownDragState({ startX: 10, startY: 60, currentX: 10, currentY: 60 });
                                setAddListSearchQuery("");
                            }}
                            title="Add list (Press A or +)"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="border border-secondary-500 bg-secondary-700 px-2 py-1 text-secondary-100 hover:bg-secondary-600"
                            onClick={removeAllLists}
                            title="Remove all lists"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H3v2h18V7h-5z" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="border border-secondary-500 bg-secondary-700 px-2 py-1 text-secondary-100 hover:bg-secondary-600"
                            onClick={toggleFullscreen}
                            disabled={!document.fullscreenEnabled}
                            title="Toggle fullscreen"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isFullscreen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8L5 5M8 5L5 8M16 8L19 5M16 5L19 8M8 16L5 19M8 19L5 16M16 16L19 19M16 19L19 16" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5L5 8M5 5L8 5M19 5L19 8M19 5L16 5M5 19L5 16M5 19L8 19M19 19L19 16M19 19L16 19" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Add List Dropdown */}
            {dropdownState === "add-list" && (
                <div
                    className="absolute z-50 max-h-96 w-48 cursor-move border border-secondary-600 bg-secondary-700 shadow-lg custom-scrollbar"
                    style={{
                        top: `${dropdownPos.y + (dropdownDragState?.currentY || 0) - (dropdownDragState?.startY || 0)}px`,
                        left: `${dropdownPos.x + (dropdownDragState?.currentX || 0) - (dropdownDragState?.startX || 0)}px`,
                    }}
                    onPointerDown={(event) => {
                        if ((event.target as HTMLElement).closest("button")) {
                            return;
                        }
                        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                        setDropdownDragState({
                            startX: event.clientX,
                            startY: event.clientY,
                            currentX: rect.left,
                            currentY: rect.top,
                        });
                    }}
                >
                    <div
                        className="overflow-y-auto"
                        style={{
                            maxHeight: "384px",
                        }}
                        onPointerMove={(event) => {
                            if (!dropdownDragState || event.buttons === 0) {
                                return;
                            }

                            const deltaX = event.clientX - dropdownDragState.startX;
                            const deltaY = event.clientY - dropdownDragState.startY;

                            setDropdownPos((prev) => ({
                                x: prev.x + deltaX,
                                y: prev.y + deltaY,
                            }));

                            setDropdownDragState((prev) =>
                                prev ? { ...prev, currentX: prev.currentX + deltaX, currentY: prev.currentY + deltaY } : null
                            );
                        }}
                        onPointerUp={() => {
                            setDropdownDragState(null);
                        }}
                        onPointerLeave={() => {
                            setDropdownDragState(null);
                        }}
                    >
                        {/* Search Input */}
                        <div className="border-b border-secondary-600 sticky top-0 bg-secondary-700 p-2">
                            <input
                                ref={addListSearchInputRef}
                                type="text"
                                placeholder="Search lists..."
                                className="w-full rounded border border-secondary-500 bg-secondary-600 px-2 py-1 text-xs text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-1 focus:ring-primary-600"
                                value={addListSearchQuery}
                                onChange={(e) => setAddListSearchQuery(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>

                        {radarLists
                            .filter((list) => !list.visible)
                            .filter((list) => list.id.toLowerCase().includes(addListSearchQuery.toLowerCase()))
                            .map((listConfig) => (
                                <button
                                    key={listConfig.id}
                                    type="button"
                                    className="w-full border-b border-secondary-600 px-3 py-2 text-left text-sm text-secondary-100 hover:bg-secondary-600"
                                    onClick={() => addList(listConfig.id)}
                                >
                                    {listConfig.id}
                                </button>
                            ))}
                        {radarLists.filter((list) => !list.visible).filter((list) => list.id.toLowerCase().includes(addListSearchQuery.toLowerCase())).length === 0 &&
                            !radarLists.every((list) => list.visible) && (
                                <div className="px-3 py-2 text-xs text-secondary-500">No lists found</div>
                            )}
                        {radarLists.every((list) => list.visible) && (
                            <div className="px-3 py-2 text-xs text-secondary-500">All lists visible</div>
                        )}
                    </div>
                </div>
            )}

            {/* List Menu Dropdown (columns & position) */}
            {dropdownState === "list-menu" && selectedList && (
                <div
                    className="absolute z-50 w-96 border border-secondary-600 bg-dark-header shadow-lg"
                    style={{
                        top: `${Math.min(dropdownPos.y, window.innerHeight - 500) + listMenuDragOffset.y}px`,
                        left: `${Math.min(dropdownPos.x, window.innerWidth - 400) + listMenuDragOffset.x}px`,
                    }}
                >
                    <div
                        className="flex cursor-move items-center justify-between border-b border-secondary-600 px-4 py-3 hover:bg-secondary-600"
                        onPointerDown={(event) => {
                            const startX = event.clientX - listMenuDragOffset.x;
                            const startY = event.clientY - listMenuDragOffset.y;

                            const handleMove = (moveEvent: PointerEvent) => {
                                if (moveEvent.pointerId === event.pointerId) {
                                    const deltaX = moveEvent.clientX - startX;
                                    const deltaY = moveEvent.clientY - startY;
                                    setListMenuDragOffset({ x: deltaX, y: deltaY });
                                }
                            };

                            const handleUp = (upEvent: PointerEvent) => {
                                if (upEvent.pointerId === event.pointerId) {
                                    window.removeEventListener("pointermove", handleMove);
                                    window.removeEventListener("pointerup", handleUp);
                                }
                            };

                            window.addEventListener("pointermove", handleMove);
                            window.addEventListener("pointerup", handleUp);
                        }}
                    >
                        <div>
                            <h3 className="text-sm font-semibold text-white">{selectedList.id}</h3>
                            <p className="mt-1 text-xs text-secondary-500">Position & Columns</p>
                        </div>
                        <button
                            type="button"
                            className="text-secondary-400 hover:text-secondary-100"
                            onClick={() => setDropdownState("closed")}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                        {/* Position Controls + Max rows */}
                        <div className="grid grid-cols-3 gap-2">
                            <label className="text-xs text-secondary-500">
                                X
                                <input
                                    type="number"
                                    className="mt-1 w-full rounded border border-secondary-500 bg-secondary-700 px-2 py-1 text-sm text-secondary-100"
                                    value={selectedList.x}
                                    min={0}
                                    max={activeResolution.width}
                                    onChange={(event) =>
                                        updateSelectedCoordinates("x", Number.parseInt(event.target.value || "0", 10))
                                    }
                                />
                            </label>

                            <label className="text-xs text-secondary-500">
                                Y
                                <input
                                    type="number"
                                    className="mt-1 w-full rounded border border-secondary-500 bg-secondary-700 px-2 py-1 text-sm text-secondary-100"
                                    value={selectedList.y}
                                    min={0}
                                    max={activeResolution.height}
                                    onChange={(event) =>
                                        updateSelectedCoordinates("y", Number.parseInt(event.target.value || "0", 10))
                                    }
                                />
                            </label>

                            <label className="text-xs text-secondary-500">
                                Max rows
                                <input
                                    type="number"
                                    className="mt-1 w-full rounded border border-secondary-500 bg-secondary-700 px-2 py-1 text-sm text-secondary-100"
                                    value={selectedList.line_number}
                                    min={0}
                                    max={65535}
                                    onChange={(event) => {
                                        const nextValue = clamp(
                                            Number.parseInt(event.target.value || "0", 10),
                                            0,
                                            65535
                                        );
                                        setRadarLists((previousLists) =>
                                            previousLists.map((listConfig) =>
                                                listConfig.id === selectedList.id
                                                    ? { ...listConfig, line_number: nextValue }
                                                    : listConfig
                                            )
                                        );
                                    }}
                                />
                            </label>
                        </div>

                        {/* Order By Column Select */}
                        <div>
                            <label className="text-xs text-secondary-500">
                                Order By
                                <select
                                    className="mt-1 w-full rounded border border-secondary-500 bg-secondary-700 px-2 py-1 text-sm text-secondary-100"
                                    value={selectedList.ordered_by_index}
                                    onChange={(event) => {
                                        const nextIndex = Number.parseInt(event.target.value || "1", 10);
                                        setRadarLists((previousLists) =>
                                            previousLists.map((listConfig) =>
                                                listConfig.id === selectedList.id
                                                    ? { ...listConfig, ordered_by_index: nextIndex }
                                                    : listConfig
                                            )
                                        );
                                    }}
                                >
                                    {selectedList.columns.map((column, index) => (
                                        <option key={index} value={index + 1}>
                                            {columnIdFromValues(column.values)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="border-t border-secondary-600 pt-3">
                            <p className="text-xs font-semibold text-white mb-2">Columns</p>
                            <div className="max-h-48 space-y-1 overflow-y-auto custom-scrollbar">
                                {selectedList.columns.map((column, index) => {
                                    const columnId = columnIdFromValues(column.values);
                                    const visible = isColumnVisible(column.values);

                                    return (
                                        <label
                                            key={`${selectedList.id}-col-${index}`}
                                            className="flex items-center justify-between gap-2 rounded border border-secondary-600 px-2 py-1 text-xs cursor-pointer hover:bg-secondary-600"
                                        >
                                            <span className="text-secondary-100">{columnId}</span>
                                            <input
                                                type="checkbox"
                                                checked={visible}
                                                onChange={(event) =>
                                                    toggleColumnVisibility(selectedList.id, index, event.target.checked)
                                                }
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

ListsSection.displayName = "ListsSection";
