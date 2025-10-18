import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUsersWithBirthdays } from '../services/api';
import { User } from '../types';

const BirthdaysPage: React.FC = () => {
    const [birthdaysByMonth, setBirthdaysByMonth] = useState<Record<string, User[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBirthdays = async () => {
            setLoading(true);
            const users = await getUsersWithBirthdays();
            const grouped = users.reduce((acc, user) => {
                if (user.birthdate) {
                    const month = new Date(user.birthdate).getMonth();
                    if (!acc[month]) {
                        acc[month] = [];
                    }
                    acc[month].push(user);
                }
                return acc;
            }, {} as Record<string, User[]>);
            setBirthdaysByMonth(grouped);
            setLoading(false);
        };
        fetchBirthdays();
    }, []);

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    };
    
    if (loading) {
        return <p className="text-center py-10">Carregando aniversariantes...</p>;
    }

    return (
        <div className="py-8">
            <h1 className="text-3xl font-bold mb-8">Aniversários</h1>
            <div className="space-y-8">
                {monthNames.map((monthName, index) => {
                    const usersInMonth = birthdaysByMonth[index];
                    if (!usersInMonth || usersInMonth.length === 0) {
                        return null;
                    }
                    return (
                        <div key={index}>
                            <h2 className="text-xl font-bold mb-4">{monthName}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {usersInMonth.map(user => (
                                    <Link to={`/profile/${user.id}`} key={user.id} className="flex items-center space-x-4 p-3 bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-md transition">
                                        <img src={user.avatar} alt={user.name} className="h-12 w-12 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {user.birthdate && formatDate(user.birthdate)}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BirthdaysPage;