import React from "react";

type InstallWarningModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const WARNING_STORAGE_KEY = "has_seen_install_warning";

export const hasSeenInstallWarning = (): boolean => {
  try {
    return localStorage.getItem(WARNING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const setSeenInstallWarning = (): void => {
  try {
    localStorage.setItem(WARNING_STORAGE_KEY, "true");
  } catch {
    // ignore
  }
};

export const InstallWarningModal: React.FC<InstallWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const handleProceed = () => {
    setSeenInstallWarning();
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-secondary-600 bg-dark-header shadow-2xl overflow-hidden">
        <div className="border-b border-secondary-600 px-6 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-accent-warning">
            ⚠️
          </div>
          <h3 className="text-base font-semibold text-white">Warning</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            Any extra file you have may be deleted. Backup before proceeding.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-secondary-600 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-small"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="btn-small rounded-xl bg-accent-warning px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
};
