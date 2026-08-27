import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileDown, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { FinanceRecord, FinanceType } from '../../types';

interface Props {
  financeRecords: FinanceRecord[];
}

// 期初餘額 = 系統開始記帳前的結存。目前實際做法是把「26屆3月份結轉」
// 當成一筆收入輸入在 2026-04-01，所以這個值要保持 0，否則會重複計算。
const OPENING_KEY = 'finance_opening_balance';

const money = (n: number) => `NT$ ${Math.round(n).toLocaleString('zh-TW')}`;

const taipeiToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const FinanceMonthlyReport: React.FC<Props> = ({ financeRecords }) => {
  const today = taipeiToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [opening, setOpening] = useState(0);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingDraft, setOpeningDraft] = useState('0');

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', OPENING_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const v = Number(data?.value ?? 0);
        setOpening(Number.isFinite(v) ? v : 0);
        setOpeningDraft(String(Number.isFinite(v) ? v : 0));
      });
  }, []);

  async function saveOpening() {
    const v = Number(openingDraft) || 0;
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: OPENING_KEY, value: String(v), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (error) {
      alert('儲存失敗：' + error.message);
      return;
    }
    setOpening(v);
    setEditingOpening(false);
  }

  const ym = `${year}-${String(month).padStart(2, '0')}`;

  // 日期一律用 'YYYY-MM-DD' 字串比對，不進 Date 物件（避免被當 UTC 而差一天）
  const report = useMemo(() => {
    const amt = (r: FinanceRecord) => Number(r.amount) || 0;
    const inMonth = financeRecords.filter(r => String(r.date ?? '').slice(0, 7) === ym);
    const before = financeRecords.filter(r => String(r.date ?? '').slice(0, 7) < ym);

    const sum = (rows: FinanceRecord[], t: FinanceType) =>
      rows.filter(r => r.type === t).reduce((s, r) => s + amt(r), 0);

    const income = sum(inMonth, FinanceType.INCOME);
    const expense = sum(inMonth, FinanceType.EXPENSE);
    const carryIn = opening + sum(before, FinanceType.INCOME) - sum(before, FinanceType.EXPENSE);

    // 分類明細
    const byCat = (t: FinanceType) => {
      const map = new Map<string, { amount: number; count: number }>();
      inMonth
        .filter(r => r.type === t)
        .forEach(r => {
          const k = r.category || '其他';
          const prev = map.get(k) ?? { amount: 0, count: 0 };
          prev.amount += amt(r);
          prev.count += 1;
          map.set(k, prev);
        });
      return Array.from(map.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.amount - a.amount);
    };

    return {
      rows: [...inMonth].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      income,
      expense,
      net: income - expense,
      carryIn,
      closing: carryIn + income - expense,
      incomeByCat: byCat(FinanceType.INCOME),
      expenseByCat: byCat(FinanceType.EXPENSE),
    };
  }, [financeRecords, ym, opening]);

  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  function exportCsv() {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = ['﻿' + `${year} 年 ${month} 月 收支月報表`];
    lines.push('');
    lines.push(['項目', '金額'].join(','));
    lines.push(['上月結轉', report.carryIn].join(','));
    lines.push(['本月收入', report.income].join(','));
    lines.push(['本月支出', report.expense].join(','));
    lines.push(['本月淨額', report.net].join(','));
    lines.push(['月底結餘', report.closing].join(','));
    lines.push('');
    lines.push(['收入分類', '筆數', '金額'].join(','));
    report.incomeByCat.forEach(c => lines.push([esc(c.category), c.count, c.amount].join(',')));
    lines.push('');
    lines.push(['支出分類', '筆數', '金額'].join(','));
    report.expenseByCat.forEach(c => lines.push([esc(c.category), c.count, c.amount].join(',')));
    lines.push('');
    lines.push(['日期', '收支', '分類', '金額', '摘要'].join(','));
    report.rows.forEach(r =>
      lines.push(
        [
          r.date,
          r.type === FinanceType.INCOME ? '收入' : '支出',
          esc(r.category),
          Number(r.amount) || 0,
          esc(r.description),
        ].join(',')
      )
    );

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ym}_收支月報表.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const CatTable: React.FC<{ title: string; rows: typeof report.incomeByCat; total: number; color: string }> = ({
    title,
    rows,
    total,
    color,
  }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <span className="font-bold text-gray-700 text-sm">{title}</span>
        <span className={`font-bold ${color}`}>{money(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-gray-300 text-sm">本月沒有資料</p>
      ) : (
        <table className="w-full text-left">
          <tbody className="divide-y divide-gray-50">
            {rows.map(c => {
              const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
              return (
                <tr key={c.category}>
                  <td className="px-5 py-3">
                    <div className="font-bold text-sm text-gray-800">{c.category}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden w-40">
                      <div
                        className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{c.count} 筆</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <div className="font-bold text-gray-800">{money(c.amount)}</div>
                    <div className="text-[11px] text-gray-400">{pct}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 月份切換 */}
      <div className="flex items-center justify-between bg-white rounded-xl border p-3">
        <button onClick={() => goMonth(-1)} aria-label="上個月" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {year} 年 {month} 月
          </h2>
          <button
            onClick={() => {
              setYear(Number(today.slice(0, 4)));
              setMonth(Number(today.slice(5, 7)));
            }}
            className="text-xs font-bold text-red-600 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50"
          >
            本月
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 border px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            <FileDown size={14} /> 匯出
          </button>
        </div>
        <button onClick={() => goMonth(1)} aria-label="下個月" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 結轉 → 收支 → 結餘 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">上月結轉</div>
          <div className="text-xl font-bold text-gray-700">{money(report.carryIn)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-600 font-bold uppercase">本月收入</div>
          <div className="text-xl font-bold text-green-700">{money(report.income)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="text-xs text-red-600 font-bold uppercase">本月支出</div>
          <div className="text-xl font-bold text-red-700">{money(report.expense)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-600 font-bold uppercase">月底結餘</div>
          <div className="text-xl font-bold text-blue-700">{money(report.closing)}</div>
          <p className={`text-[11px] mt-1 font-bold ${report.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            本月淨額 {report.net >= 0 ? '+' : ''}
            {money(report.net)}
          </p>
        </div>
      </div>

      {/* 期初餘額設定 */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-500">
          期初餘額（系統開始記帳前的結存）：
        </span>
        {editingOpening ? (
          <>
            <input
              type="number"
              value={openingDraft}
              onChange={e => setOpeningDraft(e.target.value)}
              className="border rounded-lg px-3 py-1.5 w-40 outline-none focus:ring-2 focus:ring-red-500"
            />
            <button onClick={saveOpening} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg" title="儲存">
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setEditingOpening(false);
                setOpeningDraft(String(opening));
              }}
              className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-lg"
              title="取消"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <span className="font-bold text-gray-800">{money(opening)}</span>
            <button
              onClick={() => setEditingOpening(true)}
              className="text-gray-400 hover:text-blue-600 p-1 rounded"
              title="修改"
            >
              <Pencil size={14} />
            </button>
          </>
        )}
        <span className="text-[11px] text-gray-400 w-full">
          兩種做法擇一，不要同時用：①把「上月結轉」當成一筆收入輸入在流水帳（目前採用這種，這裡請維持 0）；
          ②流水帳只放實際收支，結存填在這裡。兩個都做會重複計算，結餘就會多一倍。
        </span>
      </div>

      {/* 分類明細 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CatTable title="收入分類" rows={report.incomeByCat} total={report.income} color="text-green-600" />
        <CatTable title="支出分類" rows={report.expenseByCat} total={report.expense} color="text-red-600" />
      </div>

      {/* 本月明細 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 font-bold text-gray-700 text-sm">
          本月明細（{report.rows.length} 筆）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase">
                <th className="px-5 py-3">日期</th>
                <th className="px-5 py-3">分類</th>
                <th className="px-5 py-3">摘要</th>
                <th className="px-5 py-3 text-right">收入</th>
                <th className="px-5 py-3 text-right">支出</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{r.date}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{r.description}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600 whitespace-nowrap">
                    {r.type === FinanceType.INCOME ? money(Number(r.amount)) : ''}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-red-600 whitespace-nowrap">
                    {r.type === FinanceType.EXPENSE ? money(Number(r.amount)) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.rows.length === 0 && (
            <p className="p-10 text-center text-gray-400">這個月沒有收支紀錄</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceMonthlyReport;
