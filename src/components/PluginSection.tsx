import { ReactNode, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluginUpdateState } from "../hooks/usePluginUpdate";

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
    feat: "bg-green-500",
    fix: "bg-red-500",
    chore: "bg-yellow-500",
    other: "bg-secondary-500",
};

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
    kind: "danger" | "success";
    title: string;
    message: string;
    onDismiss?: () => void;
}) => {
    const styles = {
        danger: {
            wrapper: "bg-red-500/10 border-t border-accent-danger/30",
            icon: "text-accent-danger",
            title: "text-accent-danger",
        },
        success: {
            wrapper: "bg-green-600/10 border-t border-green-600/30",
            icon: "text-green-400",
            title: "text-green-400",
        },
    }[kind];

    const icon = kind === "danger" ? "⚠" : "✓";

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
        ? "Installing..."
        : hasUpdate
            ? "Install Update"
            : installedVersion
                ? "Check for Updates"
                : "Install Plugin";

    const installedLabel = installedVersion
        ? installedVersion === "installed"
            ? "Unknown"
            : installedVersion
        : "Not installed";

    const statusDotClass = startupError
        ? "bg-red-500"
        : hasUpdate
            ? "bg-yellow-500"
            : installedVersion
                ? "bg-green-500"
                : "bg-secondary-500";

    const statusLabel = startupError
        ? "Plugin status unavailable"
        : isLoadingSettings
            ? "Loading plugin status…"
            : hasUpdate
                ? `Update available — ${availableVersion}`
                : installedVersion && installedVersion !== "installed"
                    ? `Up to date — ${installedVersion}`
                    : installedVersion
                        ? "Plugin installed"
                        : "Plugin not installed";

    const formattedLastChecked = lastCheckedAt
        ? lastCheckedAt.toLocaleString([], {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Never";

    const changelogBadge = hasUpdate
        ? `${availableVersion} — new release`
        : installedVersion && installedVersion !== "installed"
            ? `${installedVersion} — installed`
            : "Release notes";

    const handlePrimaryAction = () => {
        if (primaryActionInstalls) void updatePlugin();
        else void checkForUpdates();
    };

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
                        <MetricTile label="Installed" value={installedLabel} />
                        <MetricTile
                            label="Available"
                            value={availableVersion ?? "—"}
                            valueClassName={hasUpdate ? "text-accent-warning" : "text-secondary-500"}
                        />
                    </div>

                    {/* actions */}
                    <div className="flex flex-col items-end gap-2.5">
                        <button
                            type="button"
                            disabled={isPrimaryDisabled}
                            onClick={handlePrimaryAction}
                            className="btn-primary btn-small disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {primaryLabel}
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-secondary-500">Dev releases</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isDevReleasesOptedIn}
                                aria-label="Toggle dev releases"
                                onClick={() => void toggleDevReleasesOptIn(!isDevReleasesOptedIn)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                                    isDevReleasesOptedIn ? "bg-primary-600" : "bg-secondary-600"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        isDevReleasesOptedIn ? "translate-x-4" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* dev notice */}
                {isDevReleasesOptedIn && (
                    <div className="mx-5 mb-4 rounded-lg border border-accent-warning/40 bg-yellow-500/10 px-4 py-3">
                        <p className="text-xs font-semibold text-accent-warning">
                            Dev releases may be unstable. Use at your own risk.
                        </p>
                        <p className="mt-0.5 text-xs text-secondary-500">
                            Blame Fabio if EuroScope crashes.
                        </p>
                    </div>
                )}

                {/* alerts */}
                {startupError && (
                    <InlineAlert
                        kind="danger"
                        title="Unable to load"
                        message="Plugin information could not be loaded due to a startup error."
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
                        title="Plugin updated"
                        message="Restart EuroScope to load the new version."
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
                    ) : changelogError ? (
                        <p className="text-sm text-accent-danger">{changelogError}</p>
                    ) : changelog ? (
                        <div className="space-y-1">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({ children }) => (
                                        <div className="mb-2 mt-5 first:mt-0">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                                                {children}
                                            </span>
                                            <div className="mt-1.5 h-px bg-secondary-700" />
                                        </div>
                                    ),
                                    p: ({ children }) => {
                                        const kind = entryKind(extractText(children));
                                        return (
                                            <div className="flex items-baseline gap-2.5 py-0.5">
                                                <div
                                                    className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASS[kind]}`}
                                                />
                                                <span className="text-sm text-secondary-300 leading-relaxed">
                                                    {children}
                                                </span>
                                            </div>
                                        );
                                    },
                                    ul: ({ children }) => (
                                        <div className="space-y-0.5">{children}</div>
                                    ),
                                    li: ({ children }) => {
                                        const kind = entryKind(extractText(children));
                                        return (
                                            <div className="flex items-baseline gap-2.5 py-0.5">
                                                <div
                                                    className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASS[kind]}`}
                                                />
                                                <span className="text-sm text-secondary-300 leading-relaxed">
                                                    {children}
                                                </span>
                                            </div>
                                        );
                                    },
                                }}
                            >
                                {changelog}
                            </ReactMarkdown>
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