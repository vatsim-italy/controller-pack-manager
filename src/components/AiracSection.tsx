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
        updateError,
        updateSuccess,
        updateAirac,
        clearError,
        changelog,
        isLoadingChangelog,
    } = useAiracUpdate();

    const isUpToDate = newAiracVersionAvailable === false;
    const hasUpdate = newAiracVersionAvailable === true;
    const statusTitle = startupError
        ? "Sector File Status: Unavailable"
        : isUpToDate
            ? "Sector File Status: Up to Date"
            : hasUpdate
                ? "Sector File Status: Update Available"
                : "Sector File Status: Unknown";

    return (
        <div className="space-y-8">
            <section className="rounded-xl border border-secondary-600 bg-dark-header p-8 shadow-md">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-5">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-secondary-600 bg-secondary-700">
                            <span className={`text-4xl ${startupError ? "text-accent-danger" : hasUpdate ? "text-accent-warning" : "text-accent-success"}`}>
                                {startupError ? "⚠" : hasUpdate ? "↻" : "✓"}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">{statusTitle}</h2>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-secondary-500">
                                <span className="rounded bg-primary-600/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-100">
                                    {installedAiracVersion ?? "unknown"}
                                </span>
                                <span>
                                    {isLoadingChangelog
                                        ? "Checking latest release notes..."
                                        : "Synced with VATITA release feed"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        className="btn-primary px-6 py-3 font-bold"
                        onClick={updateAirac}
                        disabled={isUpdating || startupError !== null}
                    >
                        {isUpdating && <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
                        {isUpdating ? "Updating..." : hasUpdate ? "Install Update" : "Check for Updates"}
                    </button>
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

                    <div className="max-h-96 overflow-y-auto p-6 custom-scrollbar">
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
