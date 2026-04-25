import React from 'react';
import ActivityListView from '../components/ActivityListView';
import { Activity, ActivityType } from '../types';

interface Props {
    activities: Activity[];
}

const CoffeeMeeting: React.FC<Props> = ({ activities }) => {
    const filtered = activities.filter(a => a.type === ActivityType.COFFEE_MEETING);
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
