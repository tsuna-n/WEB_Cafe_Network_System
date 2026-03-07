export default function SummaryCard({
    icon,
    label,
    value,
    sub,
    accent,
    delay = 0,
    className = '',
}: {
    icon: string
    label: string
    value: string
    sub?: string
    accent?: boolean
    delay?: number
    className?: string
}) {
    return (
        <div
            className={`bg-[#2a241f] border border-[#3e352d] rounded-2xl p-4 lg:p-5 flex flex-col gap-2 hover:border-[#5c4e42] transition-colors anim-up ${className}`}
            style={{ animationDelay: `${delay * 0.06}s` }}
        >
            <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-gray-400 font-medium">{label}</span>
            </div>
            <div className={`text-xl lg:text-2xl font-bold ${accent ? 'text-[#cba365]' : 'text-white'}`}>
                {value}
            </div>
            {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
    )
}