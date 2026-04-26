import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  Upload,
  Search,
  Download,
  Edit,
  Trash2,
  X,
  Loader2,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  File as FileIcon,
  Folder,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { ChapterDocument, DocumentCategory } from '../../types';

interface DocumentManagerProps {
  documents: ChapterDocument[];
  uploaderName: string;
  onAddDocument: (doc: Omit<ChapterDocument, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateDocument: (doc: ChapterDocument) => Promise<void>;
  onDeleteDocument: (doc: ChapterDocument) => Promise<void>;
  onUploadFile: (file: File) => Promise<{ filePath: string; publicUrl: string }>;
  onGetDownloadUrl: (filePath: string) => Promise<string>;
}

const CATEGORY_LIST: DocumentCategory[] = [
  '例會資料',
  '商務培訓',
  '會議記錄',
  '表單範本',
  '財務文件',
  '章程規範',
  '其他',
];

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  '例會資料': 'bg-blue-100 text-blue-700',
  '商務培訓': 'bg-purple-100 text-purple-700',
  '會議記錄': 'bg-green-100 text-green-700',
  '表單範本': 'bg-amber-100 text-amber-700',
  '財務文件': 'bg-pink-100 text-pink-700',
  '章程規範': 'bg-red-100 text-red-700',
  '其他': 'bg-gray-100 text-gray-700',
};

// 根據副檔名選 icon 與顏色
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return { Icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' };
  if (['doc', 'docx'].includes(ext)) return { Icon: FileText, color: 'text-blue-600 bg-blue-50' };
  if (['ppt', 'pptx'].includes(ext)) return { Icon: FileText, color: 'text-orange-600 bg-orange-50' };
  if (['pdf'].includes(ext)) return { Icon: FileText, color: 'text-red-600 bg-red-50' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { Icon: FileImage, color: 'text-pink-600 bg-pink-50' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: FileArchive, color: 'text-amber-600 bg-amber-50' };
  return { Icon: FileIcon, color: 'text-gray-500 bg-gray-50' };
};

const formatFileSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
};

const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  uploaderName,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onUploadFile,
  onGetDownloadUrl,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ChapterDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [downloadingId, setDownloadingId] = useState<string | number | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<DocumentCategory>('其他');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('其他');
    setFormFile(null);
    setEditingDoc(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (doc: ChapterDocument) => {
    setEditingDoc(doc);
    setFormTitle(doc.title);
    setFormDescription(doc.description || '');
    setFormCategory(doc.category);
    setFormFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isUploading) return; // 上傳中不允許關閉
    setIsModalOpen(false);
    resetForm();
  };

  const handleFileSelected = (file: File) => {
    setFormFile(file);
    // 自動帶入標題（如果沒填過）
    if (!formTitle && !editingDoc) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setFormTitle(nameWithoutExt);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('請輸入文件標題');
      return;
    }

    if (!editingDoc && !formFile) {
      alert('請選擇要上傳的檔案');
      return;
    }

    setIsUploading(true);
    try {
      if (editingDoc) {
        // 編輯：可選擇是否替換檔案
        let updatedDoc: ChapterDocument = {
          ...editingDoc,
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
        };

        if (formFile) {
          // 替換檔案
          const { filePath, publicUrl } = await onUploadFile(formFile);
          updatedDoc = {
            ...updatedDoc,
            file_name: formFile.name,
            file_path: filePath,
            file_url: publicUrl,
            file_size: formFile.size,
            file_type: formFile.type || '',
          };
        }

        await onUpdateDocument(updatedDoc);
      } else {
        // 新增
        const { filePath, publicUrl } = await onUploadFile(formFile!);
        await onAddDocument({
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          file_name: formFile!.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: formFile!.size,
          file_type: formFile!.type || '',
          uploaded_by: uploaderName,
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('文件處理失敗:', err);
      alert('上傳失敗: ' + (err.message || '請稍後再試'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: ChapterDocument) => {
    setDownloadingId(doc.id);
    try {
      const url = await onGetDownloadUrl(doc.file_path);
      // 用 a 元素觸發下載並嘗試保留原檔名
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('下載失敗:', err);
      alert('下載失敗: ' + (err.message || '請稍後再試'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (doc: ChapterDocument) => {
    if (!window.confirm(`確定要刪除文件「${doc.title}」嗎？\n\n此動作會同時刪除實體檔案，無法復原。`)) {
      return;
    }
    try {
      await onDeleteDocument(doc);
    } catch (err: any) {
      console.error('刪除失敗:', err);
      alert('刪除失敗: ' + (err.message || '請稍後再試'));
    }
  };

  // 過濾與分類統計
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter(doc => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
      if (q) {
        const haystack = [doc.title, doc.description, doc.file_name, doc.category, doc.uploaded_by]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [documents, searchQuery, categoryFilter]);

  // 各分類數量
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length };
    CATEGORY_LIST.forEach(c => { counts[c] = 0; });
    documents.forEach(d => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

  // 拖放處理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Folder className="text-red-600" size={26} />
            文件管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">上傳並管理分會的各種文件、表格、教材</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <Upload size={18} /> 上傳新文件
        </button>
      </div>

      {/* 搜尋列 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋標題、描述、檔名..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="清除搜尋"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          {searchQuery || categoryFilter !== 'all' ? (
            <>找到 <span className="font-bold text-gray-700">{filteredDocs.length}</span> 筆 / 共 {documents.length} 筆</>
          ) : (
            <>共 <span className="font-bold text-gray-700">{documents.length}</span> 份文件</>
          )}
        </div>
      </div>

      {/* 分類 tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            categoryFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          全部 <span className="ml-1 text-xs opacity-70">({categoryCounts.all || 0})</span>
        </button>
        {CATEGORY_LIST.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              categoryFilter === cat
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
            <span className="ml-1 text-xs opacity-70">({categoryCounts[cat] || 0})</span>
          </button>
        ))}
      </div>

      {/* 文件列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
              <Folder className="text-gray-300" size={32} />
            </div>
            <p className="text-gray-400 font-medium">尚未上傳任何文件</p>
            <p className="text-xs text-gray-400 mt-1">點擊右上方「上傳新文件」開始建立文件庫</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            找不到符合條件的文件
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">文件</th>
                  <th className="px-6 py-4">分類</th>
                  <th className="px-6 py-4">大小</th>
                  <th className="px-6 py-4">上傳日期</th>
                  <th className="px-6 py-4">上傳者</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDocs.map(doc => {
                  const { Icon, color } = getFileIcon(doc.file_name);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{doc.title}</p>
                            <p className="text-xs text-gray-400 truncate font-mono">{doc.file_name}</p>
                            {doc.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${CATEGORY_COLORS[doc.category]}`}>
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        <div className="flex items-center gap-1">
                          <HardDrive size={12} className="text-gray-300" />
                          {formatFileSize(doc.file_size)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-gray-300" />
                          {formatDate(doc.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {doc.uploaded_by || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            title="下載"
                          >
                            {downloadingId === doc.id
                              ? <Loader2 className="animate-spin" size={16} />
                              : <Download size={16} />
                            }
                          </button>
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="編輯"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="刪除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 上傳/編輯 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingDoc ? '編輯文件' : '上傳新文件'}</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isUploading}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 檔案上傳區 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {editingDoc ? '替換檔案 (選填)' : '選擇檔案 *'}
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-red-500 bg-red-50'
                      : formFile
                      ? 'border-green-300 bg-green-50/30'
                      : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelected(f);
                    }}
                    className="hidden"
                  />
                  {formFile ? (
                    <div className="space-y-1">
                      <div className="w-10 h-10 mx-auto rounded-lg bg-green-100 flex items-center justify-center">
                        <FileText className="text-green-600" size={20} />
                      </div>
                      <p className="font-bold text-gray-700 text-sm break-all">{formFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(formFile.size)}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-600 hover:underline mt-1"
                      >
                        移除檔案
                      </button>
                    </div>
                  ) : editingDoc ? (
                    <div className="space-y-1">
                      <Upload className="mx-auto text-gray-400" size={28} />
                      <p className="text-sm font-medium text-gray-600">點擊或拖曳檔案以替換</p>
                      <p className="text-xs text-gray-400 break-all">目前: {editingDoc.file_name}</p>
                      <p className="text-[10px] text-gray-400">不選擇檔案則只更新文字資訊</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="mx-auto text-gray-400" size={28} />
                      <p className="text-sm font-medium text-gray-600">點擊或拖曳檔案到此處</p>
                      <p className="text-xs text-gray-400">支援 PDF、Word、Excel、PPT、圖片、壓縮檔等</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 標題 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">文件標題 *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="例如：2026 年度例會議程範本"
                />
              </div>

              {/* 分類 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">分類 *</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as DocumentCategory)}
                  className="w-full border rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-red-500"
                >
                  {CATEGORY_LIST.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">說明 (選填)</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="簡述這份文件的用途或內容..."
                />
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isUploading}
                  className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      {editingDoc ? '更新中...' : '上傳中...'}
                    </>
                  ) : (
                    editingDoc ? '儲存變更' : '上傳文件'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
