export interface Step {
  title: string
  subtitle: string
  status: "completed" | "in-progress" | "failed" | "pending"
  description?: string
  actions?: string[]
  screenshot?: string
  screenshotCaption?: string
}

export const steps: Step[] = [
  {
    title: "Step 1: Gathering Business Details",
    subtitle: "Collecting essential information for compliance check",
    status: "completed",
    description:
      "Our AI gathers core information from your business profile to analyze your compliance status.",
    actions: [
      "→ Collecting business information...",
      "✓ Business details collected",
      "→ Preparing for analysis...",
      "✓ Analysis preparation complete"
    ],
    screenshot: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder.svg?height=150&width=400",
    screenshotCaption: "Business details gathered successfully",
  },
  {
    title: "Step 2: Checking Compliance",
    subtitle: "Analyzing profile against requirements",
    status: "in-progress",
    description:
      "We're analyzing your profile for compliance with platform requirements and best practices.",
    actions: [
      "→ Checking profile completeness...",
      "→ Analyzing content quality...",
      "→ Validating business information...",
      "→ Checking media and visuals..."
    ],
    screenshot: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder.svg?height=150&width=400",
    screenshotCaption: "Compliance check in progress",
  },
  {
    title: "Step 3: Compliance Results",
    subtitle: "Your compliance status and next steps",
    status: "pending",
    description:
      "We'll show you what needs fixing or confirm you're all set. We check every hour to maintain your compliance.",
    actions: [
      "→ Waiting for analysis to complete...",
      "→ Preparing recommendations...",
      "→ Setting up hourly monitoring..."
    ],
    screenshot: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder.svg?height=150&width=400",
    screenshotCaption: "Ready to provide your compliance status",
  }
]

export interface ComplianceReport {
  status: string
  completionRate: number
  issues: {
    type: string
    severity: "high" | "medium" | "low"
    description: string
  }[]
}

export interface ComplianceIssue {
  type: string
  severity: "high" | "medium" | "low"
  description: string
}

