import { ReactNode } from "react";
import { Header } from "./Header";
import { ErrorBoundary } from "./ErrorBoundary";

interface LayoutProps {
    children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
    return (
        <ErrorBoundary>
            <div className="flex flex-col h-screen bg-gray-50">
                <Header />
                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </ErrorBoundary>
    );
};
