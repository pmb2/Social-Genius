"use client"

export function ProgressCircle({ value }: { value: number }) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-32 h-32">
        <defs>
          <linearGradient id="circleGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FF1681" />
            <stop offset="100%" stopColor="#FFAB1A" />
          </linearGradient>
        </defs>
        <circle className="stroke-[#FF1681]/10" strokeWidth="6" fill="transparent" r={radius} cx="64" cy="64" />
        <circle
          className="transition-all duration-300 ease-in-out"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="url(#circleGradient)"
          fill="transparent"
          r={radius}
          cx="64"
          cy="64"
        />
      </svg>
      <span className="absolute text-3xl font-medium text-black">{value}%</span>
    </div>
  )
}

export default ProgressCircle

