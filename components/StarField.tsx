'use client'
import { useEffect, useRef, useState } from 'react'

export function StarField() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationFrameId: number
        const stars: Array<{ x: number, y: number, size: number, speed: number }> = []

        const resizeCanvas = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            initStars()
        }

        const initStars = () => {
            stars.length = 0
            const numberOfStars = Math.floor((canvas.width * canvas.height) / 8000)

            for (let i = 0; i < numberOfStars; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 2,
                    speed: Math.random() * 0.5 + 0.1
                })
            }
        }

        const drawStars = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            stars.forEach(star => {
                ctx.fillStyle = 'rgba(147, 51, 234, 0.4)'
                ctx.beginPath()
                ctx.arc(star.x, star.y, star.size * 0.7, 0, Math.PI * 2)
                ctx.fill()

                star.y = (star.y + star.speed * 0.5) % canvas.height
            })

            animationFrameId = requestAnimationFrame(drawStars)
        }

        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)
        drawStars()

        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener('resize', resizeCanvas)
        }
    }, [mounted])

    return <canvas ref={canvasRef} className="fixed inset-0 -z-1000" />
} 