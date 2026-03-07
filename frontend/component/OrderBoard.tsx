'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchOrders, updateOrderStatus, type Order } from '@/service/api'

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return 'เมื่อกี้'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins} นาที`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ชม.`
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

const payBadge: Record<string, { label: string; emoji: string; color: string }> = {
    cash: { label: 'เงินสด', emoji: '💵', color: '#4ade80' },
    promptpay: { label: 'PromptPay', emoji: '📱', color: '#60a5fa' },
    card: { label: 'บัตร', emoji: '💳', color: '#c084fc' },
}

/* ─── Main Component ─── */

export default function OrderBoard() {
    const [pendingOrders, setPendingOrders] = useState<Order[]>([])
    const [completedOrders, setCompletedOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const prevCountRef = useRef<number>(0)

    // ─── Data Fetching ───
    const loadOrders = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true)
        setError(null)
        try {
            const [pending, completed] = await Promise.all([
                fetchOrders(undefined, 'pending'),
                fetchOrders(undefined, 'completed'),
            ])

            // แจ้งเตือนด้วย title เมื่อมี order ใหม่
            if (prevCountRef.current > 0 && pending.length > prevCountRef.current) {
                const newCount = pending.length - prevCountRef.current
                document.title = `🔔 (${newCount} ใหม่) จัดการออเดอร์`
                setTimeout(() => { document.title = 'จัดการออเดอร์' }, 5000)
            }
            prevCountRef.current = pending.length

            setPendingOrders(pending)
            setCompletedOrders(completed.slice(0, 20))
            setLastRefresh(new Date())
        } catch (err) {
            console.error('โหลดออเดอร์ไม่สำเร็จ:', err)
            setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบ')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadOrders(true)
        const timer = setInterval(() => loadOrders(false), 10_000)
        return () => clearInterval(timer)
    }, [loadOrders])

    // ─── Status Update ───
    const handleComplete = async (orderId: string) => {
        setUpdatingId(orderId)
        try {
            await updateOrderStatus(orderId, 'completed')
            // Optimistic UI — ย้าย pending → completed ทันที
            const order = pendingOrders.find((o) => o.order_id === orderId)
            setPendingOrders((prev) => prev.filter((o) => o.order_id !== orderId))
            if (order) {
                setCompletedOrders((prev) => [{ ...order, status: 'completed' as const }, ...prev].slice(0, 20))
            }
        } catch (err) {
            console.error('อัพเดทสถานะไม่สำเร็จ:', err)
            alert('อัพเดทสถานะไม่สำเร็จ กรุณาลองอีกครั้ง')
            loadOrders(false) // reload เพื่อ sync กับ server
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUndoComplete = async (orderId: string) => {
        setUpdatingId(orderId)
        try {
            await updateOrderStatus(orderId, 'pending')
            const order = completedOrders.find((o) => o.order_id === orderId)
            setCompletedOrders((prev) => prev.filter((o) => o.order_id !== orderId))
            if (order) {
                setPendingOrders((prev) => [{ ...order, status: 'pending' as const }, ...prev])
            }
        } catch (err) {
            console.error('ย้อนสถานะไม่สำเร็จ:', err)
            alert('ย้อนสถานะไม่สำเร็จ')
            loadOrders(false)
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <main className="relative w-full min-h-dvh bg-[#26211d] font-sans text-white">

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-card { animation: slideDown 0.3s ease-out both; }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
        .pulse-dot { animation: pulse-ring 2s infinite; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3e352d; border-radius: 10px; }
      ` }} />

            {/* ─── Header ─── */}
            <header className="sticky top-0 z-10 bg-[#26211d]/90 backdrop-blur-md border-b border-[#3e352d] px-4 lg:px-8 py-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📋</span>
                        <div>
                            <h1 className="text-xl font-bold">จัดการออเดอร์</h1>
                            <p className="text-xs text-gray-500">
                                อัพเดทล่าสุด {formatTime(lastRefresh.toISOString())} · รีเฟรชทุก 10 วิ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {pendingOrders.length > 0 && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-sm font-medium">
                                <span className="w-2 h-2 rounded-full bg-red-500 pulse-dot" />
                                {pendingOrders.length} รอทำ
                            </div>
                        )}
                        <button
                            onClick={() => loadOrders(true)}
                            disabled={loading}
                            className="bg-[#362e28] hover:bg-[#4a3f35] border border-[#4a3f35] text-gray-300 px-4 py-2 rounded-xl text-sm transition-colors active:scale-95 disabled:opacity-50"
                        >
                            {loading ? '⏳' : '🔄'} รีเฟรช
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── Content ─── */}
            <div className="max-w-7xl mx-auto p-4 lg:p-8">

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <span className="text-sm">{error}</span>
                        </div>
                        <button
                            onClick={() => loadOrders(true)}
                            className="text-red-400 hover:text-red-300 px-3 py-1 rounded-lg bg-red-500/10 text-sm transition-colors"
                        >
                            ลองอีกครั้ง
                        </button>
                    </div>
                )}

                {loading && pendingOrders.length === 0 && completedOrders.length === 0 ? (
                    <div className="flex items-center justify-center py-32 text-gray-400">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#3e352d] border-t-[#cba365] rounded-full animate-spin mx-auto mb-4" />
                            <p>กำลังโหลดออเดอร์...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* ─── Pending Column ─── */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-3 h-3 rounded-full bg-amber-500" />
                                <h2 className="text-lg font-semibold text-amber-400">กำลังทำ</h2>
                                <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                    {pendingOrders.length}
                                </span>
                            </div>

                            {pendingOrders.length === 0 ? (
                                <div className="border-2 border-dashed border-[#3e352d] rounded-2xl p-12 text-center text-gray-500">
                                    <span className="text-4xl block mb-3">🎉</span>
                                    <p className="font-medium text-lg">ไม่มีออเดอร์ค้าง</p>
                                    <p className="text-sm mt-1">ออเดอร์ใหม่จะแสดงที่นี่อัตโนมัติ</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {pendingOrders.map((order, i) => (
                                        <OrderCard
                                            key={order.order_id}
                                            order={order}
                                            index={i}
                                            onComplete={() => handleComplete(order.order_id)}
                                            isUpdating={updatingId === order.order_id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* ─── Completed Column ─── */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                <h2 className="text-lg font-semibold text-emerald-400">เสร็จแล้ว</h2>
                                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                    {completedOrders.length}
                                </span>
                            </div>

                            {completedOrders.length === 0 ? (
                                <div className="border-2 border-dashed border-[#3e352d] rounded-2xl p-12 text-center text-gray-500">
                                    <span className="text-4xl block mb-3">☕</span>
                                    <p className="font-medium">ยังไม่มีออเดอร์เสร็จ</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {completedOrders.map((order, i) => (
                                        <OrderCard
                                            key={order.order_id}
                                            order={order}
                                            index={i}
                                            completed
                                            onUndo={() => handleUndoComplete(order.order_id)}
                                            isUpdating={updatingId === order.order_id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </main>
    )
}

/* ─── Order Card ─── */

function OrderCard({
    order,
    index,
    onComplete,
    onUndo,
    isUpdating,
    completed,
}: {
    order: Order
    index: number
    onComplete?: () => void
    onUndo?: () => void
    isUpdating?: boolean
    completed?: boolean
}) {
    const pay = payBadge[order.payment_method] || payBadge.cash

    return (
        <div
            className={`anim-card rounded-2xl border p-4 lg:p-5 transition-all ${completed
                ? 'bg-[#2a241f]/60 border-[#3e352d]/50'
                : 'bg-[#2a241f] border-[#3e352d] hover:border-[#5c4e42]'
                }`}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <span className={`text-xl font-black ${completed ? 'text-gray-500' : 'text-[#cba365]'}`}>
                        #{order.order_number}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full border" style={{
                        color: pay.color,
                        borderColor: pay.color + '40',
                        backgroundColor: pay.color + '15',
                    }}>
                        {pay.emoji} {pay.label}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-500 block">{formatTime(order.created_at)}</span>
                    <span className="text-[10px] text-gray-600">{timeAgo(order.created_at)}</span>
                </div>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-3">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                        <span className={completed ? 'text-gray-500' : 'text-gray-300'}>
                            <span className="text-gray-500 mr-1.5 font-mono text-xs">×{item.qty}</span>
                            {item.item_name}
                        </span>
                        <span className="text-gray-500 tabular-nums text-xs">
                            {(item.price * item.qty).toLocaleString()}฿
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between pt-3 border-t ${completed ? 'border-[#3e352d]/40' : 'border-[#3e352d]'}`}>
                <span className={`font-bold text-lg ${completed ? 'text-gray-500' : 'text-[#cba365]'}`}>
                    {order.total.toLocaleString()}฿
                </span>

                {/* ปุ่ม "เสร็จแล้ว" สำหรับ pending orders */}
                {!completed && onComplete && (
                    <button
                        onClick={onComplete}
                        disabled={isUpdating}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                        {isUpdating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                รอสักครู่...
                            </>
                        ) : (
                            <>✓ เสร็จแล้ว</>
                        )}
                    </button>
                )}

                {/* ปุ่ม Undo สำหรับ completed orders */}
                {completed && onUndo && (
                    <button
                        onClick={onUndo}
                        disabled={isUpdating}
                        className="text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {isUpdating ? (
                            <div className="w-3 h-3 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                        ) : (
                            <>↩ ย้อนกลับ</>
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}
