import Navbar from "@/page/component/Navbar"
import { decodePosition } from "@/service/tableHash"

export default async function PositionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: slug } = await params
  const positionId = decodePosition(slug) ?? undefined

  return (
    <div>
      <nav>
        <Navbar positionId={positionId} />
      </nav>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}