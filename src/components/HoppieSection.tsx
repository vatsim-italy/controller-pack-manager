import { useState } from "react";

interface HoppieSectionProps {
    hoppieCode: string | null;
}

export const HoppieSection = ({ hoppieCode }: HoppieSectionProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopyToClipboard = async () => {
        if (hoppieCode) {
            await navigator.clipboard.writeText(hoppieCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="card card-accent">
            <div className="card-header">
                <div className="card-icon">🔑</div>
                <h2 className="text-xl font-semibold text-white">Hoppie Code</h2>
            </div>

            {hoppieCode ? (
                <div className="card-content">
                    <div>
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-secondary-500">Your Code</span>
                        <div className="rounded-lg border border-secondary-500 bg-secondary-700 p-4 font-mono text-lg break-all text-primary-100 user-select-all">
                            {hoppieCode}
                        </div>
                    </div>
                    <button
                        className="btn-primary w-full"
                        onClick={handleCopyToClipboard}
                    >
                        {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
                    </button>
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="text-4xl mb-4 opacity-50">🔍</div>
                    <div className="mb-2 text-xl font-semibold text-secondary-100">No Hoppie Code</div>
                    <div className="text-base text-secondary-500">
                        No Hoppie code was found in your EuroScope configuration.
                    </div>
                </div>
            )}
        </div>
    );
};
