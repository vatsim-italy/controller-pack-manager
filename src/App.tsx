import { Profile, ListConfig } from "./main";
import { Layout } from "./components/Layout";
import { PluginSection } from "./components/PluginSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";
import { ListsSection } from "./components";
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
    const listsSectionRef = useRef<{ getCurrentLayout: () => ListConfig[] | null }>(null);

    const refreshProfiles = async () => {
        try {
            const updatedProfiles = await invoke<Profile[] | null>("get_existing_profiles");
            if (updatedProfiles) {
                setAppProfiles(updatedProfiles);
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
            if (!currentLayout || currentLayout.length === 0) {
                setSaveError("No lists to save");
                setIsSaving(false);
                return;
            }

            const result = await invoke<string>("save_layout", {
                profileName: selectedProfileName.replace(/\.prf$/i, ""),
                listConfigs: currentLayout,
            });

            setSaveSuccess(true);
            // Show the success message
            console.log(result);
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
            return <ProfilesList profiles={appProfiles} onProfilesUpdate={handleProfilesUpdate} />;
        }

        if (activeSection === "lists") {
            return (
                <ListsSection
                    listConfigs={listConfigs}
                    resumeLayout={loadedConfigs}
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
                            {activeSection === "lists" && appProfiles && appProfiles.length > 0 && (
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
