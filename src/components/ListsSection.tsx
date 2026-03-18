import { ListConfig } from "../main";
import { ListConfigCard } from "./ListConfigCard";

interface ListsSectionProps {
    listConfigs: ListConfig[] | null;
}

export const ListsSection = ({ listConfigs }: ListsSectionProps) => {
    if (!listConfigs || listConfigs.length === 0) {
        return (
            <div className="rounded-xl border border-secondary-600 bg-dark-header p-6 shadow-md">
                <h2 className="text-xl font-semibold text-white">List Configs</h2>
                <p className="mt-2 text-sm text-secondary-500">No list configurations were detected.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="rounded-xl border border-secondary-600 bg-dark-header p-4 shadow-md">
                <h2 className="text-xl font-semibold text-white">Detected List Configs</h2>
                <p className="mt-1 text-sm text-secondary-500">
                    {listConfigs.length} list configuration{listConfigs.length === 1 ? "" : "s"} found.
                </p>
            </section>

            <div className="space-y-4">
                {listConfigs.map((config) => (
                    <ListConfigCard key={config.id} config={config} />
                ))}
            </div>
        </div>
    );
};
