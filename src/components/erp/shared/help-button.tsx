'use client'

import { useNavStore } from '@/lib/stores'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

interface HelpButtonProps {
  /** Section ID in the guide (e.g. 'ventes', 'production', 'stock') */
  section: string
  /** Sub-section ID in the guide (e.g. 'clients', 'devis', 'maintenance') */
  sub?: string
  /** Optional tooltip text — defaults to "Aide" */
  tooltip?: string
  /** Size variant */
  size?: 'sm' | 'default' | 'icon'
}

export function HelpButton({ section, sub, tooltip = 'Aide', size = 'icon' }: HelpButtonProps) {
  const openHelp = useNavStore((s) => s.openHelp)

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'}
            onClick={() => openHelp(section, sub)}
          >
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
