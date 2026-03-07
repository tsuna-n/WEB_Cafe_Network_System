'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchDailySummary, fetchOrders, type DailySummary, type Order } from '@/service/api'
//components
import SummaryCard from './SummaryCard'

/* ─── Types ─────────────────────────────────────── */

interface TopItem {
    name: string
    qty: number
    revenue: number
}

/* ─── Helpers ────────────────────────────────────── */

function computeTopItems(orders: Order[]): TopItem[] {
    const map = new Map<string, TopItem>()
    for (const order of orders) {
        for (const it of order.items) {
            const existing = map.get(it.item_name)
            if (existing) {
                existing.qty += it.qty
                existing.revenue += it.price * it.qty
            } else {
                map.set(it.item_name, { name: it.item_name, qty: it.qty, revenue: it.price * it.qty })
            }
        }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
}

function payLabel(method: string) {
    switch (method) {
        case 'cash': return 'เงินสด'
        case 'promptpay': return 'PromptPay'
        case 'card': return 'บัตร'
        default: return method
    }
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'เมื่อกี้'
    if (m < 60) return `${m} นาทีที่แล้ว`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} ชม.ที่แล้ว`
    return `${Math.floor(h / 24)} วันที่แล้ว`
}

/* ─── Component ──────────────────────────────────── */

export default function Dashboard() {
    const [summary, setSummary] = useState<DailySummary | null>(null)
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [isDemo, setIsDemo] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const today = new Date().toISOString().slice(0, 10)
            const [s, o] = await Promise.all([
                fetchDailySummary(today),
                fetchOrders(today),
            ])
            setSummary(s)
            setOrders(o)
            setIsDemo(false)
        } catch {
            setIsDemo(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
        const interval = setInterval(load, 30_000)      // refresh ทุก 30 วิ
        return () => clearInterval(interval)
    }, [load])

    const topItems = computeTopItems(orders)

    /* now time string */
    const [now, setNow] = useState('')
    useEffect(() => {
        const tick = () => {
            const d = new Date()
            setNow(
                d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
                '  ' +
                d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            )
        }
        tick()
        const id = setInterval(tick, 30_000)
        return () => clearInterval(id)
    }, [])

    /* ─── Render ─── */
    return (
        <main className="relative w-full min-h-[100dvh] bg-[#26211d] font-sans text-white">
            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3e352d; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #5c4e42; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim-up { animation: fadeUp 0.35s ease-out both; }
      `}} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
                {/* ─── Header ──────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold">
                            <span className="text-[#cba365]">📊</span> แดชบอร์ด
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">{now}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isDemo && (
                            <span className="text-xs bg-[#4a3f35] text-[#cba365] px-3 py-1 rounded-full">
                                ⚠ ข้อมูลตัวอย่าง
                            </span>
                        )}
                        <button
                            onClick={load}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#362e28] border border-[#4a3f35] text-sm text-gray-300 hover:border-gray-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            รีเฟรช
                        </button>
                    </div>
                </div>

                {loading && !summary ? (
                    <div className="flex items-center justify-center py-32 text-gray-400">
                        <div className="spinner mr-3" /> กำลังโหลด...
                    </div>
                ) : (
                    <>
                        {/* ─── Summary Cards ────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-8">
                            <SummaryCard
                                delay={0}
                                icon="💰"
                                label="ยอดขายวันนี้"
                                value={`${Number(summary?.total_revenue ?? 0).toLocaleString()}฿`}
                                accent
                            />
                            <SummaryCard
                                delay={1}
                                icon="🧾"
                                label="ออเดอร์"
                                value={summary?.total_orders ?? '0'}
                                sub="รายการ"
                            />
                            <SummaryCard
                                delay={2}
                                icon="💵"
                                label="เงินสด"
                                value={`${Number(summary?.cash_revenue ?? 0).toLocaleString()}฿`}
                                sub={`${summary?.cash_orders ?? 0} บิล`}
                            />
                            <SummaryCard
                                delay={3}
                                icon="📱"
                                label="PromptPay"
                                value={`${Number(summary?.promptpay_revenue ?? 0).toLocaleString()}฿`}
                                sub={`${summary?.promptpay_orders ?? 0} บิล`}
                            />
                            <SummaryCard
                                delay={4}
                                icon="💳"
                                label="บัตร"
                                value={`${Number(summary?.card_revenue ?? 0).toLocaleString()}฿`}
                                sub={`${summary?.card_orders ?? 0} บิล`}
                                className="col-span-2 lg:col-span-1"
                            />
                        </div>

                        {/* ─── Bottom Grid (Orders + Top Items) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

                            {/* Recent Orders */}
                            <div className="lg:col-span-2 bg-[#2a241f] border border-[#3e352d] rounded-2xl overflow-hidden anim-up" style={{ animationDelay: '0.15s' }}>
                                <div className="px-5 py-4 border-b border-[#3e352d] flex items-center justify-between">
                                    <h2 className="font-semibold text-lg">ออเดอร์ล่าสุด</h2>
                                    <span className="text-xs text-gray-500">{orders.length} รายการ</span>
                                </div>

                                <div className="overflow-x-auto custom-scroll">
                                    <table className="w-full text-sm min-w-[500px]">
                                        <thead>
                                            <tr className="text-gray-500 text-xs border-b border-[#3e352d]">
                                                <th className="text-left px-5 py-3 font-medium">#</th>
                                                <th className="text-left px-3 py-3 font-medium">รายการ</th>
                                                <th className="text-center px-3 py-3 font-medium">ชำระ</th>
                                                <th className="text-right px-3 py-3 font-medium">ยอด</th>
                                                <th className="text-right px-5 py-3 font-medium">เวลา</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.slice(0, 10).map((o, i) => (
                                                <tr
                                                    key={o.order_id}
                                                    className="border-b border-[#3e352d]/50 hover:bg-[#362e28] transition-colors"
                                                    style={{ animation: `fadeUp 0.3s ease-out ${0.05 * i}s both` }}
                                                >
                                                    <td className="px-5 py-3 text-[#cba365] font-semibold">{o.order_number}</td>
                                                    <td className="px-3 py-3 text-gray-300 max-w-[200px] truncate">
                                                        {o.items.map(it => `${it.item_name} x${it.qty}`).join(', ')}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${o.payment_method === 'cash'
                                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                                : o.payment_method === 'promptpay'
                                                                    ? 'bg-blue-500/15 text-blue-400'
                                                                    : 'bg-purple-500/15 text-purple-400'
                                                            }`}>
                                                            {payLabel(o.payment_method)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-semibold">{o.total.toLocaleString()}฿</td>
                                                    <td className="px-5 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                                                        {timeAgo(o.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {orders.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-12 text-gray-500">
                                                        ยังไม่มีออเดอร์วันนี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Top Selling Items */}
                            <div className="bg-[#2a241f] border border-[#3e352d] rounded-2xl overflow-hidden anim-up" style={{ animationDelay: '0.25s' }}>
                                <div className="px-5 py-4 border-b border-[#3e352d]">
                                    <h2 className="font-semibold text-lg">🏆 เมนูยอดนิยม</h2>
                                </div>

                                <div className="p-4 flex flex-col gap-2">
                                    {topItems.length === 0 && (
                                        <p className="text-center py-8 text-gray-500 text-sm">ยังไม่มีข้อมูล</p>
                                    )}
                                    {topItems.map((item, i) => {
                                        const maxQty = topItems[0]?.qty ?? 1
                                        const pct = Math.round((item.qty / maxQty) * 100)

                                        return (
                                            <div
                                                key={item.name}
                                                className="relative bg-[#362e28] rounded-xl p-4 hover:bg-[#3e352d] transition-colors overflow-hidden"
                                                style={{ animation: `fadeUp 0.3s ease-out ${0.08 * i}s both` }}
                                            >
                                                {/* progress bar bg */}
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-[#cba365]/10 rounded-xl transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />

                                                <div className="relative flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="text-[#cba365] font-bold text-sm w-5 shrink-0">
                                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                                                        </span>
                                                        <span className="font-medium truncate">{item.name}</span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-bold text-[#cba365]">{item.qty} ชิ้น</div>
                                                        <div className="text-xs text-gray-500">{item.revenue.toLocaleString()}฿</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}

/* ─── Sub-components ─────────────────────────────── */


