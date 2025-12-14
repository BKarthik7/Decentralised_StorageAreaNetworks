-- Drop tables if they exist (reverse order of dependencies)
DROP TABLE IF EXISTS key_shards;
DROP TABLE IF EXISTS access_logs;
DROP TABLE IF EXISTS replicas;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Files table
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    uploader_id INTEGER REFERENCES users(id),
    cid VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size BIGINT,
    metadata_hash VARCHAR(255),
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_cid ON files(cid);

-- Replicas table
CREATE TABLE replicas (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    provider VARCHAR(50) NOT NULL,
    provider_metadata JSONB,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    last_checked TIMESTAMP WITH TIME ZONE
);

-- Access Logs table
CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    accessed_by INTEGER REFERENCES users(id),
    access_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(50)
);

CREATE INDEX idx_access_logs_access_time ON access_logs(access_time);

-- Key Shards Table
CREATE TABLE IF NOT EXISTS key_shards (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    shard_index INTEGER NOT NULL,
    shard_ref TEXT NOT NULL,
    holder TEXT NOT NULL, -- Could be a node ID or user ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Nodes Table (Dynamic Registry)
CREATE TABLE IF NOT EXISTS nodes (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'node-1'
    name VARCHAR(100) NOT NULL,
    location VARCHAR(50),
    status VARCHAR(20) DEFAULT 'online', -- 'online', 'offline'
    load INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Initial Nodes ( Simulation)
INSERT INTO nodes (id, name, location, status, load) VALUES 
('node-1', 'Alpha Node', 'EU', 'online', 45),
('node-2', 'Beta Node', 'US', 'online', 30),
('node-3', 'Gamma Node', 'ASIA', 'online', 15)
ON CONFLICT (id) DO NOTHING;

-- Sample Admin User
-- Password hash for 'admin123' (placeholder, should be generated properly in real app)
INSERT INTO users (email, password_hash, display_name)
VALUES ('admin@example.com', '$2b$12$938wkUr4j72ripYnDR7Cw.SbjXpd80pzsDeXcfofLvryVhjDyPSlm', 'Admin User');
