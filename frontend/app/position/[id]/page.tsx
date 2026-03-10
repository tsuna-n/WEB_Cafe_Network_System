import Menu from "@/page/Menu"
import { decodePosition } from "@/service/tableHash"

export default async function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const positionId = decodePosition(slug)

  // hash ไม่ถูกต้อง
  if (!positionId) {
    return (
      <div className="min-h-dvh bg-[#26211d] flex items-center justify-center text-white font-sans">
        <div className="text-center p-8 max-w-sm">
          <span className="text-6xl block mb-4">🚫</span>
          <h1 className="text-2xl font-bold mb-2">ลิงก์ไม่ถูกต้อง</h1>
          <p className="text-gray-400 text-sm">
            กรุณาสแกน QR Code ที่โต๊ะอีกครั้ง
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Menu positionId={positionId} />
    </div>
  )
}
