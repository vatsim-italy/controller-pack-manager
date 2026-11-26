import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Notice } from "./StatusStrip";

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

    const [legacyCode, setLegacyCode] = useState<string | null>(null);
    const [hasSavedCode, setHasSavedCode] = useState(!!hoppieCode);

    useEffect(() => {
        setCodeInput(hoppieCode ?? "");
        setHasSavedCode(!!hoppieCode);
        if (!hoppieCode) {
            invoke<string | null>("get_legacy_hoppie_code")
                .then(setLegacyCode)
                .catch(() => setLegacyCode(null));
        }
    }, [hoppieCode]);

    const handleUpdateHoppieCode = async (code: string = codeInput) => {
        const normalized = code.trim();
        if (!normalized) {
            setUpdateError("Hoppie code cannot be empty.");
            return;
        }

        setIsUpdatingCode(true);
        setUpdateError(null);
        setUpdateSuccess(false);

        try {
            await invoke("update_hoppie_code", { hoppieCode: normalized });
            setCodeInput(normalized);
            setHasSavedCode(true);
            setLegacyCode(null);
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
        <section className="panel space-y-4 p-5">
            <div>
                <label htmlFor="hoppie-code" className="font-semibold text-secondary-100">
                    Hoppie logon code
                </label>
                <p className="text-sm text-secondary-400">
                    {hasSavedCode
                        ? "Saved in your VCP plugin settings."
                        : "No code found. Get one at hoppie.nl, then save it here."}
                </p>
            </div>

            {legacyCode && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-secondary-600 bg-secondary-800 px-3 py-2">
                    <p className="text-sm text-secondary-200">
                        Found a Hoppie code in your old TopSky settings. Import it into the VCP plugin?
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn-primary btn-small"
                            onClick={() => handleUpdateHoppieCode(legacyCode)}
                            disabled={isUpdatingCode}
                        >
                            Import
                        </button>
                        <button type="button" className="btn-secondary btn-small" onClick={() => setLegacyCode(null)}>
                            Not now
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-[16rem] flex-1 items-center rounded-[3px] border border-secondary-600 bg-secondary-800 focus-within:border-secondary-500">
                    <input
                        id="hoppie-code"
                        type={isCodeVisible ? "text" : "password"}
                        value={codeInput}
                        onChange={(event) => setCodeInput(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full bg-transparent px-3 py-2 font-mono text-sm text-secondary-100 outline-none"
                    />
                    <button
                        type="button"
                        className="px-3 text-secondary-400 transition-colors hover:text-secondary-100"
                        onClick={() => setIsCodeVisible((current) => !current)}
                        aria-label={isCodeVisible ? "Hide code" : "Show code"}
                    >
                        {isCodeVisible ? <IconEyeClosed /> : <IconEyeOpen />}
                    </button>
                </div>

                <button
                    type="button"
                    className="btn-primary btn-small"
                    onClick={() => handleUpdateHoppieCode()}
                    disabled={isUpdatingCode}
                >
                    {isUpdatingCode ? "Saving…" : updateSuccess ? "Saved" : "Save code"}
                </button>
            </div>

            {updateError && <Notice kind="danger" title="Couldn't save the code" message={updateError} />}
        </section>
    );
};
