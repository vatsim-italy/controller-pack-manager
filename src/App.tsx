import { Profile } from "./main";
import { invoke } from "@tauri-apps/api/core";

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
    const updateAirac = async () => {
        await invoke("update_airac_version");
    };

    return (
        <main className="container">
            <h1>Controller Pack Manager</h1>
            <h2>EuroScope Config Detection</h2>
            {startupError && <p>Detection failed: {startupError}</p>}
            {!startupError && euroscopeConfigPath && (
                <p>Detected config folder: {euroscopeConfigPath}</p>
            )}
            {!startupError && !euroscopeConfigPath && (
                <p>No EuroScope config folder was detected in %APPDATA%\EuroScope.</p>
            )}
            <h2>Installed AIRAC Release</h2>
            {!startupError && installedAiracVersion && (
                <p>Version: {installedAiracVersion}</p>
            )}
            {!startupError && !installedAiracVersion && (
                <p>No AIRAC release installation was found in %APPDATA%\EuroScope\LIXX.</p>
            )}
            <button disabled={!newAiracVersionAvailable} onClick={updateAirac}>Update</button>

            <h2>Profiles</h2>
            {
                profiles?.map((profile, index) => (
                    <div key={profile.realName || index}>
                        <h4>{profile.name}</h4>
                        <p>{profile.realName}</p>
                        <p>{profile.certificate}</p>
                        <p>{profile.server}</p>
                        <p>{profile.proxyServer}</p>
                        <p>{profile.connectToVatsim}</p>
                    </div>
                ))
            }

            <h2>Hoppie Code</h2>
            {!hoppieCode && (
                <p>No Hoppie code was found</p>
            )}
            {hoppieCode && (
                <p>{hoppieCode}</p>
            )}
        </main>
    );
}

export default App;
