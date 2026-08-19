import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const GroupMeeting: React.FC<Props> = ({ activities }) => {
    const now = new Date();
    const filtered = activities
        .filter(a => {
            if (a.type !== ActivityType.GROUP_MEETING) return false;
            const isActive = a.status === 'active' || !a.status;
            if (!isActive) return false;
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
            title="組聚"
            subtitle="小組夥伴定期聚會,深化彼此的商務連結"
            activities={filtered}
            emptyMessage="目前沒有組聚"
        />
    );
};

export default GroupMeeting;
