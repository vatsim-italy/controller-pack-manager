interface ConfigSectionProps {
    euroscopeConfigPath: string | null;
    startupError: string | null;
}

export const ConfigSection = ({
    euroscopeConfigPath,
    startupError,
}: ConfigSectionProps) => {
    if (startupError) {
        return (
            <div className="card card-accent">
                <div className="card-header">
                    <div className="card-icon">📁</div>
                    <h2 className="text-xl font-semibold text-white">EuroScope Configuration</h2>
                </div>
                <div className="alert alert-error">
                    <div className="alert-icon">❌</div>
                    <div className="alert-content">
                        <div className="alert-title">Detection Failed</div>
                        <div className="alert-message">{startupError}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card card-accent">
            <div className="card-header">
                <div className="card-icon">📁</div>
                <h2 className="text-xl font-semibold text-white">EuroScope Configuration</h2>
            </div>
            {euroscopeConfigPath ? (
                <div className="card-content">
                    <div>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-secondary-500">Status</span>
                        <div className="status-badge status-badge-success">
                            <span className="status-dot"></span>
                            Detected
                        </div>
                    </div>
                    <div>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-secondary-500">Configuration Path</span>
                        <span className="block break-all text-base text-secondary-100">{euroscopeConfigPath}</span>
                    </div>
                </div>
            ) : (
                <div className="alert alert-warning">
                    <div className="alert-icon">⚠️</div>
                    <div className="alert-content">
                        <div className="alert-title">Configuration Not Found</div>
                        <div className="alert-message">
                            No EuroScope config folder was detected in %APPDATA%\EuroScope.
                            Please ensure EuroScope is properly installed.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
