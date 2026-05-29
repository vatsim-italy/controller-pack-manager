interface ConfigSectionProps {
    euroscopeConfigPath: string | null;
    startupError: string | null;
    isPickingFolder: boolean;
    folderActionError: string | null;
    onChooseFolder: () => Promise<void>;
    onResetFolder: () => Promise<void>;
}

export const ConfigSection = ({
    euroscopeConfigPath,
    startupError,
    isPickingFolder,
    folderActionError,
    onChooseFolder,
    onResetFolder,
}: ConfigSectionProps) => {
    return (
        <div className="space-y-6">
            {startupError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-xl text-red-300">❌</div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Detection failed</h3>
                            <p className="mt-1 text-sm leading-6 text-secondary-200">{startupError}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-secondary-600 bg-secondary-800/60 p-6 shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">EuroScope Configuration</h2>
                            <p className="mt-2 text-sm text-secondary-400">
                                {euroscopeConfigPath ? "Detected path" : "No path configured"}
                            </p>
                        </div>

                        <div className={`text-sm font-semibold ${euroscopeConfigPath ? "text-emerald-300" : "text-amber-300"}`}>
                            {euroscopeConfigPath ? "Detected" : "Not detected"}
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-secondary-600 bg-secondary-700/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-secondary-500">Path</p>
                        <p className="mt-2 break-all text-sm leading-6 text-secondary-100">
                            {euroscopeConfigPath ?? "No path configured"}
                        </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            className="btn-primary px-5 py-2.5 text-sm font-bold"
                            onClick={onChooseFolder}
                            disabled={isPickingFolder}
                        >
                            {isPickingFolder ? "Opening..." : euroscopeConfigPath ? "Change Folder" : "Choose Folder"}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary px-5 py-2.5 text-sm font-bold"
                            onClick={onResetFolder}
                            disabled={isPickingFolder || !euroscopeConfigPath}
                        >
                            Reset to Auto-Detect
                        </button>
                    </div>

                    {folderActionError && (
                        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                            <p className="text-sm font-semibold text-red-200">Folder change failed</p>
                            <p className="mt-2 text-sm leading-6 text-red-100">{folderActionError}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
