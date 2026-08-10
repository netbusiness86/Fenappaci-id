import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-600 text-white';
    case 'DIRECTION':
      return 'bg-purple-600 text-white';
    case 'COORDINATION_REGIONALE':
      return 'bg-blue-600 text-white';
    case 'DELEGUE_DEPARTEMENTAL':
      return 'bg-teal-600 text-white';
    case 'DELEGUE_SOUS_PREFECTURE':
      return 'bg-cyan-600 text-white';
    case 'AGENT':
      return 'bg-[#2E7D32] text-white';
    default:
      return 'bg-gray-600 text-white';
  }
}
