import { useAiracUpdate } from "../hooks/useAiracUpdate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";

interface AiracSectionProps {
    installedAiracVersion: string | null;
    latestAiracVersion: string | null;
    newAiracVersionAvailable: boolean | null;
    startupError: string | null;
    onUpdateComplete?: () => void;
}

// ─── sub-components ───────────────────────────────────────────────────────────

const MetricTile = ({
                        label,
                        value,
                        valueClassName = "text-white",
                    }: {
    label: string;
    value: string;
    valueClassName?: string;
}) => (
    <div className="rounded-lg bg-secondary-700/50 px-3 py-2.5">
        <div className="mb-1 text-xs text-secondary-500">{label}</div>
        <div className={`text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
);

const InlineAlert = ({
                         kind,
                         title,
                         message,
                         onDismiss,
                     }: {
    kind: "danger" | "success" | "warning";
    title: string;
    message: string;
    onDismiss?: () => void;
}) => {
    const styles = {
        danger: {
            wrapper: "bg-accent-danger/10 border-t border-accent-danger/30",
            icon: "text-accent-danger",
            title: "text-accent-danger",
        },
        success: {
            wrapper: "bg-green-600/10 border-t border-green-600/30",
            icon: "text-green-400",
            title: "text-green-400",
        },
        warning: {
            wrapper: "bg-accent-warning/10 border-t border-accent-warning/30",
            icon: "text-accent-warning",
            title: "text-accent-warning",
        },
    }[kind];

    const icon = kind === "danger" ? "⚠" : kind === "success" ? "✓" : "⚠";

    return (
        <div className={`flex items-start gap-3 px-5 py-3 ${styles.wrapper}`}>
            <span className={`mt-0.5 flex-shrink-0 text-sm font-bold ${styles.icon}`}>
                {icon}
            </span>
            <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${styles.title}`}>{title}</div>
                <div className="mt-0.5 text-xs text-secondary-400">{message}</div>
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="flex-shrink-0 text-secondary-500 hover:text-secondary-300 transition-colors text-xs"
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

// ─── main component ───────────────────────────────────────────────────────────

export const AiracSection = ({
                                 installedAiracVersion,
                                 latestAiracVersion,
                                 newAiracVersionAvailable,
                                 startupError,
                                 onUpdateComplete,
                             }: AiracSectionProps) => {
    const [hasOpenedSectorDownload, setHasOpenedSectorDownload] = useState(false);
    const {
        isUpdating,
        isImportingSectorZip,
        hasImportedSectorFiles,
        updateError,
        sectorImportError,
        sectorImportSuccess,
        updateSuccess,
        updateAirac,
        openSectorDownloadPage,
        importSectorZip,
        checkForUpdates,
        clearError,
        changelog,
        isLoadingChangelog,
        lastCheckedAt,
    } = useAiracUpdate(onUpdateComplete);

    const hasUpdate = newAiracVersionAvailable === true && !updateSuccess;
    const isUpToDate = installedAiracVersion === latestAiracVersion && latestAiracVersion !== null;
    const isInstalled = !!installedAiracVersion;
    const requiresSectorImport = !hasImportedSectorFiles && (hasUpdate || !isInstalled);
    const targetAiracVersion = latestAiracVersion ?? installedAiracVersion ?? "—";

    const installedDisplay = installedAiracVersion ?? "Not installed";
    const availableDisplay = latestAiracVersion ?? "—";

    const statusDotClass = startupError
        ? "bg-accent-danger"
        : requiresSectorImport
            ? "bg-accent-warning"
            : hasUpdate
                ? "bg-accent-warning"
                : isInstalled
                    ? "bg-green-500"
                    : "bg-secondary-500";

    const statusLabel = startupError
        ? "AIRAC status unavailable"
        : requiresSectorImport && !hasOpenedSectorDownload
            ? "Sector package required — download before installing"
            : requiresSectorImport
                ? "Import the downloaded AeroNav ZIP to continue"
                : hasUpdate
                    ? `Update available — AIRAC ${targetAiracVersion}`
                    : isUpToDate || updateSuccess
                        ? `Up to date — AIRAC ${installedDisplay}`
                        : isInstalled
                            ? `Installed — AIRAC ${installedDisplay}`
                            : "Not installed";

    const primaryLabel = isUpdating
        ? "Installing..."
        : isImportingSectorZip
            ? "Importing..."
            : requiresSectorImport && !hasOpenedSectorDownload
                ? "Download Sector ZIP"
                : requiresSectorImport
                    ? "Import Sector ZIP"
                    : hasUpdate
                        ? "Install Update"
                        : !isInstalled
                            ? "Install"
                            : "Check for Updates";

    const isPrimaryDisabled = startupError !== null || isUpdating || isImportingSectorZip;

    const primaryClassName = requiresSectorImport
        ? "btn-warning btn-small disabled:opacity-40 disabled:cursor-not-allowed"
        : "btn-primary btn-small disabled:opacity-40 disabled:cursor-not-allowed";

    const formattedLastChecked = lastCheckedAt
        ? lastCheckedAt.toLocaleString([], {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Never";

    const changelogBadge = targetAiracVersion !== "—"
        ? `AIRAC ${targetAiracVersion}`
        : "Release notes";

    const handlePrimaryAction = async () => {
        if (requiresSectorImport && !hasOpenedSectorDownload) {
            await openSectorDownloadPage();
            setHasOpenedSectorDownload(true);
            return;
        }
        if (requiresSectorImport) {
            await importSectorZip();
            return;
        }
        if (hasUpdate || !isInstalled) {
            await updateAirac();
            setHasOpenedSectorDownload(false);
            return;
        }
        await checkForUpdates();
    };

    useEffect(() => {
        console.log("[AIRAC] Card state", {
            installedAiracVersion,
            latestAiracVersion,
            newAiracVersionAvailable,
            hasUpdate,
            hasImportedSectorFiles,
            requiresSectorImport,
            updateSuccess,
            primaryLabel,
        });
    }, [
        hasImportedSectorFiles,
        hasUpdate,
        installedAiracVersion,
        latestAiracVersion,
        newAiracVersionAvailable,
        primaryLabel,
        requiresSectorImport,
        updateSuccess,
    ]);

    return (
        <div className="space-y-6">

            {/* ── status card ── */}
            <section className="rounded-xl border border-secondary-600 bg-dark-header shadow-md overflow-hidden">

                {/* status bar */}
                <div className="flex items-center gap-3 border-b border-secondary-600 px-5 py-3.5">
                    <div className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDotClass}`} />
                    <span className="flex-1 text-sm font-semibold text-white">{statusLabel}</span>
                    <span className="text-xs text-secondary-500">
                        Last checked: {formattedLastChecked}
                    </span>
                </div>

                {/* body */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">

                    {/* version tiles */}
                    <div className="grid grid-cols-2 gap-2 flex-1 min-w-[200px]">
                        <MetricTile label="Installed" value={installedDisplay} />
                        <MetricTile
                            label="Available"
                            value={availableDisplay}
                            valueClassName={hasUpdate ? "text-accent-warning" : "text-secondary-500"}
                        />
                    </div>

                    {/* action */}
                    <div className="flex flex-col items-end gap-2">
                        <button
                            type="button"
                            disabled={isPrimaryDisabled}
                            onClick={() => void handlePrimaryAction()}
                            className={primaryClassName}
                        >
                            {isUpdating && (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            )}
                            {primaryLabel}
                        </button>
                    </div>
                </div>

                {/* sector import notice */}
                {requiresSectorImport && !startupError && (
                    <div className="mx-5 mb-4 rounded-lg border border-accent-warning/40 bg-accent-warning/10 px-4 py-3">
                        <p className="text-xs font-semibold text-accent-warning">
                            {hasOpenedSectorDownload
                                ? "Import the AeroNav ZIP you just downloaded to continue."
                                : "A sector package is required before installation. Download it first."}
                        </p>
                    </div>
                )}

                {/* alerts */}
                {startupError && (
                    <InlineAlert
                        kind="danger"
                        title="Unable to load"
                        message="AIRAC information could not be loaded due to a startup error."
                    />
                )}
                {sectorImportError && (
                    <InlineAlert
                        kind="danger"
                        title="Sector import failed"
                        message={sectorImportError}
                        onDismiss={clearError}
                    />
                )}
                {sectorImportSuccess && (
                    <InlineAlert
                        kind="success"
                        title="Sector files imported"
                        message={sectorImportSuccess}
                    />
                )}
                {updateError && (
                    <InlineAlert
                        kind="danger"
                        title="Update failed"
                        message={updateError}
                        onDismiss={clearError}
                    />
                )}
                {updateSuccess && (
                    <InlineAlert
                        kind="success"
                        title="Update complete"
                        message="AIRAC files have been successfully updated."
                    />
                )}
            </section>

            {/* ── changelog card ── */}
            <section className="rounded-xl border border-secondary-600 bg-dark-header shadow-md overflow-hidden">
                <div className="flex items-center justify-between border-b border-secondary-600 bg-secondary-700/40 px-5 py-3.5">
                    <span className="text-sm font-semibold text-white">Changelog</span>
                    <span className="rounded-md border border-secondary-600 bg-secondary-700 px-2 py-0.5 text-xs text-secondary-400">
                        {changelogBadge}
                    </span>
                </div>

                <div className="custom-scrollbar max-h-96 overflow-y-auto px-5 py-4">
                    {isLoadingChangelog ? (
                        <p className="text-sm text-secondary-500">Loading release notes…</p>
                    ) : changelog ? (
                        <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog}</ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-secondary-500">
                            No changelog available for this release.
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
};