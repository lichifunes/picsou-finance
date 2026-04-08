import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAccounts, useUpdateAccount, useDeleteAccount, useAllAccountsHistory } from '@/features/accounts/hooks'
import { AccountForm } from '@/components/shared/AccountForm'
import { AddAccountModal } from '@/components/shared/AddAccountModal'
import { AccountCard } from '@/components/shared/AccountCard'
import { AccountsStackedChart } from '@/components/shared/AccountsStackedChart'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Wallet, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Account, AccountRequest, AccountType } from '@/types/api'

type AssetFilter = 'ALL' | 'STOCKS' | 'METALS' | 'SAVINGS' | 'CHECKING' | 'CRYPTO' | 'REAL_ESTATE'

const FILTER_KEYS: AssetFilter[] = ['ALL', 'STOCKS', 'METALS', 'SAVINGS', 'CHECKING', 'CRYPTO', 'REAL_ESTATE']

const ASSET_FILTER_MAP: Record<AssetFilter, AccountType[] | null> = {
  ALL: null,
  STOCKS: ['PEA', 'COMPTE_TITRES'],
  METALS: ['OTHER'],
  SAVINGS: ['LEP', 'SAVINGS'],
  CHECKING: ['CHECKING'],
  CRYPTO: ['CRYPTO'],
  REAL_ESTATE: [],
}

const TYPE_GROUP_META: Record<string, { key: string; labelKey: string; color: string }> = {
  STOCKS:      { key: 'STOCKS',      labelKey: 'accounts.filters.STOCKS',      color: '#6366f1' },
  METALS:      { key: 'METALS',      labelKey: 'accounts.filters.METALS',      color: '#eab308' },
  SAVINGS:     { key: 'SAVINGS',     labelKey: 'accounts.filters.SAVINGS',     color: '#22c55e' },
  CHECKING:    { key: 'CHECKING',    labelKey: 'accounts.filters.CHECKING',    color: '#0ea5e9' },
  CRYPTO:      { key: 'CRYPTO',      labelKey: 'accounts.filters.CRYPTO',      color: '#f97316' },
  REAL_ESTATE: { key: 'REAL_ESTATE', labelKey: 'accounts.filters.REAL_ESTATE', color: '#a855f7' },
}

const TYPE_TO_GROUP: Record<AccountType, string> = {
  PEA: 'STOCKS',
  COMPTE_TITRES: 'STOCKS',
  OTHER: 'METALS',
  LEP: 'SAVINGS',
  SAVINGS: 'SAVINGS',
  CHECKING: 'CHECKING',
  CRYPTO: 'CRYPTO',
}

type AccountFormData = {
  name: string
  type: 'LEP' | 'PEA' | 'COMPTE_TITRES' | 'CRYPTO' | 'CHECKING' | 'SAVINGS' | 'OTHER'
  provider?: string
  currency: string
  currentBalance?: number
  isManual: boolean
  color: string
  ticker?: string
}

export function AccountsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: accounts, isLoading } = useAccounts()
  const { data: historyData, isLoading: isHistoryLoading } = useAllAccountsHistory()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filter, setFilter] = useState<AssetFilter>('ALL')

  // Chart accounts: grouped by type when ALL, individual accounts otherwise
  const chartAccounts = useMemo(() => {
    if (!accounts) return []
    if (filter !== 'ALL') {
      const types = ASSET_FILTER_MAP[filter]!
      return accounts.filter(a => types.includes(a.type))
    }
    // ALL → one virtual account per type group
    return Object.values(TYPE_GROUP_META).map(meta => ({
      id: meta.key as unknown as number,
      name: t(meta.labelKey),
      type: 'OTHER' as AccountType,
      provider: null,
      currency: 'EUR',
      currentBalance: 0,
      currentBalanceEur: 0,
      lastSyncedAt: null,
      isManual: false,
      color: meta.color,
      ticker: null,
      createdAt: '',
    }))
  }, [accounts, filter, t])

  // Chart history: aggregated by type group when ALL, filtered per-account otherwise
  const chartHistory = useMemo(() => {
    if (!historyData || !accounts) return []
    if (filter !== 'ALL') {
      const types = ASSET_FILTER_MAP[filter]!
      const ids = new Set(accounts.filter(a => types.includes(a.type)).map(a => String(a.id)))
      return historyData.map(point => {
        const filtered: { date: string; [key: string]: string | number } = { date: point.date }
        for (const id of ids) {
          if (point[id] !== undefined) filtered[id] = point[id]
        }
        return filtered
      })
    }
    // ALL → sum balances per type group per date
    const groupIds: Record<string, Set<string>> = {}
    for (const a of accounts) {
      const group = TYPE_TO_GROUP[a.type]
      if (!groupIds[group]) groupIds[group] = new Set()
      groupIds[group].add(String(a.id))
    }
    return historyData.map(point => {
      const aggregated: { date: string; [key: string]: string | number } = { date: point.date }
      for (const [group, ids] of Object.entries(groupIds)) {
        let sum = 0
        for (const id of ids) {
          sum += (point[id] as number) ?? 0
        }
        aggregated[group] = sum
      }
      return aggregated
    })
  }, [historyData, accounts, filter])

  // Grid accounts: always individual, filtered by type
  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    const types = ASSET_FILTER_MAP[filter]
    if (!types) return accounts
    return accounts.filter(a => types.includes(a.type))
  }, [accounts, filter])

  function handleOpenCreate() {
    setShowCreateModal(true)
  }

  function handleOpenEdit(account: Account) {
    setEditingAccount(account)
    setShowEditForm(true)
  }

  function handleEditFormOpenChange(open: boolean) {
    setShowEditForm(open)
    if (!open) setEditingAccount(null)
  }

  async function handleEditSubmit(data: AccountFormData) {
    if (!editingAccount) return
    const request: AccountRequest = {
      name: data.name,
      type: data.type,
      provider: data.provider || undefined,
      currency: data.currency,
      currentBalance: data.currentBalance,
      isManual: data.isManual,
      color: data.color,
      ticker: data.ticker || undefined,
    }
    await updateAccount.mutateAsync({ id: editingAccount.id, data: request })
    setShowEditForm(false)
    setEditingAccount(null)
  }

  async function handleConfirmDelete() {
    if (deleteId === null) return
    await deleteAccount.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const defaultValues: Partial<AccountFormData> | undefined = editingAccount
    ? {
        name: editingAccount.name,
        type: editingAccount.type,
        provider: editingAccount.provider ?? '',
        currency: editingAccount.currency,
        currentBalance: editingAccount.currentBalance,
        isManual: editingAccount.isManual,
        color: editingAccount.color,
        ticker: editingAccount.ticker ?? '',
      }
    : undefined

  const isMutating = updateAccount.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('accounts.title')}
        actions={
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="size-4" />
            {t('accounts.addAccount')}
          </Button>
        }
      />

      {accounts && accounts.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            {FILTER_KEYS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {t(`accounts.filters.${f}`)}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('accounts.evolution')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <Skeleton className="h-[250px] w-full rounded-xl" />
              ) : (
                <AccountsStackedChart accounts={chartAccounts} data={chartHistory} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-12" />}
          title={t('accounts.noAccounts')}
          action={{ label: t('accounts.addAccount'), onClick: handleOpenCreate }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <div key={account.id} className="relative group">
              <AccountCard
                account={account}
                onClick={() => navigate(`/accounts/${account.id}`)}
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenEdit(account)
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteId(account.id)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAccountModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <AccountForm
        open={showEditForm}
        onOpenChange={handleEditFormOpenChange}
        onSubmit={handleEditSubmit}
        defaultValues={defaultValues}
        title={t('accounts.editAccount')}
        loading={isMutating}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title={t('accounts.deleteAccount')}
        description={t('accounts.deleteConfirm')}
        onConfirm={handleConfirmDelete}
        loading={deleteAccount.isPending}
        variant="destructive"
      />
    </div>
  )
}
