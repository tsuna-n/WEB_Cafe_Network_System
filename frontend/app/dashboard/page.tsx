import Dashboard from "@/page/Dashboard"
import AuthGuard from "@/page/component/AuthGuard"

export default function DashboardPage() {
    return (
        <AuthGuard>
            <Dashboard />
        </AuthGuard>
    )
}
