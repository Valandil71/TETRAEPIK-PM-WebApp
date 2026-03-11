import { getStatusIcon } from "@/utils/projectTableHelpers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatusIconProps {
  status: string;
  size?: number;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Reusable status icon component for assignment status
 * Displays an icon with appropriate color based on assignment status
 */
export function StatusIcon({
  status,
  size = 16,
  className = "",
  showTooltip = true,
}: StatusIconProps) {
  const { icon: Icon, color, label } = getStatusIcon(status);

  const iconElement = (
    <Icon
      className={`${color} ${className}`}
      size={size}
      aria-label={label}
    />
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{iconElement}</TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return iconElement;
}
