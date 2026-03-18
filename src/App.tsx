import { Profile } from "./main";
import { Layout } from "./components/Layout";
import { ConfigSection } from "./components/ConfigSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";
import { useMemo, useState } from "react";

export type DashboardSection = "sector-file" | "plugin" | "profiles" | "topsky";

type AppProps = {
    euroscopeConfigPath: string | null;
    installedAiracVersion: string | null;
    newAiracVersionAvailable: boolean | null;
    profiles: Profile[] | null;
    hoppieCode: string | null;
    startupError: string | null;
};

function App(
    {
        euroscopeConfigPath,
        installedAiracVersion,
        newAiracVersionAvailable,
        profiles,
        hoppieCode,
        startupError
    }: AppProps
) {
    const [activeSection, setActiveSection] = useState<DashboardSection>("sector-file");

    const sectionMeta = useMemo(() => {
        const titles: Record<DashboardSection, { title: string; subtitle: string }> = {
            "sector-file": {
                title: "Sector File Manager",
                subtitle: "Manage AIRAC updates for your local EuroScope sector files.",
            },
            plugin: {
                title: "Plugin Manager",
                subtitle: "Check your EuroScope installation path and plugin setup.",
            },
            profiles: {
                title: "Profiles",
                subtitle: "View and verify detected controller profiles.",
            },
            topsky: {
                title: "TopSky",
                subtitle: "Manage your Hoppie code used by TopSky CPDLC features.",
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
                <ConfigSection
                    euroscopeConfigPath={euroscopeConfigPath}
                    startupError={startupError}
                />
            );
        }

        if (activeSection === "profiles") {
            return <ProfilesList profiles={profiles} />;
        }

        return <HoppieSection hoppieCode={hoppieCode} />;
    };

    return (
        <Layout activeSection={activeSection} onSectionChange={setActiveSection}>
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <section className="border-b border-secondary-600 pb-5">
                    <h1 className="text-4xl font-bold text-white">{sectionMeta.title}</h1>
                    <p className="mt-2 text-base text-secondary-500">{sectionMeta.subtitle}</p>
                </section>

                <div className="pb-8">
                    {renderSection()}
                </div>
            </div>
        </Layout>
    );
}

export default App;
