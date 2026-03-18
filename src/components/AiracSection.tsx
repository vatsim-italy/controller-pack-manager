import { useAiracUpdate } from "../hooks/useAiracUpdate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiracSectionProps {
    installedAiracVersion: string | null;
    newAiracVersionAvailable: boolean | null;
    startupError: string | null;
}

export const AiracSection = ({
    installedAiracVersion,
    newAiracVersionAvailable,
    startupError,
}: AiracSectionProps) => {
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
    } = useAiracUpdate();

    const hasUpdate = newAiracVersionAvailable === true;
    const requiresSectorImport = hasUpdate && !hasImportedSectorFiles;
    const cardTitle = startupError
        ? `Update Status Unavailable: AIRAC ${installedAiracVersion ?? "unknown"}`
        : requiresSectorImport
            ? `Update Ready: Import Sector Files for AIRAC ${installedAiracVersion ?? "unknown"}`
            : hasUpdate
                ? `Update Available: AIRAC ${installedAiracVersion ?? "unknown"}`
                : `Up to Date: AIRAC ${installedAiracVersion ?? "unknown"}`;

    const formattedLastChecked = lastCheckedAt
        ? lastCheckedAt.toLocaleString([], {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Never";

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-secondary-600 bg-dark-header p-6 shadow-md">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-secondary-600 bg-secondary-700">
                            {startupError ? (
                                <span className="text-2xl text-accent-danger">⚠</span>
                            ) : hasUpdate ? (
                                <span className="text-2xl text-accent-warning">↻</span>
                            ) : (
                                <span className="text-2xl text-accent-success">✓</span>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <h2 className="text-xl font-bold text-white">{cardTitle}</h2>
                            <p className="text-xs text-secondary-500">Last check for updates: {formattedLastChecked}</p>
                            {requiresSectorImport && (
                                <p className="text-xs text-accent-warning">
                                    Install is locked until you import the downloaded AeroNav sector zip.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        {hasUpdate && (
                            <>
                                <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => void openSectorDownloadPage()}
                                    disabled={startupError !== null || isUpdating || isImportingSectorZip}
                                >
                                    Download Update
                                </button>

                                <button
                                    type="button"
                                    className="btn-warning btn-small"
                                    onClick={() => void importSectorZip()}
                                    disabled={startupError !== null || isUpdating || isImportingSectorZip}
                                >
                                    {isImportingSectorZip ? "Importing..." : "Import Update"}
                                </button>
                            </>
                        )}

                        <button
                            className="btn-primary px-5 py-2.5 text-sm font-bold"
                            onClick={hasUpdate ? updateAirac : checkForUpdates}
                            disabled={isUpdating || startupError !== null || requiresSectorImport}
                        >
                            {isUpdating && <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
                            {isUpdating
                                ? "Updating..."
                                : requiresSectorImport
                                    ? "Import Sector ZIP First"
                                    : hasUpdate
                                        ? "Install Update"
                                        : "Check for Updates"}
                        </button>
                    </div>
                </div>

                {startupError && (
                    <div className="mt-4 alert alert-error">
                        <div className="alert-icon">❌</div>
                        <div className="alert-content">
                            <div className="alert-title">Unable to Load</div>
                            <div className="alert-message">
                                AIRAC information could not be loaded due to a startup error.
                            </div>
                        </div>
                    </div>
                )}

                {sectorImportError && (
                    <div className="mt-4 alert alert-error">
                        <div className="alert-icon">❌</div>
                        <div className="alert-content">
                            <div className="alert-title">Sector Import Failed</div>
                            <div className="alert-message">{sectorImportError}</div>
                        </div>
                        <button
                            className="btn-secondary btn-small mt-2"
                            onClick={clearError}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {sectorImportSuccess && (
                    <div className="mt-4 alert alert-success">
                        <div className="alert-icon">✅</div>
                        <div className="alert-content">
                            <div className="alert-title">Sector Files Imported</div>
                            <div className="alert-message">{sectorImportSuccess}</div>
                        </div>
                    </div>
                )}

                {updateError && (
                    <div className="mt-4 alert alert-error">
                        <div className="alert-icon">❌</div>
                        <div className="alert-content">
                            <div className="alert-title">Update Failed</div>
                            <div className="alert-message">{updateError}</div>
                        </div>
                        <button
                            className="btn-secondary btn-small mt-2"
                            onClick={clearError}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {updateSuccess && (
                    <div className="mt-4 alert alert-success">
                        <div className="alert-icon">✅</div>
                        <div className="alert-content">
                            <div className="alert-title">Update Completed</div>
                            <div className="alert-message">
                                AIRAC version has been successfully updated.
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                        <span className="text-primary-600">↺</span>
                        <span>Detailed Changelog</span>
                    </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-secondary-600 bg-dark-header shadow-sm">
                    <div className="flex items-center justify-between border-b border-secondary-600 bg-secondary-700/50 p-6">
                        <span className="font-bold uppercase tracking-tight text-white">
                            Version {installedAiracVersion ?? "unknown"}
                        </span>
                        <span className="text-xs font-medium text-secondary-500">
                            Latest release notes
                        </span>
                    </div>

                    <div className="custom-scrollbar max-h-[calc(100vh-410px)] overflow-y-auto p-6">
                        {isLoadingChangelog ? (
                            <p className="text-sm text-secondary-500">Loading latest release notes…</p>
                        ) : changelog ? (
                            <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {changelog}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-sm text-secondary-500">
                                No changelog is available for this release.
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};
