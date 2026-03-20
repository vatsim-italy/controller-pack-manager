interface BooleanListCardProps {
    id: string;
    visible: boolean;
    toggles: {
        label: string;
        key: string;
        value: boolean;
    }[];
    onToggle: (toggleKey: string, value: boolean) => void;
    position?: { x: number; y: number };
}

export const BooleanListCard = ({
    id,
    visible,
    toggles,
    onToggle,
    position,
}: BooleanListCardProps) => {
    if (!visible) {
        return null;
    }

    const style = position
        ? {
            position: "absolute" as const,
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 10,
        }
        : {};

    return (
        <div
            style={style}
            className="rounded-lg border border-primary-600 bg-dark-header p-3 shadow-lg min-w-fit"
        >
            <div className="mb-3 border-b border-secondary-600 pb-2">
                <h3 className="text-sm font-semibold text-white">{id}</h3>
            </div>

            <div className="space-y-2">
                {toggles.map((toggle) => (
                    <label
                        key={toggle.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-secondary-700"
                    >
                        <input
                            type="checkbox"
                            checked={toggle.value}
                            onChange={(e) => onToggle(toggle.key, e.target.checked)}
                            className="h-4 w-4 cursor-pointer rounded border-secondary-500 text-primary-600 transition"
                        />
                        <span className="text-xs text-secondary-100">{toggle.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};
