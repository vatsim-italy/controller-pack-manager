interface HeaderProps {
    title?: string;
    subtitle?: string;
}

export const Header = ({
    title = "Controller Pack Manager",
    subtitle = "Euroscope Sector File & Configuration Manager",
}: HeaderProps) => {
    return (
        <header className="bg-dark-header px-8 py-6 shadow-md">
            <h1 className="text-3xl font-bold text-white mb-1">{title}</h1>
            <p className="text-gray-400 text-sm">{subtitle}</p>
        </header>
    );
};
