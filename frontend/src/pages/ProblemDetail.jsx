import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';

const ProblemDetail = () => {
    const { id } = useParams();
    const [problem, setProblem] = useState(null);
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState('# Write your code here\n');
    const [submitting, setSubmitting] = useState(false);
    const [verdict, setVerdict] = useState('');
    const [execTime, setExecTime] = useState(null);

    useEffect(() => {
        axios.get(`http://localhost:5000/api/problems/${id}`)
            .then(res => setProblem(res.data))
            .catch(err => console.error(err));
    }, [id]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setVerdict('Judging...');
        setExecTime(null);
        
        try {
            const res = await axios.post('http://localhost:5000/api/submit', {
                problemId: id,
                code: code,
                language: language
            });
            
            const subId = res.data.submissionId;
            
            // Poll for result
            const poll = setInterval(async () => {
                const statusRes = await axios.get(`http://localhost:5000/api/submissions/${subId}`);
                if (statusRes.data.verdict !== 'Pending') {
                    clearInterval(poll);
                    setVerdict(statusRes.data.verdict);
                    setExecTime(statusRes.data.execution_time);
                    setSubmitting(false);
                }
            }, 1000);
            
        } catch (error) {
            console.error(error);
            setVerdict("Submission Error");
            setSubmitting(false);
        }
    };

    if (!problem) return <div className="p-4">Loading problem...</div>;

    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Description */}
            <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-2xl font-bold mb-2">{problem.title}</h2>
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-semibold mb-4">
                    {problem.difficulty}
                </span>
                
                <div className="prose mb-6">
                    <p className="text-gray-700 whitespace-pre-wrap">{problem.description}</p>
                </div>
            </div>

            {/* Right Column: Code Editor */}
            <div className="w-full md:w-2/3 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">Code Editor</span>
                        <select 
                            value={language} 
                            onChange={(e) => {
                                setLanguage(e.target.value);
                                if(e.target.value === 'java') setCode('public class Solution {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}');
                                else if (e.target.value === 'cpp') setCode('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}');
                                else setCode('# Write your code here\n');
                            }}
                            className="text-sm bg-white border border-gray-300 rounded px-2 py-1 outline-none font-medium"
                        >
                            <option value="python">Python 3 (Standard Library)</option>
                            <option value="cpp">C++ (g++ with STL)</option>
                            <option value="java">Java (JDK 21 & BigInteger)</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleSubmit} 
                        disabled={submitting}
                        className={`px-4 py-1.5 rounded text-white font-medium transition ${submitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {submitting ? 'Submitting...' : 'Submit Code'}
                    </button>
                </div>
                
                <div className="h-96">
                    <Editor
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        value={code}
                        onChange={(value) => setCode(value)}
                        options={{ minimap: { enabled: false }, fontSize: 14 }}
                    />
                </div>

                {/* Verdict Panel */}
                {verdict && (
                    <div className={`p-4 border-t font-semibold flex justify-between items-center ${
                        verdict === 'Accepted' ? 'bg-green-50 text-green-700' :
                        verdict === 'Judging...' ? 'bg-blue-50 text-blue-700' :
                        'bg-red-50 text-red-700'
                    }`}>
                        <div className="text-lg">{verdict}</div>
                        {execTime !== null && <div className="text-sm opacity-80">{execTime} ms</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProblemDetail;
