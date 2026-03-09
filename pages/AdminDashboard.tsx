
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Activity, Registration, AdminUser, UserRole, Member, AttendanceRecord, AttendanceStatus } from '../types';
import Sidebar from './admin/Sidebar';
import DashboardHome from './admin/DashboardHome';
import CheckInManager from './admin/CheckInManager';
import AttendanceManager from './admin/AttendanceManager';
import ActivityManager from './admin/ActivityManager';
import MemberManager from './admin/MemberManager';
import UserManager from './admin/UserManager';

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
  onAddMembers?: (members: Member[]) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string | number) => void;
  onUpdateAttendance: (activityId: string, memberId: string, status: AttendanceStatus) => void; 
  onDeleteAttendance: (activityId: string, memberId: string) => void; 
  onUploadImage: (file: File) => Promise<string>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const canAccessActivities = props.currentUser.role === UserRole.MANAGER || props.currentUser.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = props.currentUser.role === UserRole.SUPER_ADMIN;

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar user={props.currentUser} onLogout={props.onLogout} />
      <div className="flex-grow p-8">
        <Routes>
          <Route path="/" element={<DashboardHome activities={props.activities} registrations={props.registrations} />} />
          <Route path="/check-in" element={<CheckInManager activities={props.activities} registrations={props.registrations} onUpdateRegistration={props.onUpdateRegistration} onDeleteRegistration={props.onDeleteRegistration} />} />
          <Route path="/attendance" element={<AttendanceManager activities={props.activities} members={props.members} attendance={props.attendance} onUpdateAttendance={props.onUpdateAttendance} onDeleteAttendance={props.onDeleteAttendance} />} />
          
          {canAccessActivities && (
            <>
              <Route path="/activities" element={<ActivityManager activities={props.activities} onAddActivity={props.onAddActivity} onUpdateActivity={props.onUpdateActivity} onDeleteActivity={props.onDeleteActivity} onUploadImage={props.onUploadImage} />} />
              <Route path="/members" element={
                <MemberManager 
                  members={props.members} 
                  onAddMember={props.onAddMember} 
                  onAddMembers={props.onAddMembers} 
                  onUpdateMember={props.onUpdateMember} 
                  onDeleteMember={props.onDeleteMember} 
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
