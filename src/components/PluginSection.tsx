import { isValidElement, ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePluginUpdate } from "../hooks/usePluginUpdate";

const IconEyeOpen = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const IconEyeClosed = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" />
        <path d="M9.9 5.1A11.3 11.3 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-4.2 4.9" />
        <path d="M6.2 6.3A17.1 17.1 0 0 0 2 12s3.5 7 10 7c1.5 0 2.9-.4 4.1-1" />
    </svg>
);

interface PluginSectionProps {
    installedAiracVersion: string | null;
    installedPluginVersion: string | null;
    startupError: string | null;
}

export const PluginSection = ({
    installedAiracVersion,
    installedPluginVersion,
    startupError,
}: PluginSectionProps) => {
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [isTokenVisible, setIsTokenVisible] = useState(false);

    const {
        isUpdating,
        isSavingToken,
        updateError,
        updateSuccess,
        updatePlugin,
        clearError,
        changelog,
        isLoadingChangelog,
        changelogError,
        availableVersion,
        hasGithubToken,
        isDevReleasesOptedIn,
        tokenInput,
        setTokenInput,
        saveGithubToken,
        clearGithubToken,
        toggleDevReleasesOptIn,
        lastCheckedAt,
    } = usePluginUpdate();

    const hasUpdate = Boolean(availableVersion);
    const currentInstalledVersionLabel = installedPluginVersion
        ? `${installedPluginVersion}`
        : `AIRAC ${installedAiracVersion ?? "unknown"}`;

    const cardTitle = startupError
        ? `Update Status Unavailable: ${currentInstalledVersionLabel}`
        : hasUpdate
            ? `Update Available: ${availableVersion}`
            : `Up to Date: ${currentInstalledVersionLabel}`;

    const formattedLastChecked = lastCheckedAt
        ? lastCheckedAt.toLocaleString([], {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Never";

    const extractText = (node: ReactNode): string => {
        if (typeof node === "string" || typeof node === "number") {
            return String(node);
        }

        if (Array.isArray(node)) {
            return node.map(extractText).join("");
        }

        if (isValidElement<{ children?: ReactNode }>(node)) {
            return extractText(node.props.children ?? "");
        }

        return "";
    };

    return (
        <>
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
                                {!hasGithubToken && (
                                    <p className="text-xs text-accent-warning">Provide a GitHub access token to fetch plugin releases.</p>
                                )}
                                {hasGithubToken && !isDevReleasesOptedIn && (
                                    <p className="text-xs text-accent-warning">Enable dev releases to install plugin updates.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-secondary-500">Dev mode</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isDevReleasesOptedIn}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDevReleasesOptedIn ? "bg-primary-600" : "bg-secondary-600"}`}
                                    onClick={() => void toggleDevReleasesOptIn(!isDevReleasesOptedIn)}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isDevReleasesOptedIn ? "translate-x-5" : "translate-x-0.5"}`}
                                    />
                                </button>
                            </div>

                            <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => setIsTokenModalOpen(true)}
                            >
                                {hasGithubToken ? "Manage Token" : "Set Access Token"}
                            </button>

                            <button
                                className="btn-primary px-5 py-2.5 text-sm font-bold"
                                onClick={updatePlugin}
                                disabled={isUpdating || startupError !== null || !hasGithubToken || !isDevReleasesOptedIn}
                            >
                                {isUpdating && <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
                                {isUpdating ? "Updating..." : hasUpdate ? "Install Update" : "Check for Updates"}
                            </button>
                        </div>
                    </div>

                    {isDevReleasesOptedIn && (
                        <div className="mt-4 rounded-lg border border-accent-warning bg-accent-warning/10 p-3">
                            <p className="text-sm font-semibold text-accent-warning">
                                Dev releases could be unstable. Use it at your own risk.
                            </p>
                            <p className="mt-1 text-xs text-secondary-500">Blame Fabio if EuroScope crashes</p>
                        </div>
                    )}

                    {startupError && (
                        <div className="mt-4 alert alert-error">
                            <div className="alert-icon">❌</div>
                            <div className="alert-content">
                                <div className="alert-title">Unable to Load</div>
                                <div className="alert-message">
                                    Plugin information could not be loaded due to a startup error.
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
                                    Plugin version has been successfully updated.
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
                                Version {currentInstalledVersionLabel}
                            </span>
                            <span className="text-xs font-medium text-secondary-500">
                                Latest release notes
                            </span>
                        </div>

                        <div className="custom-scrollbar max-h-[calc(100vh-410px)] overflow-y-auto p-6">
                            {isLoadingChangelog ? (
                                <p className="text-sm text-secondary-500">Loading latest release notes…</p>
                            ) : changelogError ? (
                                <p className="text-sm text-accent-danger">{changelogError}</p>
                            ) : changelog ? (
                                <div className="markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h2: ({ children }) => (
                                                <h2 className="mt-4 mb-2 text-base font-semibold text-white">{children}</h2>
                                            ),
                                            p: ({ children }) => {
                                                const normalized = extractText(children).trim().toLowerCase();
                                                const dotColor = normalized.startsWith("feat:")
                                                    ? "bg-accent-success"
                                                    : normalized.startsWith("fix:")
                                                        ? "bg-accent-danger"
                                                        : normalized.startsWith("chore:")
                                                            ? "bg-accent-warning"
                                                            : "";

                                                if (dotColor) {
                                                    return (
                                                        <div className="flex items-start gap-2">
                                                            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`}></span>
                                                            <p className="text-sm text-secondary-300">{children}</p>
                                                        </div>
                                                    );
                                                }

                                                return <p className="text-sm text-secondary-300">{children}</p>;
                                            },
                                        }}
                                    >
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

            {isTokenModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-dark-header/80 px-4">
                    <div className="w-full max-w-xl rounded-xl border border-secondary-600 bg-dark-header shadow-lg">
                        <div className="flex items-center justify-between border-b border-secondary-600 px-5 py-4">
                            <h3 className="text-base font-semibold text-white">GitHub Access Token</h3>
                            <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => setIsTokenModalOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-5">
                            <p className="text-sm text-secondary-500">
                                Provide a token with repository read access to download plugin releases.
                            </p>

                            <div className="relative">
                                <input
                                    type={isTokenVisible ? "text" : "password"}
                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    value={tokenInput}
                                    onChange={(event) => setTokenInput(event.target.value)}
                                    className="w-full rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2 pr-10 text-sm text-white outline-none focus:border-primary-600"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-100 transition-colors hover:text-white"
                                    onClick={() => setIsTokenVisible((current) => !current)}
                                    aria-label={isTokenVisible ? "Hide token" : "Show token"}
                                >
                                    {isTokenVisible ? <IconEyeClosed /> : <IconEyeOpen />}
                                </button>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    className="btn-small rounded-xl bg-accent-danger px-4 py-2 font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isSavingToken}
                                    onClick={() => void clearGithubToken()}
                                >
                                    Clear Token
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary px-4 py-2 text-sm font-semibold"
                                    disabled={isSavingToken}
                                    onClick={() => void saveGithubToken()}
                                >
                                    Save Token
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
