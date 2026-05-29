import { Profile, ListConfig, ScreenConfig, ControllerListConfig, MetarListConfig } from "./main";
import { Layout } from "./components/Layout";
import { ConfigSection } from "./components/ConfigSection";
import { PluginSection } from "./components/PluginSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";
import { ListsSection } from "./components";
import type { ListsSectionScreenConfig } from "./components/ListsSection";
import { usePluginUpdate } from "./hooks/usePluginUpdate";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type DashboardSection = "sector-file" | "plugin" | "profiles" | "topsky" | "lists" | "settings";

type AppProps = {
    euroscopeConfigPath: string | null;
    installedAiracVersion: string | null;
    latestAiracVersion: string | null;
    installedPluginVersion: string | null;
    newAiracVersionAvailable: boolean | null;
    profiles: Profile[] | null;
    hoppieCode: string | null;
    listConfigs: ListConfig[] | null;
    startupError: string | null;
};

function App(
    {
        euroscopeConfigPath,
        installedPluginVersion,
        profiles,
        hoppieCode,
        listConfigs,
        startupError,
        installedAiracVersion: initialInstalled,
        latestAiracVersion: initialLatest,
        newAiracVersionAvailable: initialAvailable,
    }: AppProps
) {
    const [activeSection, setActiveSection] = useState<DashboardSection>("sector-file");
    const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
    const [euroscopeConfigPathState, setEuroscopeConfigPathState] = useState<string | null>(euroscopeConfigPath);
    const [appProfiles, setAppProfiles] = useState<Profile[] | null>(profiles);
    const [appHoppieCode, setAppHoppieCode] = useState<string | null>(hoppieCode);
    const [appListConfigs, setAppListConfigs] = useState<ListConfig[] | null>(listConfigs);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasShownMissingSettingsModal, setHasShownMissingSettingsModal] = useState(false);
    const [isMissingSettingsModalOpen, setIsMissingSettingsModalOpen] = useState(false);
    const [isPickingFolder, setIsPickingFolder] = useState(false);
    const [folderActionError, setFolderActionError] = useState<string | null>(null);
    const [loadedConfigs, setLoadedConfigs] = useState<ListConfig[] | null>(null);
    const [loadedControllerList, setLoadedControllerList] = useState<ControllerListConfig | null>(null);
    const [loadedMetarList, setLoadedMetarList] = useState<MetarListConfig | null>(null);
    const listsSectionRef = useRef<{
        getCurrentLayout: () => ListConfig[] | null;
        getCurrentScreenConfig: () => ListsSectionScreenConfig;
    }>(null);
    const [airacState, setAiracState] = useState({
        installed: initialInstalled,
        latest: initialLatest,
        available: initialAvailable
    });
    const pluginState = usePluginUpdate(Boolean(euroscopeConfigPathState));
    const currentPluginVersion = pluginState.installedVersion ?? installedPluginVersion;


    const refreshEuroScopeData = useCallback(async (resolvedPath: string | null) => {
        setEuroscopeConfigPathState(resolvedPath);
        setLoadedConfigs(null);
        setLoadedControllerList(null);
        setLoadedMetarList(null);

        if (!resolvedPath) {
            setAiracState((previousState) => ({
                ...previousState,
                installed: null,
                latest: null,
                available: null,
            }));
            setAppProfiles(null);
            setAppHoppieCode(null);
            setAppListConfigs(null);
            setSelectedProfileName(null);
            return;
        }

        try {
            const [installedAiracVersion, latestAiracVersion, available, profilesValue, hoppieCodeValue, listConfigsValue] = await Promise.all([
                invoke<string | null>("get_detected_installed_airac_version"),
                invoke<string | null>("get_latest_airac_version"),
                invoke<boolean>("refresh_airac_update_status"),
                invoke<Profile[] | null>("get_existing_profiles"),
                invoke<string | null>("get_hoppie_code"),
                invoke<ListConfig[] | null>("get_list_configs"),
            ]);

            setAiracState((previousState) => ({
                ...previousState,
                installed: installedAiracVersion,
                latest: latestAiracVersion,
                available,
            }));
            setAppProfiles(profilesValue);
            setAppHoppieCode(hoppieCodeValue);
            setAppListConfigs(listConfigsValue);
            setSelectedProfileName((currentSelection) => {
                if (!profilesValue || profilesValue.length === 0) {
                    return null;
                }

                if (currentSelection && profilesValue.some((profile) => profile.name === currentSelection)) {
                    return currentSelection;
                }

                return profilesValue[0].name;
            });
        } catch (error) {
            console.error("Failed to refresh EuroScope data:", error);
        }
    }, []);

    const chooseEuroScopeFolder = useCallback(async () => {
        setFolderActionError(null);
        setIsPickingFolder(true);

        try {
            const selectedPath = await open({
                directory: true,
                multiple: false,
                defaultPath: euroscopeConfigPathState ?? undefined,
            });

            if (!selectedPath || Array.isArray(selectedPath)) {
                return;
            }

            const resolvedPath = await invoke<string | null>("set_euroscope_config_dir", { path: selectedPath });
            await refreshEuroScopeData(resolvedPath ?? selectedPath);
            setIsMissingSettingsModalOpen(false);
            setHasShownMissingSettingsModal(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setFolderActionError(message);
        } finally {
            setIsPickingFolder(false);
        }
    }, [euroscopeConfigPathState, refreshEuroScopeData]);

    const resetEuroScopeFolder = useCallback(async () => {
        setFolderActionError(null);
        setIsPickingFolder(true);

        try {
            const resolvedPath = await invoke<string | null>("clear_euroscope_config_dir_override");
            await refreshEuroScopeData(resolvedPath);
            setIsMissingSettingsModalOpen(false);
            setHasShownMissingSettingsModal(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setFolderActionError(message);
        } finally {
            setIsPickingFolder(false);
        }
    }, [refreshEuroScopeData]);

    const handleProfilesUpdate = async (updatedProfiles?: Profile[] | null) => {
        if (updatedProfiles) {
            setAppProfiles(updatedProfiles);
            setSelectedProfileName((currentSelection) => {
                if (!updatedProfiles.length) {
                    return null;
                }

                if (currentSelection && updatedProfiles.some((profile) => profile.name === currentSelection)) {
                    return currentSelection;
                }

                return updatedProfiles[0].name;
            });
            return;
        }

        await refreshEuroScopeData(euroscopeConfigPathState);
    };

    const handleSaveLayout = async () => {
        if (!selectedProfileName || !listsSectionRef.current) {
            setSaveError("No profile selected or lists section not available");
            return;
        }

        setIsSaving(true);
        setSaveSuccess(false);
        setSaveError(null);

        try {
            const currentLayout = listsSectionRef.current.getCurrentLayout();
            const currentScreenLists = listsSectionRef.current.getCurrentScreenConfig();
            let savedSomething = false;

            if (currentLayout && currentLayout.length > 0) {
                await invoke<string>("save_layout", {
                    profileName: selectedProfileName.replace(/\.prf$/i, ""),
                    listConfigs: currentLayout,
                });
                savedSomething = true;
            }

            const selectedProfile = appProfiles?.find((profile) => profile.name === selectedProfileName) ?? null;
            const currentScreenConfig = selectedProfile?.screenConfig ?? null;
            const profileNameNoExt = selectedProfileName.replace(/\.prf$/i, "");

            let latestScreenConfig: ScreenConfig | null = null;
            try {
                latestScreenConfig = await invoke<ScreenConfig>("load_screen_config", {
                    profileName: profileNameNoExt,
                });
            } catch {
                latestScreenConfig = currentScreenConfig;
            }

            const mergedScreenConfig: ScreenConfig = {
                controller_list: currentScreenLists.controller_list,
                metar_list: currentScreenLists.metar_list,
                title_bar: latestScreenConfig?.title_bar ?? {
                    visible: false,
                    file_name: true,
                    controller_name: true,
                    primary_frequency: true,
                    atis_frequency: true,
                    clock: true,
                    leader: true,
                    filter: true,
                    transition_level: true,
                },
                display_config: latestScreenConfig?.display_config ?? { id: 0, position: 0, maximized: false },
                connect_sel_to_sil: currentScreenLists.connect_sel_to_sil,
                connect_dep_to_sel: currentScreenLists.connect_dep_to_sel,
                connect_sil_to_top: currentScreenLists.connect_sil_to_top,
            };

            await invoke<string>("save_screen_config", {
                profileName: profileNameNoExt,
                screenConfig: mergedScreenConfig,
            });
            savedSomething = true;

            setAppProfiles((previousProfiles) => {
                if (!previousProfiles) {
                    return previousProfiles;
                }
                return previousProfiles.map((profile) =>
                    profile.name === selectedProfileName
                        ? { ...profile, screenConfig: mergedScreenConfig }
                        : profile
                );
            });

            if (!savedSomething) {
                setSaveError("No lists to save");
                setIsSaving(false);
                return;
            }

            setSaveSuccess(true);
            // Show the success message
            console.log("Layout and screen settings saved");
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setSaveError(errorMessage);
            setTimeout(() => setSaveError(null), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (appProfiles && appProfiles.length > 0 && !selectedProfileName) {
            setSelectedProfileName(appProfiles[0].name);
        }
    }, [appProfiles, selectedProfileName]);

    useEffect(() => {
        if (!selectedProfileName) {
            return;
        }

        let cancelled = false;

        const restoreLayout = async () => {
            setLoadedConfigs(null);

            try {
                // Check if profile exists in appProfiles (handles both saved and unsaved profiles)
                const profileInMemory = appProfiles?.find((p) => p.name === selectedProfileName);

                // If profile exists in memory with configured lists, use those directly
                if (profileInMemory && profileInMemory.configuredLists && profileInMemory.configuredLists.length > 0) {
                    if (!cancelled) {
                        setLoadedConfigs(profileInMemory.configuredLists);
                    }
                    return;
                }

                // Otherwise, load from disk (for profiles that haven't been loaded into appProfiles yet)
                const loadedLayout = await invoke<ListConfig[]>("load_layout", {
                    profileName: selectedProfileName.replace(/\.prf$/i, ""),
                });

                if (!cancelled) {
                    setLoadedConfigs(loadedLayout);
                }
            } catch {
                if (!cancelled) {
                    setLoadedConfigs(null);
                }
            }
        };

        restoreLayout();

        return () => {
            cancelled = true;
        };
    }, [selectedProfileName, appProfiles]);

    useEffect(() => {
        if (!selectedProfileName) {
            return;
        }

        let cancelled = false;

        const loadScreenConfig = async () => {
            try {
                // Check if profile exists in appProfiles with screenConfig
                const profileInMemory = appProfiles?.find((p) => p.name === selectedProfileName);

                // If profile has screenConfig in memory, use that directly
                if (profileInMemory && profileInMemory.screenConfig) {
                    if (!cancelled) {
                        const config = profileInMemory.screenConfig;
                        setLoadedControllerList(config.controller_list ?? null);
                        setLoadedMetarList(config.metar_list ?? null);
                    }
                    return;
                }

                // Otherwise, load from disk
                const config = await invoke<ScreenConfig>("load_screen_config", {
                    profileName: selectedProfileName.replace(/\.prf$/i, ""),
                });

                if (!cancelled) {
                    setLoadedControllerList(config.controller_list ?? null);
                    setLoadedMetarList(config.metar_list ?? null);
                    setAppProfiles((previousProfiles) => {
                        if (!previousProfiles) {
                            return previousProfiles;
                        }

                        return previousProfiles.map((profile) =>
                            profile.name === selectedProfileName
                                ? { ...profile, screenConfig: config }
                                : profile
                        );
                    });
                }
            } catch (error) {
                console.error("Failed to load screen config:", error);
                if (!cancelled) {
                    setLoadedMetarList(null);
                }
                // Screen config loading failure is not critical
            }
        };

        loadScreenConfig();

        return () => {
            cancelled = true;
        };
    }, [selectedProfileName, appProfiles]);

    useEffect(() => {
        if (!selectedProfileName) {
            setLoadedControllerList(null);
            setLoadedMetarList(null);
        }
    }, [selectedProfileName]);

    useEffect(() => {
        // Clear loaded configs when leaving Lists section to force reload on return
        if (activeSection !== "lists") {
            setLoadedConfigs(null);
        } else if (activeSection === "lists" && !loadedConfigs && selectedProfileName) {
            // Re-fetch layout when returning to Lists section
            (async () => {
                try {
                    // Check appProfiles first for in-memory data
                    const profileInMemory = appProfiles?.find((p) => p.name === selectedProfileName);
                    if (profileInMemory && profileInMemory.configuredLists && profileInMemory.configuredLists.length > 0) {
                        setLoadedConfigs(profileInMemory.configuredLists);
                        return;
                    }

                    // Otherwise load from disk
                    const loadedLayout = await invoke<ListConfig[]>("load_layout", {
                        profileName: selectedProfileName.replace(/\.prf$/i, ""),
                    });
                    setLoadedConfigs(loadedLayout);
                } catch {
                    setLoadedConfigs(null);
                }
            })();
        }
    }, [activeSection, selectedProfileName, appProfiles]);

    useEffect(() => {
        if (euroscopeConfigPathState || hasShownMissingSettingsModal) {
            return;
        }

        setIsMissingSettingsModalOpen(true);
        setHasShownMissingSettingsModal(true);
    }, [euroscopeConfigPathState, hasShownMissingSettingsModal]);

    const sectionMeta = useMemo(() => {
        const titles: Record<DashboardSection, { title: string; subtitle: string }> = {
            "sector-file": {
                title: "Sector File Manager",
                subtitle: "Manage AIRAC updates for your local EuroScope sector files.",
            },
            plugin: {
                title: "VATITA Controller Plugin",
                subtitle: "Manage and update the VATITA plugin for EuroScope.",
            },
            profiles: {
                title: "Profiles",
                subtitle: "View and verify detected controller profiles.",
            },
            topsky: {
                title: "TopSky",
                subtitle: "Manage your Hoppie code used by TopSky CPDLC features.",
            },
            lists: {
                title: "Lists",
                subtitle: "Compose and position EuroScope-style lists on a radar screen preview.",
            },
            settings: {
                title: "Settings",
                subtitle: "Choose where EuroScope stores its files and override auto-detection if needed.",
            },
        };

        return titles[activeSection];
    }, [activeSection]);

    const selectedProfile = useMemo(() => {
        if (!selectedProfileName || !appProfiles) {
            return null;
        }
        return appProfiles.find((profile) => profile.name === selectedProfileName) ?? null;
    }, [appProfiles, selectedProfileName]);

    const refreshAiracState = useCallback(async () => {
        try {
            const [installed, latest, available] = await Promise.all([
                invoke<string | null>("get_detected_installed_airac_version"),
                invoke<string | null>("get_latest_airac_version"),
                invoke<boolean>("refresh_airac_update_status"),
            ]);

            setAiracState({
                installed,
                latest,
                available
            });
        } catch (error) {
            console.error("Failed to refresh AIRAC state:", error);
        }
    }, []);

    const renderSection = () => {
        if (activeSection === "sector-file") {
            return (
                <AiracSection
                    installedAiracVersion={airacState.installed}
                    latestAiracVersion={airacState.latest}
                    newAiracVersionAvailable={airacState.available}
                    startupError={startupError}
                    onUpdateComplete={refreshAiracState}
                />
            );
        }

         if (activeSection === "plugin") {
             return (
                 <PluginSection
                     startupError={startupError}
                     {...pluginState}
                 />
             );
         }

        if (activeSection === "profiles") {
            return (
                <ProfilesList
                    profiles={appProfiles}
                    euroscopeConfigPath={euroscopeConfigPathState}
                    selectedProfileName={selectedProfileName}
                    onSelectProfileName={setSelectedProfileName}
                    onProfilesUpdate={handleProfilesUpdate}
                />
            );
        }

        if (activeSection === "settings") {
            return (
                <ConfigSection
                    euroscopeConfigPath={euroscopeConfigPathState}
                    startupError={startupError}
                    isPickingFolder={isPickingFolder}
                    folderActionError={folderActionError}
                    onChooseFolder={chooseEuroScopeFolder}
                    onResetFolder={resetEuroScopeFolder}
                />
            );
        }

        if (activeSection === "lists") {
            return (
                <ListsSection
                    listConfigs={appListConfigs}
                    resumeLayout={loadedConfigs}
                    controllerListConfig={loadedControllerList}
                    metarListConfig={loadedMetarList}
                    connectSelToSil={selectedProfile?.screenConfig?.connect_sel_to_sil ?? true}
                    connectDepToSel={selectedProfile?.screenConfig?.connect_dep_to_sel ?? true}
                    connectSilToTop={selectedProfile?.screenConfig?.connect_sil_to_top ?? false}
                    displayPosition={selectedProfile?.screenConfig?.display_config?.position ?? 0}
                    ref={listsSectionRef}
                />
            );
        }

        return <HoppieSection hoppieCode={appHoppieCode} />;
    };

    return (
        <Layout
            activeSection={activeSection}
            onSectionChange={setActiveSection}
        >
            <div className="w-full space-y-4">
                <section className="border-b border-secondary-600 pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <h1 className="text-2xl font-semibold text-white">{sectionMeta.title}</h1>
                        <div className="flex items-center gap-3">
                            {(activeSection === "lists" || activeSection === "profiles") && appProfiles && appProfiles.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-3 text-sm text-secondary-100">
                                        <span className="text-secondary-500 font-semibold">Profile</span>
                                        <select
                                            className="rounded border border-secondary-500 bg-secondary-700 px-3 py-2 text-sm text-secondary-100 font-medium"
                                            value={selectedProfileName || ""}
                                            onChange={(event) => setSelectedProfileName(event.target.value)}
                                        >
                                            {appProfiles.map((profile) => (
                                                <option key={profile.name} value={profile.name}>
                                                    {profile.name.replace(/\.prf$/i, "")}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {activeSection === "lists" && (
                                        <>
                                            <button
                                                type="button"
                                                className="rounded border border-primary-600 bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                onClick={handleSaveLayout}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? "Saving..." : saveSuccess ? "✓ Saved!" : "Save Layout to Profile"}
                                            </button>
                                            {saveError && (
                                                <div className="rounded border border-accent-danger bg-accent-danger/10 px-3 py-2 text-sm font-medium text-accent-danger flex items-center gap-2">
                                                    <span>✕</span>
                                                    <span>{saveError}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                            {activeSection === "sector-file" && (
                                <span className="rounded border border-primary-600 bg-primary-600/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-100">
                                    AIRAC {airacState.installed ?? "Not installed"}
                                </span>
                            )}
                            {activeSection === "plugin" && (
                                <span className="rounded border border-primary-600 bg-primary-600/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-100">
                                    {currentPluginVersion
                                        ? `${currentPluginVersion}`
                                        : "Plugin not installed"}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="mt-1 text-sm text-secondary-500">{sectionMeta.subtitle}</p>
                </section>

                {isMissingSettingsModalOpen && !euroscopeConfigPathState && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-secondary-600 bg-secondary-700 p-6 shadow-2xl">
                            <h2 className="text-xl font-semibold text-white">Where is it?</h2>
                            <p className="mt-2 text-sm text-secondary-400">
                                Please select the EuroScope folder to continue.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    className="btn-primary px-4 py-2 text-sm font-bold"
                                    onClick={chooseEuroScopeFolder}
                                    disabled={isPickingFolder}
                                >
                                    {isPickingFolder ? "Opening..." : "Choose Folder"}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary px-4 py-2 text-sm font-bold"
                                    onClick={() => setIsMissingSettingsModalOpen(false)}
                                    disabled={isPickingFolder}
                                >
                                    Not Now
                                </button>
                            </div>

                            {folderActionError && (
                                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                                    {folderActionError}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="pb-6">
                    {renderSection()}
                </div>
            </div>
        </Layout>
    );
}

export default App;
