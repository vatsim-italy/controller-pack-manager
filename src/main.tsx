import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./styles/global.css";

const rootElement = document.getElementById("root") as HTMLElement;

export type Profile = {
    name: string,
    realName: string | null,
    certificate: string | null,
    server: string | null,
    connectToVatsim: boolean | null,
    configuredLists: [string, string][],
    proxyServer: string | null,
}

export type ListColumn = {
    values: string[],
}

export type ListConfig = {
    id: string,
    visible: boolean,
    x: number,
    y: number,
    resizable: boolean,
    ordered_by_index: number,
    header_only: boolean,
    columns: ListColumn[],
}

const renderApp = (
    euroscopeConfigPath: string | null,
    installedAiracVersion: string | null,
    installedPluginVersion: string | null,
    newAiracVersionAvailable: boolean | null,
    profiles: Profile[] | null,
    hoppieCode: string | null,
    listConfigs: ListConfig[] | null,
    startupError: string | null
) => {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App
                euroscopeConfigPath={euroscopeConfigPath}
                installedAiracVersion={installedAiracVersion}
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

const bootstrap = async () => {
    let euroscopeConfigPath: string | null = null;
    let installedAiracVersion: string | null = null;
    let installedPluginVersion: string | null = null;
    let newAiracVersionAvailable: boolean | null = null;
    let profiles: Profile[] | null = null;
    let hoppieCode: string | null = null;
    let listConfigs: ListConfig[] | null = null;
    let startupError: string | null = null;

    try {
        euroscopeConfigPath = await invoke<string | null>("get_detected_euroscope_config_dir");
        installedAiracVersion = await invoke<string | null>("get_detected_installed_airac_version");
        installedPluginVersion = await invoke<string | null>("get_installed_plugin_version");
        profiles = await invoke<Profile[] | null>("get_existing_profiles");
        newAiracVersionAvailable = await invoke<boolean | null>("is_new_airac_version_available");
        listConfigs = await invoke<ListConfig[] | null>("get_list_configs");
        hoppieCode = await invoke<string | null>("get_hoppie_code");
    } catch (error) {
        startupError = error instanceof Error ? error.message : String(error);
    }

    renderApp(
        euroscopeConfigPath,
        installedAiracVersion,
        installedPluginVersion,
        newAiracVersionAvailable,
        profiles,
        hoppieCode,
        listConfigs,
        startupError
    );
};

void bootstrap();
