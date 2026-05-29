import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import App from "./App";
import "./styles/global.css";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

export type Profile = {
    name: string,
    realName: string | null,
    certificate: string | null,
    server: string | null,
    connectToVatsim: boolean | null,
    configuredLists: ListConfig[] | null,
    proxyServer: string | null,
    startupAsr: string | null,
    screenConfig: ScreenConfig | null,
}

export type ListColumn = {
    values: string[],
}

export type ListConfig = {
    id: string,
    visible: boolean,
    x: number,
    y: number,
    line_number: number,
    resizable: boolean,
    ordered_by_index: number,
    header_only: boolean,
    columns: ListColumn[],
}

export type ControllerListConfig = {
    visible: boolean,
    x: number,
    y: number,
    fss: boolean,
    ctr: boolean,
    app: boolean,
    twr: boolean,
    gnd: boolean,
    atis: boolean,
    obs: boolean,
}

export type TitleBarConfig = {
    visible: boolean,
    file_name: boolean,
    controller_name: boolean,
    primary_frequency: boolean,
    atis_frequency: boolean,
    clock: boolean,
    leader: boolean,
    filter: boolean,
    transition_level: boolean,
}

export type MetarListConfig = {
    visible: boolean,
    x: number,
    y: number,
    title: boolean,
}

export type DisplayConfig = {
    id: number,
    position: number,
    maximized: boolean,
}

export type ScreenConfig = {
    controller_list: ControllerListConfig,
    metar_list: MetarListConfig,
    title_bar: TitleBarConfig,
    display_config: DisplayConfig,
    connect_sel_to_sil: boolean,
    connect_dep_to_sel: boolean,
    connect_sil_to_top: boolean,
}

const renderApp = (
    euroscopeConfigPath: string | null,
    installedAiracVersion: string | null,
    latestAiracVersion: string | null,
    installedPluginVersion: string | null,
    newAiracVersionAvailable: boolean | null,
    profiles: Profile[] | null,
    hoppieCode: string | null,
    listConfigs: ListConfig[] | null,
    startupError: string | null
) => {
    root.render(
        <React.StrictMode>
            <App
                euroscopeConfigPath={euroscopeConfigPath}
                installedAiracVersion={installedAiracVersion}
                latestAiracVersion={latestAiracVersion}
                installedPluginVersion={installedPluginVersion}
                newAiracVersionAvailable={newAiracVersionAvailable}
                profiles={profiles}
                hoppieCode={hoppieCode}
                listConfigs={listConfigs}
                startupError={startupError}
            />
        </React.StrictMode>,
    );
};

const LoadingScreen = () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary-700 text-secondary-100">
        <div className="flex w-full max-w-sm flex-col gap-4 px-6">
            <div className="flex items-center gap-3">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                <div>
                    <h1 className="text-lg font-semibold text-white">Starting Controller Pack Manager</h1>
                    <p className="mt-1 text-sm text-secondary-400">Checking installed files and update status...</p>
                </div>
            </div>
            <div className="h-1 overflow-hidden rounded bg-secondary-600">
                <div className="h-full w-1/2 animate-pulse rounded bg-primary-500" />
            </div>
        </div>
    </div>
);

root.render(
    <React.StrictMode>
        <LoadingScreen />
    </React.StrictMode>,
);

type FolderGateProps = {
    startupError: string | null;
    onFolderResolved: (path: string) => Promise<void>;
};

const FolderGate = ({ startupError, onFolderResolved }: FolderGateProps) => {
    const [isPickingFolder, setIsPickingFolder] = React.useState(false);
    const [actionError, setActionError] = React.useState<string | null>(null);

    const pickFolder = async () => {
        setActionError(null);
        setIsPickingFolder(true);

        try {
            const selectedPath = await open({
                directory: true,
                multiple: false,
            });

            if (!selectedPath || Array.isArray(selectedPath)) {
                return;
            }

            await onFolderResolved(selectedPath);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsPickingFolder(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary-700 px-4 text-secondary-100">
            <div className="w-full max-w-md rounded-2xl border border-secondary-600 bg-secondary-800/90 p-6 shadow-2xl">
                <h1 className="text-2xl font-semibold text-white">Where is it?</h1>
                <p className="mt-2 text-sm leading-6 text-secondary-300">
                    Select the EuroScope folder before the rest of the app loads.
                </p>

                {startupError && (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                        {startupError}
                    </div>
                )}

                {actionError && (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                        {actionError}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="btn-primary px-4 py-2 text-sm font-bold"
                        onClick={pickFolder}
                        disabled={isPickingFolder}
                    >
                        {isPickingFolder ? "Opening..." : "Choose Folder"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const bootstrap = async () => {
    let euroscopeConfigPath: string | null = null;
    let startupError: string | null = null;

    const captureError = (error: unknown) => {
        startupError = startupError ?? (error instanceof Error ? error.message : String(error));
    };

    const readOptional = async <T,>(command: string): Promise<T | null> => {
        try {
            return await invoke<T>(command);
        } catch (error) {
            captureError(error);
            return null;
        }
    };

    const readNonCritical = async <T,>(command: string): Promise<T | null> => {
        try {
            return await invoke<T>(command);
        } catch (error) {
            console.error(`Startup command failed: ${command}`, error);
            return null;
        }
    };

    const loadAndRenderApp = async (detectedEuroscopeConfigPath: string) => {
        const [installedAiracResult, latestAiracResult, installedPluginResult, profilesResult, updateStatusResult, listConfigsResult, hoppieCodeResult] = await Promise.all([
            readOptional<string | null>("get_detected_installed_airac_version"),
            // Fetching the latest AIRAC version can fail due to network/GitHub issues;
            // treat it as non-critical so the app doesn't show a startup error.
            readNonCritical<string | null>("get_latest_airac_version"),
            readOptional<string | null>("get_installed_plugin_version"),
            readOptional<Profile[] | null>("get_existing_profiles"),
            readNonCritical<boolean>("refresh_airac_update_status"),
            readOptional<ListConfig[] | null>("get_list_configs"),
            readOptional<string | null>("get_hoppie_code"),
        ]);

        renderApp(
            detectedEuroscopeConfigPath,
            installedAiracResult,
            latestAiracResult,
            installedPluginResult,
            updateStatusResult,
            profilesResult,
            hoppieCodeResult,
            listConfigsResult,
            startupError
        );
    };

    euroscopeConfigPath = await readOptional<string | null>("get_detected_euroscope_config_dir");

    if (!euroscopeConfigPath) {
        root.render(
            <React.StrictMode>
                <FolderGate
                    startupError={startupError}
                    onFolderResolved={async (selectedPath) => {
                        const resolvedPath = await invoke<string | null>("set_euroscope_config_dir", { path: selectedPath });
                        await loadAndRenderApp(resolvedPath ?? selectedPath);
                    }}
                />
            </React.StrictMode>,
        );
        return;
    }

    await loadAndRenderApp(euroscopeConfigPath);
};

void bootstrap();
