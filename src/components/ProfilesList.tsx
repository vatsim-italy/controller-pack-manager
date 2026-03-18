import { Profile } from "../main";

interface ProfilesListProps {
    profiles: Profile[] | null;
}

const renderValue = (
    value: string | boolean | null,
    type: "string" | "boolean" = "string"
): { text: string; className: string } => {
    if (value === null) {
        return { text: "Not configured", className: "text-secondary-500 italic" };
    }

    if (type === "boolean") {
        return {
            text: value ? "Yes" : "No",
            className: value ? "text-accent-success font-semibold" : "text-secondary-500 font-semibold",
        };
    }

    return { text: String(value), className: "" };
};

export const ProfilesList = ({ profiles }: ProfilesListProps) => {
    if (!profiles || profiles.length === 0) {
        return (
            <div className="card card-accent">
                <div className="card-header">
                    <div className="card-icon">👤</div>
                    <h2 className="text-xl font-semibold text-white">Profiles</h2>
                </div>
                <div className="text-center py-12">
                    <div className="text-4xl mb-4 opacity-50">📋</div>
                    <div className="mb-2 text-xl font-semibold text-secondary-100">No Profiles Found</div>
                    <div className="text-base text-secondary-500">
                        No EuroScope profiles are currently configured.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card card-accent">
            <div className="card-header">
                <div className="card-icon">👤</div>
                <h2 className="text-xl font-semibold text-white">Profiles</h2>
                <span className="status-badge status-badge-info ml-auto">
                    {profiles.length} {profiles.length === 1 ? "Profile" : "Profiles"}
                </span>
            </div>
            <div className="flex flex-col gap-4">
                {profiles.map((profile, index) => (
                    <div key={profile.realName || index} className="rounded-xl border border-secondary-600 bg-secondary-600 p-4 transition-all duration-200 hover:bg-secondary-700">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-lg font-semibold text-white break-words flex-1">{profile.name}</span>
                            {profile.connectToVatsim !== null && (
                                <span className={`status-badge ml-2 flex-shrink-0 ${profile.connectToVatsim ? "status-badge-success" : "status-badge-warning"}`}>
                                    <span className="status-dot"></span>
                                    {profile.connectToVatsim ? "VATSIM" : "Offline"}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Real Name</span>
                                <span className={`block text-sm ${renderValue(profile.realName).className}`}>
                                    {renderValue(profile.realName).text}
                                </span>
                            </div>

                            <div>
                                <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Server</span>
                                <span className={`block text-sm ${renderValue(profile.server).className}`}>
                                    {renderValue(profile.server).text}
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Certificate</span>
                            <span className={`block text-sm ${renderValue(profile.certificate).className}`}>
                                {renderValue(profile.certificate).text}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Proxy Server</span>
                            <span className={`block text-sm ${renderValue(profile.proxyServer).className}`}>
                                {renderValue(profile.proxyServer).text}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
