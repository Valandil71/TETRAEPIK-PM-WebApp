import { getBgClass } from "./tailwindColors";

/**
 * Gets system color class for display
 * Uses color settings from Supabase if available, otherwise falls back to defaults
 * Now colors are stored as Tailwind class names directly (e.g., "blue-500")
 */
export function getSystemColorClass(
  system: string,
  getSystemColor?: (system: string) => string
): string {
  if (getSystemColor) {
    const colorValue = getSystemColor(system);
    if (colorValue) {
      // If it's already a Tailwind color value, convert to bg class
      return getBgClass(colorValue);
    }
  }
  
  // Fallback to default colors
  const defaultColors: Record<string, string> = {
    'B0X': 'bg-blue-500',
    'XTM': 'bg-purple-500',
    'SSE': 'bg-green-500',
    'STM': 'bg-orange-500',
    'LAT': 'bg-pink-500',
  };
  
  return defaultColors[system] || 'bg-gray-500';
}

