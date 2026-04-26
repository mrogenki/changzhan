import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Home from './pages/Home';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import MemberList from './pages/MemberList';
import Milestones from './pages/Milestones';
import RegularMeeting from './pages/RegularMeeting';
import BusinessTraining from './pages/BusinessTraining';
import CoffeeMeeting from './pages/CoffeeMeeting';
import LiffCheckin from './pages/LiffCheckin';
import { Activity, ActivityType, Registration, AdminUser, Member, AttendanceRecord, AttendanceStatus, FinanceRecord, Milestone, ChapterDocument } from './types';
import { INITIAL_ACTIVITIES, INITIAL_ADMINS, INITIAL_MEMBERS } from './constants';

const getEnv = (key: string): string | undefined => {
  try {
    return (import.meta as any)?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://qxoglhkfxxqsjefynzqn.supabase.co';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Header: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const isAdminPage = location.pathname.startsWith('/admin');

    if (isAdminPage) return null;

    return (
        <nav className="bg-white border-b sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center text-white font-bold">長</div>
                            <span className="text-xl font-bold tracking-tight">長展分會</span>
                        </Link>
                    </div>
                    <div className="hidden lg:flex items-center space-x-6">
                        <Link to="/" className="text-gray-700 hover:text-red-600 transition-colors font-medium">首頁</Link>
                        <Link to="/regular-meeting" className="text-gray-700 hover:text-red-600 transition-colors font-medium">例會活動</Link>
                        <Link to="/training" className="text-gray-700 hover:text-red-600 transition-colors font-medium">商務培訓</Link>
                        <Link to="/coffee" className="text-gray-700 hover:text-red-600 transition-colors font-medium">咖啡會議</Link>
                        <Link to="/members" className="text-gray-700 hover:text-red-600 transition-colors font-medium">產業資源</Link>
                        <Link to="/milestones" className="text-gray-700 hover:text-red-600 transition-colors font-medium">長展大事記</Link>
                        <Link to="/admin" className="text-gray-500 hover:text-gray-900 flex items-center gap-1 border border-gray-200 px-3 py-1 rounded-full text-sm font-bold">後台管理</Link>
                    </div>
                    <div className="lg:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-500 hover:text-red-600">
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="lg:hidden bg-white border-t px-4 py-3 space-y-3 shadow-lg">
                    <Link to="/" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">首頁</Link>
                    <Link to="/regular-meeting" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">例會活動</Link>
                    <Link to="/training" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">商務培訓</Link>
                    <Link to="/coffee" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">咖啡會議</Link>
                    <Link to="/members" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">產業資源</Link>
                    <Link to="/milestones" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">長展大事記</Link>
                    <Link to="/admin" onClick={() => setIsOpen(false)} className="block text-gray-500 text-sm font-bold">後台管理</Link>
                </div>
            )}
        </nav>
    );
};

const Footer: React.FC = () => {
    const location = useLocation();
    if (location.pathname.startsWith('/admin')) return null;

    return (
        <footer className="bg-white border-t py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <div className="flex justify-center items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center text-white text-xs font-bold">長</div>
                    <span className="font-bold text-gray-800 tracking-wider">BNI 長展分會</span>
                </div>
                <p className="text-gray-400 text-xs">&copy; 2026 長展分會. All rights reserved.</p>
            </div>
        </footer>
    );
};

const App: React.FC = () => {
    // ⚠️ LIFF 短路判斷:必須在所有 hooks 之前
    // 條件: path 是 /liff/checkin,或 URL 含有 LIFF 特徵參數(OAuth 重定向回來時 path 會變成 /)
    if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const search = window.location.search;
        const isLiffPath = path.startsWith('/liff/checkin');
        const hasLiffParams = search.includes('liff.state') || (search.includes('activity_id=') && search.includes('token='));
        if (isLiffPath || hasLiffParams) {
            return <LiffCheckin />;
        }
    }

    const [activities, setActivities] = useState<Activity[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [documents, setDocuments] = useState<ChapterDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
        const saved = sessionStorage.getItem('current_user');
        return saved ? JSON.parse(saved) : null;
    });

    const fetchData = async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        try {
            const { data: actData } = await supabase.from('activities').select('*').order('date', { ascending: true }).order('time', { ascending: true });
            if (actData) {
                const needsMigration = actData.some(a => a.type === '例會' || a.type === '近期活動' || a.type === '精選活動');
                if (needsMigration) {
                    const updates = actData.map(async (a) => {
                        if (a.type === '例會') {
                            return supabase.from('activities').update({ type: ActivityType.REGULAR }).eq('id', a.id);
                        }
                        if (a.type === '近期活動' || a.type === '精選活動') {
                            return supabase.from('activities').update({ type: ActivityType.SPECIAL }).eq('id', a.id);
                        }
                        return Promise.resolve();
                    });
                    await Promise.all(updates);
                    fetchData();
                    return;
                }
                const mappedActs = actData.map((a: any) => ({
                    ...a,
                    status: a.status || 'active'
                }));
                setActivities(mappedActs);
            } else if (actData && actData.length === 0) {
                const initActs = INITIAL_ACTIVITIES.map(({ id, status, ...rest }) => rest);
                const { data: inserted } = await supabase.from('activities').insert(initActs).select();
                if (inserted) {
                    const mappedInserted = inserted.map((a: any) => ({
                        ...a,
                        status: a.status || 'active'
                    }));
                    setActivities(mappedInserted);
                }
            }

            const { data: regData } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
            if (regData) setRegistrations(regData);

            const { data: userData, error: userError } = await supabase.from('admins').select('*');
            if (userData && userData.length > 0) {
                setUsers(userData);
            } else if (!userError && userData && userData.length === 0) {
                const initAdmins = INITIAL_ADMINS.map(({ id, ...rest }) => rest);
                const { data: inserted } = await supabase.from('admins').insert(initAdmins).select();
                if (inserted) setUsers(inserted);
            }

            const { data: memberData, error: memberError } = await supabase.from('members').select('*');
            if (memberData && memberData.length > 0) {
                setMembers(memberData);
            } else if (!memberError && memberData && memberData.length === 0) {
                const initMembers = INITIAL_MEMBERS.map(({ id, ...rest }) => rest);
                const { data: inserted } = await supabase.from('members').insert(initMembers).select();
                if (inserted) setMembers(inserted);
            }

            const { data: attendanceData } = await supabase.from('attendance').select('*');
            if (attendanceData) {
                setAttendance(attendanceData as AttendanceRecord[]);
            }

            const { data: financeData } = await supabase.from('finance_records').select('*').order('date', { ascending: false });
            if (financeData) {
                setFinanceRecords(financeData as FinanceRecord[]);
            }

            const { data: milestoneData } = await supabase.from('milestones').select('*').order('date', { ascending: false });
            if (milestoneData) {
                setMilestones(milestoneData as Milestone[]);
            }

            const { data: documentData } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
            if (documentData) {
                setDocuments(documentData as ChapterDocument[]);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    };

    // 局部 refresh:只重抓 attendance / registrations,不全量 fetchData
    const refreshAttendance = async () => {
        const { data } = await supabase.from('attendance').select('*');
        if (data) setAttendance(data as AttendanceRecord[]);
    };

    const refreshRegistrations = async () => {
        const { data } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
        if (data) setRegistrations(data);
    };

    useEffect(() => {
        fetchData(true);
    }, []);

    const handleLogin = (user: AdminUser) => {
        setCurrentUser(user);
        sessionStorage.setItem('current_user', JSON.stringify(user));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('current_user');
    };

    const handleUploadImage = async (file: File): Promise<string> => {
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `activity-covers/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('activity-images')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('activity-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error: any) {
            console.error('圖片上傳失敗:', error);
            throw error;
        }
    };

    const handleRegister = async (newReg: Registration): Promise<boolean> => {
        const { id, ...regData } = newReg as any;
        const { error } = await supabase.from('registrations').insert([regData]);
        if (error) {
            alert('報名失敗:' + error.message);
            return false;
        } else {
            await fetchData();
            return true;
        }
    };

    const handleUpdateActivity = async (updated: Activity) => {
        const { status, ...updateData } = updated as any;
        const { error } = await supabase.from('activities').update(updateData).eq('id', updated.id);
        if (error) alert('更新失敗:' + error.message);
        else fetchData();
    };

    const handleAddActivity = async (newAct: Activity) => {
        const { id, status, ...actData } = newAct as any;
        const { error } = await supabase.from('activities').insert([actData]);
        if (error) alert('新增活動失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteActivity = async (id: string | number) => {
        await supabase.from('registrations').delete().eq('activityId', id);
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (error) alert('刪除失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteRegistration = async (id: string | number) => {
        const { error } = await supabase.from('registrations').delete().eq('id', id);
        if (error) alert('刪除報名紀錄失敗:' + error.message);
        else fetchData();
    };

    const handleUpdateRegistration = async (updated: Registration) => {
        const { error } = await supabase.from('registrations').update(updated).eq('id', updated.id);
        if (error) alert('更新報名狀態失敗:' + error.message);
        else fetchData();
    };

    const handleAddUser = async (newUser: AdminUser) => {
        const { id, ...userData } = newUser as any;
        const { error } = await supabase.from('admins').insert([userData]);
        if (error) alert('新增管理員失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteUser = async (id: string | number) => {
        const { error } = await supabase.from('admins').delete().eq('id', id);
        if (error) {
            alert('刪除人員失敗:' + error.message);
        } else {
            fetchData();
        }
    };

    const handleAddMember = async (newMember: Member) => {
        const { id, ...memberData } = newMember as any;
        const { error } = await supabase.from('members').insert([memberData]);
        if (error) alert('新增會員失敗:' + error.message);
        else fetchData();
    };

    const handleUpdateMember = async (updated: Member) => {
        const { error } = await supabase.from('members').update(updated).eq('id', updated.id);
        if (error) alert('更新會員失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteMember = async (id: string | number) => {
        const { error } = await supabase.from('members').delete().eq('id', id);
        if (error) alert('刪除會員失敗:' + error.message);
        else fetchData();
    };

    const handleUpdateAttendance = async (activityId: string, memberId: string, status: AttendanceStatus) => {
        const now = new Date().toISOString();
        const tempId = `temp-${Date.now()}`;

        setAttendance(prev => {
            const existingIndex = prev.findIndex(r => String(r.activity_id) === String(activityId) && String(r.member_id) === String(memberId));
            if (existingIndex >= 0) {
                const newArr = [...prev];
                newArr[existingIndex] = { ...newArr[existingIndex], status, updated_at: now };
                return newArr;
            } else {
                return [...prev, { id: tempId, activity_id: activityId, member_id: memberId, status, updated_at: now }];
            }
        });

        try {
            const { data, error } = await supabase
                .from('attendance')
                .upsert(
                    { activity_id: String(activityId), member_id: String(memberId), status, updated_at: now },
                    { onConflict: 'activity_id,member_id' }
                )
                .select();

            if (error) {
                console.error('Attendance update failed:', error);
                fetchData();
            }
        } catch (err) {
            console.error('API error:', err);
            fetchData();
        }
    };

    const handleDeleteAttendance = async (activityId: string, memberId: string) => {
        setAttendance(prev => prev.filter(r => !(String(r.activity_id) === String(activityId) && String(r.member_id) === String(memberId))));

        try {
            const { error } = await supabase
                .from('attendance')
                .delete()
                .match({ activity_id: String(activityId), member_id: String(memberId) });

            if (error) {
                console.error('Delete attendance failed:', error);
                fetchData();
            }
        } catch (err) {
            console.error('API error:', err);
            fetchData();
        }
    };

    const handleAddFinanceRecord = async (newRecord: FinanceRecord) => {
        const { id, ...recordData } = newRecord as any;
        const { error } = await supabase.from('finance_records').insert([recordData]);
        if (error) alert('新增收支紀錄失敗:' + error.message);
        else fetchData();
    };

    const handleUpdateFinanceRecord = async (updated: FinanceRecord) => {
        const { error } = await supabase.from('finance_records').update(updated).eq('id', updated.id);
        if (error) alert('更新收支紀錄失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteFinanceRecord = async (id: string | number) => {
        const { error } = await supabase.from('finance_records').delete().eq('id', id);
        if (error) alert('刪除收支紀錄失敗:' + error.message);
        else fetchData();
    };

    const handleAddMilestone = async (newMilestone: Milestone) => {
        const { id, ...milestoneData } = newMilestone as any;
        const { error } = await supabase.from('milestones').insert([milestoneData]);
        if (error) alert('新增大事記失敗:' + error.message);
        else fetchData();
    };

    const handleUpdateMilestone = async (updated: Milestone) => {
        const { error } = await supabase.from('milestones').update(updated).eq('id', updated.id);
        if (error) alert('更新大事記失敗:' + error.message);
        else fetchData();
    };

    const handleDeleteMilestone = async (id: string | number) => {
        const { error } = await supabase.from('milestones').delete().eq('id', id);
        if (error) alert('刪除大事記失敗:' + error.message);
        else fetchData();
    };

    // ===== 文件管理 =====
    const handleUploadDocumentFile = async (file: File): Promise<{ filePath: string; publicUrl: string }> => {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${safeName}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chapter-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/octet-stream',
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('chapter-documents')
            .getPublicUrl(filePath);

        return { filePath, publicUrl: data.publicUrl };
    };

    const handleGetDocumentDownloadUrl = async (filePath: string): Promise<string> => {
        // 用 signed URL 觸發瀏覽器下載並設定 content-disposition
        const { data, error } = await supabase.storage
            .from('chapter-documents')
            .createSignedUrl(filePath, 60, { download: true });
        if (error || !data?.signedUrl) {
            // Fallback：用 public URL
            const { data: pubData } = supabase.storage
                .from('chapter-documents')
                .getPublicUrl(filePath);
            return pubData.publicUrl;
        }
        return data.signedUrl;
    };

    const handleAddDocument = async (doc: Omit<ChapterDocument, 'id' | 'created_at' | 'updated_at'>) => {
        const { error } = await supabase.from('documents').insert([doc]);
        if (error) {
            alert('新增文件失敗:' + error.message);
            throw error;
        }
        await fetchData();
    };

    const handleUpdateDocument = async (doc: ChapterDocument) => {
        const { id, created_at, updated_at, ...updateData } = doc;
        const payload = { ...updateData, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('documents').update(payload).eq('id', id);
        if (error) {
            alert('更新文件失敗:' + error.message);
            throw error;
        }
        await fetchData();
    };

    const handleDeleteDocument = async (doc: ChapterDocument) => {
        // 先刪 storage 檔案，再刪 db
        const { error: storageError } = await supabase.storage
            .from('chapter-documents')
            .remove([doc.file_path]);
        if (storageError) {
            console.warn('刪除實體檔案失敗 (可能已不存在):', storageError);
        }
        const { error } = await supabase.from('documents').delete().eq('id', doc.id);
        if (error) {
            alert('刪除文件失敗:' + error.message);
            throw error;
        }
        await fetchData();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center space-y-4">
                    <Loader2 className="animate-spin text-red-600" size={56} />
                    <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Connecting Database</p>
                </div>
            </div>
        );
    }

    return (
        <Router>
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-grow bg-gray-50/30">
                    <Routes>
                        <Route path="/" element={<Home activities={activities} />} />
                        <Route path="/regular-meeting" element={<RegularMeeting activities={activities} />} />
                        <Route path="/training" element={<BusinessTraining activities={activities} />} />
                        <Route path="/coffee" element={<CoffeeMeeting activities={activities} />} />
                        <Route path="/members" element={<MemberList members={members} />} />
                        <Route path="/milestones" element={<Milestones milestones={milestones} />} />
                        <Route path="/activity/:id" element={<ActivityDetail activities={activities} onRegister={handleRegister} registrations={registrations} members={members} />} />
                        <Route path="/admin/login" element={currentUser ? <Navigate to="/admin" /> : <LoginPage users={users} onLogin={handleLogin} />} />
                        <Route path="/admin/*" element={
                            currentUser ? (
                                <AdminDashboard
                                    currentUser={currentUser}
                                    onLogout={handleLogout}
                                    activities={activities}
                                    registrations={registrations}
                                    users={users}
                                    members={members}
                                    attendance={attendance}
                                    onUpdateActivity={handleUpdateActivity}
                                    onAddActivity={handleAddActivity}
                                    onDeleteActivity={handleDeleteActivity}
                                    onUpdateRegistration={handleUpdateRegistration}
                                    onDeleteRegistration={handleDeleteRegistration}
                                    onAddUser={handleAddUser}
                                    onDeleteUser={handleDeleteUser}
                                    onAddMember={handleAddMember}
                                    onUpdateMember={handleUpdateMember}
                                    onDeleteMember={handleDeleteMember}
                                    onUpdateAttendance={handleUpdateAttendance}
                                    onDeleteAttendance={handleDeleteAttendance}
                                    onRefreshAttendance={refreshAttendance}
                                    onRefreshRegistrations={refreshRegistrations}
                                    onAddFinanceRecord={handleAddFinanceRecord}
                                    onUpdateFinanceRecord={handleUpdateFinanceRecord}
                                    onDeleteFinanceRecord={handleDeleteFinanceRecord}
                                    financeRecords={financeRecords}
                                    milestones={milestones}
                                    onAddMilestone={handleAddMilestone}
                                    onUpdateMilestone={handleUpdateMilestone}
                                    onDeleteMilestone={handleDeleteMilestone}
                                    documents={documents}
                                    onAddDocument={handleAddDocument}
                                    onUpdateDocument={handleUpdateDocument}
                                    onDeleteDocument={handleDeleteDocument}
                                    onUploadDocumentFile={handleUploadDocumentFile}
                                    onGetDocumentDownloadUrl={handleGetDocumentDownloadUrl}
                                    onUploadImage={handleUploadImage}
                                />
                            ) : (
                                <Navigate to="/admin/login" />
                            )
                        } />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
};

export default App;
