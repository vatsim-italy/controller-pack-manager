import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    onProfilesUpdate?: (updatedProfiles?: Profile[] | null) => Promise<void> | void;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface DraftMeta {
    isUnsaved: boolean;
    cloneSource: string | null;
}

interface ProfileEntry {
    profile: Profile;
    meta: DraftMeta;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const withFallback = (value: string | null | undefined, fallback = "") =>
    value ?? fallback;

const stripPrf = (value: string) => value.replace(/\.prf$/i, "");

const profileToEntry = (profile: Profile): ProfileEntry => ({
    profile,
    meta: { isUnsaved: false, cloneSource: null },
});

const buildDraft = (base: Profile, fields: DraftFields): Profile => ({
    ...base,
    realName: fields.realName.trim() || null,
    certificate: fields.vatsimCid.trim() || null,
    server: fields.serverAddress.trim() || null,
    proxyServer: fields.proxyServer.trim() || null,
    startupAsr: fields.startupAsr.trim() || null,
    connectToVatsim: fields.connectToVatsim,
    screenConfig: fields.screenConfig,
});

// ─── form-field state ─────────────────────────────────────────────────────────

interface DraftFields {
    profileName: string;
    realName: string;
    vatsimCid: string;
    serverAddress: string;
    proxyServer: string;
    startupAsr: string;
    connectToVatsim: boolean;
    screenConfig: ScreenConfig | null;
}

const fieldsFromProfile = (profile: Profile): DraftFields => ({
    profileName: stripPrf(profile.name),
    realName: withFallback(profile.realName),
    vatsimCid: withFallback(profile.certificate),
    serverAddress: withFallback(profile.server),
    proxyServer: withFallback(profile.proxyServer),
    startupAsr: withFallback(profile.startupAsr),
    connectToVatsim: profile.connectToVatsim ?? false,
    screenConfig: profile.screenConfig ?? null,
});

// ─── accordion ────────────────────────────────────────────────────────────────

const Accordion = ({
                       label,
                       isOpen,
                       onToggle,
                       children,
                   }: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) => (
    <div className="overflow-hidden rounded-xl border border-secondary-600 bg-secondary-700/30">
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary-700/60"
        >
            <span className="text-sm font-semibold text-white">{label}</span>
            <span
                className={`text-lg leading-none text-secondary-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                }`}
            >
                ⌄
            </span>
        </button>
        {isOpen && (
            <div className="border-t border-secondary-600 bg-dark-header/40 px-4 py-4">
                {children}
            </div>
        )}
    </div>
);

// ─── component ────────────────────────────────────────────────────────────────

export const ProfilesList = ({
                                 profiles,
                                 euroscopeConfigPath,
                                 selectedProfileName,
                                 onSelectProfileName,
                                 onProfilesUpdate,
                             }: ProfilesListProps) => {
    const [entries, setEntries] = useState<ProfileEntry[]>(
        () => (profiles ?? []).map(profileToEntry)
    );
    const [selectedIndex, setSelectedIndex] = useState(0);

    const [isScreenConfigOpen, setIsScreenConfigOpen] = useState(true);
    const [isAsrConfigOpen, setIsAsrConfigOpen] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        profileName: string;
    }>({ isOpen: false, profileName: "" });

    const [fields, setFields] = useState<DraftFields>(() =>
        entries[0]
            ? fieldsFromProfile(entries[0].profile)
            : fieldsFromProfile({
                name: "",
                realName: null,
                certificate: null,
                server: null,
                connectToVatsim: false,
                proxyServer: null,
                startupAsr: null,
                configuredLists: [],
                screenConfig: null,
            })
    );

    const selectedIndexRef = useRef(selectedIndex);
    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
    }, [selectedIndex]);

    useEffect(() => {
        if (!profiles) return;
        setEntries((prev) => {
            const incomingMap = new Map(profiles.map((p) => [p.name, p]));
            const merged: ProfileEntry[] = prev
                .map((entry) => {
                    if (entry.meta.isUnsaved) return entry;
                    const updated = incomingMap.get(entry.profile.name);
                    return updated ? { ...entry, profile: updated } : null;
                })
                .filter(Boolean) as ProfileEntry[];
            for (const p of profiles) {
                if (!merged.some((e) => e.profile.name === p.name)) {
                    merged.push(profileToEntry(p));
                }
            }
            return merged;
        });
    }, [profiles]);

    useEffect(() => {
        if (!selectedProfileName) return;
        const idx = entries.findIndex((e) => e.profile.name === selectedProfileName);
        if (idx >= 0 && idx !== selectedIndex) setSelectedIndex(idx);
    }, [selectedProfileName, entries]);

    const selectedEntry = useMemo<ProfileEntry | null>(() => {
        if (entries.length === 0) return null;
        const clamped = Math.max(0, Math.min(selectedIndex, entries.length - 1));
        return entries[clamped] ?? null;
    }, [entries, selectedIndex]);

    const prevProfileNameRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedEntry) return;
        const name = selectedEntry.profile.name;
        if (name === prevProfileNameRef.current) return;
        prevProfileNameRef.current = name;
        setFields(fieldsFromProfile(selectedEntry.profile));
        setIsScreenConfigOpen(true);
        setIsAsrConfigOpen(true);
        setIsAdvancedOpen(false);
        setSaveSuccess(false);
    }, [selectedEntry]);

    useEffect(() => {
        if (!saveSuccess) return;
        const timer = setTimeout(() => setSaveSuccess(false), 3000);
        return () => clearTimeout(timer);
    }, [saveSuccess]);

    const notifyParent = useCallback(
        (updatedEntries: ProfileEntry[]) => {
            onProfilesUpdate?.(updatedEntries.map((e) => e.profile));
        },
        [onProfilesUpdate]
    );

    useEffect(() => {
        if (isSaving) return;
        notifyParent(entries);
    }, [entries, isSaving, notifyParent]);

    const setField = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
        setFields((prev) => ({ ...prev, [key]: value }));
    };

    // ─── actions ──────────────────────────────────────────────────────────────

    const selectStartupAsr = async () => {
        try {
            const selection = await open({
                title: "Select Startup ASR",
                defaultPath: euroscopeConfigPath ?? undefined,
                multiple: false,
                filters: [
                    { name: "ASR Files", extensions: ["asr"] },
                    { name: "All Files", extensions: ["*"] },
                ],
            });
            if (typeof selection === "string") setField("startupAsr", selection);
        } catch (error) {
            console.error("Failed to select startup ASR:", error);
        }
    };

    const saveCurrentProfile = async () => {
        if (!selectedEntry || isSaving) return;
        setIsSaving(true);

        const { profile, meta } = selectedEntry;
        const hasPrfExtension = /\.prf$/i.test(profile.name);
        const nextName = fields.profileName.trim();
        const renamed = nextName
            ? hasPrfExtension
                ? `${nextName}.prf`
                : nextName
            : profile.name;

        try {
            const draftProfile = buildDraft(profile, fields);
            let updatedProfiles = await invoke<Profile[] | null>("update_profile", {
                originalName: profile.name,
                newName: renamed,
                realName: draftProfile.realName,
                certificate: draftProfile.certificate,
                server: draftProfile.server,
                proxyServer: draftProfile.proxyServer,
                startupAsr: draftProfile.startupAsr,
                connectToVatsim: draftProfile.connectToVatsim,
                configuredLists: draftProfile.configuredLists,
                cloneFrom: meta.cloneSource,
            });

            if (!updatedProfiles) return;

            let finalScreenConfig = fields.screenConfig;
            if (finalScreenConfig) {
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
                        controller_list:
                            latestScreenConfig?.controller_list ?? finalScreenConfig.controller_list,
                        metar_list: latestScreenConfig?.metar_list ?? finalScreenConfig.metar_list,
                        title_bar: finalScreenConfig.title_bar,
                        display_config: finalScreenConfig.display_config,
                        connect_sel_to_sil: finalScreenConfig.connect_sel_to_sil,
                        connect_dep_to_sel: finalScreenConfig.connect_dep_to_sel,
                        connect_sil_to_top: finalScreenConfig.connect_sil_to_top,
                    };

                    await invoke<string>("save_screen_config", {
                        profileName: profileNameNoExt,
                        screenConfig: mergedScreenConfig,
                    });

                    finalScreenConfig = mergedScreenConfig;
                } catch (error) {
                    console.error("Failed to save screen config:", error);
                }
            }

            setEntries((prev) => {
                const next: ProfileEntry[] = updatedProfiles!.map((p) => {
                    const screenCfg = p.name === renamed ? finalScreenConfig : p.screenConfig;
                    return profileToEntry({ ...p, screenConfig: screenCfg ?? p.screenConfig });
                });
                for (const entry of prev) {
                    if (entry.meta.isUnsaved && entry.profile.name !== profile.name) {
                        next.push(entry);
                    }
                }
                return next;
            });

            onSelectProfileName?.(renamed);
            setSaveSuccess(true);
        } catch (error) {
            console.error("Failed to save profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const createNewProfile = () => {
        const base = "New Profile";
        const existingNames = new Set(entries.map((e) => e.profile.name));
        let candidate = `${base}.prf`;
        let counter = 2;
        while (existingNames.has(candidate)) {
            candidate = `${base} ${counter}.prf`;
            counter++;
        }
        const newProfile: Profile = {
            name: candidate,
            realName: null,
            certificate: null,
            server: null,
            connectToVatsim: false,
            proxyServer: null,
            startupAsr: null,
            configuredLists: [],
            screenConfig: null,
        };
        setEntries((prev) => {
            const next = [
                ...prev,
                { profile: newProfile, meta: { isUnsaved: true, cloneSource: null } },
            ];
            setSelectedIndex(next.length - 1);
            return next;
        });
    };

    const cloneSelectedProfile = () => {
        if (!selectedEntry) return;
        const { profile } = selectedEntry;
        const base = `${stripPrf(profile.name)}_COPY`;
        const existingNames = new Set(entries.map((e) => e.profile.name));
        let candidate = `${base}.prf`;
        let counter = 2;
        while (existingNames.has(candidate)) {
            candidate = `${base}_${counter}.prf`;
            counter++;
        }
        const cloned: Profile = {
            ...buildDraft(profile, fields),
            name: candidate,
            configuredLists: profile.configuredLists,
        };
        setEntries((prev) => {
            const next = [
                ...prev,
                { profile: cloned, meta: { isUnsaved: true, cloneSource: profile.name } },
            ];
            setSelectedIndex(next.length - 1);
            return next;
        });
    };

    const deleteSelectedProfile = () => {
        if (!selectedEntry) return;
        setDeleteConfirmation({
            isOpen: true,
            profileName: stripPrf(selectedEntry.profile.name),
        });
    };

    const confirmDelete = async () => {
        if (!selectedEntry) return;
        const { profile, meta } = selectedEntry;
        try {
            if (meta.isUnsaved) {
                setEntries((prev) => {
                    const next = prev.filter((_, i) => i !== selectedIndexRef.current);
                    setSelectedIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
                    return next;
                });
            } else {
                const updatedProfiles = await invoke<Profile[] | null>("delete_profile", {
                    profileName: profile.name,
                });
                if (updatedProfiles) {
                    setEntries(updatedProfiles.map(profileToEntry));
                    setSelectedIndex(0);
                    onProfilesUpdate?.(updatedProfiles);
                }
            }
            setSaveSuccess(false);
        } catch (error) {
            console.error("Failed to delete profile:", error);
        } finally {
            setDeleteConfirmation({ isOpen: false, profileName: "" });
        }
    };

    // ─── render ───────────────────────────────────────────────────────────────

    if (entries.length === 0 || !selectedEntry) {
        return (
            <section className="rounded-xl border border-secondary-600 bg-dark-header shadow-md">
                <div className="py-16 text-center">
                    <div className="mb-4 text-4xl opacity-30">📋</div>
                    <div className="mb-1 text-base font-semibold text-white">No profiles found</div>
                    <div className="text-sm text-secondary-500">
                        No EuroScope profiles are currently configured.
                    </div>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-secondary-600 bg-dark-header shadow-md overflow-hidden">

                {/* ── status bar ── */}
                <div className="flex items-center gap-3 border-b border-secondary-600 px-5 py-3.5">
                    <div className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        selectedEntry.meta.isUnsaved ? "bg-accent-warning" : "bg-green-500"
                    }`} />
                    <span className="flex-1 text-sm font-semibold text-white">
                        {stripPrf(selectedEntry.profile.name)}
                    </span>
                    {saveSuccess && (
                        <span className="text-xs font-semibold text-green-400">✓ Saved</span>
                    )}
                    {selectedEntry.meta.isUnsaved && (
                        <span className="rounded-full bg-accent-warning/20 px-2 py-0.5 text-xs font-semibold text-accent-warning">
                            unsaved
                        </span>
                    )}
                </div>

                {/* ── profile tab strip ── */}
                <div className="border-b border-secondary-600 px-5 py-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-500">
                        Profiles
                    </span>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {entries.map((entry, index) => {
                            const isActive = index === selectedIndex;
                            const isNew = entry.meta.isUnsaved;
                            return (
                                <button
                                    key={entry.profile.name}
                                    type="button"
                                    onClick={() => {
                                        setSelectedIndex(index);
                                        if (!isNew) onSelectProfileName?.(entry.profile.name);
                                    }}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all ${
                                        isActive
                                            ? "border-primary-600 bg-primary-600 text-white"
                                            : "border-secondary-600 bg-secondary-700 text-secondary-100 hover:border-secondary-500"
                                    }`}
                                >
                                    <span>{stripPrf(entry.profile.name)}</span>
                                    {isNew && (
                                        <span
                                            className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                                                isActive
                                                    ? "bg-white/20 text-white"
                                                    : "bg-accent-warning/30 text-accent-warning"
                                            }`}
                                        >
                                            new
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={createNewProfile}
                            className="rounded-lg border border-dashed border-secondary-500 bg-secondary-700 px-3 py-1.5 text-sm font-semibold text-secondary-400 transition-colors hover:border-secondary-400 hover:text-secondary-300"
                        >
                            + New
                        </button>
                    </div>
                </div>

                {/* ── form fields ── */}
                <div className="space-y-5 px-5 py-5">

                    {/* identity row */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                                Profile Name
                            </span>
                            <input
                                value={fields.profileName}
                                onChange={(e) => setField("profileName", e.target.value)}
                                className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                                Real Name
                            </span>
                            <input
                                value={fields.realName}
                                onChange={(e) => setField("realName", e.target.value)}
                                className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                                VATSIM CID
                            </span>
                            <input
                                value={fields.vatsimCid}
                                onChange={(e) => setField("vatsimCid", e.target.value)}
                                className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                            />
                        </label>
                    </div>

                    {/* accordions */}
                    <Accordion
                        label="Screen Configuration"
                        isOpen={isScreenConfigOpen}
                        onToggle={() => setIsScreenConfigOpen((p) => !p)}
                    >
                        <ScreenConfigSection
                            screenConfig={fields.screenConfig}
                            onChange={(newConfig) => setField("screenConfig", newConfig)}
                        />
                    </Accordion>

                    <Accordion
                        label="ASR Configuration"
                        isOpen={isAsrConfigOpen}
                        onToggle={() => setIsAsrConfigOpen((p) => !p)}
                    >
                        <p className="mb-3 text-xs text-secondary-500">
                            Select the radar view file loaded automatically at startup.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-secondary-600 bg-secondary-700/40 px-3 py-3">
                            <span className="text-xs font-semibold text-secondary-400">Startup ASR</span>
                            <span className="flex-1 break-all text-xs text-secondary-300">
                                {fields.startupAsr || "None"}
                            </span>
                            <button
                                type="button"
                                onClick={selectStartupAsr}
                                className="rounded-lg border border-secondary-500 bg-secondary-700 px-3 py-1.5 text-xs font-medium text-secondary-100 transition-colors hover:border-secondary-400"
                            >
                                {fields.startupAsr ? "Change" : "Add"}
                            </button>
                            {fields.startupAsr && (
                                <button
                                    type="button"
                                    onClick={() => setField("startupAsr", "")}
                                    className="rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-1.5 text-xs font-medium text-secondary-400 transition-colors hover:border-secondary-500"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </Accordion>

                    <Accordion
                        label="Advanced Settings"
                        isOpen={isAdvancedOpen}
                        onToggle={() => setIsAdvancedOpen((p) => !p)}
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold text-secondary-500">
                                        Server Address
                                    </span>
                                    <input
                                        value={fields.serverAddress}
                                        onChange={(e) => setField("serverAddress", e.target.value)}
                                        className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold text-secondary-500">
                                        Proxy Server
                                    </span>
                                    <input
                                        placeholder="localhost:8080"
                                        value={fields.proxyServer}
                                        onChange={(e) => setField("proxyServer", e.target.value)}
                                        className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 text-sm text-white outline-none focus:border-primary-600"
                                    />
                                </label>
                            </div>
                            <ToggleSwitch
                                label="Connect to VATSIM (tick)"
                                checked={fields.connectToVatsim}
                                onChange={(v) => setField("connectToVatsim", v)}
                            />
                        </div>
                    </Accordion>
                </div>

                {/* ── footer ── */}
                <div className="flex items-center justify-between border-t border-secondary-600 px-5 py-4">
                    <button
                        type="button"
                        onClick={deleteSelectedProfile}
                        className="text-xs font-semibold text-secondary-500 transition-colors hover:text-accent-danger"
                    >
                        Delete profile
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={cloneSelectedProfile}
                            className="btn-secondary btn-small"
                        >
                            Clone
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={saveCurrentProfile}
                            className={`btn-small ${
                                saveSuccess
                                    ? "rounded-xl border border-green-600 bg-green-600 px-4 py-2 font-semibold text-white"
                                    : "btn-primary"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            {isSaving ? "Saving…" : saveSuccess ? "✓ Saved" : "Save Profile"}
                        </button>
                    </div>
                </div>
            </section>

            {/* ── delete confirmation modal ── */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="w-96 rounded-xl border border-secondary-600 bg-dark-header shadow-2xl overflow-hidden">
                        <div className="border-b border-secondary-600 px-6 py-4">
                            <h3 className="text-base font-semibold text-white">Delete profile</h3>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-secondary-300">
                                Delete{" "}
                                <span className="font-semibold text-white">
                                    "{deleteConfirmation.profileName}"
                                </span>
                                ? This cannot be undone.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-secondary-600 px-6 py-4">
                            <button
                                type="button"
                                onClick={() =>
                                    setDeleteConfirmation({ isOpen: false, profileName: "" })
                                }
                                className="btn-secondary btn-small"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="btn-small rounded-xl bg-accent-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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