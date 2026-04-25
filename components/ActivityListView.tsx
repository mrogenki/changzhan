import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Inbox } from 'lucide-react';
import { Activity } from '../types';

interface Props {
    title: string;
    subtitle: string;
    activities: Activity[];
    emptyMessage?: string;
}

const ActivityListView: React.FC<Props> = ({ title, subtitle, activities, emptyMessage = '目前沒有活動' }) => {
    // 只顯示 active 的活動,並依日期排序(近的在前)
    const visible = activities
        .filter(a => a.status !== 'closed')
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-3">{title}</h1>
                <p className="text-gray-500">{subtitle}</p>
            </div>

            {visible.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                    <Inbox className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-400">{emptyMessage}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visible.map(activity => (
                        <Link
                            key={activity.id}
                            to={`/activity/${activity.id}`}
                            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300"
                        >
                            <div className="aspect-video bg-gray-100 overflow-hidden">
                                {activity.picture && (
                                    <img
                                        src={activity.picture}
                                        alt={activity.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                )}
                            </div>
                            <div className="p-6">
                                <span className="inline-block bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-3">
                                    {activity.type}
                                </span>
                                <h3 className="text-lg font-bold mb-3 line-clamp-2 group-hover:text-red-600 transition-colors">
                                    {activity.title}
                                </h3>
                                <div className="space-y-2 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-red-500" />
                                        <span>{activity.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-red-500" />
                                        <span>{activity.time}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-red-500" />
                                        <span className="line-clamp-1">{activity.location}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActivityListView;
