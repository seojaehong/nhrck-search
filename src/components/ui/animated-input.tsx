"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

interface OrbInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onFocusChange?: (focused: boolean) => void
}

export function OrbInput({ value, onChange, onSubmit, onFocusChange }: OrbInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)

  const placeholders = useMemo(
    () => [
      "사건명, 결정요지로 검색하세요",
      "성희롱 관련 결정문 찾기",
      "직장 내 괴롭힘 사례 검색",
      "인권침해 판단 기준 검색",
    ],
    []
  )

  const CHAR_DELAY = 75
  const IDLE_DELAY_AFTER_FINISH = 2200

  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const current = placeholders[placeholderIndex]
    if (!current) {
      setDisplayedText("")
      setIsTyping(false)
      return
    }

    const chars = Array.from(current)
    setDisplayedText("")
    setIsTyping(true)
    let charIndex = 0

    intervalRef.current = window.setInterval(() => {
      if (charIndex < chars.length) {
        const next = chars.slice(0, charIndex + 1).join("")
        setDisplayedText(next)
        charIndex += 1
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setIsTyping(false)

        timeoutRef.current = window.setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
        }, IDLE_DELAY_AFTER_FINISH)
      }
    }, CHAR_DELAY)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [placeholderIndex, placeholders])

  const handleFocus = () => {
    setIsFocused(true)
    onFocusChange?.(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    onFocusChange?.(false)
  }

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-4 px-5 py-3.5 bg-white shadow-sm transition-all duration-300 ease-out rounded-2xl border ${
          isFocused
            ? "shadow-lg scale-[1.01] border-gray-300 ring-2 ring-gray-900/5"
            : "border-gray-200"
        }`}
      >
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full overflow-hidden transition-all duration-300 ${isFocused ? "scale-110" : ""}`}>
            <img
              src="https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=80&h=80&fit=crop"
              alt="Search"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
            placeholder={`${displayedText}${isTyping ? "|" : ""}`}
            aria-label="검색어 입력"
            className="w-full text-[15px] text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none font-normal"
          />
        </div>

        <button
          onClick={onSubmit}
          className="px-5 py-2 bg-gray-900 text-white rounded-xl text-[14px] font-semibold hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          검색
        </button>
      </div>
    </div>
  )
}

export default OrbInput
