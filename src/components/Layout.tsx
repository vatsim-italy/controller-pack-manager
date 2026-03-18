import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { DashboardSection } from "../App";
import logo from "../assets/logo.png";

interface LayoutProps {
    children: ReactNode;
    activeSection: DashboardSection;
    onSectionChange: (section: DashboardSection) => void;
    isEuroscopeDetected: boolean;
}

const IconDocument = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
    </svg>
);

const IconPlugin = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
        <path d="M9 3v3M15 3v3M12 14v7M9 10H6a3 3 0 0 1 0-6h2M15 10h3a3 3 0 1 0 0-6h-2" />
        <rect x="7" y="6" width="10" height="8" rx="2" />
    </svg>
);

const IconProfile = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20a8 8 0 1 1 16 0" />
    </svg>
);

const IconCompass = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="m14.8 9.2-1.8 5.6-5.6 1.8 1.8-5.6z" />
    </svg>
);

const dashboardItems: Array<{
    id: DashboardSection;
    label: string;
    icon: ReactNode;
}> = [
        { id: "sector-file", label: "Sector File", icon: <IconDocument /> },
        { id: "plugin", label: "Plugin", icon: <IconPlugin /> },
        { id: "profiles", label: "Profiles", icon: <IconProfile /> },
        { id: "topsky", label: "TopSky", icon: <IconCompass /> },
    ];

export const Layout = ({ children, activeSection, onSectionChange, isEuroscopeDetected }: LayoutProps) => {
    return (
        <ErrorBoundary>
            <div className="flex h-screen w-full overflow-hidden bg-secondary-700 text-white">
                <aside className="flex h-full w-64 shrink-0 flex-col border-r border-secondary-600 bg-dark-header">
                    <div className="border-b border-secondary-600 px-5 py-6">
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="VATITA logo" className="h-9 w-9 object-contain" />
                            <div className="text-2xl font-bold leading-none text-white">VATITA</div>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-2 p-4" aria-label="Primary">
                        {dashboardItems.map((item) => {
                            const isActive = item.id === activeSection;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSectionChange(item.id)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-semibold transition-all duration-150 ${isActive
                                        ? "bg-primary-600 text-white shadow-lg"
                                        : "text-secondary-500 hover:bg-secondary-600 hover:text-white"
                                        }`}
                                >
                                    <span aria-hidden className="text-secondary-100">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="space-y-3 border-t border-secondary-600 p-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 text-sm font-medium text-secondary-100">
                            <span className={`h-2 w-2 rounded-full ${isEuroscopeDetected ? "bg-accent-success" : "bg-accent-danger"}`}></span>
                            {isEuroscopeDetected ? "EuroScope Detected" : "EuroScope Not Detected"}
                        </div>
                    </div>
                </aside>

                <main className="flex-1 overflow-y-auto px-6 py-5">
                    {children}
                </main>
            </div>
        </ErrorBoundary>
    );
};
