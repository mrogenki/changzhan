import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Activity, Registration, AdminUser, UserRole, Member, AttendanceRecord, AttendanceStatus, FinanceRecord, Milestone } from '../types';
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
  onBatchImportMembers: (toAdd: Member[], toUpdate: Member[]) => Promise<void>;
  onUpdateAttendance: (activityId: string, memberId: string, status: AttendanceStatus) => void; 
  onDeleteAttendance: (activityId: string, memberId: string) => void; 
  onAddFinanceRecord: (record: FinanceRecord) => void;
  onUpdateFinanceRecord: (record: FinanceRecord) => void;
  onDeleteFinanceRecord: (id: string | number) => void;
  financeRecords: FinanceRecord[];
  milestones: Milestone[];
  onAddMilestone: (milestone: Milestone) => void;
  onUpdateMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (id: string | number) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const canAccessActivities = props.currentUser.role === UserRole.MANAGER || props.currentUser.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = props.currentUser.role === UserRole.SUPER_ADMIN;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        user={props.currentUser}
        onLogout={props.onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-grow min-w-0 flex flex-col">
        {/* 手機版頂部列(桌面版隱藏) */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="開啟選單"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center text-white font-bold text-sm">長</div>
            <span className="font-bold text-gray-900">管理系統</span>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-grow">
          <Routes>
            <Route path="/" element={<DashboardHome activities={props.activities} registrations={props.registrations} />} />
            <Route path="/check-in" element={<CheckInManager activities={props.activities} registrations={props.registrations} onUpdateRegistration={props.onUpdateRegistration} onDeleteRegistration={props.onDeleteRegistration} />} />
            <Route path="/attendance" element={<AttendanceManager activities={props.activities} members={props.members} attendance={props.attendance} onUpdateAttendance={props.onUpdateAttendance} onDeleteAttendance={props.onDeleteAttendance} />} />
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
                    onBatchImportMembers={props.onBatchImportMembers}
                    onUploadImage={props.onUploadImage}
                  />
                } />
                <Route path="/birthdays" element={<BirthdayManager members={props.members} />} />
                <Route path="/membership-expiry" element={<MembershipExpiryManager members={props.members} />} />
              </>
            )}

            {canAccessUsers && (
              <Route path="/users" element={<UserManager users={props.users} onAddUser={props.onAddUser} onDeleteUser={props.onDeleteUser} currentUser={props.currentUser} />} />
            )}

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
