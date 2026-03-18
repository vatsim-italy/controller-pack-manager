import { useEffect, useMemo, useState } from "react";
import { Profile } from "../main";
import { invoke } from "@tauri-apps/api/core";

interface ProfilesListProps {
    profiles: Profile[] | null;
}

const withFallback = (value: string | null, fallback = "") => value ?? fallback;
const stripPrf = (value: string) => value.replace(/\.prf$/i, "");

export const ProfilesList = ({ profiles }: ProfilesListProps) => {
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
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; profileName: string }>({
        isOpen: false,
        profileName: "",
    });

    useEffect(() => {
        setLocalProfiles(profiles);
        setSelectedIndex(0);
        setIsAdvancedOpen(false);
    }, [profiles]);

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
    const [connectToVatsim, setConnectToVatsim] = useState(selectedProfile.connectToVatsim ?? false);

    useEffect(() => {
        setProfileName(stripPrf(selectedProfile.name));
        setRealName(withFallback(selectedProfile.realName));
        setVatsimCid(withFallback(selectedProfile.certificate));
        setServerAddress(withFallback(selectedProfile.server));
        setProxyServer(withFallback(selectedProfile.proxyServer));
        setConnectToVatsim(selectedProfile.connectToVatsim ?? false);
        setIsAdvancedOpen(false);
    }, [selectedProfile]);

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
            connectToVatsim,
            cloneFrom,
        });
        if (updatedProfiles) {
            setLocalProfiles(updatedProfiles);
            setSaveSuccess(true);
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
                                    onClick={() => setSelectedIndex(index)}
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

                                <div className="rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2">
                                    <label className="flex items-center gap-2 text-sm text-secondary-100">
                                        <input
                                            type="checkbox"
                                            checked={connectToVatsim}
                                            onChange={(event) => setConnectToVatsim(event.target.checked)}
                                            className="h-4 w-4 rounded border-secondary-500 bg-secondary-700 text-primary-600 focus:ring-primary-600"
                                        />
                                        Automatically connect to VATSIM on EuroScope startup
                                    </label>
                                </div>
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
                    <button type="button" className="btn-primary btn-small" onClick={saveCurrentProfile}>Save Profile</button>
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
