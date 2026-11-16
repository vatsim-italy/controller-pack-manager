import { useAiracUpdate } from "../hooks/useAiracUpdate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { InstallWarningModal, hasSeenInstallWarning } from "./InstallWarningModal";
import { Notice, StatusStrip, StripTone, formatLastChecked, stripButtonClass } from "./StatusStrip";

interface AiracSectionProps {
    installedAiracVersion: string | null;
    latestAiracVersion: string | null;
    newAiracVersionAvailable: boolean | null;
    startupError: string | null;
    onUpdateComplete?: () => void;
}

// ─── main component ───────────────────────────────────────────────────────────

export const AiracSection = ({
                                 installedAiracVersion,
                                 latestAiracVersion,
                                 newAiracVersionAvailable,
                                 startupError,
                                 onUpdateComplete,
                             }: AiracSectionProps) => {
    const [hasOpenedSectorDownload, setHasOpenedSectorDownload] = useState(false);
    const [isWarningOpen, setIsWarningOpen] = useState(false);
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

    const tone: StripTone = startupError
        ? "error"
        : requiresSectorImport || hasUpdate
            ? "action"
            : isInstalled
                ? "current"
                : "idle";

    const statusLabel = startupError
        ? "Status unavailable"
        : requiresSectorImport
            ? "Sector files needed"
            : hasUpdate
                ? "Update available"
                : isUpToDate || updateSuccess || isInstalled
                    ? "Up to date"
                    : "Not installed";

    const primaryLabel = isUpdating
        ? "Installing…"
        : isImportingSectorZip
            ? "Importing…"
            : requiresSectorImport && !hasOpenedSectorDownload
                ? "Download sector files"
                : requiresSectorImport
                    ? "Import ZIP"
                    : hasUpdate
                        ? "Install update"
                        : !isInstalled
                            ? "Install"
                            : "Check for updates";

    const isPrimaryDisabled = startupError !== null || isUpdating || isImportingSectorZip;

    const executeInstall = async () => {
        await updateAirac();
        setHasOpenedSectorDownload(false);
    };

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
            if (!hasSeenInstallWarning()) {
                setIsWarningOpen(true);
                return;
            }
            await executeInstall();
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

    const steps = [
        {
            title: "Download the sector files from AeroNav",
            detail: "Log in on AeroNav and download the LIXX package. It opens in your browser.",
            done: hasOpenedSectorDownload,
            // The strip button drives the next step; this only lets people reopen the page.
            action: hasOpenedSectorDownload ? (
                <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => void openSectorDownloadPage()}
                    disabled={isPrimaryDisabled}
                >
                    Open AeroNav again
                </button>
            ) : null,
        },
        {
            title: "Import the ZIP you downloaded",
            detail: "Pick the AeroNav ZIP. Only its .sct, .ese, ICAO and NavData files are used.",
            done: hasImportedSectorFiles,
            action: null,
        },
        {
            title: `Install AIRAC ${targetAiracVersion}`,
            detail: "Available once the sector files are imported.",
            done: false,
            action: null,
        },
    ];
    const currentStep = steps.findIndex((step) => !step.done);

    return (
        <div className="space-y-5">
            <InstallWarningModal
                isOpen={isWarningOpen}
                onClose={() => setIsWarningOpen(false)}
                onConfirm={() => {
                    setIsWarningOpen(false);
                    void executeInstall();
                }}
            />

            <StatusStrip
                tone={tone}
                installed={installedAiracVersion ?? "—"}
                latest={latestAiracVersion ?? "—"}
                status={statusLabel}
                lastChecked={formatLastChecked(lastCheckedAt)}
                action={
                    <button
                        type="button"
                        disabled={isPrimaryDisabled}
                        onClick={() => void handlePrimaryAction()}
                        className={stripButtonClass}
                    >
                        {isUpdating && (
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-strip border-t-transparent" />
                        )}
                        {primaryLabel}
                    </button>
                }
            />

            {requiresSectorImport && !startupError && (
                <ol className="panel divide-y divide-secondary-600" aria-label="Install steps">
                    {steps.map((step, index) => {
                        const isCurrent = index === currentStep;
                        return (
                            <li key={step.title} className={`flex items-center gap-4 px-5 py-4 ${isCurrent ? "" : "opacity-60"}`}>
                                <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
                                        step.done
                                            ? "bg-accent-success text-strip-ink"
                                            : isCurrent
                                                ? "bg-strip text-strip-ink"
                                                : "border border-secondary-500 text-secondary-400"
                                    }`}
                                    aria-hidden
                                >
                                    {step.done ? "✓" : index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-secondary-100">{step.title}</div>
                                    <div className="text-sm text-secondary-400">{step.detail}</div>
                                </div>
                                {step.action}
                            </li>
                        );
                    })}
                </ol>
            )}

            {startupError && (
                <Notice kind="danger" title="Couldn't load AIRAC information" message={startupError} />
            )}
            {sectorImportError && (
                <Notice kind="danger" title="Sector import failed" message={sectorImportError} onDismiss={clearError} />
            )}
            {sectorImportSuccess && (
                <Notice kind="success" title="Sector files imported" message={sectorImportSuccess} />
            )}
            {updateError && (
                <Notice kind="danger" title="Install failed" message={updateError} onDismiss={clearError} />
            )}
            {updateSuccess && (
                <Notice kind="success" title="Installed" message="Your sector files are on the latest AIRAC." />
            )}

            <section className="panel">
                <h2 className="panel-title">
                    <span>What's new</span>
                    {targetAiracVersion !== "—" && (
                        <span className="font-mono text-xs font-normal text-secondary-400">AIRAC {targetAiracVersion}</span>
                    )}
                </h2>
                <div className="custom-scrollbar max-h-96 overflow-y-auto px-5 py-4">
                    {isLoadingChangelog ? (
                        <p className="text-sm text-secondary-500">Loading release notes…</p>
                    ) : changelog ? (
                        <div className="markdown-content max-w-[70ch]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{changelog}</ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-secondary-500">This release has no notes.</p>
                    )}
                </div>
            </section>
        </div>
    );
};
