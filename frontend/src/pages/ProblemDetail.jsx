import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, waitForVerdict } from '../api';
import Editor from '@monaco-editor/react';
import '../editor';

const ProblemDetail = ({ id }) => {
    const [problem, setProblem] = useState(null);
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState('# Write your code here\n');
    const [submitting, setSubmitting] = useState(false);
    const [verdict, setVerdict] = useState('');
    const [execTime, setExecTime] = useState(null);
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const requestRef = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        api(`/problems/${id}`, { signal: controller.signal })
            .then(setProblem)
            .catch(err => { if (!controller.signal.aborted) setError(err.message); });
        return () => { controller.abort(); requestRef.current?.abort(); };
    }, [id]);

    const handleSubmit = async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setSubmitting(true);
        setVerdict('Judging...');
        setExecTime(null);
        
        try {
            const options = { token, signal: controller.signal };
            const res = await api('/submit', { ...options, body: {
                problemId: Number(id), code, language,
            }
            });
            const result = await waitForVerdict(res.submissionId, options);
            if (!controller.signal.aborted) {
                setVerdict(result.verdict);
                setExecTime(result.execution_time);
            }
        } catch (error) {
            if (!controller.signal.aborted) setVerdict(error.message);
        } finally {
            if (!controller.signal.aborted) setSubmitting(false);
        }
    };

    if (error) return <div role="alert" className="p-4 text-red-700">{error}</div>;
    if (!problem) return <div role="status" className="p-4">Loading problem...</div>;

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
                {problem.samples.map((sample, index) => <section key={index} className="my-4">
                    <h3 className="font-semibold">Sample {index + 1}</h3>
                    <p>Input</p><pre className="bg-gray-50 p-2 whitespace-pre-wrap">{sample.input}</pre>
                    <p>Output</p><pre className="bg-gray-50 p-2 whitespace-pre-wrap">{sample.output}</pre>
                </section>)}
                <label className="block text-sm font-semibold" htmlFor="judge-token">Judge access token</label>
                <input id="judge-token" type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off"
                    className="mt-2 w-full border rounded p-2" aria-describedby="token-help" />
                <p id="token-help" className="mt-2 text-sm text-gray-600">Get this from the judge owner. It stays in this page's memory and clears on refresh.</p>
            </div>

            {/* Right Column: Code Editor */}
            <div className="w-full md:w-2/3 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <div className="bg-gray-100 px-4 py-3 border-b flex flex-wrap gap-3 justify-between items-center">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-700">Code Editor</span>
                        <select 
                            aria-label="Programming language"
                            disabled={submitting}
                            value={language} 
                            onChange={(e) => {
                                setLanguage(e.target.value);
                                if(e.target.value === 'java') setCode('public class Solution {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}');
                                else if (e.target.value === 'cpp') setCode('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}');
                                else setCode('# Write your code here\n');
                            }}
                            className="max-w-full text-sm bg-white border border-gray-300 rounded px-2 py-2 focus-visible:outline-2 focus-visible:outline-blue-600 font-medium"
                        >
                            <option value="python">Python 3 (Standard Library)</option>
                            <option value="cpp">C++ (g++ with STL)</option>
                            <option value="java">Java (JDK 21 & BigInteger)</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleSubmit} 
                        disabled={submitting || !token.trim()}
                        className="px-4 py-2 rounded text-white font-medium whitespace-nowrap bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        {submitting ? 'Submitting...' : 'Submit Code'}
                    </button>
                </div>
                
                <div className="h-96">
                    <Editor
                        loading={<textarea aria-label="Source code" value={code} onChange={e => setCode(e.target.value)} disabled={submitting} className="w-full h-96 p-4 font-mono" />}
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        value={code}
                        onChange={(value) => setCode(value || '')}
                        options={{ minimap: { enabled: false }, fontSize: 14, readOnly: submitting }}
                    />
                </div>

                {/* Verdict Panel */}
                {verdict && (
                    <div role="status" aria-live="polite" className={`p-4 border-t font-semibold flex justify-between items-center ${
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

export default function ProblemPage() {
    const { id } = useParams();
    return <ProblemDetail key={id} id={id} />;
}
