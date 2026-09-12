import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ProblemList = () => {
    const [problems, setProblems] = useState([]);

    useEffect(() => {
        axios.get('http://localhost:5000/api/problems')
            .then(res => setProblems(res.data))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">Problem Archive</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-3 font-semibold">#</th>
                            <th className="p-3 font-semibold">Title</th>
                            <th className="p-3 font-semibold">Difficulty</th>
                        </tr>
                    </thead>
                    <tbody>
                        {problems.map(p => (
                            <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="p-3 text-gray-500">{p.id}</td>
                                <td className="p-3">
                                    <Link to={\`/problem/\${p.id}\`} className="text-blue-600 font-medium hover:underline">
                                        {p.title}
                                    </Link>
                                </td>
                                <td className="p-3">
                                    <span className={\`px-2 py-1 rounded text-xs font-semibold \${
                                        p.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                                        p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }\`}>
                                        {p.difficulty}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProblemList;
