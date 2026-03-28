
import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, Trash2, Edit2, TrendingUp, TrendingDown, Wallet, Calendar as CalendarIcon, Tag, FileText, ChevronDown, X } from 'lucide-react';
import { FinanceRecord, FinanceType, FinanceCategory, Activity } from '../../types';

interface FinanceManagerProps {
  activities: Activity[];
  financeRecords: FinanceRecord[];
  onAddFinanceRecord: (record: FinanceRecord) => void;
  onUpdateFinanceRecord: (record: FinanceRecord) => void;
  onDeleteFinanceRecord: (id: string | number) => void;
}

const FinanceManager: React.FC<FinanceManagerProps> = ({
  activities,
  financeRecords,
  onAddFinanceRecord,
  onUpdateFinanceRecord,
  onDeleteFinanceRecord
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<FinanceType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<Partial<FinanceRecord>>({
    type: FinanceType.INCOME,
    category: FinanceCategory.ACTIVITY_FEE,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    activity_id: ''
  });

  const categories = Object.values(FinanceCategory);

  const filteredRecords = useMemo(() => {
    return financeRecords.filter(record => {
      const matchesSearch = record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || record.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || record.category === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [financeRecords, searchTerm, typeFilter, categoryFilter]);

  const stats = useMemo(() => {
    const income = financeRecords
      .filter(r => r.type === FinanceType.INCOME)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const expense = financeRecords
      .filter(r => r.type === FinanceType.EXPENSE)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    return { income, expense, balance: income - expense };
  }, [financeRecords]);

  const handleOpenModal = (record?: FinanceRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData(record);
    } else {
      setEditingRecord(null);
      setFormData({
        type: FinanceType.INCOME,
        category: FinanceCategory.ACTIVITY_FEE,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: '',
        activity_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      onUpdateFinanceRecord({ ...editingRecord, ...formData } as FinanceRecord);
    } else {
      onAddFinanceRecord({ ...formData, id: Date.now() } as FinanceRecord);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收支管理</h1>
          <p className="text-gray-500 text-sm">記錄與追蹤分會的所有財務收支狀況</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>新增收支紀錄</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">總收入</p>
            <p className="text-2xl font-bold text-green-600">${stats.income.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">總支出</p>
            <p className="text-2xl font-bold text-red-600">${stats.expense.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">目前餘額</p>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              ${stats.balance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜尋描述或類別..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">所有類型</option>
            <option value={FinanceType.INCOME}>收入</option>
            <option value={FinanceType.EXPENSE}>支出</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">所有類別</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">日期</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">類別</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">描述</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">金額</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarIcon size={14} className="text-gray-400" />
                        {record.date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.type === FinanceType.INCOME ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {record.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">{record.description}</div>
                      {record.activity_id && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          關聯活動: {activities.find(a => String(a.id) === String(record.activity_id))?.title || '未知活動'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${
                        record.type === FinanceType.INCOME ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {record.type === FinanceType.INCOME ? '+' : '-'}${Number(record.amount).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(record)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('確定要刪除此筆紀錄嗎？')) {
                              onDeleteFinanceRecord(record.id);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={48} className="text-gray-200" />
                      <p>尚無收支紀錄</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                {editingRecord ? '編輯收支紀錄' : '新增收支紀錄'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">類型</label>
                  <div className="flex p-1 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: FinanceType.INCOME })}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        formData.type === FinanceType.INCOME ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      收入
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: FinanceType.EXPENSE })}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        formData.type === FinanceType.EXPENSE ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      支出
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">日期</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">類別</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">金額</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">描述</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                  placeholder="請輸入收支說明..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">關聯活動 (選填)</label>
                <select
                  value={formData.activity_id || ''}
                  onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">無關聯活動</option>
                  {activities.map(act => (
                    <option key={act.id} value={act.id}>{act.title}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                >
                  {editingRecord ? '儲存修改' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceManager;
