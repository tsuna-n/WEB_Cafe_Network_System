'use client'

import React, { useState, useEffect } from 'react'
import { MenuItem, Order, createOrder } from '@/service/api'
import { getServerUrl } from '@/service/config'

type CartItem = MenuItem & { qty: number }
export type PaymentMethod = 'cash' | 'promptpay'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  total: number
  positionId?: string
  onSuccess: () => void
}

type PaymentStep = 'selection' | 'processing' | 'cash_instruction' | 'promptpay_qr' | 'success'

export default function PaymentModal({
  isOpen, onClose, items, total, positionId, onSuccess
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('selection')
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep('selection')
      setCreatedOrder(null)
      setQrImage(null)
      setSlipFile(null)
      setSlipPreview(null)
      setSlipError(null)
      setIsVerifying(false)
    }
  }, [isOpen])

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (slipPreview) URL.revokeObjectURL(slipPreview)
    }
  }, [slipPreview])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSlipFile(file)
    setSlipError(null)
    if (file) {
      const url = URL.createObjectURL(file)
      setSlipPreview(url)
    } else {
      setSlipPreview(null)
    }
  }
  const handleSelectMethod = async (method: PaymentMethod) => {
    if (!items || items.length === 0) {
      alert('กรุณาเลือกสินค้าก่อนชำระเงิน')
      onClose()
      return
    }

    setStep('processing')
    try {
      const order = await createOrder(
        items.map(c => ({ item_id: c.id, item_name: c.name, qty: c.qty, price: c.price })),
        method,
        positionId
      )
      setCreatedOrder(order)

      if (method === 'cash') {
        setStep('cash_instruction')
      } else {
        setStep('promptpay_qr')
        // Fetch QR image
        try {
          const amount = typeof order.total === 'number' ? order.total : total
          const res = await fetch(`${getServerUrl()}/api/payments/promptpay-qr?amount=${amount}&orderId=${order.order_id}`)
          if (!res.ok) throw new Error('Failed to fetch QR')
          const data = await res.json()
          if (data.qr_image) {
            setQrImage(data.qr_image)
          } else {
            throw new Error('No QR image in response')
          }
        } catch (err) {
          console.error("QR Fetch Error:", err)
          setSlipError('ไม่สามารถสร้าง QR Code ได้ กรุณาลองใหม่')
        }
      }
    } catch (err) {
      console.error("Order Create Error:", err)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setStep('selection')
    }
  }

  const handleVerifySlip = async () => {
    if (!slipFile || !createdOrder) return
    setIsVerifying(true)
    setSlipError(null)
    try {
      const formData = new FormData()
      formData.append('slip', slipFile)
      formData.append('orderId', createdOrder.order_id)

      const res = await fetch(`${getServerUrl()}/api/payments/verify-slip`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setSlipError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }
      setStep('success')
    } catch {
      setSlipError('ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleFinish = () => { onSuccess(); onClose() }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={step === 'selection' || step === 'cash_instruction' || step === 'success' ? onClose : undefined}
      />
      <div className="relative w-full max-w-md bg-[#1e1915] border border-[#3e352d] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">

        {/* ─── เลือกวิธีชำระเงิน ─── */}
        {step === 'selection' && (
          <div className="p-8 space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">เลือกวิธีชำระเงิน</h3>
              {total > 0
                ? <p className="text-gray-400">ยอดรวม <span className="text-[#cba365] font-bold">{total.toLocaleString()}฿</span></p>
                : <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 text-red-400 text-sm">ตะกร้าสินค้าว่างเปล่า</div>
              }
            </div>
            {total > 0 && (
              <div className="grid gap-4">
                <button onClick={() => handleSelectMethod('promptpay')}
                  className="flex items-center gap-4 p-6 bg-[#2a241f] border border-[#3e352d] rounded-3xl hover:border-[#cba365] transition-all active:scale-95">
                  <div className="w-14 h-14 bg-[#004677] rounded-2xl flex items-center justify-center text-3xl">📱</div>
                  <div className="text-left">
                    <div className="text-white font-bold text-lg">สแกนจ่าย QR</div>
                    <div className="text-gray-500 text-sm">PromptPay / ทุกธนาคาร</div>
                  </div>
                </button>
                <button onClick={() => handleSelectMethod('cash')}
                  className="flex items-center gap-4 p-6 bg-[#2a241f] border border-[#3e352d] rounded-3xl hover:border-[#cba365] transition-all active:scale-95">
                  <div className="w-14 h-14 bg-[#2d5a27] rounded-2xl flex items-center justify-center text-3xl">💵</div>
                  <div className="text-left">
                    <div className="text-white font-bold text-lg">เงินสด</div>
                    <div className="text-gray-500 text-sm">ชำระที่เคาน์เตอร์</div>
                  </div>
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-full py-4 text-gray-500 hover:text-white transition-colors">ยกเลิก</button>
          </div>
        )}

        {/* ─── Processing ─── */}
        {step === 'processing' && (
          <div className="p-12 flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 border-4 border-[#3e352d] border-t-[#cba365] rounded-full animate-spin" />
            <p className="text-[#cba365] font-medium animate-pulse">กำลังเตรียมออเดอร์...</p>
          </div>
        )}

        {/* ─── เงินสด ─── */}
        {step === 'cash_instruction' && createdOrder && (
          <div className="p-8 space-y-8 text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl mx-auto">💵</div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">รับออเดอร์เรียบร้อย!</h3>
              <p className="text-gray-400">กรุณาชำระเงินที่เคาน์เตอร์</p>
            </div>
            <div className="bg-[#2a241f] border border-[#3e352d] rounded-3xl p-6 space-y-4">
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">บัตรคิว</div>
                <div className="text-5xl font-black text-[#cba365]">#{createdOrder.order_number}</div>
              </div>
              <div className="pt-4 border-t border-[#3e352d] flex justify-between text-sm">
                <span className="text-gray-400">โต๊ะ</span><span className="text-white font-bold">{positionId || 'ไม่ระบุ'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ยอดชำระ</span><span className="text-white font-bold">{total.toLocaleString()}฿</span>
              </div>
            </div>
            <button onClick={handleFinish} className="w-full py-5 bg-[#cba365] text-[#26211d] rounded-2xl font-black text-xl active:scale-95 transition-transform">ตกลง</button>
          </div>
        )}

        {/* ─── QR + แนบสลิป ─── */}
        {step === 'promptpay_qr' && createdOrder && (
          <div className="flex flex-col overflow-y-auto max-h-[90vh]">
            <div className="p-6 space-y-4 text-center">
              {/* PromptPay header */}
              <div className="flex items-center justify-center bg-white py-2 rounded-t-2xl -mb-4 relative z-10 mx-4">
                <span className="font-bold text-sm tracking-widest text-[#004677]">PromptPay</span>
              </div>
              {/* QR */}
              <div className="bg-white p-5 rounded-3xl inline-block mx-auto min-w-[220px] min-h-[220px] flex items-center justify-center">
                {qrImage
                  ? <img src={qrImage} alt="QR" className="w-44 h-44 animate-in fade-in duration-500" />
                  : <div className="w-10 h-10 border-4 border-gray-200 border-t-[#004677] rounded-full animate-spin" />
                }
              </div>
              <div>
                <div className="text-2xl font-black text-white">{total.toLocaleString()}฿</div>
                <div className="text-gray-500 text-sm">ออเดอร์ #{createdOrder.order_number}</div>
              </div>
            </div>

            {/* ─── แนบสลิปยืนยัน ─── */}
            <div className="px-6 pb-6 space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <div className="flex-1 h-px bg-[#3e352d]" />
                <span>โอนเสร็จแล้ว แนบสลิปยืนยัน</span>
                <div className="flex-1 h-px bg-[#3e352d]" />
              </div>

              {/* File input */}
              <label className="block w-full border-2 border-dashed border-[#3e352d] rounded-2xl p-4 text-center cursor-pointer hover:border-[#cba365] transition-colors active:scale-95 overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {slipPreview ? (
                  <div className="space-y-2">
                    <img src={slipPreview} alt="Slip Preview" className="max-h-40 mx-auto rounded-lg shadow-md" />
                    <span className="text-emerald-400 text-xs font-medium block">✓ {slipFile?.name}</span>
                  </div>
                ) : (
                  <div className="py-4">
                    <span className="text-4xl block mb-2">📎</span>
                    <span className="text-gray-500 text-sm">แตะเพื่อถ่ายหรือแนบสลิป</span>
                  </div>
                )}
              </label>

              {slipError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 text-center">
                  {slipError}
                </div>
              )}

              <button
                onClick={handleVerifySlip}
                disabled={!slipFile || isVerifying}
                className="w-full py-5 bg-[#cba365] text-[#26211d] rounded-2xl font-black text-xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isVerifying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#26211d]/30 border-t-[#26211d] rounded-full animate-spin" />
                    กำลังตรวจสอบกับธนาคาร...
                  </>
                ) : '✓ ยืนยันการโอน'}
              </button>

              <button onClick={onClose} className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm">
                ยกเลิกและกลับไปหน้าเมนู
              </button>
            </div>
          </div>
        )}

        {/* ─── สำเร็จ ─── */}
        {step === 'success' && (
          <div className="relative p-10 flex flex-col items-center text-center overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-[#cba365] to-emerald-500" />
            
            {/* Animated Checkmark */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
              <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-5xl shadow-lg shadow-emerald-500/40 animate-in zoom-in duration-500">
                ✓
              </div>
            </div>

            <div className="space-y-2 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <h3 className="text-3xl font-black text-white tracking-tight">ชำระเงินสำเร็จ!</h3>
              <p className="text-gray-400 text-lg">ขอบคุณที่ใช้บริการค่ะ</p>
            </div>

            {/* Order Summary Card */}
            <div className="w-full bg-[#2a241f] border border-[#3e352d] rounded-[2rem] p-8 space-y-6 mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
              <div className="space-y-1">
                <div className="text-[#cba365] text-xs font-bold uppercase tracking-[0.2em]">Order Number</div>
                <div className="text-6xl font-black text-white">#{createdOrder?.order_number}</div>
              </div>
              
              <div className="pt-6 border-t border-[#3e352d] grid grid-cols-2 gap-4">
                <div className="text-left">
                  <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Position</div>
                  <div className="text-white font-bold text-lg">{positionId ? `Table ${positionId}` : 'Take Away'}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Status</div>
                  <div className="text-emerald-400 font-bold text-lg">Preparing</div>
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-sm mb-8 animate-in fade-in duration-1000 delay-500">
              กรุณารอรับออเดอร์ที่โต๊ะของท่าน <br/> พนักงานจะนำเมนูไปเสิร์ฟในเร็วๆ นี้
            </p>

            <button 
              onClick={handleFinish} 
              className="w-full py-5 bg-gradient-to-r from-[#cba365] to-[#b88a4d] text-[#26211d] rounded-2xl font-black text-xl shadow-xl shadow-[#cba365]/20 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400"
            >
              ตกลง
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
