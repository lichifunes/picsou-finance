import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { AccountForm } from '@/components/shared/AccountForm'
import { ACCOUNT_COLORS } from '@/lib/constants'
import { useCreateAccount } from '@/features/accounts/hooks'
import {
  useSearchInstitutions,
  useInitiateBankSync,
  useInitiateTrAuth,
  useCompleteTrAuth,
  useAddCryptoExchange,
  useAddCryptoWallet,
  usePreviewFinaryFile,
  usePreviewFinaryApi,
  useImportFinary,
  useExecuteFinaryApiSync,
} from '@/features/sync/hooks'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  Landmark,
  ArrowLeftRight,
  Wallet,
  Smartphone,
  FileSpreadsheet,
  PenLine,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Search,
  Eye,
  EyeOff,
  Upload,
  ShieldCheck,
} from 'lucide-react'
import type { ExchangeType, ChainType, AccountRequest, FinaryPreviewResponse, FinaryAccountMapping, FinaryMappingAction, AccountType } from '@/types/api'

// ---------------------------------------------------------------------------
// Props & types
// ---------------------------------------------------------------------------

interface AddAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type WizardStep = 'selector' | 'banks' | 'exchanges' | 'wallets' | 'tr' | 'finary'

// ---------------------------------------------------------------------------
// Source config
// ---------------------------------------------------------------------------

const SOURCES: { key: WizardStep; icon: typeof Landmark; labelKey: string; descKey: string }[] = [
  { key: 'banks', icon: Landmark, labelKey: 'sync.banks.title', descKey: 'addAccount.desc.banks' },
  { key: 'exchanges', icon: ArrowLeftRight, labelKey: 'sync.exchanges.title', descKey: 'addAccount.desc.exchanges' },
  { key: 'wallets', icon: Wallet, labelKey: 'sync.wallets.title', descKey: 'addAccount.desc.wallets' },
  { key: 'tr', icon: Smartphone, labelKey: 'sync.tr.title', descKey: 'addAccount.desc.tr' },
  { key: 'finary', icon: FileSpreadsheet, labelKey: 'sync.finary.title', descKey: 'addAccount.desc.finary' },
  { key: 'manual', icon: PenLine, labelKey: 'addAccount.manual', descKey: 'addAccount.desc.manual' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const { t } = useTranslation()
  const createAccount = useCreateAccount()
  const [step, setStep] = useState<WizardStep>('selector')
  const [showManualForm, setShowManualForm] = useState(false)
  const [isPending, setIsPending] = useState(false)

  function handleSourceClick(key: string) {
    if (key === 'manual') {
      onOpenChange(false)
      setShowManualForm(true)
      return
    }
    setStep(key as WizardStep)
  }

  function handleDialogChange(open: boolean) {
    if (open) setStep('selector')
    onOpenChange(open)
  }

  function handleDone() {
    setStep('selector')
    onOpenChange(false)
  }

  async function handleManualSubmit(data: {
    name: string
    type: 'LEP' | 'PEA' | 'COMPTE_TITRES' | 'CRYPTO' | 'CHECKING' | 'SAVINGS' | 'OTHER'
    provider?: string
    currency: string
    currentBalance?: number
    isManual: boolean
    color: string
    ticker?: string
  }) {
    const request: AccountRequest = {
      name: data.name,
      type: data.type,
      provider: data.provider || undefined,
      currency: data.currency,
      currentBalance: data.currentBalance,
      isManual: true,
      color: data.color,
      ticker: data.ticker || undefined,
    }
    await createAccount.mutateAsync(request)
    setShowManualForm(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {step === 'selector' ? t('addAccount.title') : t(`sync.${step === 'tr' ? 'tr' : step}.title`)}
            </DialogTitle>
            <DialogDescription />
          </DialogHeader>

          {isPending ? (
            <Card>
              <CardContent className="p-0">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Loader2 className="size-4 animate-spin" />
                    </EmptyMedia>
                    <EmptyTitle>{t('addAccount.syncing')}</EmptyTitle>
                    <EmptyDescription>{t('addAccount.syncingDesc')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <>
              {step === 'selector' && (
                <div className="grid grid-cols-1 gap-2">
                  {SOURCES.map(({ key, icon: Icon, labelKey, descKey }) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="h-auto justify-start gap-3 px-4 py-3"
                      onClick={() => handleSourceClick(key)}
                    >
                      <Icon className="size-5 text-muted-foreground shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{t(labelKey)}</p>
                        <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground ml-auto shrink-0" />
                    </Button>
                  ))}
                </div>
              )}

              {step === 'banks' && <BankWizard onDone={handleDone} onBack={() => setStep('selector')} onPending={setIsPending} />}
              {step === 'exchanges' && <ExchangeWizard onDone={handleDone} onBack={() => setStep('selector')} onPending={setIsPending} />}
              {step === 'wallets' && <WalletWizard onDone={handleDone} onBack={() => setStep('selector')} onPending={setIsPending} />}
              {step === 'tr' && <TradeRepublicWizard onDone={handleDone} onBack={() => setStep('selector')} onPending={setIsPending} />}
              {step === 'finary' && <FinaryWizard onDone={handleDone} onBack={() => setStep('selector')} onPending={setIsPending} />}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AccountForm
        open={showManualForm}
        onOpenChange={setShowManualForm}
        onSubmit={handleManualSubmit}
        title={t('addAccount.manual')}
        loading={createAccount.isPending}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Shared: Back button + Success state
// ---------------------------------------------------------------------------

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button variant="ghost" size="sm" className="mb-2" onClick={onClick}>
      <ArrowLeft className="size-4" />
      {t('common.back')}
    </Button>
  )
}

function SuccessState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <CheckCircle2 className="size-8 text-green-500" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wizard: Banques
// ---------------------------------------------------------------------------

function BankWizard({ onDone, onBack, onPending }: { onDone: () => void; onBack: () => void; onPending: (v: boolean) => void }) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [connected, setConnected] = useState(false)

  const { data: institutions, isLoading: searchLoading } = useSearchInstitutions(searchQuery.trim())
  const initiateMutation = useInitiateBankSync()

  const searchEnabled = searchQuery.trim().length >= 2

  function handleConnect(institutionId: string, institutionName: string) {
    onPending(true)
    initiateMutation.mutate(
      { institutionId, institutionName },
      {
        onSuccess: (data) => {
          onPending(false)
          window.open(data.authLink, '_blank', 'noopener,noreferrer')
          setConnected(true)
        },
        onError: () => onPending(false),
      },
    )
  }

  if (connected) {
    return (
      <>
        <BackButton onClick={onBack} />
        <SuccessState message={t('addAccount.bankConnected')} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sync.banks.searchPlaceholder')}
            className="pl-10"
            autoFocus
          />
        </div>

        {searchLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        )}

        {searchEnabled && institutions && institutions.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {institutions.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{inst.name}</span>
                  <span className="text-xs text-muted-foreground">{inst.country}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleConnect(inst.id, inst.name)}
                  disabled={initiateMutation.isPending}
                >
                  {t('sync.banks.connect')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {searchEnabled && institutions && institutions.length === 0 && !searchLoading && (
          <p className="text-sm text-muted-foreground">{t('sync.banks.noConnections')}</p>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Wizard: Exchanges
// ---------------------------------------------------------------------------

function ExchangeWizard({ onDone, onBack, onPending }: { onDone: () => void; onBack: () => void; onPending: (v: boolean) => void }) {
  const { t } = useTranslation()
  const [exchangeType, setExchangeType] = useState<ExchangeType>('BINANCE')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [done, setDone] = useState(false)

  const addMutation = useAddCryptoExchange()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onPending(true)
    addMutation.mutate(
      { type: exchangeType, apiKey, apiSecret },
      {
        onSuccess: () => { onPending(false); setDone(true) },
        onError: () => onPending(false),
      },
    )
  }

  if (done) {
    return (
      <>
        <BackButton onClick={onBack} />
        <SuccessState message={t('addAccount.exchangeConnected')} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t('sync.exchanges.type')}</Label>
          <div className="flex gap-2">
            {(['BINANCE', 'KRAKEN'] as ExchangeType[]).map((type) => (
              <Button
                key={type}
                type="button"
                variant={exchangeType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExchangeType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="exchange-api-key">{t('sync.exchanges.apiKey')}</Label>
          <Input
            id="exchange-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('sync.exchanges.apiKey')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exchange-api-secret">{t('sync.exchanges.apiSecret')}</Label>
          <div className="relative">
            <Input
              id="exchange-api-secret"
              type={showSecret ? 'text' : 'password'}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={t('sync.exchanges.apiSecret')}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret((p) => !p)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={addMutation.isPending} className="w-full">
          {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('sync.exchanges.connect')}
        </Button>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------------
// Wizard: Wallets
// ---------------------------------------------------------------------------

function WalletWizard({ onDone, onBack, onPending }: { onDone: () => void; onBack: () => void; onPending: (v: boolean) => void }) {
  const { t } = useTranslation()
  const [chain, setChain] = useState<ChainType>('ETHEREUM')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [done, setDone] = useState(false)

  const addMutation = useAddCryptoWallet()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onPending(true)
    addMutation.mutate(
      { chain, address, label: label || undefined },
      {
        onSuccess: () => { onPending(false); setDone(true) },
        onError: () => onPending(false),
      },
    )
  }

  if (done) {
    return (
      <>
        <BackButton onClick={onBack} />
        <SuccessState message={t('addAccount.walletConnected')} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t('sync.wallets.chain')}</Label>
          <div className="flex gap-2">
            {(['BITCOIN', 'ETHEREUM', 'SOLANA'] as ChainType[]).map((c) => (
              <Button
                key={c}
                type="button"
                variant={chain === c ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChain(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet-address">{t('sync.wallets.address')}</Label>
          <Input
            id="wallet-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('sync.wallets.address')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet-label">{t('sync.wallets.label')}</Label>
          <Input
            id="wallet-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('sync.wallets.label')}
          />
        </div>

        <Button type="submit" disabled={addMutation.isPending} className="w-full">
          {addMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          <Wallet className="size-4" />
          {t('sync.wallets.track')}
        </Button>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------------
// Wizard: Trade Republic
// ---------------------------------------------------------------------------

type TrState = 'IDLE' | 'AWAITING_TAN' | 'CONNECTED' | 'ERROR'

function TradeRepublicWizard({ onDone, onBack, onPending }: { onDone: () => void; onBack: () => void; onPending: (v: boolean) => void }) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<TrState>('IDLE')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [tan, setTan] = useState('')
  const [processId, setProcessId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const initiateMutation = useInitiateTrAuth()
  const completeMutation = useCompleteTrAuth()

  function handleInitiate(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length === 0) return
    onPending(true)
    initiateMutation.mutate(
      { phoneNumber: phone, pin },
      {
        onSuccess: (data) => {
          onPending(false)
          setProcessId(data.processId)
          setAuthState('AWAITING_TAN')
          setErrorMsg(null)
        },
        onError: (err: any) => {
          onPending(false)
          setErrorMsg(err.message || t('sync.tr.errors.unknownError'))
          setAuthState('ERROR')
        },
      },
    )
  }

  function handleTan(e: React.FormEvent) {
    e.preventDefault()
    if (!processId || tan.length === 0) return
    onPending(true)
    completeMutation.mutate(
      { processId, tan },
      {
        onSuccess: () => {
          onPending(false)
          setAuthState('CONNECTED')
          setTan('')
          setPhone('')
          setPin('')
          setProcessId(null)
          setErrorMsg(null)
        },
        onError: (err: any) => {
          onPending(false)
          setErrorMsg(err.message || t('sync.tr.errors.unknownError'))
          setAuthState('ERROR')
        },
      },
    )
  }

  if (authState === 'CONNECTED') {
    return (
      <>
        <BackButton onClick={onBack} />
        <SuccessState message={t('addAccount.trConnected')} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <div className="space-y-4">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{errorMsg}</span>
            <Button variant="ghost" size="sm" onClick={() => { setErrorMsg(null); setAuthState('IDLE'); setProcessId(null) }}>
              {t('sync.banks.retry')}
            </Button>
          </div>
        )}

        {authState !== 'AWAITING_TAN' && (
          <form onSubmit={handleInitiate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tr-phone">
                <Smartphone className="size-4 inline-block mr-1" />
                {t('sync.tr.phone')}
              </Label>
              <Input id="tr-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+49..." autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-pin">
                <ShieldCheck className="size-4 inline-block mr-1" />
                {t('sync.tr.pin')}
              </Label>
              <InputOTP maxLength={4} value={pin} onChange={setPin} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" disabled={initiateMutation.isPending} className="w-full">
              {initiateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('sync.tr.connect')}
            </Button>
          </form>
        )}

        {authState === 'AWAITING_TAN' && (
          <form onSubmit={handleTan} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tr-tan">
                <ShieldCheck className="size-4 inline-block mr-1" />
                {t('sync.tr.tan')}
              </Label>
              <InputOTP maxLength={6} value={tan} onChange={setTan} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" disabled={completeMutation.isPending} className="w-full">
              {completeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('sync.tr.connect')}
            </Button>
          </form>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Wizard: Finary (3-step: Upload → Mapping → Results)
// ---------------------------------------------------------------------------

type FinaryStep = 1 | 2 | 3

function FinaryWizard({ onDone, onBack, onPending }: { onDone: () => void; onBack: () => void; onPending: (v: boolean) => void }) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<FinaryStep>(1)
  const [isApiSync, setIsApiSync] = useState(false)
  const [previewData, setPreviewData] = useState<FinaryPreviewResponse | null>(null)
  const [mappings, setMappings] = useState<FinaryAccountMapping[]>([])
  const [importResult, setImportResult] = useState<{ accountsCreated: number; accountsMapped: number; accountsSkipped: number; transactionsImported: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const previewFileMutation = usePreviewFinaryFile()
  const previewApiMutation = usePreviewFinaryApi()
  const importMutation = useImportFinary()
  const executeApiMutation = useExecuteFinaryApiSync()

  // --- Step 1: Upload / API Sync ---

  function handleFileUpload(file: File) {
    setLoading(true)
    onPending(true)
    setError(null)
    previewFileMutation.mutate(file, {
      onSuccess: (data) => {
        onPending(false)
        setLoading(false)
        setPreviewData(data)
        initMappings(data)
        setIsApiSync(false)
        setStep(2)
      },
      onError: (err: unknown) => {
        onPending(false)
        setLoading(false)
        setError(err instanceof Error ? err.message : t('common.retry'))
      },
    })
  }

  function handleApiSync() {
    setLoading(true)
    onPending(true)
    setError(null)
    previewApiMutation.mutate(totpCode || undefined, {
      onSuccess: (data) => {
        onPending(false)
        setLoading(false)
        setPreviewData(data)
        initMappings(data)
        setIsApiSync(true)
        setTotpRequired(false)
        setStep(2)
      },
      onError: (err: any) => {
        onPending(false)
        setLoading(false)
        if (err.response?.status === 403) {
          setTotpRequired(true)
        } else {
          setError(err instanceof Error ? err.message : t('common.retry'))
        }
      },
    })
  }

  function initMappings(preview: FinaryPreviewResponse) {
    setMappings(preview.accounts.map((account, i) => ({
      finaryName: account.finaryName,
      finaryCategory: account.finaryCategory,
      action: 'CREATE_NEW' as FinaryMappingAction,
      targetAccountId: undefined,
      newAccount: {
        name: account.finaryName,
        type: account.suggestedType,
        provider: account.finaryInstitution,
        currency: account.nativeCurrency,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      },
    })))
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  // --- Step 2: Mapping ---

  function setMappingAction(index: number, action: FinaryMappingAction) {
    setMappings((prev) => prev.map((m, i) => {
      if (i !== index) return m
      const account = previewData?.accounts[index]
      if (action === 'SKIP') return { ...m, action, targetAccountId: undefined, newAccount: undefined }
      if (action === 'MAP_EXISTING') return { ...m, action, newAccount: undefined }
      return {
        ...m,
        action,
        targetAccountId: undefined,
        newAccount: {
          name: m.newAccount?.name ?? account?.finaryName ?? '',
          type: m.newAccount?.type ?? account?.suggestedType ?? 'OTHER' as AccountType,
          provider: m.newAccount?.provider ?? account?.finaryInstitution ?? 'Finary',
          currency: m.newAccount?.currency ?? account?.nativeCurrency ?? 'EUR',
          color: m.newAccount?.color ?? ACCOUNT_COLORS[0],
        },
      }
    }))
  }

  function updateNewAccountField(index: number, field: string, value: string) {
    setMappings((prev) => prev.map((m, i) => {
      if (i !== index || !m.newAccount) return m
      return { ...m, newAccount: { ...m.newAccount, [field]: value } }
    }))
  }

  function handleImport() {
    if (!previewData) return
    setLoading(true)
    onPending(true)
    setError(null)

    const token = previewData.fileToken
    const mutation = isApiSync ? executeApiMutation : importMutation
    const payload = isApiSync
      ? { syncToken: token, mappings }
      : { fileToken: token, mappings }

    mutation.mutate(payload as any, {
      onSuccess: (data) => {
        onPending(false)
        setLoading(false)
        setImportResult(data)
        setStep(3)
      },
      onError: (err: unknown) => {
        onPending(false)
        setLoading(false)
        setError(err instanceof Error ? err.message : t('common.retry'))
      },
    })
  }

  const hasSkipAll = mappings.every((m) => m.action === 'SKIP')

  // --- Step 3: Results ---

  if (step === 3 && importResult) {
    return (
      <>
        <BackButton onClick={onBack} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ResultStat label={t('sync.finary.accountsCreated')} value={importResult.accountsCreated} />
            <ResultStat label={t('sync.finary.accountsMapped')} value={importResult.accountsMapped} />
            <ResultStat label={t('sync.finary.accountsSkipped')} value={importResult.accountsSkipped} />
            <ResultStat label={t('sync.finary.transactionsImported')} value={importResult.transactionsImported} />
          </div>
          <Button onClick={onDone} className="w-full">
            <CheckCircle2 className="size-4" />
            {t('sync.finary.done')}
          </Button>
        </div>
      </>
    )
  }

  // --- Step 2: Mapping ---

  if (step === 2 && previewData) {
    return (
      <>
        <BackButton onClick={() => { setStep(1); setPreviewData(null) }} />
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={loading || hasSkipAll}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t('sync.finary.import')}
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {previewData.accounts.map((account, index) => (
              <div key={account.finaryName + account.finaryCategory} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.finaryName}</p>
                    <p className="text-xs text-muted-foreground">{account.finaryInstitution} &middot; {account.finaryCategory}</p>
                  </div>
                  <span className="text-sm font-medium shrink-0 ml-2">{account.currentBalance.toLocaleString()} {account.nativeCurrency}</span>
                </div>

                <div className="flex gap-1.5">
                  {(['SKIP', 'MAP_EXISTING', 'CREATE_NEW'] as const).map((action) => (
                    <Button
                      key={action}
                      variant={mappings[index]?.action === action ? 'default' : 'outline'}
                      size="xs"
                      onClick={() => setMappingAction(index, action)}
                    >
                      {t(`sync.finary.${action === 'SKIP' ? 'skip' : action === 'MAP_EXISTING' ? 'mapExisting' : 'createNew'}`)}
                    </Button>
                  ))}
                </div>

                {mappings[index]?.action === 'MAP_EXISTING' && (
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
                    value={mappings[index].targetAccountId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val) {
                        setMappings((prev) => prev.map((m, i) => i === index ? { ...m, targetAccountId: Number(val) } : m))
                      }
                    }}
                  >
                    <option value="" disabled>{t('sync.finary.mapExisting')}...</option>
                    {previewData.existingPicsouAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                )}

                {mappings[index]?.action === 'CREATE_NEW' && mappings[index].newAccount && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('accounts.addAccount')}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={mappings[index].newAccount!.name}
                        onChange={(e) => updateNewAccountField(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('sync.exchanges.type')}</Label>
                      <select
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring"
                        value={mappings[index].newAccount!.type}
                        onChange={(e) => updateNewAccountField(index, 'type', e.target.value)}
                      >
                        {(['CHECKING', 'SAVINGS', 'LEP', 'PEA', 'COMPTE_TITRES', 'CRYPTO', 'OTHER'] as const).map((type) => (
                          <option key={type} value={type}>{t(`accountTypes.${type === 'COMPTE_TITRES' ? 'compteTitres' : type.toLowerCase()}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // --- Step 1: Upload / API Sync ---

  return (
    <>
      <BackButton onClick={onBack} />
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>x</Button>
          </div>
        )}

        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Upload className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{t('sync.finary.uploadFile')}</p>
          <p className="text-xs text-muted-foreground">{t('sync.finary.uploadHint')}</p>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {t('sync.finary.uploadFile')}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={onFileSelected} />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleApiSync} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t('sync.finary.apiSync')}
          </Button>

          {totpRequired && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="finary-totp" className="text-xs">{t('sync.finary.totp')}</Label>
                <Input id="finary-totp" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} className="mt-1" />
              </div>
              <Button className="mt-5" onClick={handleApiSync} disabled={totpCode.length !== 6 || loading}>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
