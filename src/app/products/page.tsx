'use client'

import { useEffect, useState } from 'react'

type Product = {
  id: string
  name: string
  active: boolean
  sort_order: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await fetch('/api/products')
    setProducts(await res.json())
  }

  useEffect(() => { load() }, [])

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    setNewName('')
    await load()
    setLoading(false)
  }

  async function saveEdit(id: string) {
    await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    setEditId(null)
    await load()
  }

  async function toggleActive(product: Product) {
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    })
    await load()
  }

  async function deleteProduct(id: string) {
    if (!confirm('この商品を削除しますか？（関連する在庫データも削除されます）')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">商品マスタ管理</h1>

      <form onSubmit={addProduct} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="商品名を入力"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
        >
          追加
        </button>
      </form>

      <div className="space-y-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            {editId === p.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(p.id)}
                  autoFocus
                />
                <button
                  onClick={() => saveEdit(p.id)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm"
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-gray-800 dark:text-gray-100 ${!p.active ? 'line-through opacity-50' : ''}`}>
                  {p.name}
                </span>
                <button
                  onClick={() => { setEditId(p.id); setEditName(p.name) }}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded text-sm"
                >
                  編集
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className={`px-3 py-1 rounded text-sm text-white ${p.active ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {p.active ? '無効化' : '有効化'}
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  削除
                </button>
              </>
            )}
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">商品がまだ登録されていません</p>
        )}
      </div>
    </div>
  )
}
