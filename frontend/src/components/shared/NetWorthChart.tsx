import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, Legend, Line, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { TimeRangeSelector, type TimeRange } from '@/components/shared/TimeRangeSelector'
import { formatDate, formatCurrency } from '@/lib/utils'
import { EmptyChartState } from '@/components/shared/EmptyChartState'
import type { IntradayPoint } from '@/features/dashboard/api'

interface NetWorthChartProps {
  data: { date: string; total: number; invested?: number }[]
  intraday?: IntradayPoint[]
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
}

function NetWorthTooltip({ active, payload, labels, is24H }: {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    payload: { date?: string; timestamp?: string; total: number; invested?: number }
  }>
  labels: { total: string; invested: string; gainLoss: string; locale: string; currency: string }
  is24H: boolean
}) {
  if (!active || !payload?.length) return null

  const totalItem = payload.find(p => p.dataKey === 'total')
  if (!totalItem) return null

  const total = totalItem.value as number
  const investedItem = payload.find(p => p.dataKey === 'invested')
  const hasInvested = investedItem != null
  const invested = hasInvested ? (investedItem.value as number) : 0
  const gainLoss = hasInvested ? total - invested : null

  const dateStr = is24H ? totalItem.payload?.timestamp : totalItem.payload?.date
  const formattedDate = is24H && dateStr
    ? new Date(dateStr).toLocaleString(labels.locale, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    : formatDate(dateStr, labels.locale)

  return (
    <div className="rounded-xl bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="mb-1.5 font-medium">{formattedDate}</div>
      <div className="flex items-center gap-2 py-0.5">
        <div
          className="h-0.5 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: 'var(--color-total)' }}
        />
        <span className="text-muted-foreground">{labels.total}</span>
        <span className="ml-auto font-mono font-medium tabular-nums">
          {formatCurrency(total, labels.currency, labels.locale)}
        </span>
      </div>
      {hasInvested && (
        <div className="flex items-center gap-2 py-0.5">
          <div
            className="h-0.5 w-4 shrink-0 border-t-2 border-dashed"
            style={{ borderColor: 'var(--color-invested)' }}
          />
          <span className="text-muted-foreground">{labels.invested}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {formatCurrency(invested, labels.currency, labels.locale)}
          </span>
        </div>
      )}
      {hasInvested && gainLoss !== null && (
        <>
          <div className="my-1.5 border-t border-border" />
          <div className="flex items-center justify-between py-0.5">
            <span className={`font-mono font-medium tabular-nums ${gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, labels.currency, labels.locale)}
            </span>
            <span className="text-muted-foreground">{labels.gainLoss}</span>
          </div>
        </>
      )}
    </div>
  )
}

function filterByRange(data: NetWorthChartProps['data'], range: TimeRange) {
  if (range === 'ALL') return data
  const now = new Date()
  let from: Date
  switch (range) {
    case '7D': from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break
    case '1M': from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
    case '3M': from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
    case 'YTD': from = new Date(now.getFullYear(), 0, 1); break
    case '1Y': from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    default: return data
  }
  return data.filter(p => new Date(p.date) >= from)
}

function getXAxisFormatter(range: TimeRange, locale: string) {
  switch (range) {
    case '24H':
      return (value: string) => {
        const d = new Date(value)
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
      }
    case '7D':
      return (value: string) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    case '1M':
    case '3M':
      return (value: string) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    default:
      return (value: string) => new Date(value).toLocaleDateString(locale, { month: 'short' })
  }
}

export function NetWorthChart({ data, intraday = [], range, onRangeChange }: NetWorthChartProps) {
  const { t } = useTranslation()
  const locale = t('common.locale')
  const is24H = range === '24H'
  const showDots = range === '24H' || range === '7D'

  const filteredData = useMemo(() => {
    if (is24H) {
      return intraday.map(p => ({
        date: p.timestamp,
        timestamp: p.timestamp,
        total: p.total,
        invested: p.invested,
      }))
    }
    return filterByRange(data, range)
  }, [data, intraday, range, is24H])

  const xInterval = useMemo(() => {
    const len = filteredData.length
    if (len <= 8) return 0
    return Math.floor(len / 6)
  }, [filteredData.length])

  const yTickFormatter = useMemo(() => {
    const maxVal = filteredData.length ? Math.max(...filteredData.map(d => d.total)) : 0
    if (maxVal >= 1_000_000) return (v: number) => `${(v / 1_000_000).toFixed(1)}M`
    if (maxVal >= 100_000) return (v: number) => `${(v / 1_000).toFixed(0)}k`
    if (maxVal >= 10_000) return (v: number) => `${(v / 1_000).toFixed(1)}k`
    if (maxVal >= 1_000) return (v: number) => `${(v / 1_000).toFixed(2)}k`
    if (maxVal >= 100) return (v: number) => v.toFixed(0)
    return (v: number) => v.toFixed(2)
  }, [filteredData])

  const chartConfig = useMemo(() => ({
    total: {
      label: t('dashboard.netWorth'),
      color: 'var(--chart-1)',
    },
    invested: {
      label: t('dashboard.invested'),
      color: 'var(--chart-5)',
    },
  }) satisfies ChartConfig, [t])

  const labels = useMemo(() => ({
    total: t('dashboard.netWorth'),
    invested: t('dashboard.invested'),
    gainLoss: t('dashboard.gainLoss'),
    locale: t('common.locale'),
    currency: t('common.currency'),
  }), [t])

  const xAxisFormatter = useMemo(() => getXAxisFormatter(range, locale), [range, locale])

  const isEmpty24H = is24H && filteredData.length === 0

  return (
    <div>
      <div className="flex justify-end mb-3">
        <TimeRangeSelector value={range} onChange={onRangeChange} />
      </div>
      {isEmpty24H ? (
        <EmptyChartState />
      ) : (
      <ChartContainer config={chartConfig} className="h-[250px] w-full [&>div>div]:!w-full [&>div>div>svg]:!w-full">
        <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={is24H ? 'timestamp' : 'date'}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={xAxisFormatter}
          interval={xInterval}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={yTickFormatter}
          width={45}
          tickCount={5}
        />
        <ChartTooltip content={<NetWorthTooltip labels={labels} is24H={is24H} />} />
        <Area
          dataKey="total"
          type="monotone"
          fill="url(#fillTotal)"
          stroke="var(--color-total)"
          strokeWidth={2}
          dot={showDots ? { r: 3, fill: 'var(--color-total)', strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="invested"
          type="monotone"
          stroke="var(--color-invested)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          activeDot={false}
        />
        <Legend content={() => (
          <div className="flex items-center justify-center gap-5 pt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: 'var(--color-total)' }}
              />
              <span className="text-muted-foreground">{labels.total}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className="h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: 'var(--color-invested)' }}
              />
              <span className="text-muted-foreground">{labels.invested}</span>
            </div>
          </div>
        )} />
      </AreaChart>
    </ChartContainer>
      )}
    </div>
  )
}
