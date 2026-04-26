import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Activity, Registration, AdminUser, UserRole, Member, AttendanceRecord, AttendanceStatus, FinanceRecord, Milestone, ChapterDocument } from '../types';
import Sidebar from './admin/Sidebar';
import DashboardHome from './admin/DashboardHome';
import CheckInManager from './admin/CheckInManager';
import AttendanceManager from './admin/AttendanceManager';
import ActivityManager from './admin/ActivityManager';
import MemberManager from './admin/MemberManager';
import UserManager from './admin/UserManager';
import FinanceManager from './admin/FinanceManager';
import MilestoneManager from './admin/MilestoneManager';
import BirthdayManager from './admin/BirthdayManager';
import MembershipExpiryManager from './admin/MembershipExpiryManager';
import GuestManager from './admin/GuestManager';
import DocumentManager from './admin/DocumentManager';

interface AdminDashboardProps {
  currentUser: AdminUser;
  onLogout: () => void;
  activities: Activity[];
  registrations: Registration[];
  users: AdminUser[];
  members: Member[];
  attendance: AttendanceRecord[];
  onUpdateActivity: (act: Activity) => void;
  onAddActivity: (act: Activity) => void;
  onDeleteActivity: (id: string | number) => void;
  onUpdateRegistration: (reg: Registration) => void;
  onDeleteRegistration: (id: string | number) => void;
  onAddUser: (user: AdminUser) => void;
  onDeleteUser: (id: string) => void;
  onAddMember: (member: Member) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string | number) => void;
  onUpdateAttendance: (activityId: string, memberId: string, status: AttendanceStatus) => void;
  onDeleteAttendance: (activityId: string, memberId: string) => void;
  onRefreshAttendance: () => Promise<void>;
  onRefreshRegistrations: () => Promise<void>;
  onAddFinanceRecord: (record: FinanceRecord) => void;
  onUpdateFinanceRecord: (record: FinanceRecord) => void;
  onDeleteFinanceRecord: (id: string | number) => void;
  financeRecords: FinanceRecord[];
  milestones: Milestone[];
  onAddMilestone: (milestone: Milestone) => void;
  onUpdateMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (id: string | number) => void;
  documents: ChapterDocument[];
  onAddDocument: (doc: Omit<ChapterDocument, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateDocument: (doc: ChapterDocument) => Promise<void>;
  onDeleteDocument: (doc: ChapterDocument) => Promise<void>;
  onUploadDocumentFile: (file: File) => Promise<{ filePath: string; publicUrl: string }>;
  onGetDocumentDownloadUrl: (filePath: string) => Promise<string>;
  onUploadImage: (file: File) => Promise<string>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const canAccessActivities = props.currentUser.role === UserRole.MANAGER || props.currentUser.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = props.currentUser.role === UserRole.SUPER_ADMIN;

  // 手機版 sidebar 開合 state
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        user={props.currentUser}
        onLogout={props.onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-grow min-w-0 p-8">
        {/* 手機版漢堡按鈕 */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden mb-4 p-2 bg-gray-900 text-white rounded-lg"
          aria-label="開啟選單"
        >
          ☰ 選單
        </button>

        <Routes>
          <Route path="/" element={<DashboardHome activities={props.activities} registrations={props.registrations} />} />
          <Route path="/check-in" element={<CheckInManager activities={props.activities} registrations={props.registrations} onUpdateRegistration={props.onUpdateRegistration} onDeleteRegistration={props.onDeleteRegistration} onRefreshRegistrations={props.onRefreshRegistrations} />} />
          <Route path="/attendance" element={<AttendanceManager activities={props.activities} members={props.members} attendance={props.attendance} onUpdateAttendance={props.onUpdateAttendance} onDeleteAttendance={props.onDeleteAttendance} onRefreshAttendance={props.onRefreshAttendance} />} />
          <Route path="/finance" element={<FinanceManager activities={props.activities} financeRecords={props.financeRecords} onAddFinanceRecord={props.onAddFinanceRecord} onUpdateFinanceRecord={props.onUpdateFinanceRecord} onDeleteFinanceRecord={props.onDeleteFinanceRecord} />} />
          <Route path="/milestones" element={<MilestoneManager milestones={props.milestones} onAddMilestone={props.onAddMilestone} onUpdateMilestone={props.onUpdateMilestone} onDeleteMilestone={props.onDeleteMilestone} onUploadImage={props.onUploadImage} />} />

          {canAccessActivities && (
            <>
              <Route path="/activities" element={<ActivityManager activities={props.activities} onAddActivity={props.onAddActivity} onUpdateActivity={props.onUpdateActivity} onDeleteActivity={props.onDeleteActivity} onUploadImage={props.onUploadImage} />} />
              <Route path="/members" element={
                <MemberManager
                  members={props.members}
                  onAddMember={props.onAddMember}
                  onUpdateMember={props.onUpdateMember}
                  onDeleteMember={props.onDeleteMember}
                  onUploadImage={props.onUploadImage}
                />
              } />
              <Route path="/guests" element={<GuestManager currentUser={props.currentUser} />} />
              <Route path="/birthdays" element={<BirthdayManager members={props.members} />} />
              <Route path="/membership-expiry" element={<MembershipExpiryManager members={props.members} />} />
              <Route path="/documents" element={
                <DocumentManager
                  documents={props.documents}
                  uploaderName={props.currentUser.name}
                  onAddDocument={props.onAddDocument}
                  onUpdateDocument={props.onUpdateDocument}
                  onDeleteDocument={props.onDeleteDocument}
                  onUploadFile={props.onUploadDocumentFile}
                  onGetDownloadUrl={props.onGetDocumentDownloadUrl}
                />
              } />
            </>
          )}

          {canAccessUsers && (
            <Route path="/users" element={<UserManager users={props.users} onAddUser={props.onAddUser} onDeleteUser={props.onDeleteUser} currentUser={props.currentUser} />} />
          )}

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
