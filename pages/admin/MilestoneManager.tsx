
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, Calendar, Tag, Loader2, UploadCloud, X } from 'lucide-react';
import { Milestone, MilestoneType } from '../../types';

interface MilestoneManagerProps {
  milestones: Milestone[];
  onAddMilestone: (milestone: Milestone) => void;
  onUpdateMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (id: string | number) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const MilestoneManager: React.FC<MilestoneManagerProps> = ({
  milestones,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onUploadImage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [milestoneImage, setMilestoneImage] = useState('');
  const [milestoneImages, setMilestoneImages] = useState<string[]>([]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await onUploadImage(file);
        setMilestoneImage(url);
      } catch (error: any) {
        console.error('Upload error:', error);
        alert('圖片上傳失敗: ' + (error.message || '請檢查 Supabase Storage 權限設定'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleAddMoreImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        const newUrls = [];
        for (let i = 0; i < files.length; i++) {
          const url = await onUploadImage(files[i]);
          newUrls.push(url);
        }
        setMilestoneImages(prev => [...prev, ...newUrls]);
      } catch (error: any) {
        console.error('Upload error:', error);
        alert('部分圖片上傳失敗: ' + (error.message || '請檢查 Supabase Storage 權限設定'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setMilestoneImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const milestoneData: any = {
      type: formData.get('type') as MilestoneType,
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      image_url: milestoneImage,
      images: milestoneImages,
      description: formData.get('description') as string,
    };

    if (editingMilestone) {
      onUpdateMilestone({ ...editingMilestone, ...milestoneData });
    } else {
      onAddMilestone(milestoneData);
    }
    setIsModalOpen(false);
    setEditingMilestone(null);
    setMilestoneImage('');
    setMilestoneImages([]);
  };

  const handleOpenModal = (milestone?: Milestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneImage(milestone.image_url);
      setMilestoneImages(milestone.images || []);
    } else {
      setEditingMilestone(null);
      setMilestoneImage('');
      setMilestoneImages([]);
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">大事記管理</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 transition-colors"
        >
          <Plus size={20} />
          新增大事記
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="relative aspect-video bg-gray-100">
              {milestone.image_url ? (
                <img src={milestone.image_url} alt={milestone.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImageIcon size={48} />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenModal(milestone)}
                  className="p-2 bg-white/90 text-gray-600 rounded-lg hover:text-red-600 transition-colors shadow-sm"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => { if (confirm('確定要刪除這筆大事記嗎？')) onDeleteMilestone(milestone.id); }}
                  className="p-2 bg-white/90 text-gray-600 rounded-lg hover:text-red-600 transition-colors shadow-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="absolute bottom-2 left-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  milestone.type === MilestoneType.AWARD ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {milestone.type}
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <Calendar size={12} />
                {milestone.date}
              </div>
              <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{milestone.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{milestone.description}</p>
            </div>
          </div>
        ))}
      </div>

      {milestones.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-20 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
            <ImageIcon size={32} />
          </div>
          <p className="text-gray-400 font-bold">目前尚無大事記資料</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingMilestone ? '修改大事記' : '新增大事記'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">類型</label>
                  <select
                    name="type"
                    defaultValue={editingMilestone?.type || MilestoneType.ACTIVITY}
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value={MilestoneType.ACTIVITY}>活動剪影</option>
                    <option value={MilestoneType.AWARD}>得獎紀錄</option>
                    <option value={MilestoneType.OTHER}>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">標題</label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingMilestone?.title}
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="例如：2024 年度頒獎典禮"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">日期</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={editingMilestone?.date}
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">封面圖片</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      {milestoneImage ? (
                        <img src={milestoneImage} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="milestone-image-upload"
                        />
                        <label
                          htmlFor="milestone-image-upload"
                          className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-red-300 hover:text-red-600 cursor-pointer transition-all"
                        >
                          {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                          {isUploading ? '上傳中...' : '更換封面圖片'}
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">這將作為大事記列表的主圖</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">更多照片 (點進去可看)</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {milestoneImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <div className="relative aspect-square">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddMoreImages}
                        className="hidden"
                        id="milestone-more-images-upload"
                      />
                      <label
                        htmlFor="milestone-more-images-upload"
                        className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-red-300 hover:text-red-600 cursor-pointer transition-all"
                      >
                        <Plus size={20} />
                        <span className="text-[10px] mt-1">新增</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">描述</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingMilestone?.description}
                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="請輸入簡短描述..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {editingMilestone ? '儲存修改' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneManager;
