import { ScreenConfig } from "../main";
import { useEffect, useRef, useState } from "react";
import { availableMonitors } from "@tauri-apps/api/window";
import { ToggleSwitch } from "./ToggleSwitch";

interface ScreenConfigSectionProps {
    screenConfig: ScreenConfig | null;
    onChange: (config: ScreenConfig) => void;
}

export const ScreenConfigSection = ({ screenConfig, onChange }: ScreenConfigSectionProps) => {
    const positionDropdownRef = useRef<HTMLDivElement | null>(null);
    const [availableDisplays, setAvailableDisplays] = useState<Array<{ id: number; label: string }>>([
        { id: 0, label: "Display 0" },
    ]);
    const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);

    const displayPositions = [
        { label: "Full", key: "full" },
        { label: "Left Half", key: "left-half" },
        { label: "Right Half", key: "right-half" },
        { label: "Top Half", key: "top-half" },
        { label: "Bottom Half", key: "bottom-half" },
        { label: "Left Third", key: "left-third" },
        { label: "Middle Third", key: "middle-third" },
        { label: "Right Third", key: "right-third" },
        { label: "Left Two Third", key: "left-two-third" },
        { label: "Right Two Third", key: "right-two-third" },
    ];

    const renderPositionIcon = (key: string) => {
        const strokeColor = "rgb(148 163 184)";
        const fillColor = "rgb(37 99 235)";

        switch (key) {
            case "left-half":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="2" width="6" height="12" fill={fillColor} />
                    </svg>
                );
            case "right-half":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="8" y="2" width="6" height="12" fill={fillColor} />
                    </svg>
                );
            case "top-half":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="2" width="12" height="6" fill={fillColor} />
                    </svg>
                );
            case "bottom-half":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="8" width="12" height="6" fill={fillColor} />
                    </svg>
                );
            case "left-third":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="2" width="4" height="12" fill={fillColor} />
                    </svg>
                );
            case "middle-third":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="6" y="2" width="4" height="12" fill={fillColor} />
                    </svg>
                );
            case "right-third":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="10" y="2" width="4" height="12" fill={fillColor} />
                    </svg>
                );
            case "left-two-third":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="2" width="8" height="12" fill={fillColor} />
                    </svg>
                );
            case "right-two-third":
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="6" y="2" width="8" height="12" fill={fillColor} />
                    </svg>
                );
            case "full":
            default:
                return (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke={strokeColor} strokeWidth="1" />
                        <rect x="2" y="2" width="12" height="12" fill={fillColor} />
                    </svg>
                );
        }
    };

    const deriveDisplayLabel = (
        index: number,
        monitorName: string | null,
        width: number,
        height: number
    ) => {
        const trimmedName = (monitorName || "").trim();
        const friendlyName = trimmedName.length > 0 ? trimmedName : `Display ${index}`;
        return `${index}: ${friendlyName} (${width}×${height})`;
    };

    const [config, setConfig] = useState<ScreenConfig>(
        screenConfig || {
            controller_list: {
                visible: false,
                x: 0,
                y: 0,
                fss: true,
                ctr: true,
                app: true,
                twr: true,
                gnd: true,
                atis: false,
                obs: false,
            },
            metar_list: {
                visible: false,
                x: 0,
                y: 0,
                title: true,
            },
            title_bar: {
                visible: true,
                file_name: true,
                controller_name: true,
                primary_frequency: true,
                atis_frequency: false,
                clock: true,
                leader: true,
                filter: true,
                transition_level: true,
            },
            display_config: {
                id: 0,
                position: 0,
                maximized: false,
            },
            connect_sel_to_sil: true,
            connect_dep_to_sel: true,
            connect_sil_to_top: false,
        }
    );

    useEffect(() => {
        setConfig(
            screenConfig || {
                controller_list: {
                    visible: false,
                    x: 0,
                    y: 0,
                    fss: true,
                    ctr: true,
                    app: true,
                    twr: true,
                    gnd: true,
                    atis: false,
                    obs: false,
                },
                metar_list: {
                    visible: false,
                    x: 0,
                    y: 0,
                    title: true,
                },
                title_bar: {
                    visible: true,
                    file_name: true,
                    controller_name: true,
                    primary_frequency: true,
                    atis_frequency: false,
                    clock: true,
                    leader: true,
                    filter: true,
                    transition_level: true,
                },
                display_config: {
                    id: 0,
                    position: 0,
                    maximized: false,
                },
                connect_sel_to_sil: true,
                connect_dep_to_sel: true,
                connect_sil_to_top: false,
            }
        );
    }, [screenConfig]);

    useEffect(() => {
        let cancelled = false;

        const loadDisplays = async () => {
            try {
                const monitors = await availableMonitors();
                if (cancelled) {
                    return;
                }

                if (monitors.length === 0) {
                    setAvailableDisplays([{ id: 0, label: "Display 0" }]);
                    return;
                }

                setAvailableDisplays(
                    monitors.map((monitor, index) => {
                        const width = monitor.size?.width ?? 0;
                        const height = monitor.size?.height ?? 0;
                        return {
                            id: index,
                            label: deriveDisplayLabel(index, monitor.name, width, height),
                        };
                    })
                );
            } catch {
                if (!cancelled) {
                    setAvailableDisplays([{ id: 0, label: "Display 0" }]);
                }
            }
        };

        loadDisplays();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!positionDropdownRef.current) {
                return;
            }

            if (!positionDropdownRef.current.contains(event.target as Node)) {
                setIsPositionDropdownOpen(false);
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    const handleChange = (newConfig: ScreenConfig) => {
        setConfig(newConfig);
        onChange(newConfig);
    };

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-secondary-600 bg-secondary-700/30 p-4">
                <div className="mb-3">
                    <h4 className="text-sm font-semibold text-secondary-100">Display Configuration</h4>
                    <p className="mt-1 text-xs text-secondary-500">Select target monitor and placement behavior.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <label className="text-xs text-secondary-400">Display ID</label>
                        <select
                            value={config.display_config.id}
                            onChange={(e) =>
                                handleChange({
                                    ...config,
                                    display_config: {
                                        ...config.display_config,
                                        id: parseInt(e.target.value) || 0,
                                    },
                                })
                            }
                            className="mt-1 w-full rounded border border-secondary-500 bg-secondary-700 px-3 py-2 text-sm font-medium text-secondary-100"
                        >
                            {availableDisplays.map((display) => (
                                <option key={display.id} value={display.id} className="bg-secondary-700 text-secondary-100">
                                    {display.label}
                                </option>
                            ))}
                            {!availableDisplays.some((display) => display.id === config.display_config.id) && (
                                <option value={config.display_config.id} className="bg-secondary-700 text-secondary-100">Display {config.display_config.id}</option>
                            )}
                        </select>
                    </div>

                    <div className="relative lg:col-span-4" ref={positionDropdownRef}>
                        <label className="text-xs text-secondary-400">Position</label>
                        <button
                            type="button"
                            onClick={() => setIsPositionDropdownOpen((previous) => !previous)}
                            className="mt-1 flex w-full items-center justify-between rounded border border-secondary-500 bg-secondary-700 px-3 py-2 text-sm font-medium text-secondary-100"
                        >
                            <span className="flex items-center gap-2">
                                {renderPositionIcon(displayPositions[config.display_config.position]?.key ?? "full")}
                                <span>{displayPositions[config.display_config.position]?.label ?? "Full"}</span>
                            </span>
                            <span className="text-secondary-400">▾</span>
                        </button>

                        {isPositionDropdownOpen && (
                            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded border border-secondary-600 bg-secondary-700 shadow-lg">
                                {displayPositions.map((position, index) => {
                                    const isSelected = config.display_config.position === index;

                                    return (
                                        <button
                                            key={position.key}
                                            type="button"
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${isSelected
                                                ? "bg-secondary-600 text-white"
                                                : "text-secondary-100 hover:bg-secondary-600"
                                                }`}
                                            onClick={() => {
                                                handleChange({
                                                    ...config,
                                                    display_config: {
                                                        ...config.display_config,
                                                        position: index,
                                                    },
                                                });
                                                setIsPositionDropdownOpen(false);
                                            }}
                                        >
                                            {renderPositionIcon(position.key)}
                                            <span>{position.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-4">
                        <span className="text-xs text-secondary-400">Window Mode</span>
                        <ToggleSwitch
                            compact
                            label="Maximized"
                            description="Open radar in maximized state"
                            checked={config.display_config.maximized}
                            onChange={(nextChecked) =>
                                handleChange({
                                    ...config,
                                    display_config: {
                                        ...config.display_config,
                                        maximized: nextChecked,
                                    },
                                })
                            }
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-secondary-600 bg-secondary-700/30 p-4">
                <div className="mb-3">
                    <h4 className="text-sm font-semibold text-secondary-100">Title Bar</h4>
                    <p className="mt-1 text-xs text-secondary-500">Control visible elements in the radar title bar.</p>
                </div>

                <div className="space-y-2">
                    <ToggleSwitch
                        label="Show Title Bar"
                        checked={config.title_bar.visible}
                        onChange={(nextChecked) =>
                            handleChange({
                                ...config,
                                title_bar: {
                                    ...config.title_bar,
                                    visible: nextChecked,
                                },
                            })
                        }
                    />

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {[
                            ["file_name", "File Name"],
                            ["controller_name", "Controller Name"],
                            ["primary_frequency", "Primary Frequency"],
                            ["atis_frequency", "ATIS Frequency"],
                            ["clock", "Clock"],
                            ["leader", "Leader"],
                            ["filter", "Filter"],
                            ["transition_level", "Transition Level"],
                        ].map(([key, label]) => (
                            <ToggleSwitch
                                key={key}
                                compact
                                label={label}
                                checked={config.title_bar[key as keyof typeof config.title_bar] as boolean}
                                onChange={(nextChecked) =>
                                    handleChange({
                                        ...config,
                                        title_bar: {
                                            ...config.title_bar,
                                            [key]: nextChecked,
                                        },
                                    })
                                }
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
