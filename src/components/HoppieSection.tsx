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
                <h2 className="text-xl font-semibold text-dark-text">Hoppie Code</h2>
            </div>

            {hoppieCode ? (
                <div className="card-content">
                    <div>
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Code</span>
                        <div className="bg-gray-50 p-4 rounded-lg font-mono text-lg text-primary-600 break-all user-select-all border border-gray-200">
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
                    <div className="text-xl font-semibold text-gray-700 mb-2">No Hoppie Code</div>
                    <div className="text-base text-gray-600">
                        No Hoppie code was found in your EuroScope configuration.
                    </div>
                </div>
            )}
        </div>
    );
};
