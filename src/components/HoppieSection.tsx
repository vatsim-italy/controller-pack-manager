import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface HoppieSectionProps {
    hoppieCode: string | null;
}

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

export const HoppieSection = ({ hoppieCode }: HoppieSectionProps) => {
    const [codeInput, setCodeInput] = useState(hoppieCode ?? "");
    const [isUpdatingCode, setIsUpdatingCode] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [updateSuccess, setUpdateSuccess] = useState(false);
    const [isCodeVisible, setIsCodeVisible] = useState(false);

    useEffect(() => {
        setCodeInput(hoppieCode ?? "");
    }, [hoppieCode]);

    const handleUpdateHoppieCode = async () => {
        const normalized = codeInput.trim();
        if (!normalized) {
            setUpdateError("Hoppie code cannot be empty.");
            return;
        }

        setIsUpdatingCode(true);
        setUpdateError(null);
        setUpdateSuccess(false);

        try {
            await invoke("update_hoppie_code", { hoppieCode: normalized });
            setUpdateSuccess(true);
            setTimeout(() => setUpdateSuccess(false), 2500);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setUpdateError(message);
        } finally {
            setIsUpdatingCode(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-3xl font-bold text-white">Hoppie Code CPDLC Section</h2>
                <p className="mt-1 text-sm text-secondary-500">
                    Your Hoppie code is required for CPDLC and DCL operations in the LIXX FIR.
                </p>
            </div>

            <section className="rounded-xl border border-secondary-600 bg-dark-header p-4 shadow-md">
                <div className="space-y-4">
                    <div>
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-secondary-500">Current Hoppie Code</span>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-secondary-600 bg-secondary-700 px-3 py-2">
                                <span className="text-secondary-500">⇄</span>
                                <input
                                    type={isCodeVisible ? "text" : "password"}
                                    value={codeInput}
                                    onChange={(event) => setCodeInput(event.target.value)}
                                    className="w-full bg-transparent font-mono text-sm text-white outline-none"
                                />
                                <button
                                    type="button"
                                    className="text-secondary-100 transition-colors hover:text-white"
                                    onClick={() => setIsCodeVisible((current) => !current)}
                                    aria-label={isCodeVisible ? "Hide code" : "Show code"}
                                >
                                    {isCodeVisible ? <IconEyeClosed /> : <IconEyeOpen />}
                                </button>
                            </div>

                            <button
                                className="btn-primary px-4 py-2 text-sm font-bold"
                                onClick={handleUpdateHoppieCode}
                                disabled={isUpdatingCode}
                            >
                                {isUpdatingCode ? "Updating..." : "Update Hoppie Code"}
                            </button>
                        </div>

                        {!hoppieCode && (
                            <p className="mt-2 text-sm text-secondary-500">
                                No Hoppie code was found. Enter a code and press update.
                            </p>
                        )}
                    </div>

                    {updateError && (
                        <div className="alert alert-error">
                            <div className="alert-icon">❌</div>
                            <div className="alert-content">
                                <div className="alert-title">Update Failed</div>
                                <div className="alert-message">{updateError}</div>
                            </div>
                        </div>
                    )}

                    {updateSuccess && (
                        <div className="alert alert-success">
                            <div className="alert-icon">✅</div>
                            <div className="alert-content">
                                <div className="alert-title">Update Completed</div>
                                <div className="alert-message">Hoppie code has been updated.</div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
