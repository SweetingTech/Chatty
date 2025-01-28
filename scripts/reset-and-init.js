import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__dirname);

async function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { stdio: 'inherit', ...options });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
        
        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function waitForServer(url, maxAttempts = 30, delay = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log('Server is ready!');
                return true;
            }
        } catch (error) {
            if (i === maxAttempts - 1) {
                throw new Error(`Server at ${url} not responding after ${maxAttempts} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
}

async function startChromaServer() {
    const pythonCmd = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';
    const chromaServer = spawn(pythonCmd, ['start_chroma.py'], {
        stdio: 'inherit',
        detached: true
    });
    
    // Don't wait for the server process to exit
    chromaServer.unref();
    
    // Wait for the server to be ready
    console.log('Waiting for ChromaDB server to start...');
    await waitForServer('http://localhost:8001/heartbeat');
}

async function resetAndInit() {
    try {
        const pythonCmd = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';
        
        console.log('Step 1: Resetting ChromaDB...');
        await runCommand(pythonCmd, [join(__dirname, 'reset-chromadb.py')]);
        
        console.log('\nStep 2: Starting ChromaDB server...');
        await startChromaServer();
        
        console.log('\nStep 3: Initializing ChromaDB...');
        await runCommand('node', [join(__dirname, 'init-chromadb.js')]);
        
        console.log('\nStep 4: Initializing Weaviate...');
        await runCommand('node', [join(__dirname, 'init-weaviate.js')]);
        
        console.log('\nDatabase reset and initialization completed successfully!');
    } catch (error) {
        console.error('Error during reset and initialization:', error);
        process.exit(1);
    }
}

// Run the reset and init process
resetAndInit();
