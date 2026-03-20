interface ToggleSwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    compact?: boolean;
}

export const ToggleSwitch = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    compact = false,
}: ToggleSwitchProps) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`group flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${checked
                ? "border-primary-600 bg-primary-600/10"
                : "border-secondary-600 bg-secondary-700/40 hover:bg-secondary-700/70"
                } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${compact ? "py-1.5" : ""}`}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium text-secondary-100">{label}</span>
                {description && <span className="block text-xs text-secondary-400">{description}</span>}
            </span>

            <span
                className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full border transition-colors ${checked
                    ? "border-primary-500 bg-primary-600"
                    : "border-secondary-500 bg-secondary-700"
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"
                        }`}
                />
            </span>
        </button>
    );
};
