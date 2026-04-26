import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi } from './api'
import type { AccountRequest, Account, DebtRequest, HoldingResponse, RealEstateMetadataRequest, TransactionRequest } from '@/types/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export interface HoldingWithAccount extends HoldingResponse {
  accountName: string
  accountId: number
  accountType: Account['type']
}

export interface PortfolioLine {
  id: string
  name: string
  ticker: string | null
  quantity: number
  accountName: string
  accountType: Account['type']
  accountColor: string
  valueEur: number
  pnlEur: number | null
  pnlPercent: number | null
  priceUpdatedAt: string | null
}

const HOLDING_ACCOUNT_TYPES: Account['type'][] = ['PEA', 'COMPTE_TITRES', 'CRYPTO']

export function usePortfolio() {
  return useQuery({
    queryKey: ['accounts', 'portfolio'],
    queryFn: async (): Promise<PortfolioLine[]> => {
      const accounts = await accountsApi.list()
      const lines: PortfolioLine[] = []

      // Accounts with holdings — expand each holding as a line
      const holdingAccounts = accounts.filter(a => HOLDING_ACCOUNT_TYPES.includes(a.type))
      const holdingResults = await Promise.all(
        holdingAccounts.map(async (account): Promise<PortfolioLine[]> => {
          try {
            const holdings = await accountsApi.holdings(account.id)
            return holdings.map(h => ({
              id: `${account.id}-${h.ticker}`,
              name: h.name ?? h.ticker,
              ticker: h.ticker,
              quantity: h.quantity,
              accountName: account.name,
              accountType: account.type,
              accountColor: account.color,
              valueEur: h.currentValueEur ?? 0,
              pnlEur: h.pnlEur,
              pnlPercent: h.pnlPercent,
              priceUpdatedAt: h.priceUpdatedAt,
            }))
          } catch {
            return []
          }
        }),
      )
      lines.push(...holdingResults.flat())

      // Fetch live prices for all tickers
      const allTickers = [...new Set(lines.map(l => l.ticker).filter((t): t is string => t != null && t !== 'EUR'))]
      let livePrices: Record<string, number> = {}
      if (allTickers.length > 0) {
        try {
          livePrices = await accountsApi.prices(allTickers)
        } catch { /* keep backend prices */ }
      }

      const now = new Date().toISOString()
      const enriched = lines.map(l => {
        if (!l.ticker || l.ticker === 'EUR') return l
        const livePrice = livePrices[l.ticker]
        if (livePrice == null) return l // keep backend priceUpdatedAt
        const valueEur = l.quantity * livePrice
        const pnlEur = l.pnlEur != null && l.valueEur > 0
          ? l.pnlEur + (valueEur - l.valueEur)
          : null
        return { ...l, valueEur, pnlEur, priceUpdatedAt: now }
      })

      // Cash accounts — aggregate into a single "Euros" line (exclude LOAN accounts)
      const cashAccounts = accounts.filter(a => !HOLDING_ACCOUNT_TYPES.includes(a.type) && a.type !== 'LOAN')
      if (cashAccounts.length > 0) {
        enriched.push({
          id: 'cash-aggregated',
          name: 'Euros',
          ticker: 'EUR',
          quantity: 0,
          accountName: cashAccounts.map(a => a.name).join(', '),
          accountType: cashAccounts[0].type,
          accountColor: '#22c55e',
          valueEur: cashAccounts.reduce((sum, a) => sum + a.currentBalanceEur, 0),
          pnlEur: null,
          pnlPercent: null,
          priceUpdatedAt: null,
        })
      }

      return enriched
    },
    staleTime: QUERY_STALE_TIMES.accountDetail,
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
    staleTime: QUERY_STALE_TIMES.accounts,
  })
}

export function useAccount(id: number) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => accountsApi.get(id),
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: !!id,
  })
}

export function useAccountHoldings(id: number) {
  return useQuery({
    queryKey: ['accounts', id, 'holdings'],
    queryFn: () => accountsApi.holdings(id),
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: !!id,
  })
}

export function useHoldingsWithLivePrices(id: number) {
  return useQuery({
    queryKey: ['accounts', id, 'holdings'],
    queryFn: async (): Promise<HoldingResponse[]> => {
      const holdings = await accountsApi.holdings(id)
      if (holdings.length === 0) return holdings

      const tickers = [...new Set(holdings.map(h => h.ticker))]
      try {
        const livePrices = await accountsApi.prices(tickers)
        const now = new Date().toISOString()
        return holdings.map(h => {
          const livePrice = livePrices[h.ticker]
          if (livePrice == null) return h // keep backend priceUpdatedAt
          const costBasisEur = h.averageBuyIn != null ? h.quantity * h.averageBuyIn : null
          const currentValueEur = h.quantity * livePrice
          const pnlEur = costBasisEur != null ? currentValueEur - costBasisEur : null
          const pnlPercent = costBasisEur != null && costBasisEur !== 0 ? (pnlEur! / costBasisEur) * 100 : null
          return {
            ...h,
            currentPrice: livePrice,
            currentValueEur,
            costBasisEur,
            pnlEur,
            pnlPercent,
            priceUpdatedAt: now,
          }
        })
      } catch {
        return holdings // keep backend priceUpdatedAt
      }
    },
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: !!id,
  })
}

export function useAccountTransactions(id: number) {
  return useQuery({
    queryKey: ['accounts', id, 'transactions'],
    queryFn: () => accountsApi.transactions(id),
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: !!id,
  })
}

export function useAccountHistory(id: number, from?: string) {
  return useQuery({
    queryKey: ['accounts', id, 'history', from],
    queryFn: () => accountsApi.history(id, from),
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: !!id,
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AccountRequest) => accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AccountRequest }) => accountsApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.id] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => accountsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useAddSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, balance, date }: { id: number; balance: number; date: string }) =>
      accountsApi.addSnapshot(id, balance, date),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', id, 'history'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', id] })
    },
  })
}

export function useUpdateRealEstateMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RealEstateMetadataRequest }) =>
      accountsApi.updateRealEstateMetadata(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateDebtMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DebtRequest }) =>
      accountsApi.updateDebtMetadata(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['loan-summary', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useLoanSummary(id: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['loan-summary', id],
    queryFn: () => accountsApi.loanSummary(id),
    staleTime: QUERY_STALE_TIMES.accountDetail,
    enabled: enabled && Number.isFinite(id),
  })
}

export function useAddTransaction(accountId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TransactionRequest) => accountsApi.addTransaction(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'history'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteTransaction(accountId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (txId: number) => accountsApi.deleteTransaction(accountId, txId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'history'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTransaction(accountId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ txId, data }: { txId: number; data: TransactionRequest }) =>
      accountsApi.updateTransaction(accountId, txId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'holdings'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'history'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateHolding(accountId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticker, data }: { ticker: string; data: { quantity: number; averageBuyIn?: number } }) =>
      accountsApi.updateHolding(accountId, ticker, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'holdings'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteHolding(accountId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => accountsApi.deleteHolding(accountId, ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId, 'holdings'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

export type PricePoint = { date: string; priceEur: number }

export function usePriceHistory(ticker: string | null, months: number, range: string) {
  const is24H = range === '24H'
  return useQuery({
    queryKey: ['price-history', ticker, is24H ? 'intraday' : months],
    queryFn: async (): Promise<PricePoint[]> => {
      if (is24H) {
        const data = await accountsApi.priceIntraday(ticker!)
        return data.map(p => ({ date: p.timestamp, priceEur: p.priceEur }))
      }
      return accountsApi.priceHistory(ticker!, months)
    },
    enabled: !!ticker,
    staleTime: 2 * 60 * 1000,
  })
}
