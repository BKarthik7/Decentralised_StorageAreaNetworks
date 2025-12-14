import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import CytoscapeComponent from 'react-cytoscapejs';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('nodes'); // 'nodes' or 'blockchain'
    const [systemState, setSystemState] = useState({ nodes: [], stats: {}, logs: [] });
    const [blockchainData, setBlockchainData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const cyRef = useRef(null);

    // Fetch System State
    useEffect(() => {
        const fetchSystemState = async () => {
            try {
                const res = await axios.get('/api/admin/system-state');
                setSystemState(res.data);
            } catch (err) {
                console.error("Failed to fetch system state", err);
            } finally {
                setLoading(false);
            }
        };

        const fetchBlockchainData = async () => {
            try {
                const res = await axios.get('/api/admin/blockchain');
                setBlockchainData(res.data);
            } catch (err) {
                console.error("Failed to fetch blockchain data", err);
            }
        };

        fetchSystemState();
        if (activeTab === 'blockchain') {
            fetchBlockchainData();
        }

        const interval = setInterval(() => {
            fetchSystemState();
            if (activeTab === 'blockchain') fetchBlockchainData();
        }, 3000); // Poll every 3s

        return () => clearInterval(interval);
    }, [refreshTrigger, activeTab]);

    const handleSimulateFailure = async (nodeId) => {
        try {
            await axios.post('/api/admin/simulate/node-failure', { nodeId });
        } catch (err) {
            console.error("Simulation failed", err);
        }
    };

    const handleNodeRecovery = async (nodeId) => {
        try {
            await axios.post('/api/admin/simulate/node-recovery', { nodeId });
        } catch (err) {
            console.error("Recovery failed", err);
        }
    };

    // Graph Data
    const elements = [
        ...systemState.nodes.map(node => ({
            data: { id: node.id, label: node.name, type: 'node', status: node.status },
            style: {
                'background-color': node.status === 'online' ? '#10b981' : '#ef4444',
                'label': node.name
            }
        })),
        { data: { id: 'center', label: 'Network', type: 'hub' } },
        ...systemState.nodes.map(node => ({
            data: { source: 'center', target: node.id }
        }))
    ];

    const layout = { name: 'grid', rows: 2, fit: true, padding: 30 };

    const renderNodesTab = () => (
        <>
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                    <h3>Files Stored</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{systemState.stats.files || 0}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                    <h3>Active Replicas</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{systemState.stats.replicas || 0}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                    <h3>Storage Used</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{(systemState.stats.storageUsed / 1024).toFixed(2) || 0} KB</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="network-viz" style={{ border: '1px solid #e5e7eb', borderRadius: '8px', height: '500px' }}>
                    <h3>Network Topology</h3>
                    <CytoscapeComponent
                        elements={elements}
                        style={{ width: '100%', height: '400px' }}
                        layout={layout}
                        cy={(cy) => { cyRef.current = cy; }}
                        stylesheet={[
                            {
                                selector: 'node',
                                style: {
                                    'background-color': '#3b82f6',
                                    'label': 'data(label)',
                                    'color': '#333',
                                    'font-size': '12px'
                                }
                            },
                            {
                                selector: 'edge',
                                style: { 'width': 2, 'line-color': '#ccc' }
                            }
                        ]}
                    />
                    <div className="node-controls" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {systemState.nodes.map(node => (
                            <button
                                key={node.id}
                                onClick={() => node.status === 'online' ? handleSimulateFailure(node.id) : handleNodeRecovery(node.id)}
                                style={{
                                    backgroundColor: node.status === 'online' ? '#ef4444' : '#10b981',
                                    fontSize: '0.8rem',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                {node.status === 'online' ? `Kill ${node.name}` : `Recover ${node.name}`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="event-log" style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', height: '500px', overflowY: 'auto' }}>
                    <h3>System Events</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {systemState.logs.map(log => (
                            <li key={log.id} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <br />
                                <strong style={{
                                    color: log.type === 'CRITICAL' ? 'red' :
                                        log.type === 'SUCCESS' ? 'green' :
                                            log.type === 'RECOVERY' ? 'blue' : '#333'
                                }}>[{log.type}]</strong> {log.message}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );

    const renderBlockchainTab = () => {
        if (!blockchainData) return <div>Loading Blockchain Data...</div>;
        if (!blockchainData.connected) return <div className="error">Blockchain Provider Not Connected</div>;

        return (
            <div className="blockchain-view">
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card">
                        <h3>Current Block</h3>
                        <p className="stat-value">#{blockchainData.network.height}</p>
                    </div>
                    <div className="card">
                        <h3>Gas Price</h3>
                        <p className="stat-value">{parseFloat(blockchainData.network.gasPrice).toFixed(2)} Gwei</p>
                    </div>
                    <div className="card">
                        <h3>Network</h3>
                        <p className="stat-value">{blockchainData.network.name} (ID: {blockchainData.network.chainId})</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    <div className="card full-width">
                        <h3>Recent Blocks</h3>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Height</th>
                                    <th>Hash</th>
                                    <th>Time</th>
                                    <th>Txs</th>
                                    <th>Gas Used</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blockchainData.blocks.map(block => (
                                    <tr key={block.hash}>
                                        <td>{block.number}</td>
                                        <td title={block.hash}>{block.hash.substring(0, 10)}...</td>
                                        <td>{new Date(block.timestamp).toLocaleTimeString()}</td>
                                        <td>{block.txCount}</td>
                                        <td>{parseInt(block.gasUsed).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="card full-width">
                        <h3>Recent Transactions</h3>
                        {blockchainData.transactions.length === 0 ? (
                            <p>No recent transactions.</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tx Hash</th>
                                        <th>Block</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Value (ETH)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blockchainData.transactions.map(tx => (
                                        <tr key={tx.hash}>
                                            <td title={tx.hash}><span className="hash">{tx.hash.substring(0, 10)}...</span></td>
                                            <td>{tx.blockNumber}</td>
                                            <td title={tx.from}>{tx.from.substring(0, 10)}...</td>
                                            <td title={tx.to}>{tx.to ? tx.to.substring(0, 10) + '...' : 'Create'}</td>
                                            <td>{tx.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>System Admin Dashboard</h1>
                <div className="actions">
                    <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="btn">Refresh</button>
                    <button onClick={() => window.location.href = '/dashboard'} className="btn-secondary">User View</button>
                </div>
            </header>

            <div className="tabs" style={{ marginBottom: '2rem', borderBottom: '1px solid #e5e7eb' }}>
                <button
                    className={`tab-btn ${activeTab === 'nodes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('nodes')}
                >
                    Node Topology
                </button>
                <button
                    className={`tab-btn ${activeTab === 'blockchain' ? 'active' : ''}`}
                    onClick={() => setActiveTab('blockchain')}
                >
                    Blockchain Monitor
                </button>
            </div>

            {activeTab === 'nodes' ? renderNodesTab() : renderBlockchainTab()}

            <style>{`
                .stats-grid .card, .card {
                    padding: 1.5rem;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #111;
                    margin: 0.5rem 0 0;
                }
                .tab-btn {
                    padding: 1rem 2rem;
                    border: none;
                    background: none;
                    font-size: 1rem;
                    font-weight: 500;
                    color: #6b7280;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                }
                .tab-btn.active {
                    color: #3b82f6;
                    border-bottom-color: #3b82f6;
                }
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                }
                .data-table th, .data-table td {
                    text-align: left;
                    padding: 0.75rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                .data-table th {
                    font-weight: 600;
                    color: #374151;
                }
                .hash {
                    font-family: monospace;
                    color: #2563eb;
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
