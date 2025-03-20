import { memo, useMemo } from 'react';

// Status color mapping - move outside component to prevent recreation
const STATUS_COLORS = {
  "noncompliant": "#FF1681",
  "compliant": "#0080FF",
  "active": "#C939D6",
  "default": "#FF1681"
};

function StatusIndicatorComponent({ status }: { status: string }) {
  // Use memoization to prevent recalculation of color on re-renders
  const color = useMemo(() => 
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.default, 
    [status]
  );

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

// Memoize the entire component to prevent unnecessary re-renders
export const StatusIndicator = memo(StatusIndicatorComponent);

