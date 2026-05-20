import { useVersionCheck } from "../hooks/useVersionCheck";
import { useState, useEffect } from "react";

export const VersionWarning = () => {
  const { localVersion, remoteVersion, isOutdated, loading } = useVersionCheck();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!loading && isOutdated) {
      setIsOpen(true);
    }
  }, [loading, isOutdated]);

  if (loading || !isOutdated || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary-700 rounded-lg max-w-sm w-full mx-4 border border-secondary-600">
        <div className="px-6 py-4 border-b border-secondary-600">
          <h2 className="text-lg font-semibold text-white">Update Available</h2>
        </div>

        <div className="px-6 py-4">
          <p className="text-secondary-200 text-sm mb-4">
            A new version is available.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-400">Current:</span>
              <span className="text-white font-medium">v{localVersion}</span>
            </div>
            {remoteVersion && (
              <div className="flex justify-between">
                <span className="text-secondary-400">Latest:</span>
                <span className="text-yellow-400 font-medium">v{remoteVersion}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-secondary-600 flex gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-4 py-2 border border-secondary-500 text-secondary-200 rounded hover:bg-secondary-600 transition-colors text-sm font-medium"
          >
            Dismiss
          </button>
          <a
            href="https://github.com/vatsim-italy/controller-pack-manager/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm font-medium text-center"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
};
