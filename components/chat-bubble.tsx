"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"

export function ChatBubble() {
  return (
    <Button
      size="icon"
      className="fixed bottom-4 right-4 h-12 w-12 rounded-full bg-gradient-to-r from-[#F5F124] via-[#FAC116] to-[#F18EF0] shadow-lg hover:opacity-90"
    >
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mask%20group%20(8)-DcPWOQsZME6DH3YHaew1g9ss4Fz1pV.png"
        alt="Chat"
        className="w-6 h-6"
        width={24}
        height={24}
      />
    </Button>
  )
}

