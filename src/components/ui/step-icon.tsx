import { CheckCircle2, Clock, XCircle, HelpCircle } from "lucide-react"
import type { Step } from "@/src/types/business-profile"

export function StepIcon({ status }: { status: Step["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="w-6 h-6 rounded-full bg-[#0080FF] flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      )
    case "in-progress":
      return (
        <div className="w-6 h-6 rounded-full bg-[#FF1681] flex items-center justify-center">
          <Clock className="w-4 h-4 text-white" />
        </div>
      )
    case "failed":
      return (
        <div className="w-6 h-6 rounded-full bg-[#C939D6] flex items-center justify-center">
          <XCircle className="w-4 h-4 text-white" />
        </div>
      )
    default:
      return (
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center">
          <HelpCircle className="w-4 h-4 text-gray-400" />
        </div>
      )
  }
}

