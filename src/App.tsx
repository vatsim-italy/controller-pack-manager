import { Profile } from "./main";
import { Layout } from "./components/Layout";
import { ConfigSection } from "./components/ConfigSection";
import { AiracSection } from "./components/AiracSection";
import { ProfilesList } from "./components/ProfilesList";
import { HoppieSection } from "./components/HoppieSection";

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
    return (
        <Layout>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                <div>
                    <ConfigSection
                        euroscopeConfigPath={euroscopeConfigPath}
                        startupError={startupError}
                    />
                </div>
                <div>
                    <AiracSection
                        installedAiracVersion={installedAiracVersion}
                        newAiracVersionAvailable={newAiracVersionAvailable}
                        startupError={startupError}
                    />
                </div>
                <div className="lg:col-span-2">
                    <ProfilesList profiles={profiles} />
                </div>
                <div>
                    <HoppieSection hoppieCode={hoppieCode} />
                </div>
            </div>
        </Layout>
    );
}

export default App;
