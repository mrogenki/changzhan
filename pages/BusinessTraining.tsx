import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const BusinessTraining: React.FC<Props> = ({ activities }) => {
    const now = new Date();
    const filtered = activities
        .filter(a => {
            if (a.type !== ActivityType.BUSINESS_TRAINING) return false;
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
            title="商務培訓"
            subtitle="系統化提升商業思維與技能"
            activities={filtered}
            emptyMessage="目前沒有商務培訓活動"
        />
    );
};

export default BusinessTraining;
