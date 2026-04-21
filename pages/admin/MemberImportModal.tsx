import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { Member } from '../../types';

interface MemberImportModalProps {
  existingMembers: Member[];
  onClose: () => void;
  onImport: (toAdd: Member[], toUpdate: Member[]) => Promise<void>;
}

// 範本檔案的欄位順序（與 CSV 匯出格式對齊）
const TEMPLATE_HEADERS = [
  '會員編號',     // member_no (必填)
  '組別',         // group_name
  '產業鏈',       // industry_chain (必填，必須是 5 選 1)
  '行業別',       // industry_category (必填)
  '姓名',         // name (必填)
  '公司名稱',     // company (必填)
  '公司抬頭',     // company_title
  '統一編號',     // tax_id
  '手機號碼',     // mobile_phone
  '室內電話',     // landline
  '地址',         // address
  '會員簡介',     // intro
  '網站連結',     // website
  '狀態',         // status: 活躍 / 停權/離會
  '入會日期',     // join_date YYYY-MM-DD
  '會籍到期日',   // end_date YYYY-MM-DD
  '生日',         // birthday YYYY-MM-DD
];

const VALID_CHAINS = ['美食', '工程', '健康', '幸福', '工商'];

interface ParsedRow {
  rowIndex: number;          // 原始 Excel 列號 (從 2 開始，1 是表頭)
  data: Partial<Member>;
  errors: string[];
  action: 'add' | 'update' | 'error';
  existingMember?: Member;   // 如果 action=update，這是被覆蓋的舊資料
}

/** 把 Excel 序列化的日期數字或字串轉成 YYYY-MM-DD */
const normalizeDate = (val: any): string => {
  if (!val) return '';
  // Excel 的日期可能是 number (序列日期)、Date 物件、或字串
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Excel 1900 epoch
    const date = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // 字串：嘗試解析常見格式
  const str = String(val).trim();
  if (!str) return '';
  // 已經是 YYYY-MM-DD 或 YYYY/MM/DD
  const m1 = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
  }
  return str; // 保留原樣，讓後續驗證去處理
};

const isValidDate = (str: string): boolean => {
  if (!str) return true; // 空值 OK（選填欄位）
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
};

const MemberImportModal: React.FC<MemberImportModalProps> = ({ existingMembers, onClose, onImport }) => {
  const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'done'>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [importedCount, setImportedCount] = useState({ added: 0, updated: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 動態載入 SheetJS（不打進主 bundle）
  const loadXLSX = async () => {
    // @ts-ignore - URL import resolved at runtime, no types needed
    const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/xlsx@0.18.5');
    return mod;
  };

  const downloadTemplate = async () => {
    setIsLoading(true);
    try {
      const XLSX = await loadXLSX();
      // 範例資料：示範如何填寫各種欄位
      const sample = [
        TEMPLATE_HEADERS,
        [
          '001', '第1組', '工商', '網站設計業', '王大明', '範例設計工作室',
          '範例設計有限公司', '12345678', '0912-345-678', '02-2345-6789',
          '台北市信義區信義路五段7號', '專業形象設計，幫品牌說好故事', 'https://example.com',
          '活躍', '2023-01-15', '2026-12-31', '1985-03-20',
        ],
        [
          '002', '第2組', '美食', '咖啡業', '陳小華', '小華咖啡',
          '', '', '0987-654-321', '', '', '手沖精品咖啡', '',
          '活躍', '2024-06-01', '2027-05-31', '1990-08-12',
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sample);
      // 設定欄寬，視覺友善
      ws['!cols'] = [
        { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 18 },
        { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 30 },
        { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '會員名單');
      XLSX.writeFile(wb, '會員批次匯入_範本.xlsx');
    } catch (e: any) {
      alert('範本下載失敗：' + (e.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setGlobalError('');
    setIsLoading(true);

    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // header: 1 → 回傳純陣列，第 0 列是表頭
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      if (rows.length < 2) {
        setGlobalError('檔案沒有資料列（除了表頭以外）');
        setIsLoading(false);
        return;
      }

      // 表頭驗證：檢查必填欄位都在
      const headerRow = rows[0].map(h => String(h || '').trim());
      const requiredHeaders = ['會員編號', '產業鏈', '行業別', '姓名', '公司名稱'];
      const missingHeaders = requiredHeaders.filter(h => !headerRow.includes(h));
      if (missingHeaders.length > 0) {
        setGlobalError(`檔案缺少必要欄位：${missingHeaders.join('、')}。請使用「下載範本」取得正確格式。`);
        setIsLoading(false);
        return;
      }

      // 建立欄名 → 欄索引對映（容許欄位順序不固定、容許多餘欄位）
      const colMap: Record<string, number> = {};
      headerRow.forEach((h, i) => { colMap[h] = i; });
      const get = (row: any[], header: string): string => {
        const idx = colMap[header];
        if (idx === undefined) return '';
        const v = row[idx];
        return v === null || v === undefined ? '' : String(v).trim();
      };

      // 既有會員依 member_no 建索引（轉字串方便比對）
      const existingByNo = new Map<string, Member>();
      existingMembers.forEach(m => {
        if (m.member_no !== undefined && m.member_no !== null) {
          existingByNo.set(String(m.member_no).trim(), m);
        }
      });

      // 解析每一列
      const parsed: ParsedRow[] = [];
      const seenInFile = new Set<string>(); // 偵測檔案內重複的會員編號

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // 略過完全空白列
        const isEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
        if (isEmpty) continue;

        const errors: string[] = [];
        const memberNo = get(row, '會員編號');
        const name = get(row, '姓名');
        const chain = get(row, '產業鏈');
        const category = get(row, '行業別');
        const company = get(row, '公司名稱');

        // 必填驗證
        if (!memberNo) errors.push('缺少會員編號');
        if (!name) errors.push('缺少姓名');
        if (!chain) errors.push('缺少產業鏈');
        if (!category) errors.push('缺少行業別');
        if (!company) errors.push('缺少公司名稱');

        // 產業鏈枚舉驗證
        if (chain && !VALID_CHAINS.includes(chain)) {
          errors.push(`產業鏈「${chain}」不合法（須為：${VALID_CHAINS.join('/')})`);
        }

        // 統編格式驗證（選填，但有填就要對）
        const taxId = get(row, '統一編號');
        if (taxId && !/^\d{8}$/.test(taxId)) {
          errors.push('統一編號需為 8 碼數字');
        }

        // 日期格式
        const joinDate = normalizeDate(get(row, '入會日期'));
        const endDate = normalizeDate(get(row, '會籍到期日'));
        const birthday = normalizeDate(get(row, '生日'));
        if (joinDate && !isValidDate(joinDate)) errors.push(`入會日期格式錯誤：${joinDate}`);
        if (endDate && !isValidDate(endDate)) errors.push(`會籍到期日格式錯誤：${endDate}`);
        if (birthday && !isValidDate(birthday)) errors.push(`生日格式錯誤：${birthday}`);

        // 檔案內重複編號
        if (memberNo && seenInFile.has(memberNo)) {
          errors.push(`此檔案內會員編號 ${memberNo} 重複出現`);
        }
        if (memberNo) seenInFile.add(memberNo);

        // 狀態：「停權/離會」/「離會」/「停權」/「inactive」 → inactive；其他 → active
        const statusRaw = get(row, '狀態').toLowerCase();
        const status: 'active' | 'inactive' =
          statusRaw.includes('停權') || statusRaw.includes('離會') || statusRaw === 'inactive' ? 'inactive' : 'active';

        const existing = memberNo ? existingByNo.get(memberNo) : undefined;
        const action: 'add' | 'update' | 'error' = errors.length > 0 ? 'error' : existing ? 'update' : 'add';

        // 智慧合併：如果是 update，空值不覆蓋舊值
        const mergeValue = (newVal: string, oldVal: any) => {
          return newVal !== '' ? newVal : (oldVal ?? '');
        };

        const data: Partial<Member> = existing
          ? {
              ...existing,
              // 必填一定有值，直接覆蓋
              member_no: memberNo,
              industry_chain: chain as any,
              industry_category: category,
              name,
              company,
              // 選填欄位採智慧合併
              group_name: mergeValue(get(row, '組別'), existing.group_name),
              company_title: mergeValue(get(row, '公司抬頭'), existing.company_title),
              tax_id: mergeValue(taxId, existing.tax_id),
              mobile_phone: mergeValue(get(row, '手機號碼'), existing.mobile_phone),
              landline: mergeValue(get(row, '室內電話'), existing.landline),
              address: mergeValue(get(row, '地址'), existing.address),
              intro: mergeValue(get(row, '會員簡介'), existing.intro),
              website: mergeValue(get(row, '網站連結'), existing.website),
              join_date: mergeValue(joinDate, existing.join_date),
              end_date: mergeValue(endDate, existing.end_date),
              birthday: mergeValue(birthday, existing.birthday),
              // 狀態：有填才覆蓋
              status: get(row, '狀態') ? status : existing.status,
            }
          : {
              member_no: memberNo,
              industry_chain: chain as any,
              industry_category: category,
              name,
              company,
              group_name: get(row, '組別') || undefined,
              company_title: get(row, '公司抬頭') || undefined,
              tax_id: taxId || undefined,
              mobile_phone: get(row, '手機號碼') || undefined,
              landline: get(row, '室內電話') || undefined,
              address: get(row, '地址') || undefined,
              intro: get(row, '會員簡介') || undefined,
              website: get(row, '網站連結') || undefined,
              status,
              join_date: joinDate || undefined,
              end_date: endDate || undefined,
              birthday: birthday || undefined,
            };

        parsed.push({ rowIndex: i + 1, data, errors, action, existingMember: existing });
      }

      if (parsed.length === 0) {
        setGlobalError('檔案內沒有有效的資料列');
        setIsLoading(false);
        return;
      }

      setParsedRows(parsed);
      setStep('preview');
    } catch (e: any) {
      console.error(e);
      setGlobalError('檔案解析失敗：' + (e.message || '請確認檔案是有效的 Excel 或 CSV'));
    } finally {
      setIsLoading(false);
      // 清空 input 讓使用者可以重選同一檔案
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stats = {
    add: parsedRows.filter(r => r.action === 'add').length,
    update: parsedRows.filter(r => r.action === 'update').length,
    error: parsedRows.filter(r => r.action === 'error').length,
  };

  const handleConfirmImport = async () => {
    setStep('importing');
    const toAdd = parsedRows.filter(r => r.action === 'add').map(r => r.data as Member);
    const toUpdate = parsedRows.filter(r => r.action === 'update').map(r => r.data as Member);
    try {
      await onImport(toAdd, toUpdate);
      setImportedCount({ added: toAdd.length, updated: toUpdate.length });
      setStep('done');
    } catch (e: any) {
      alert('匯入失敗：' + (e.message || e));
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">批次匯入會員資料</h2>
              <p className="text-xs text-gray-500">支援 Excel (.xlsx) 與 CSV 格式</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-blue-900 space-y-1">
                  <p className="font-bold">使用說明</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                    <li>第一次使用請先點「下載範本」取得正確的欄位格式</li>
                    <li>必填欄位：會員編號、姓名、產業鏈、行業別、公司名稱</li>
                    <li>已存在的會員編號將「智慧合併」：新欄位有值就更新，空值保留原資料</li>
                    <li>會員照片需事後在「會員管理」頁面手動上傳</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={downloadTemplate}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors font-bold text-gray-700"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                下載範本檔案
              </button>

              <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-blue-300 transition-colors">
                <UploadCloud className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-600 font-bold mb-1">選擇要匯入的檔案</p>
                <p className="text-xs text-gray-400 mb-4">支援 .xlsx、.xls、.csv</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="member-import-file"
                />
                <label
                  htmlFor="member-import-file"
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${isLoading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                  {isLoading ? '解析中...' : '選擇檔案'}
                </label>
              </div>

              {globalError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-700 font-medium">{globalError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-bold">{fileName}</span>
                  <span className="text-gray-400 ml-2">共 {parsedRows.length} 筆</span>
                </div>
                <button
                  onClick={() => { setStep('select'); setParsedRows([]); }}
                  className="text-xs text-gray-500 hover:text-red-600 font-bold"
                >
                  重新選擇檔案
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{stats.add}</div>
                  <div className="text-xs text-green-600 font-bold mt-1">新增</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{stats.update}</div>
                  <div className="text-xs text-blue-600 font-bold mt-1">更新（智慧合併）</div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{stats.error}</div>
                  <div className="text-xs text-red-600 font-bold mt-1">錯誤（將略過）</div>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr className="text-xs font-bold text-gray-500">
                        <th className="px-3 py-2 text-left">列</th>
                        <th className="px-3 py-2 text-left">動作</th>
                        <th className="px-3 py-2 text-left">編號</th>
                        <th className="px-3 py-2 text-left">姓名</th>
                        <th className="px-3 py-2 text-left">公司</th>
                        <th className="px-3 py-2 text-left">說明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parsedRows.map((r) => (
                        <tr key={r.rowIndex} className={r.action === 'error' ? 'bg-red-50/40' : ''}>
                          <td className="px-3 py-2 font-mono text-gray-400">{r.rowIndex}</td>
                          <td className="px-3 py-2">
                            {r.action === 'add' && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">新增</span>
                            )}
                            {r.action === 'update' && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">更新</span>
                            )}
                            {r.action === 'error' && (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">錯誤</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700">{r.data.member_no || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{r.data.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.data.company || '-'}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.errors.length > 0 ? (
                              <span className="text-red-600">{r.errors.join('；')}</span>
                            ) : r.action === 'update' ? (
                              <span className="text-blue-600">已存在，將合併新欄位</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="animate-spin text-blue-600 mx-auto" size={48} />
              <p className="text-gray-600 font-bold">正在匯入資料...</p>
              <p className="text-xs text-gray-400">請勿關閉視窗</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-20 text-center space-y-4">
              <CheckCircle2 className="text-green-600 mx-auto" size={56} />
              <p className="text-xl font-bold">匯入完成</p>
              <p className="text-sm text-gray-500">
                成功新增 <span className="font-bold text-green-700">{importedCount.added}</span> 筆，
                更新 <span className="font-bold text-blue-700">{importedCount.updated}</span> 筆
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-200 font-bold text-gray-600 hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={stats.add + stats.update === 0}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                確認匯入（{stats.add + stats.update} 筆）
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-800">
              完成
            </button>
          )}
          {step === 'select' && (
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-200 font-bold text-gray-600 hover:bg-gray-50">
              關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberImportModal;
