import { execSync } from 'child_process';
import findProcess from 'find-process';

async function killProcesses() {
  // Only kill Vite processes, leave ChromaDB running
  try {
    const viteProcesses = await findProcess('port', 5173);
    const viteProcesses2 = await findProcess('port', 5174);
    [...viteProcesses, ...viteProcesses2].forEach(proc => {
      console.log(`Killing Vite process ${proc.pid}`);
      process.kill(proc.pid);
    });
  } catch (err) {
    console.log('No Vite processes found');
  }

  // Check if ChromaDB is running
  try {
    const chromaProcesses = await findProcess('port', 8001);
    if (chromaProcesses.length === 0) {
      console.log('ChromaDB not running, will be started by npm script');
    } else {
      console.log('ChromaDB already running, reusing existing instance');
    }
  } catch (err) {
    console.log('Error checking ChromaDB process:', err);
  }

  // Give processes time to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Just kill processes and exit - let npm script handle starting servers
killProcesses().catch(console.error);
