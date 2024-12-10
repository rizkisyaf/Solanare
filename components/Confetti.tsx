import { useCallback, useEffect, useState } from 'react'
import ReactConfetti from 'react-confetti'

interface ConfettiProps {
  isSmall?: boolean
  duration?: number
}

export function Confetti({ isSmall = false, duration = 3000 }: ConfettiProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isActive, setIsActive] = useState(true)

  const confettiWrapper = useCallback((wrapper: HTMLDivElement | null) => {
    if (wrapper) {
      setDimensions({
        width: isSmall ? wrapper.clientWidth : window.innerWidth,
        height: isSmall ? wrapper.clientHeight : window.innerHeight
      })
    }
  }, [isSmall])

  useEffect(() => {
    const timer = setTimeout(() => setIsActive(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!isActive) return null

  return (
    <div ref={confettiWrapper} className={isSmall ? "absolute inset-0 z-10" : "fixed inset-0 z-[99999]"}>
      <ReactConfetti
        width={dimensions.width}
        height={dimensions.height}
        recycle={false}
        numberOfPieces={isSmall ? 100 : 500}
        gravity={0.3}
        initialVelocityY={20}
      />
    </div>
  )
} 