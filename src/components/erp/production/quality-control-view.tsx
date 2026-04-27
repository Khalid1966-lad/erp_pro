'use client'

import { ClipboardCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function QualityControlView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Contrôle qualité</h2>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">Contrôle qualité</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Cette section est en cours de développement. Vous pourrez gérer les contrôles
            qualité, les non-conformités et les certificats de conformité.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
