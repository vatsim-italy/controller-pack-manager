import { ReactNode } from "react";

export type StripTone = "current" | "action" | "error" | "idle";

const BAND_CLASS: Record<StripTone, string> = {
    current: "bg-accent-success",
    action: "bg-accent-warning",
    error: "bg-accent-danger",
    idle: "bg-secondary-500",
};

const StripCell = ({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) => (
    <div className="flex min-w-[7.5rem] flex-col justify-center border-r border-strip-rule px-4 py-3">
        <span className="text-xs font-medium text-strip-ink/70">{label}</span>
        <span className={`font-mono text-lg font-bold leading-tight ${muted ? "text-strip-ink/50" : "text-strip-ink"}`}>
            {value}
        </span>
    </div>
);

interface StatusStripProps {
    tone: StripTone;
    installed: string;
    latest: string;
    status: string;
    lastChecked: string;
    action: ReactNode;
}

/** A version status drawn as a paper flight-progress strip. */
export const StatusStrip = ({ tone, installed, latest, status, lastChecked, action }: StatusStripProps) => (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-[3px] bg-strip text-strip-ink">
        <div className={`w-2 shrink-0 ${BAND_CLASS[tone]}`} aria-hidden />
        <StripCell label="Installed" value={installed} muted={installed === "—"} />
        <StripCell label="Latest" value={latest} muted={latest === "—"} />
        <div className="flex min-w-[12rem] flex-1 flex-col justify-center px-4 py-3">
            <span className="font-display text-sm font-bold" role="status">{status}</span>
            <span className="text-xs text-strip-ink/70">Checked {lastChecked}</span>
        </div>
        <div className="flex items-center px-3 py-3">{action}</div>
    </div>
);

/** Button that sits on the strip: dark ink on paper. */
export const stripButtonClass =
    "inline-flex items-center gap-2 rounded-[3px] bg-strip-ink px-4 py-2 text-sm font-semibold text-strip transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-40";

const NOTICE_CLASS = {
    danger: "border-l-accent-danger",
    success: "border-l-accent-success",
    warning: "border-l-accent-warning",
} as const;

export const Notice = ({
    kind,
    title,
    message,
    onDismiss,
}: {
    kind: keyof typeof NOTICE_CLASS;
    title: string;
    message?: ReactNode;
    onDismiss?: () => void;
}) => (
    <div
        className={`flex items-start gap-3 rounded-[3px] border border-l-4 border-secondary-600 bg-dark-header px-4 py-3 ${NOTICE_CLASS[kind]}`}
        role={kind === "danger" ? "alert" : "status"}
    >
        <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-secondary-100">{title}</div>
            {message && <div className="mt-0.5 break-words text-sm text-secondary-400">{message}</div>}
        </div>
        {onDismiss && (
            <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 text-sm text-secondary-500 transition-colors hover:text-secondary-100"
            >
                Dismiss
            </button>
        )}
    </div>
);

export const formatLastChecked = (date: Date | null) =>
    date
        ? date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : "never";
