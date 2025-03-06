export function StatusIndicator({ status }: { status: string }) {
  const getColors = (status: string) => {
    switch (status) {
      case "noncompliant":
        return "#FF1681"
      case "compliant":
        return "#0080FF"
      case "active":
        return "#C939D6"
      default:
        return "#FF1681"
    }
  }

  const color = getColors(status)

  return (
    <div
      className="w-[80px] h-[8px] rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 5px ${color}25`,
      }}
    />
  )
}

