import { ReactNode, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluginUpdateState } from "../hooks/usePluginUpdate";
import { Notice, StatusStrip, StripTone, formatLastChecked, stripButtonClass } from "./StatusStrip";

interface PluginSectionProps extends PluginUpdateState {
    startupError: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const extractText = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (isValidElement<{ children?: ReactNode }>(node))
        return extractText(node.props.children ?? "");
    return "";
};

type EntryKind = "feat" | "fix" | "chore" | "other";

const entryKind = (text: string): EntryKind => {
    const t = text.trim().toLowerCase();
    if (t.startsWith("feat:")) return "feat";
    if (t.startsWith("fix:")) return "fix";
    if (t.startsWith("chore:")) return "chore";
    return "other";
};

const DOT_CLASS: Record<EntryKind, string> = {
    feat: "bg-accent-success",
    fix: "bg-accent-danger",
    chore: "bg-accent-warning",
    other: "bg-secondary-500",
};

// ─── main component ───────────────────────────────────────────────────────────

export const PluginSection = ({ startupError, ...pluginState }: PluginSectionProps) => {
    const {
        isUpdating,
        updateError,
        updateSuccess,
        updatePlugin,
        checkForUpdates,
        clearError,
        changelog,
        isLoadingChangelog,
        changelogError,
        availableVersion,
        isDevReleasesOptedIn,
        toggleDevReleasesOptIn,
        lastCheckedAt,
        installedVersion,
        isLoadingSettings,
    } = pluginState;

    const hasUpdate = Boolean(availableVersion);
    const primaryActionInstalls = hasUpdate || !installedVersion;
    const isPrimaryDisabled = isUpdating || isLoadingSettings || startupError !== null;

    const primaryLabel = isUpdating
        ? "Installing…"
        : hasUpdate
            ? "Install update"
            : installedVersion
                ? "Check for updates"
                : "Install plugin";

    const installedLabel = installedVersion
        ? installedVersion === "installed"
            ? "unknown"
            : installedVersion
        : "Not installed";

    const tone: StripTone = startupError
        ? "error"
        : hasUpdate
            ? "action"
            : installedVersion
                ? "current"
                : "idle";

    const statusLabel = startupError
        ? "Status unavailable"
        : isLoadingSettings
            ? "Checking…"
            : hasUpdate
                ? "Update available"
                : installedVersion
                    ? "Up to date"
                    : "Not installed";

    const handlePrimaryAction = () => {
        if (primaryActionInstalls) void updatePlugin();
        else void checkForUpdates();
    };

    const entry = (children: ReactNode) => {
        const kind = entryKind(extractText(children));
        return (
            <div className="flex items-baseline gap-2.5 py-0.5">
                <div className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASS[kind]}`} />
                <span className="text-sm leading-relaxed text-secondary-200">{children}</span>
            </div>
        );
    };

    return (
        <div className="space-y-5">
            <StatusStrip
                tone={tone}
                installed={installedLabel}
                latest={availableVersion ?? (installedVersion && !hasUpdate ? installedLabel : "—")}
                status={statusLabel}
                lastChecked={formatLastChecked(lastCheckedAt)}
                action={
                    <button
                        type="button"
                        disabled={isPrimaryDisabled}
                        onClick={handlePrimaryAction}
                        className={stripButtonClass}
                    >
                        {isUpdating && (
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-strip border-t-transparent" />
                        )}
                        {primaryLabel}
                    </button>
                }
            />

            <section className="panel flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-secondary-100">Dev releases</div>
                    <div className="text-sm text-secondary-400">
                        {isDevReleasesOptedIn
                            ? "You get release candidates before everyone else. They may crash EuroScope."
                            : "Get release candidates before the stable release. They may crash EuroScope."}
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isDevReleasesOptedIn}
                    aria-label="Dev releases"
                    onClick={() => void toggleDevReleasesOptIn(!isDevReleasesOptedIn)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        isDevReleasesOptedIn ? "bg-accent-warning" : "bg-secondary-600"
                    }`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-secondary-100 transition-transform ${
                            isDevReleasesOptedIn ? "translate-x-5" : "translate-x-0.5"
                        }`}
                    />
                </button>
            </section>

            {startupError && (
                <Notice kind="danger" title="Couldn't load plugin information" message={startupError} />
            )}
            {updateError && (
                <Notice kind="danger" title="Install failed" message={updateError} onDismiss={clearError} />
            )}
            {updateSuccess && (
                <Notice kind="success" title="Plugin installed" message="Restart EuroScope to load the new version." />
            )}

            <section className="panel">
                <h2 className="panel-title">
                    <span>What's new</span>
                    {(availableVersion || installedVersion) && (
                        <span className="font-mono text-xs font-normal text-secondary-400">
                            {availableVersion ?? installedLabel}
                        </span>
                    )}
                </h2>
                <div className="custom-scrollbar max-h-96 max-w-[80ch] overflow-y-auto px-5 py-4">
                    {isLoadingChangelog ? (
                        <p className="text-sm text-secondary-500">Loading release notes…</p>
                    ) : changelogError ? (
                        <p className="text-sm text-accent-danger">{changelogError}</p>
                    ) : changelog ? (
                        <div className="space-y-1">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({ children }) => (
                                        <h3 className="mb-1.5 mt-5 font-display text-sm font-bold text-secondary-100 first:mt-0">
                                            {children}
                                        </h3>
                                    ),
                                    p: ({ children }) => entry(children),
                                    ul: ({ children }) => <div className="space-y-0.5">{children}</div>,
                                    li: ({ children }) => entry(children),
                                }}
                            >
                                {changelog}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-secondary-500">This release has no notes.</p>
                    )}
                </div>
            </section>
        </div>
    );
};
