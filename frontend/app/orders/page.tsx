import OrderBoard from '@/page/OrderBoard'
import AuthGuard from '@/page/component/AuthGuard'

export default function OrdersPage() {
    return (
        <AuthGuard>
            <OrderBoard />
        </AuthGuard>
    )
}
