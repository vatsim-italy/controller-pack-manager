import { Notice } from "./StatusStrip";

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
        <div className="space-y-4">
            {startupError && <Notice kind="danger" title="Couldn't detect EuroScope" message={startupError} />}

            <section className="panel space-y-4 p-5">
                <div>
                    <div className="font-semibold text-secondary-100">EuroScope folder</div>
                    <p className="text-sm text-secondary-400">
                        Profiles, sector files and the LIXX folder are installed here.
                    </p>
                </div>

                <div className="rounded-[3px] border border-secondary-600 bg-secondary-800 px-3 py-2.5 font-mono text-sm break-all text-secondary-100">
                    {euroscopeConfigPath ?? "Not set"}
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="btn-primary btn-small"
                        onClick={onChooseFolder}
                        disabled={isPickingFolder}
                    >
                        {isPickingFolder ? "Opening…" : euroscopeConfigPath ? "Change folder" : "Choose folder"}
                    </button>
                    <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={onResetFolder}
                        disabled={isPickingFolder || !euroscopeConfigPath}
                    >
                        Use detected folder
                    </button>
                </div>

                {folderActionError && (
                    <Notice kind="danger" title="Couldn't change the folder" message={folderActionError} />
                )}
            </section>
        </div>
    );
};
