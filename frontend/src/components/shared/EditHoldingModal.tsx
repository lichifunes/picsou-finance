import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { HoldingResponse } from '@/types/api'

interface EditHoldingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  holding: HoldingResponse | null
  onSubmit: (ticker: string, quantity: number, averageBuyIn?: number) => Promise<void>
  isLoading?: boolean
}

export function EditHoldingModal({ open, onOpenChange, holding, onSubmit, isLoading }: EditHoldingModalProps) {
  const [quantity, setQuantity] = useState('')
  const [averageBuyIn, setAverageBuyIn] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && holding) {
      setQuantity(String(holding.quantity))
      setAverageBuyIn(holding.averageBuyIn != null ? String(holding.averageBuyIn) : '')
      setError(null)
    }
  }, [open, holding])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!holding) return
    setError(null)
    try {
      await onSubmit(
        holding.ticker,
        parseFloat(quantity),
        averageBuyIn ? parseFloat(averageBuyIn) : undefined,
      )
      onOpenChange(false)
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier {holding?.ticker}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Quantité</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Prix moyen d'achat (€) <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={averageBuyIn}
              onChange={e => setAverageBuyIn(e.target.value)}
              placeholder="—"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
