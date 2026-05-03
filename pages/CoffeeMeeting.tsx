import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const CoffeeMeeting: React.FC<Props> = ({ activities }) => {
    const now = new Date();
    const filtered = activities
        .filter(a => {
            if (a.type !== ActivityType.COFFEE_MEETING) return false;
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
            title="咖啡會議"
            subtitle="一對一深度交流,建立可信賴的合作關係"
            activities={filtered}
            emptyMessage="目前沒有咖啡會議"
        />
    );
};

export default CoffeeMeeting;
