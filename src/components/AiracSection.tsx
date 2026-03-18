import { useAiracUpdate } from "../hooks/useAiracUpdate";

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
    const { isUpdating, updateError, updateSuccess, updateAirac, clearError } =
        useAiracUpdate();

    return (
        <div className="card card-accent">
            <div className="card-header">
                <div className="card-icon">🗺️</div>
                <h2 className="text-xl font-semibold text-white">AIRAC Release</h2>
            </div>

            {startupError ? (
                <div className="alert alert-error">
                    <div className="alert-icon">❌</div>
                    <div className="alert-content">
                        <div className="alert-title">Unable to Load</div>
                        <div className="alert-message">
                            AIRAC information could not be loaded due to a startup error.
                        </div>
                    </div>
                </div>
            ) : installedAiracVersion ? (
                <div className="card-content">
                    <div>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-secondary-500">Installed Version</span>
                        <span className="block text-base text-accent-success font-semibold">{installedAiracVersion}</span>
                    </div>

                    {newAiracVersionAvailable && (
                        <div className="alert alert-info">
                            <div className="alert-icon">ℹ️</div>
                            <div className="alert-content">
                                <div className="alert-title">Update Available</div>
                                <div className="alert-message">
                                    A newer AIRAC version is available for download.
                                </div>
                            </div>
                        </div>
                    )}

                    {!newAiracVersionAvailable && (
                        <div className="status-badge status-badge-success">
                            <span className="status-dot"></span>
                            Up to Date
                        </div>
                    )}

                    {updateError && (
                        <div className="alert alert-error">
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
                        <div className="alert alert-success">
                            <div className="alert-icon">✅</div>
                            <div className="alert-content">
                                <div className="alert-title">Update Completed</div>
                                <div className="alert-message">
                                    AIRAC version has been successfully updated!
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        className="btn-primary w-full"
                        onClick={updateAirac}
                        disabled={!newAiracVersionAvailable || isUpdating}
                    >
                        {isUpdating && <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>}
                        {isUpdating ? "Updating..." : "Update AIRAC"}
                    </button>
                </div>
            ) : (
                <div className="alert alert-warning">
                    <div className="alert-icon">⚠️</div>
                    <div className="alert-content">
                        <div className="alert-title">No Installation Found</div>
                        <div className="alert-message">
                            No AIRAC release installation was found in
                            %APPDATA%\EuroScope\LIXX. Please ensure the AIRAC files are
                            properly installed.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
