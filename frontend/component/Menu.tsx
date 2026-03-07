'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchCategories, fetchMenuItems, createOrder, type Category, type MenuItem } from '@/service/api'

type CartItem = MenuItem & { qty: number }
type PaymentMethod = 'cash' | 'promptpay' | 'card'

// Emoji map สำหรับแต่ละ category (ใช้แสดงบนการ์ดเมนู)
const categoryEmoji: Record<string, string> = {
  coffee: '☕',
  tea: '🍵',
  bakery: '🥐',
  other: '🥤',
}

export default function Menu() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState('all')

  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [ordering, setOrdering] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, menuItems] = await Promise.all([
        fetchCategories(),
        fetchMenuItems(),
      ])
      setCategories(cats)
      setItems(menuItems)
    } catch (err) {
      console.error('โหลดข้อมูลไม่สำเร็จ:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category_id === activeCategory)

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const found = prev.find((c) => c.id === item.id)
      if (found) {
        return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const changeQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c)
        .filter((c) => c.qty > 0)
    )
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0)

  const handleCheckout = async (method: PaymentMethod) => {
    setPayMethod(method)
    setOrdering(true)
    try {
      const orderItems = cart.map((c) => ({
        item_id: c.id,
        item_name: c.name,
        qty: c.qty,
        price: c.price,
      }))
      await createOrder(orderItems, method)
      setCart([])
      setShowPayment(false)
      alert('สั่งเรียบร้อย! 🎉')
    } catch (err) {
      console.error('สั่งไม่สำเร็จ:', err)
      alert('สั่งไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setOrdering(false)
    }
  }
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; }
  }, [])

  return (
    <main className="relative w-full h-[100dvh] bg-[#26211d] font-sans text-white overflow-hidden">

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3e352d; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #5c4e42; }
      `}} />

      {/* --- MENU AREA (ยืดเต็มจอ) --- */}
      <div className="flex flex-col h-full overflow-hidden p-4 lg:p-8">

        {/* Header: หมวดหมู่ & ปุ่มตะกร้า */}
        <div className="flex justify-between items-center gap-4 pb-4 border-b border-[#3e352d] mb-4">
          {/* Category Tabs */}
          <div className="flex gap-3 overflow-x-auto hide-scroll shrink-0 flex-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${activeCategory === 'all'
                ? 'bg-[#cba365] text-[#26211d] border-[#cba365]'
                : 'bg-transparent text-gray-300 border-[#4a3f35] hover:border-gray-400'
                }`}
            >
              ทั้งหมด
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium flex gap-2 items-center transition-colors border whitespace-nowrap ${activeCategory === cat.id
                  ? 'bg-[#cba365] text-[#26211d] border-[#cba365]'
                  : 'bg-transparent text-gray-300 border-[#4a3f35] hover:border-gray-400'
                  }`}
              >
                <span>{cat.icon}</span> {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto custom-scroll pr-2 pb-24">
          <div className="text-sm text-gray-400 mb-4">{filteredItems.length} รายการ</div>

          {loading ? (
            <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-4">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.id === item.id)

                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="relative bg-[#362e28] border border-transparent rounded-2xl p-4 lg:p-5 text-left flex flex-col hover:border-[#5c4e42] transition-colors active:scale-95"
                  >
                    {inCart && (
                      <span className="absolute top-3 right-3 bg-[#cba365] text-[#26211d] font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full shadow-lg">
                        {inCart.qty}
                      </span>
                    )}

                    <div className="text-3xl lg:text-4xl mb-3 drop-shadow-md">
                      {categoryEmoji[item.category_id] || '☕'}
                    </div>

                    <div className="font-semibold text-sm lg:text-base mt-auto">
                      {item.name}
                    </div>

                    {item.name_en && (
                      <div className="text-[10px] lg:text-xs text-gray-400 mt-0.5">
                        {item.name_en}
                      </div>
                    )}

                    {item.description && (
                      <div className="text-[10px] lg:text-xs text-gray-500 mt-1 line-clamp-1">
                        {item.description}
                      </div>
                    )}

                    <div className="text-[#cba365] font-bold text-sm lg:text-base mt-3">
                      {item.price}฿
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- FLOATING BOTTOM BAR (แสดงเมื่อมีสินค้าในตะกร้า) --- */}
      {!showCart && cart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30 animate-[slideUp_0.3s_ease-out]">
          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
          `}} />
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-[#cba365] text-[#26211d] px-5 py-4 rounded-2xl shadow-[0_10px_40px_rgba(203,163,101,0.25)] flex items-center justify-between active:scale-95 transition-transform border border-[#e5c28f]"
          >
            <div className="flex items-center gap-3">
              <div className="bg-[#26211d] text-[#cba365] w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                {totalQty}
              </div>
              <span className="font-bold text-lg">ดูรายการสั่งซื้อ</span>
            </div>
            <span className="font-bold text-xl">{total.toLocaleString()}฿</span>
          </button>
        </div>
      )}

      {/* --- CART DRAWER (สไลด์ออกมาจากขวา) --- */}
      {/* Backdrop (พื้นหลังดำเบลอ) */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${showCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowCart(false)}
      />

      {/* Drawer Container */}
      <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-[#221d19] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-[#3e352d] ${showCart ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Drawer Header */}
        <div className="p-5 border-b border-[#3e352d] shrink-0 flex justify-between items-center bg-[#2a241f]">
          <div>
            <h2 className="font-semibold text-xl">รายการสั่ง</h2>
            <p className="text-sm text-[#cba365]">{totalQty} รายการ</p>
          </div>
          <button
            onClick={() => setShowCart(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#362e28] text-gray-400 hover:text-white hover:bg-[#4a3f35] transition-colors"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Body (Items) */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4 flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
              <svg className="w-20 h-20 text-[#3e352d] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-medium text-[#7a6b5d] text-lg">ยังไม่มีรายการ</p>
              <p className="text-sm text-[#5c4e42]">เลือกเมนูเพื่อเพิ่มลงตะกร้า</p>
              <button
                onClick={() => setShowCart(false)}
                className="mt-4 px-6 py-2 rounded-full border border-[#4a3f35] text-gray-300 hover:bg-[#362e28] transition-colors"
              >
                เลือกเมนู
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-[#2a241f] rounded-2xl border border-[#3e352d]">
                  <span className="text-3xl">{categoryEmoji[item.category_id] || '☕'}</span>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-base">{item.name}</div>
                    <div className="text-[#cba365] font-semibold mt-0.5">{item.price}฿</div>
                  </div>

                  <div className="flex items-center gap-3 bg-[#1e1915] rounded-xl p-1.5 border border-[#3e352d]">
                    <button onClick={() => changeQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#3e352d] text-gray-300 active:scale-95 transition-transform bg-[#2a241f]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => changeQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#3e352d] text-gray-300 active:scale-95 transition-transform bg-[#2a241f]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer (Checkout) */}
        <div className="p-6 bg-[#2a241f] border-t border-[#3e352d] shrink-0 pb-8 sm:pb-6">
          <div className="flex justify-between items-end mb-5">
            <span className="text-gray-400">รวมทั้งหมด</span>
            <span className="text-3xl font-bold text-[#cba365]">
              {total.toLocaleString()}฿
            </span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => { setShowPayment(true); setShowCart(false); }}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 ${cart.length === 0
              ? 'bg-[#1e1915] border border-[#3e352d] text-[#5c4e42] cursor-not-allowed'
              : 'bg-[#cba365] text-[#26211d] hover:bg-[#dfb572] shadow-[0_4px_20px_rgba(203,163,101,0.2)]'
              }`}
          >
            ชำระเงิน
            {cart.length > 0 && (
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-[#26211d] border border-[#3e352d] rounded-3xl w-full max-w-[400px] p-6 flex flex-col gap-4 shadow-2xl animate-[slideUp_0.2s_ease-out]">
            <h3 className="font-semibold text-xl text-center mb-2 text-white">
              เลือกวิธีชำระเงิน
            </h3>

            <button onClick={() => handleCheckout('cash')} disabled={ordering} className="border border-[#4a3f35] bg-[#2a241f] hover:bg-[#362e28] rounded-2xl p-4 text-left flex gap-4 items-center transition-colors disabled:opacity-50">
              <span className="text-3xl drop-shadow-sm">💵</span>
              <span className="text-lg font-medium">{ordering && payMethod === 'cash' ? 'กำลังสั่ง...' : 'เงินสด'}</span>
            </button>
            <button onClick={() => handleCheckout('promptpay')} disabled={ordering} className="border border-[#4a3f35] bg-[#2a241f] hover:bg-[#362e28] rounded-2xl p-4 text-left flex gap-4 items-center transition-colors disabled:opacity-50">
              <span className="text-3xl drop-shadow-sm">📱</span>
              <span className="text-lg font-medium">{ordering && payMethod === 'promptpay' ? 'กำลังสั่ง...' : 'สแกนจ่าย / PromptPay'}</span>
            </button>
            <button
              onClick={() => { setShowPayment(false); setShowCart(true); }}
              className="mt-4 text-sm text-gray-400 hover:text-white text-center py-3 rounded-xl hover:bg-[#3e352d] transition-colors"
            >
              ย้อนกลับไปตะกร้า
            </button>
          </div>
        </div>
      )}
    </main>
  )
}