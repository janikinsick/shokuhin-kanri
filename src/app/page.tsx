'use client'

import { useEffect, useState, useCallback } from 'react'

type Product = { id: string; name: string; sort_order: number; active: boolean }
type DailyCheck = {
  id: string
  check_date: string
  camera_checked_at: string | null
  memo: string | null
}
type InventoryRecord = {
  id: string
  check_id: string
  product_id: string
  delivery_qty: number
  prev_stock: number
  prev_month_carry: number
  sold_qty: number
  actual_stock: number
  products?: { name: string; sort_order: number }
}
type RowData = {
  product_id: string
  name: string
  delivery_qty: number
  prev_stock: number
  prev_month_carry: number
  sold_qty: number
  actual_stock: number
}
type MonthlyCheck = { id: string; check_date: string; camera_checked_at: string | null }
type MonthlyRecord = {
  check_id: string
  product_id: string
  delivery_qty: number
  sold_qty: number
  actual_stock: number
  prev_month_carry: number
  products?: { name: string; sort_order: number }
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function expectedStock(row: RowData) {
  return row.prev_stock + row.delivery_qty - row.sold_qty
}

export default function Home() {
  const [date, setDate] = useState(toDateString(new Date()))
  const [cameraCheckedAt, setCameraCheckedAt] = useState('')
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<RowData[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const now = new Date()
  const [monthlyYear, setMonthlyYear] = useState(now.getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(now.getMonth() + 1)
  const [monthlyChecks, setMonthlyChecks] = useState<MonthlyCheck[]>([])
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([])
  const [monthlyProducts, setMonthlyProducts] = useState<Product[]>([])

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/products')
    const data: Product[] = await res.json()
    return data.filter((p) => p.active)
  }, [])

  const loadForDate = useCallback(async (selectedDate: string, productList: Product[]) => {
    const checkRes = await fetch(`/api/daily-checks?date=${selectedDate}`)
    const checkData: DailyCheck | null = await checkRes.json()
    setCameraCheckedAt(checkData?.camera_checked_at ? checkData.camera_checked_at.slice(0, 16) : '')
    setMemo(checkData?.memo ?? '')

    const prevDate = toDateString(new Date(new Date(selectedDate).getTime() - 86400000))
    const prevCheckRes = await fetch(`/api/daily-checks?date=${prevDate}`)
    const prevCheck: DailyCheck | null = await prevCheckRes.json()

    let prevRecords: InventoryRecord[] = []
    if (prevCheck) {
      const prevInvRes = await fetch(`/api/inventory?check_id=${prevCheck.id}`)
      prevRecords = await prevInvRes.json()
    }

    let currentRecords: InventoryRecord[] = []
    if (checkData) {
      const invRes = await fetch(`/api/inventory?check_id=${checkData.id}`)
      currentRecords = await invRes.json()
    }

    const newRows: RowData[] = productList.map((p) => {
      const cur = currentRecords.find((r) => r.product_id === p.id)
      const prev = prevRecords.find((r) => r.product_id === p.id)
      return {
        product_id: p.id,
        name: p.name,
        delivery_qty: cur?.delivery_qty ?? 0,
        prev_stock: cur?.prev_stock ?? prev?.actual_stock ?? 0,
        prev_month_carry: cur?.prev_month_carry ?? 0,
        sold_qty: cur?.sold_qty ?? 0,
        actual_stock: cur?.actual_stock ?? 0,
      }
    })
    setRows(newRows)
  }, [])

  const loadMonthlySummary = useCallback(async (year: number, month: number) => {
    const [summaryRes, prodsRes] = await Promise.all([
      fetch(`/api/monthly-summary?year=${year}&month=${month}`),
      fetch('/api/products'),
    ])
    const summary = await summaryRes.json()
    const prods: Product[] = await prodsRes.json()
    setMonthlyChecks(summary.checks ?? [])
    setMonthlyRecords(summary.records ?? [])
    setMonthlyProducts(prods.filter((p) => p.active))
  }, [])

  useEffect(() => {
    loadProducts().then((prods) => loadForDate(date, prods))
    loadMonthlySummary(monthlyYear, monthlyMonth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDateChange(newDate: string) {
    setSavedAt(null)
    setDate(newDate)
    const prods = await loadProducts()
    await loadForDate(newDate, prods)
  }

  function updateRow(productId: string, field: keyof RowData, value: number) {
    setRows((prev) =>
      prev.map((r) => (r.product_id === productId ? { ...r, [field]: value } : r))
    )
  }

  async function save() {
    setSaving(true)
    setSavedAt(null)

    const checkRes = await fetch('/api/daily-checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        check_date: date,
        camera_checked_at: cameraCheckedAt ? new Date(cameraCheckedAt).toISOString() : null,
        memo: memo || null,
      }),
    })
    const savedCheck: DailyCheck = await checkRes.json()

    await Promise.all(
      rows.map((r) =>
        fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_id: savedCheck.id,
            product_id: r.product_id,
            delivery_qty: r.delivery_qty,
            prev_stock: r.prev_stock,
            prev_month_carry: r.prev_month_carry,
            sold_qty: r.sold_qty,
            actual_stock: r.actual_stock,
          }),
        })
      )
    )

    setSaving(false)
    setSavedAt(new Date().toLocaleTimeString('ja-JP'))
  }

  const totPrev = rows.reduce((s, r) => s + r.prev_stock, 0)
  const totPrevMonthCarry = rows.reduce((s, r) => s + r.prev_month_carry, 0)
  const totDelivery = rows.reduce((s, r) => s + r.delivery_qty, 0)
  const totSold = rows.reduce((s, r) => s + r.sold_qty, 0)
  const totActual = rows.reduce((s, r) => s + r.actual_stock, 0)
  const totExpected = rows.reduce((s, r) => s + expectedStock(r), 0)
  const totalMismatch = rows.length > 0 && totActual !== totExpected

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">日次在庫チェック</h1>

      {/* 日付・カメラチェック */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            監視カメラ確認日時
          </label>
          <input
            type="datetime-local"
            value={cameraCheckedAt}
            onChange={(e) => setCameraCheckedAt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">メモ</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="備考など"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 在庫テーブル */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">商品名</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">前月繰越数</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">前日在庫</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">納品数</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">販売数</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">実在庫</th>
              <th className="text-center px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">差異</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => {
              const exp = expectedStock(r)
              const mismatch = r.actual_stock !== exp
              return (
                <tr key={r.product_id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-100 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-center">
                    <NumInput value={r.prev_month_carry} onChange={(v) => updateRow(r.product_id, 'prev_month_carry', v)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumInput value={r.prev_stock} onChange={(v) => updateRow(r.product_id, 'prev_stock', v)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumInput value={r.delivery_qty} onChange={(v) => updateRow(r.product_id, 'delivery_qty', v)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumInput value={r.sold_qty} onChange={(v) => updateRow(r.product_id, 'sold_qty', v)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumInput
                      value={r.actual_stock}
                      onChange={(v) => updateRow(r.product_id, 'actual_stock', v)}
                      error={mismatch}
                    />
                  </td>
                  <td className={`px-3 py-2 text-center font-semibold ${mismatch ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {mismatch ? `${r.actual_stock - exp > 0 ? '+' : ''}${r.actual_stock - exp}` : '一致'}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 dark:text-gray-500">
                  商品が登録されていません。先に「商品管理」から商品を追加してください。
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">合計</td>
                <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200">{totPrevMonthCarry}</td>
                <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200">{totPrev}</td>
                <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200">{totDelivery}</td>
                <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200">{totSold}</td>
                <td className={`px-3 py-3 text-center font-bold ${totalMismatch ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                  {totActual}
                </td>
                <td className={`px-3 py-3 text-center font-bold ${totalMismatch ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {totalMismatch ? `${totActual - totExpected > 0 ? '+' : ''}${totActual - totExpected}` : '一致'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 保存ボタン */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving || rows.length === 0}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
        {savedAt && (
          <span className="text-green-600 dark:text-green-400 text-sm">{savedAt} に保存しました</span>
        )}
      </div>

      {/* 月次集計 */}
      <MonthlySummary
        year={monthlyYear}
        month={monthlyMonth}
        checks={monthlyChecks}
        records={monthlyRecords}
        products={monthlyProducts}
        onChangeMonth={(y, m) => {
          setMonthlyYear(y)
          setMonthlyMonth(m)
          loadMonthlySummary(y, m)
        }}
        onImported={() => loadMonthlySummary(monthlyYear, monthlyMonth)}
      />
    </div>
  )
}

function exportCsv(year: number, month: number, checks: MonthlyCheck[], records: MonthlyRecord[], products: Product[]) {
  const sorted = [...products].sort((a, b) => a.sort_order - b.sort_order)
  const cols = checks.map((c) => c.check_date.slice(5).replace('-', '/'))

  const header = ['商品名', '前回繰越数', ...cols, '合計納品数', '合計販売数', '在庫数']
  const rows: string[][] = sorted.map((p) => {
    const checkIdMap: Record<string, MonthlyRecord> = {}
    for (const r of records) {
      if (r.product_id === p.id) checkIdMap[r.check_id] = r
    }
    const prevMonthCarry = checks[0] ? (checkIdMap[checks[0].id]?.prev_month_carry ?? 0) : 0
    const dailyCols = checks.map((c) => String(checkIdMap[c.id]?.delivery_qty ?? 0))
    const totalDelivery = checks.reduce((s, c) => s + (checkIdMap[c.id]?.delivery_qty ?? 0), 0)
    const totalSold = checks.reduce((s, c) => s + (checkIdMap[c.id]?.sold_qty ?? 0), 0)
    const lastCheck = checks[checks.length - 1]
    const stock = lastCheck ? (checkIdMap[lastCheck.id]?.actual_stock ?? 0) : 0
    return [p.name, String(prevMonthCarry), ...dailyCols, String(totalDelivery), String(totalSold), String(stock)]
  })

  const totalRow = [
    '合計',
    String(records.filter((r) => checks[0] && r.check_id === checks[0].id).reduce((s, r) => s + (r.prev_month_carry ?? 0), 0)),
    ...checks.map((c) => String(records.filter((r) => r.check_id === c.id).reduce((s, r) => s + r.delivery_qty, 0))),
    String(records.reduce((s, r) => s + r.delivery_qty, 0)),
    String(records.reduce((s, r) => s + r.sold_qty, 0)),
    String((() => { const lc = checks[checks.length - 1]; return lc ? records.filter((r) => r.check_id === lc.id).reduce((s, r) => s + r.actual_stock, 0) : 0 })()),
  ]

  const cameraRow = [
    '',
    '',
    ...checks.map((c) => c.camera_checked_at ? new Date(c.camera_checked_at).toLocaleString('ja-JP') : ''),
    '', '', '',
  ]

  const csvContent = [header, ...rows, totalRow, cameraRow]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  const bom = '﻿'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `在庫シート_${year}年${month}月度.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function MonthlySummary({
  year,
  month,
  checks,
  records,
  products,
  onChangeMonth,
  onImported,
}: {
  year: number
  month: number
  checks: MonthlyCheck[]
  records: MonthlyRecord[]
  products: Product[]
  onChangeMonth: (y: number, m: number) => void
  onImported: () => void
}) {
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const sorted = [...products].sort((a, b) => a.sort_order - b.sort_order)

  function prevMonth() {
    if (month === 1) onChangeMonth(year - 1, 12)
    else onChangeMonth(year, month - 1)
  }
  function nextMonth() {
    if (month === 12) onChangeMonth(year + 1, 1)
    else onChangeMonth(year, month + 1)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    const text = await file.text()
    const res = await fetch('/api/csv-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, csv: text }),
    })
    const data = await res.json()
    setImporting(false)
    e.target.value = ''
    if (data.ok) {
      setImportMsg(`インポート完了（${data.dates.length}日分）`)
      onImported()
    } else {
      setImportMsg(`エラー: ${data.error}`)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">月次集計</h2>
        <button onClick={prevMonth} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">◀</button>
        <span className="font-semibold text-gray-700 dark:text-gray-200">{year}年{month}月</span>
        <button onClick={nextMonth} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">▶</button>
        <button
          onClick={() => exportCsv(year, month, checks, records, products)}
          disabled={checks.length === 0}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          CSVエクスポート
        </button>
        <label className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${importing ? 'bg-gray-400 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
          {importing ? 'インポート中...' : 'CSVインポート'}
          <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
        {importMsg && <span className="text-sm text-gray-600 dark:text-gray-400">{importMsg}</span>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="text-xs border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 text-left px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-200 dark:border-gray-600 min-w-36">商品名</th>
              <th className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">前回繰越数</th>
              {checks.map((c) => (
                <th key={c.id} className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                  {c.check_date.slice(5).replace('-', '/')}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">合計納品数</th>
              <th className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">合計販売数</th>
              <th className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold whitespace-nowrap">在庫数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((p) => {
              const checkIdMap: Record<string, MonthlyRecord> = {}
              for (const r of records) {
                if (r.product_id === p.id) checkIdMap[r.check_id] = r
              }
              const totalDelivery = checks.reduce((s, c) => s + (checkIdMap[c.id]?.delivery_qty ?? 0), 0)
              const totalSold = checks.reduce((s, c) => s + (checkIdMap[c.id]?.sold_qty ?? 0), 0)
              const lastCheck = checks[checks.length - 1]
              const stock = lastCheck ? (checkIdMap[lastCheck.id]?.actual_stock ?? 0) : 0
              const prevMonthCarry = checks[0] ? (checkIdMap[checks[0].id]?.prev_month_carry ?? 0) : 0

              return (
                <tr key={p.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-800 dark:text-gray-100 font-medium border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">{p.name}</td>
                  <td className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">{prevMonthCarry || ''}</td>
                  {checks.map((c) => {
                    const qty = checkIdMap[c.id]?.delivery_qty ?? 0
                    return (
                      <td key={c.id} className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                        {qty || ''}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-center font-semibold text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">{totalDelivery || ''}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">{totalSold || ''}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-gray-800 dark:text-gray-100">{stock || ''}</td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4 + checks.length} className="text-center py-6 text-gray-400 dark:text-gray-500">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-3 py-2 font-bold text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">合計</td>
                <td className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600">
                  {records.filter((r) => checks[0] && r.check_id === checks[0].id).reduce((s, r) => s + (r.prev_month_carry ?? 0), 0) || ''}
                </td>
                {checks.map((c) => {
                  const dayTotal = records.filter((r) => r.check_id === c.id).reduce((s, r) => s + r.delivery_qty, 0)
                  return (
                    <td key={c.id} className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600">
                      {dayTotal || ''}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600">
                  {records.reduce((s, r) => s + r.delivery_qty, 0) || ''}
                </td>
                <td className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600">
                  {records.reduce((s, r) => s + r.sold_qty, 0) || ''}
                </td>
                <td className="px-2 py-2 text-center font-bold text-gray-700 dark:text-gray-200">
                  {(() => {
                    const lastCheck = checks[checks.length - 1]
                    if (!lastCheck) return ''
                    const tot = records.filter((r) => r.check_id === lastCheck.id).reduce((s, r) => s + r.actual_stock, 0)
                    return tot || ''
                  })()}
                </td>
              </tr>
              <tr>
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600">カメラ確認</td>
                <td className="border-r border-gray-200 dark:border-gray-600" />
                {checks.map((c) => (
                  <td key={c.id} className="px-1 py-1.5 text-center text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                    {c.camera_checked_at
                      ? new Date(c.camera_checked_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </td>
                ))}
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function NumInput({
  value,
  onChange,
  error,
}: {
  value: number
  onChange: (v: number) => void
  error?: boolean
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`w-20 px-2 py-1 text-center border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error
          ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          : 'border-gray-300 dark:border-gray-600'
      }`}
    />
  )
}
