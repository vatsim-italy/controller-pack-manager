import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { VersionWarning } from "./VersionWarning";
import type { DashboardSection } from "../App";

interface LayoutProps {
    children: ReactNode;
    activeSection: DashboardSection;
    onSectionChange: (section: DashboardSection) => void;
    /** Sections with something waiting on the user (e.g. an update). */
    attention?: Partial<Record<DashboardSection, boolean>>;
}

const IconDocument = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
    </svg>
);

const IconPlugin = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
        <path d="M9 3v3M15 3v3M12 14v7M9 10H6a3 3 0 0 1 0-6h2M15 10h3a3 3 0 1 0 0-6h-2" />
        <rect x="7" y="6" width="10" height="8" rx="2" />
    </svg>
);

const IconProfile = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20a8 8 0 1 1 16 0" />
    </svg>
);

const IconCompass = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="m14.8 9.2-1.8 5.6-5.6 1.8 1.8-5.6z" />
    </svg>
);

const IconSettings = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.07 16.8l.06-.06A1.7 1.7 0 0 0 4.46 15a1.7 1.7 0 0 0-1.56-1H2.8a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 6.9 4.24l.06.06a1.7 1.7 0 0 0 1.87.34h0A1.7 1.7 0 0 0 9.84 3.08V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06A2 2 0 1 1 19.93 7.2l-.06.06a1.7 1.7 0 0 0-.34 1.87h0a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.56 1Z" />
    </svg>
);

const dashboardItems: Array<{
    id: DashboardSection;
    label: string;
    icon: ReactNode;
}> = [
        { id: "sector-file", label: "Sector files", icon: <IconDocument /> },
        { id: "plugin", label: "Plugin", icon: <IconPlugin /> },
        { id: "profiles", label: "Profiles", icon: <IconProfile /> },
        { id: "topsky", label: "TopSky", icon: <IconCompass /> },
    ];

const NavButton = ({
    label,
    icon,
    isActive,
    needsAttention,
    onClick,
}: {
    label: string;
    icon: ReactNode;
    isActive: boolean;
    needsAttention?: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
            isActive
                ? "bg-secondary-600 text-secondary-100"
                : "text-secondary-400 hover:bg-secondary-600/50 hover:text-secondary-100"
        }`}
    >
        {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-strip" aria-hidden />}
        <span aria-hidden>{icon}</span>
        <span className="flex-1">{label}</span>
        {needsAttention && (
            <span className="h-2 w-2 rounded-full bg-accent-warning" title="Update available" aria-label="Update available" />
        )}
    </button>
);

export const Layout = ({ children, activeSection, onSectionChange, attention = {} }: LayoutProps) => {
    return (
        <ErrorBoundary>
            <div className="flex h-screen w-full overflow-hidden bg-secondary-700 text-secondary-100">
                <aside className="flex h-full w-52 shrink-0 flex-col border-r border-secondary-600 bg-secondary-800">
                    <div className="px-5 pb-5 pt-6">
                        <img
                            src="https://www.vatita.net/images/Logo_e_scritta_white.svg"
                            alt="VATITA"
                            className="h-9 w-auto max-w-[130px] object-contain"
                        />
                        <div className="mt-2 font-display text-xs text-secondary-500">Controller Pack Manager</div>
                    </div>

                    <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
                        {dashboardItems.map((item) => (
                            <NavButton
                                key={item.id}
                                label={item.label}
                                icon={item.icon}
                                isActive={item.id === activeSection}
                                needsAttention={attention[item.id]}
                                onClick={() => onSectionChange(item.id)}
                            />
                        ))}
                    </nav>

                    <div className="border-t border-secondary-600 p-3">
                        <NavButton
                            label="Settings"
                            icon={<IconSettings />}
                            isActive={activeSection === "settings"}
                            onClick={() => onSectionChange("settings")}
                        />
                    </div>
                </aside>

                <main className="custom-scrollbar flex-1 overflow-y-auto px-10 py-8">
                    {children}
                </main>
                <VersionWarning />
            </div>
        </ErrorBoundary>
    );
};
