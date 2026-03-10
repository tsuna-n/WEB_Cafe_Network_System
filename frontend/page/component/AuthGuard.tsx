'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/service/api'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        const user = getCurrentUser()
        if (!user) {
            router.replace('/login')
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAuthorized(true)
        }
    }, [router])

    if (!authorized) {
        return (
            <div className="min-h-dvh bg-surface flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted text-sm animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
