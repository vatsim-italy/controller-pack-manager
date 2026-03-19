import { Profile, ListConfig } from "./main";
import { Layout } from "./components/Layout";
import { PluginSection } from "./components/PluginSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";
import { ListsSection } from "./components";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type DashboardSection = "sector-file" | "plugin" | "profiles" | "topsky" | "lists";

type AppProps = {
    euroscopeConfigPath: string | null;
    installedAiracVersion: string | null;
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

    useEffect(() => {
        if (appProfiles && appProfiles.length > 0 && !selectedProfileName) {
            setSelectedProfileName(appProfiles[0].name);
        }
    }, [appProfiles, selectedProfileName]);

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
            return <ListsSection listConfigs={listConfigs} />;
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
