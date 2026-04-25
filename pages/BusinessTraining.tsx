import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const BusinessTraining: React.FC<Props> = ({ activities }) => {
    const filtered = activities.filter(a => a.type === ActivityType.BUSINESS_TRAINING);
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
