import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const RegularMeeting: React.FC<Props> = ({ activities }) => {
    const now = new Date();
    const filtered = activities
        .filter(a => {
            if (a.type !== ActivityType.REGULAR_MEETING) return false;
            const isActive = a.status === 'active' || !a.status;
            if (!isActive) return false;
            // 過濾掉已過期的活動（活動開始時間已過）
            const fullDate = new Date(`${a.date.replace(/-/g, '/')} ${a.time}`);
            return fullDate > now;
        })
        .sort((a, b) => {
            const dateA = new Date(`${a.date.replace(/-/g, '/')} ${a.time}`).getTime();
            const dateB = new Date(`${b.date.replace(/-/g, '/')} ${b.time}`).getTime();
            return dateA - dateB;
        });
    return (
        <ActivityListView
            title="例會活動"
            subtitle="每週二早晨,商業菁英的固定聚會"
            activities={filtered}
            emptyMessage="目前沒有例會活動"
        />
    );
};

export default RegularMeeting;
