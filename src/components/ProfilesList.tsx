import { useEffect, useMemo, useState } from "react";
import { Profile, ScreenConfig } from "../main";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ScreenConfigSection } from "./ScreenConfigSection";
import { ToggleSwitch } from "./ToggleSwitch";

interface ProfilesListProps {
    profiles: Profile[] | null;
    euroscopeConfigPath?: string | null;
    selectedProfileName?: string | null;
    onSelectProfileName?: (name: string) => void;
    onProfilesUpdate?: () => void;
}

const withFallback = (value: string | null, fallback = "") => value ?? fallback;
const stripPrf = (value: string) => value.replace(/\.prf$/i, "");

export const ProfilesList = ({ profiles, euroscopeConfigPath, selectedProfileName, onSelectProfileName, onProfilesUpdate }: ProfilesListProps) => {
    if (!profiles || profiles.length === 0) {
        return (
            <div className="card card-accent">
                <div className="card-header">
                    <div className="card-icon">👤</div>
                    <h2 className="text-xl font-semibold text-white">Profiles</h2>
                </div>
                <div className="py-12 text-center">
                    <div className="mb-4 text-4xl opacity-50">📋</div>
                    <div className="mb-2 text-xl font-semibold text-secondary-100">No Profiles Found</div>
                    <div className="text-base text-secondary-500">
                        No EuroScope profiles are currently configured.
                    </div>
                </div>
            </div>
        );
    }

    const [localProfiles, setLocalProfiles] = useState<Profile[]>(profiles);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isScreenConfigOpen, setIsScreenConfigOpen] = useState(true);
    const [isAsrConfigOpen, setIsAsrConfigOpen] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; profileName: string }>({
        isOpen: false,
        profileName: "",
    });

    useEffect(() => {
        setLocalProfiles(profiles);
        if (selectedProfileName) {
            const matchingIndex = profiles.findIndex((profile) => profile.name === selectedProfileName);
            setSelectedIndex(matchingIndex >= 0 ? matchingIndex : 0);
        } else {
            setSelectedIndex(0);
        }
        setIsAdvancedOpen(false);
        setIsScreenConfigOpen(true);
        setIsAsrConfigOpen(true);
    }, [profiles, selectedProfileName]);

    useEffect(() => {
        if (!selectedProfileName) {
            return;
        }

        const matchingIndex = localProfiles.findIndex((profile) => profile.name === selectedProfileName);
        if (matchingIndex >= 0 && matchingIndex !== selectedIndex) {
            setSelectedIndex(matchingIndex);
        }
    }, [selectedProfileName, localProfiles, selectedIndex]);

    useEffect(() => {
        if (saveSuccess) {
            const timer = setTimeout(() => setSaveSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveSuccess]);

    const selectedProfile = useMemo(() => {
        if (localProfiles.length === 0) {
            return null;
        }

        if (selectedIndex < 0 || selectedIndex >= localProfiles.length) {
            return localProfiles[0];
        }

        return localProfiles[selectedIndex];
    }, [localProfiles, selectedIndex]);

    if (!selectedProfile) {
        return null;
    }

    const [profileName, setProfileName] = useState(stripPrf(selectedProfile.name));
    const [realName, setRealName] = useState(withFallback(selectedProfile.realName));
    const [vatsimCid, setVatsimCid] = useState(withFallback(selectedProfile.certificate));
    const [serverAddress, setServerAddress] = useState(withFallback(selectedProfile.server));
    const [proxyServer, setProxyServer] = useState(withFallback(selectedProfile.proxyServer));
    const [startupAsr, setStartupAsr] = useState(withFallback(selectedProfile.startupAsr));
    const [connectToVatsim, setConnectToVatsim] = useState(selectedProfile.connectToVatsim ?? false);
    const [screenConfig, setScreenConfig] = useState<ScreenConfig | null>(selectedProfile.screenConfig ?? null);

    useEffect(() => {
        setProfileName(stripPrf(selectedProfile.name));
        setRealName(withFallback(selectedProfile.realName));
        setVatsimCid(withFallback(selectedProfile.certificate));
        setServerAddress(withFallback(selectedProfile.server));
        setProxyServer(withFallback(selectedProfile.proxyServer));
        setStartupAsr(withFallback(selectedProfile.startupAsr));
        setConnectToVatsim(selectedProfile.connectToVatsim ?? false);
        setScreenConfig(selectedProfile.screenConfig ?? null);
        setIsScreenConfigOpen(true);
        setIsAsrConfigOpen(true);
        setIsAdvancedOpen(false);
    }, [selectedProfile]);

    const selectStartupAsr = async () => {
        try {
            const selection = await open({
                title: "Select Startup ASR",
                defaultPath: euroscopeConfigPath || undefined,
                multiple: false,
                filters: [
                    { name: "ASR Files", extensions: ["asr"] },
                    { name: "All Files", extensions: ["*"] },
                ],
            });

            if (typeof selection === "string") {
                setStartupAsr(selection);
            }
        } catch (error) {
            console.error("Failed to select startup ASR:", error);
        }
    };

    const saveCurrentProfile = async () => {
        const hasPrfExtension = /\.prf$/i.test(selectedProfile.name);
        const nextName = profileName.trim();
        const renamed = nextName ? (hasPrfExtension ? `${nextName}.prf` : nextName) : selectedProfile.name;

        // Detect if this is a cloned profile (ends with _COPY.prf)
        const isClone = selectedProfile.name.endsWith("_COPY.prf");
        let cloneFrom: string | null = null;

        if (isClone) {
            // Extract the original profile name by removing _COPY.prf and adding .prf
            cloneFrom = selectedProfile.name.replace(/_COPY\.prf$/i, ".prf");
        }

        let updatedProfiles = await invoke<Profile[] | null>("update_profile", {
            originalName: selectedProfile.name,
            newName: renamed,
            realName: realName.trim() || null,
            certificate: vatsimCid.trim() || null,
            server: serverAddress.trim() || null,
            proxyServer: proxyServer.trim() || null,
            startupAsr: startupAsr.trim() || null,
            connectToVatsim,
            configuredLists: selectedProfile.configuredLists,
            cloneFrom,
        });
        if (updatedProfiles) {
            let profilesWithScreenConfig = updatedProfiles;

            // Save screen config if changes were made
            if (screenConfig) {
                try {
                    const profileNameNoExt = renamed.replace(/\.prf$/i, "");
                    let latestScreenConfig: ScreenConfig | null = null;

                    try {
                        latestScreenConfig = await invoke<ScreenConfig>("load_screen_config", {
                            profileName: profileNameNoExt,
                        });
                    } catch {
                        latestScreenConfig = null;
                    }

                    const mergedScreenConfig: ScreenConfig = {
                        controller_list: latestScreenConfig?.controller_list ?? screenConfig.controller_list,
                        metar_list: latestScreenConfig?.metar_list ?? screenConfig.metar_list,
                        title_bar: screenConfig.title_bar,
                        display_config: screenConfig.display_config,
                        connect_sel_to_sil: screenConfig.connect_sel_to_sil,
                        connect_dep_to_sel: screenConfig.connect_dep_to_sel,
                        connect_sil_to_top: screenConfig.connect_sil_to_top,
                    };

                    await invoke<string>("save_screen_config", {
                        profileName: profileNameNoExt,
                        screenConfig: mergedScreenConfig,
                    });

                    profilesWithScreenConfig = updatedProfiles.map((profile) =>
                        profile.name === renamed
                            ? { ...profile, screenConfig: mergedScreenConfig }
                            : profile
                    );
                } catch (error) {
                    console.error("Failed to save screen config:", error);
                }
            }

            setLocalProfiles(profilesWithScreenConfig);

            setSaveSuccess(true);
            onProfilesUpdate?.();
        }
    };

    const createNewProfile = () => {
        const newProfile: Profile = {
            name: "New Profile.prf",
            realName: null,
            certificate: null,
            server: null,
            connectToVatsim: false,
            proxyServer: null,
            startupAsr: null,
            configuredLists: new Array(),
            screenConfig: null,
        };

        setLocalProfiles((previous) => {
            const updated = [...previous, newProfile];
            setSelectedIndex(updated.length - 1);
            return updated;
        });
    };

    const cloneSelectedProfile = () => {
        const clonedProfile: Profile = {
            name: `${stripPrf(selectedProfile.name)}_COPY.prf`,
            realName: selectedProfile.realName,
            certificate: selectedProfile.certificate,
            server: selectedProfile.server,
            connectToVatsim: selectedProfile.connectToVatsim ?? false,
            proxyServer: selectedProfile.proxyServer,
            startupAsr: selectedProfile.startupAsr,
            configuredLists: selectedProfile.configuredLists,
            screenConfig: selectedProfile.screenConfig,
        };

        setLocalProfiles((previous) => {
            const updated = [...previous, clonedProfile];
            setSelectedIndex(updated.length - 1);
            return updated;
        });
    };

    const deleteSelectedProfile = () => {
        setDeleteConfirmation({
            isOpen: true,
            profileName: stripPrf(selectedProfile.name),
        });
    };

    const confirmDelete = async () => {
        try {
            // Check if this is an unsaved profile (new or cloned but not yet saved)
            const isUnsavedProfile = selectedProfile.name === "New Profile.prf" || selectedProfile.name.endsWith("_COPY.prf");

            if (isUnsavedProfile) {
                // Just remove from local state without calling backend
                setLocalProfiles((previous) => {
                    const updated = previous.filter((_, index) => index !== selectedIndex);
                    setSelectedIndex((current) => Math.max(0, Math.min(current, updated.length - 1)));
                    return updated;
                });
            } else {
                // Call backend to delete from disk
                let updatedProfiles = await invoke<Profile[] | null>("delete_profile", {
                    profileName: selectedProfile.name,
                });
                if (updatedProfiles) {
                    setLocalProfiles(updatedProfiles);
                    onProfilesUpdate?.();
                }
            }

            setSaveSuccess(false);
            setDeleteConfirmation({ isOpen: false, profileName: "" });
        } catch (error) {
            console.error("Failed to delete profile:", error);
            setDeleteConfirmation({ isOpen: false, profileName: "" });
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-secondary-600 bg-dark-header shadow-md">
                <div className="border-b border-secondary-600 px-5 py-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-500">EUROSCOPE PROFILES</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {localProfiles.map((profile, index) => {
                            const isActive = index === selectedIndex;
                            const isNewProfile = profile.name === "New Profile.prf" || profile.name.endsWith("_COPY.prf");

                            return (
                                <button
                                    key={`${profile.name}-${index}`}
                                    type="button"
                                    onClick={() => {
                                        setSelectedIndex(index);
                                        onSelectProfileName?.(profile.name);
                                    }}
                                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${isActive
                                        ? "border-primary-600 bg-primary-600 text-white"
                                        : "border-secondary-600 bg-secondary-700 text-secondary-100 hover:border-secondary-500"
                                        }`}
                                >
                                    <span>{stripPrf(profile.name)}</span>
                                    {isNewProfile && (
                                        <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${isActive
                                            ? "bg-white/20 text-white"
                                            : "bg-yellow-600/40 text-yellow-300"
                                            }`}>
                                            new
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={createNewProfile}
                            className="rounded-lg border border-dashed border-secondary-500 bg-secondary-700 px-3 py-1.5 text-sm font-semibold text-secondary-100 hover:border-secondary-400 transition-colors"
                        >
                            + New
                        </button>
                    </div>
                </div>

                <div className="border-b border-secondary-600 px-5 py-4">
                    <h3 className="text-2xl font-semibold text-white">Edit Profile: {stripPrf(selectedProfile.name)}</h3>
                    <p className="mt-1 text-sm text-secondary-500">
                        Configure connection and identification details for {stripPrf(selectedProfile.name)}.
                    </p>
                    {saveSuccess && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-600/20 border border-green-600/50 px-4 py-3">
                            <span className="text-green-400 text-lg">✓</span>
                            <span className="text-sm font-medium text-green-400">Profile saved successfully</span>
                        </div>
                    )}
                </div>

                <div className="space-y-5 px-5 py-5">
                    <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">Profile Name</span>
                        <input
                            value={profileName}
                            onChange={(event) => setProfileName(event.target.value)}
                            className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">Real Name</span>
                            <input
                                value={realName}
                                onChange={(event) => setRealName(event.target.value)}
                                className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">VATSIM CID</span>
                            <input
                                value={vatsimCid}
                                onChange={(event) => setVatsimCid(event.target.value)}
                                className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                            />
                        </label>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-secondary-600 bg-secondary-700/30">
                        <button
                            type="button"
                            onClick={() => setIsScreenConfigOpen((previous) => !previous)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary-700/60"
                        >
                            <div>
                                <p className="text-sm font-semibold text-white">Screen Configuration</p>
                            </div>
                            <span className={`text-lg leading-none text-secondary-500 transition-transform ${isScreenConfigOpen ? "rotate-180" : ""}`}>
                                ⌄
                            </span>
                        </button>

                        {isScreenConfigOpen && (
                            <div className="border-t border-secondary-600 bg-dark-header/40 px-4 py-4">
                                <ScreenConfigSection
                                    screenConfig={screenConfig}
                                    onChange={(newConfig) => {
                                        setScreenConfig(newConfig);
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-secondary-600 bg-secondary-700/30">
                        <button
                            type="button"
                            onClick={() => setIsAsrConfigOpen((previous) => !previous)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary-700/60"
                        >
                            <div>
                                <p className="text-sm font-semibold text-white">ASR Configuration</p>
                            </div>
                            <span className={`text-lg leading-none text-secondary-500 transition-transform ${isAsrConfigOpen ? "rotate-180" : ""}`}>
                                ⌄
                            </span>
                        </button>

                        {isAsrConfigOpen && (
                            <div className="space-y-3 border-t border-secondary-600 bg-dark-header/40 px-4 py-4">
                                <p className="text-xs text-secondary-500">Select the radar view file loaded automatically at startup.</p>
                                <div className="rounded-lg border border-secondary-600 bg-secondary-700/40 px-3 py-3">
                                    <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-100">
                                        <span className="font-semibold text-secondary-300">Startup ASR:</span>
                                        <span className="break-all text-secondary-300">{startupAsr || "None"}</span>
                                        <button
                                            type="button"
                                            onClick={selectStartupAsr}
                                            className="rounded-lg border border-secondary-500 bg-secondary-700 px-3 py-1.5 text-sm font-medium text-secondary-100 hover:border-secondary-400 transition-colors"
                                        >
                                            {startupAsr ? "Change" : "Add"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStartupAsr("")}
                                            className="rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-1.5 text-sm font-medium text-secondary-300 hover:border-secondary-500 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-secondary-600 bg-secondary-700/30">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen((previous) => !previous)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary-700/60"
                        >
                            <div>
                                <p className="text-sm font-semibold text-white">Advanced Settings</p>
                            </div>
                            <span className={`text-lg leading-none text-secondary-500 transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}>
                                ⌄
                            </span>
                        </button>

                        {isAdvancedOpen && (
                            <div className="space-y-4 border-t border-secondary-600 bg-dark-header/40 px-4 py-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold text-secondary-500">Server Address</span>
                                        <input
                                            value={serverAddress}
                                            onChange={(event) => setServerAddress(event.target.value)}
                                            className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                                        />
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold text-secondary-500">Proxy Server</span>
                                        <input
                                            placeholder="localhost:8080"
                                            value={proxyServer}
                                            onChange={(event) => setProxyServer(event.target.value)}
                                            className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                                        />
                                    </label>
                                </div>

                                <ToggleSwitch
                                    label="Automatically connect to VATSIM on EuroScope startup"
                                    checked={connectToVatsim}
                                    onChange={setConnectToVatsim}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-secondary-600 px-5 py-4">
                    <button
                        type="button"
                        className="btn-small rounded-xl bg-accent-danger px-4 py-2 font-semibold text-white transition-all duration-200 hover:opacity-90"
                        onClick={deleteSelectedProfile}
                    >
                        Delete Profile
                    </button>
                    <button type="button" className="btn-secondary btn-small" onClick={cloneSelectedProfile}>Clone Profile</button>
                    <button
                        type="button"
                        className={`btn-small ${saveSuccess
                            ? "rounded-xl border border-green-600 bg-green-600 px-4 py-2 font-semibold text-white"
                            : "btn-primary"
                            }`}
                        onClick={saveCurrentProfile}
                    >
                        {saveSuccess ? "✓ Saved" : "Save Profile"}
                    </button>
                </div>
            </section>

            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-xl border border-secondary-600 bg-dark-header shadow-2xl w-96">
                        <div className="border-b border-secondary-600 px-6 py-4">
                            <h3 className="text-lg font-semibold text-white">Delete Profile</h3>
                        </div>

                        <div className="px-6 py-4">
                            <p className="text-secondary-200 mb-2">
                                Are you sure you want to delete the profile <span className="font-semibold text-white">"{deleteConfirmation.profileName}"</span>?
                            </p>
                            <p className="text-sm text-accent-danger font-semibold">
                                This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-secondary-600 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmation({ isOpen: false, profileName: "" })}
                                className="btn-secondary btn-small"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="btn-small rounded-xl bg-accent-danger px-4 py-2 font-semibold text-white transition-all duration-200 hover:opacity-90"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
