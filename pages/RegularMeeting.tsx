import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const RegularMeeting: React.FC<Props> = ({ activities }) => {
    const filtered = activities.filter(a => a.type === ActivityType.REGULAR_MEETING);
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
