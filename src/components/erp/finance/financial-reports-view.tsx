'use client'

import { BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function FinancialReportsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">États financiers</h2>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">États financiers</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Cette section est en cours de développement. Vous pourrez consulter le bilan,
            le compte de résultat, la balance et les états de TVA.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
