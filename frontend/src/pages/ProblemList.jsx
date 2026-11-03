import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

const ProblemList = () => {
    const [problems, setProblems] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        api('/problems', { signal: controller.signal }).then(setProblems)
            .catch(err => { if (!controller.signal.aborted) setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);

    return (
        <div className="flex flex-col gap-6">
            {/* Hero Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-8">
                <h1 className="text-3xl font-bold mb-2">Programming practice</h1>
                <p className="text-gray-600 text-lg max-w-2xl">
                    A local practice judge for C++, Python and Java. Submitting requires an owner-provided access token and an available isolated runner.
                </p>
            </div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {loading && <p role="status">Loading problems...</p>}
            {!loading && !error && !problems.length && <p>No problems have been added yet.</p>}

            {/* Problem Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Problem Archive</h2>
                    <span className="text-sm text-gray-500">{problems.length} problems available</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-gray-200">
                                <th className="p-4 font-semibold text-gray-600">ID</th>
                                <th className="p-4 font-semibold text-gray-600">Problem Title</th>
                                <th className="p-4 font-semibold text-gray-600">Difficulty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {problems.map((p, index) => (
                                <tr key={p.id} className={`border-b border-gray-50 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                    <td className="p-4 text-gray-500 font-mono">{p.id}</td>
                                    <td className="p-4">
                                        <Link to={`/problem/${p.id}`} className="text-blue-600 font-bold hover:text-blue-800 hover:underline">
                                            {p.title}
                                        </Link>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                            p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                            p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {p.difficulty}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProblemList;
