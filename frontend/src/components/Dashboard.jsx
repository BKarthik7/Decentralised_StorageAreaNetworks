import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import FileDetails from './FileDetails';

const Dashboard = () => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const res = await axios.get('/api/files', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFiles(res.data);
            } catch (err) {
                console.error(err);
                if (err.response?.status === 401) {
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            <header>
                <h1>Welcome, {user.displayName}</h1>
                <div className="actions">
                    <Link to="/upload" className="btn">Upload New File</Link>
                    <button onClick={handleLogout} className="btn-secondary">Logout</button>
                </div>
            </header>

            <section className="files-list">
                <h2>Your Files</h2>
                {loading ? <p>Loading...</p> : (
                    files.length === 0 ? <p>No files uploaded yet.</p> : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>CID</th>
                                    <th>Size</th>
                                    <th>Uploaded At</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map(file => (
                                    <tr key={file.id}>
                                        <td>{file.filename}</td>
                                        <td>
                                            <a href={`https://gateway.pinata.cloud/ipfs/${file.cid}`} target="_blank" rel="noopener noreferrer">
                                                {file.cid.substring(0, 10)}...
                                            </a>
                                        </td>
                                        <td>{(file.size / 1024).toFixed(2)} KB</td>
                                        <td>
                                            {/* Placeholder for details/decryption view */}
                                            <button onClick={() => setSelectedFileId(file.id)} className="btn-sm">View Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </section>

            {selectedFileId && (
                <FileDetails
                    fileId={selectedFileId}
                    onClose={() => setSelectedFileId(null)}
                />
            )}
        </div>
    );
};

export default Dashboard;
