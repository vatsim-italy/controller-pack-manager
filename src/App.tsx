import { Profile, ListConfig, ScreenConfig, ControllerListConfig, MetarListConfig } from "./main";
import { Layout } from "./components/Layout";
import { PluginSection } from "./components/PluginSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";
import { ListsSection } from "./components";
import type { ListsSectionScreenConfig } from "./components/ListsSection";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type DashboardSection = "sector-file" | "plugin" | "profiles" | "topsky" | "lists";

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
        installedAiracVersion,
        latestAiracVersion,
        installedPluginVersion,
        newAiracVersionAvailable,
        profiles,
        hoppieCode,
        listConfigs,
        startupError
    }: AppProps
) {
    const [activeSection, setActiveSection] = useState<DashboardSection>("sector-file");
    const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
    const [appProfiles, setAppProfiles] = useState<Profile[] | null>(profiles);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [loadedConfigs, setLoadedConfigs] = useState<ListConfig[] | null>(null);
    const [loadedControllerList, setLoadedControllerList] = useState<ControllerListConfig | null>(null);
    const [loadedMetarList, setLoadedMetarList] = useState<MetarListConfig | null>(null);
    const listsSectionRef = useRef<{
        getCurrentLayout: () => ListConfig[] | null;
        getCurrentScreenConfig: () => ListsSectionScreenConfig;
    }>(null);

    const refreshProfiles = async () => {
        try {
            const updatedProfiles = await invoke<Profile[] | null>("get_existing_profiles");
            if (updatedProfiles) {
                setAppProfiles((previousProfiles) => {
                    const screenConfigByName = new Map(
                        (previousProfiles ?? [])
                            .filter((profile) => profile.screenConfig)
                            .map((profile) => [profile.name, profile.screenConfig])
                    );

                    return updatedProfiles.map((profile) => ({
                        ...profile,
                        screenConfig: screenConfigByName.get(profile.name) ?? profile.screenConfig,
                    }));
                });
            }
        } catch (error) {
            console.error("Failed to refresh profiles:", error);
        }
    };

    const handleProfilesUpdate = () => {
        refreshProfiles();
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
    }, [selectedProfileName]);

    useEffect(() => {
        if (!selectedProfileName) {
            return;
        }

        let cancelled = false;

        const loadScreenConfig = async () => {
            try {
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
    }, [selectedProfileName]);

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
                    const loadedLayout = await invoke<ListConfig[]>("load_layout", {
                        profileName: selectedProfileName.replace(/\.prf$/i, ""),
                    });
                    setLoadedConfigs(loadedLayout);
                } catch {
                    setLoadedConfigs(null);
                }
            })();
        }
    }, [activeSection, selectedProfileName]);

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
        };

        return titles[activeSection];
    }, [activeSection]);

    const selectedProfile = useMemo(() => {
        if (!selectedProfileName || !appProfiles) {
            return null;
        }
        return appProfiles.find((profile) => profile.name === selectedProfileName) ?? null;
    }, [appProfiles, selectedProfileName]);

    const renderSection = () => {
        if (activeSection === "sector-file") {
            return (
                <AiracSection
                    installedAiracVersion={installedAiracVersion}
                    latestAiracVersion={latestAiracVersion}
                    newAiracVersionAvailable={newAiracVersionAvailable}
                    startupError={startupError}
                />
            );
        }

        if (activeSection === "plugin") {
            return (
                <PluginSection
                    installedAiracVersion={installedAiracVersion}
                    installedPluginVersion={installedPluginVersion}
                    startupError={startupError}
                />
            );
        }

        if (activeSection === "profiles") {
            return (
                <ProfilesList
                    profiles={appProfiles}
                    euroscopeConfigPath={euroscopeConfigPath}
                    selectedProfileName={selectedProfileName}
                    onSelectProfileName={setSelectedProfileName}
                    onProfilesUpdate={handleProfilesUpdate}
                />
            );
        }

        if (activeSection === "lists") {
            return (
                <ListsSection
                    listConfigs={listConfigs}
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

        return <HoppieSection hoppieCode={hoppieCode} />;
    };

    return (
        <Layout
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            isEuroscopeDetected={Boolean(euroscopeConfigPath)}
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
                                    AIRAC {installedAiracVersion ?? "unknown"}
                                </span>
                            )}
                            {activeSection === "plugin" && (
                                <span className="rounded border border-primary-600 bg-primary-600/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-100">
                                    {installedPluginVersion
                                        ? `${installedPluginVersion}`
                                        : `AIRAC ${installedAiracVersion ?? "unknown"}`}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="mt-1 text-sm text-secondary-500">{sectionMeta.subtitle}</p>
                </section>

                <div className="pb-6">
                    {renderSection()}
                </div>
            </div>
        </Layout>
    );
}

export default App;
