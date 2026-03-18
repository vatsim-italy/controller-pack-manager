import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { DashboardSection } from "../App";

interface LayoutProps {
    children: ReactNode;
    activeSection: DashboardSection;
    onSectionChange: (section: DashboardSection) => void;
}

const dashboardItems: Array<{
    id: DashboardSection;
    label: string;
    icon: string;
}> = [
        { id: "sector-file", label: "Sector File", icon: "📄" },
        { id: "plugin", label: "Plugin", icon: "🔌" },
        { id: "profiles", label: "Profiles", icon: "👤" },
        { id: "topsky", label: "TopSky", icon: "🧭" },
    ];

export const Layout = ({ children, activeSection, onSectionChange }: LayoutProps) => {
    return (
        <ErrorBoundary>
            <div className="flex h-screen w-full overflow-hidden bg-secondary-700 text-white">
                <aside className="flex h-full w-72 shrink-0 flex-col border-r border-secondary-600 bg-dark-header">
                    <div className="border-b border-secondary-600 px-6 py-6">
                        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-500">VATITA</div>
                        <div className="mt-2 text-3xl font-bold text-white">Dashboard</div>
                        <p className="mt-1 text-sm text-secondary-500">Italy vACC Controller Pack</p>
                    </div>

                    <nav className="flex-1 space-y-2 p-5" aria-label="Primary">
                        {dashboardItems.map((item) => {
                            const isActive = item.id === activeSection;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSectionChange(item.id)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xl font-semibold transition-all duration-150 ${isActive
                                            ? "bg-primary-600 text-white shadow-lg"
                                            : "text-secondary-500 hover:bg-secondary-600 hover:text-white"
                                        }`}
                                >
                                    <span aria-hidden>{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="space-y-4 border-t border-secondary-600 p-5">
                        <div className="inline-flex items-center gap-2 rounded-full bg-secondary-600 px-3 py-1 text-sm font-medium text-secondary-100">
                            <span className="h-2 w-2 rounded-full bg-accent-success"></span>
                            EuroScope Connected
                        </div>

                        <div className="space-y-2 text-sm text-secondary-500">
                            <button type="button" className="block w-full rounded-lg px-2 py-2 text-left hover:bg-secondary-600 hover:text-white">
                                Settings
                            </button>
                            <button type="button" className="block w-full rounded-lg px-2 py-2 text-left hover:bg-secondary-600 hover:text-white">
                                Support
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 overflow-y-auto px-8 py-8">
                    {children}
                </main>
            </div>
        </ErrorBoundary>
    );
};
