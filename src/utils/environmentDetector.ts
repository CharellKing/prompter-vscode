import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Environment {
    type: 'python' | 'nodejs';
    path: string;
    version: string;
    displayName: string;
}

export class EnvironmentDetector {
    private static instance: EnvironmentDetector;
    private environments: Environment[] = [];

    private constructor() {}

    public static getInstance(): EnvironmentDetector {
        if (!EnvironmentDetector.instance) {
            EnvironmentDetector.instance = new EnvironmentDetector();
        }
        return EnvironmentDetector.instance;
    }

    public async detectEnvironments(): Promise<Environment[]> {
        this.environments = [];
        
        // Detect Python environments
        await this.detectPythonEnvironments();
        
        // Detect Node.js environments
        await this.detectNodejsEnvironments();
        
        return this.environments;
    }

    private async detectPythonEnvironments(): Promise<void> {
        const pythonCommands = ['python', 'python3', 'py'];
        
        for (const cmd of pythonCommands) {
            try {
                const { stdout: versionOutput } = await execAsync(`${cmd} --version`);
                const { stdout: pathOutput } = await execAsync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`);
                
                const version = versionOutput.trim();
                const paths = pathOutput.trim().split('\n');
                
                for (const envPath of paths) {
                    const cleanPath = envPath.trim();
                    if (cleanPath && !this.environments.some(env => env.path === cleanPath)) {
                        this.environments.push({
                            type: 'python',
                            path: cleanPath,
                            version: version,
                            displayName: `${version} (${cleanPath})`
                        });
                    }
                }
            } catch (error) {
                // Ignore errors, continue detecting other environments
            }
        }

        // Detect conda environments
        await this.detectCondaEnvironments();
        
        // Detect virtual environments
        await this.detectVirtualEnvironments();
    }

    private async detectCondaEnvironments(): Promise<void> {
        try {
            const { stdout } = await execAsync('conda env list');
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const envName = parts[0];
                        const envPath = parts[parts.length - 1];
                        
                        if (envPath.includes(path.sep)) {
                            const pythonPath = path.join(envPath, process.platform === 'win32' ? 'python.exe' : 'bin/python');
                            
                            try {
                                const { stdout: versionOutput } = await execAsync(`"${pythonPath}" --version`);
                                const version = versionOutput.trim();
                                
                                this.environments.push({
                                    type: 'python',
                                    path: pythonPath,
                                    version: version,
                                    displayName: `${version} - Conda (${envName})`
                                });
                            } catch (error) {
                                // Ignore invalid environments
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // conda not available
        }
    }

    private async detectVirtualEnvironments(): Promise<void> {
        // Detect common virtual environment locations
        const commonVenvPaths = [
            path.join(process.env.HOME || process.env.USERPROFILE || '', '.virtualenvs'),
            path.join(process.cwd(), 'venv'),
            path.join(process.cwd(), '.venv'),
            path.join(process.cwd(), 'env')
        ];

        for (const venvDir of commonVenvPaths) {
            try {
                const pythonPath = path.join(venvDir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
                const { stdout: versionOutput } = await execAsync(`"${pythonPath}" --version`);
                const version = versionOutput.trim();
                
                this.environments.push({
                    type: 'python',
                    path: pythonPath,
                    version: version,
                    displayName: `${version} - Virtual Env (${path.basename(venvDir)})`
                });
            } catch (error) {
                // Virtual environment does not exist or is invalid
            }
        }
    }

    private async detectNodejsEnvironments(): Promise<void> {
        const nodeCommands = ['node', 'nodejs'];
        
        for (const cmd of nodeCommands) {
            try {
                const { stdout: versionOutput } = await execAsync(`${cmd} --version`);
                const { stdout: pathOutput } = await execAsync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`);
                
                const version = versionOutput.trim();
                const paths = pathOutput.trim().split('\n');
                
                for (const envPath of paths) {
                    const cleanPath = envPath.trim();
                    if (cleanPath && !this.environments.some(env => env.path === cleanPath)) {
                        this.environments.push({
                            type: 'nodejs',
                            path: cleanPath,
                            version: version,
                            displayName: `Node.js ${version} (${cleanPath})`
                        });
                    }
                }
            } catch (error) {
                // Ignore errors
            }
        }

        // Detect nvm environments
        await this.detectNvmEnvironments();
    }

    private async detectNvmEnvironments(): Promise<void> {
        try {
            // Windows nvm
            const { stdout } = await execAsync('nvm list');
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                const match = line.match(/\s*(\d+\.\d+\.\d+)/);
                if (match) {
                    const version = match[1];
                    const nvmHome = process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm');
                    const nodePath = path.resolve(nvmHome, `v${version}`, 'node.exe');
                    
                    // Verify if file exists
                    try {
                        await fs.promises.access(nodePath);
                        this.environments.push({
                            type: 'nodejs',
                            path: nodePath,
                            version: `v${version}`,
                            displayName: `Node.js v${version} - NVM`
                        });
                    } catch (accessError) {
                        // File does not exist, skip this version
                    }
                }
            }
        } catch (error) {
            // nvm not available or on Unix system
            try {
                // Unix nvm
                const { stdout } = await execAsync('bash -c "source ~/.nvm/nvm.sh && nvm list"');
                const lines = stdout.split('\n');
                
                for (const line of lines) {
                    const match = line.match(/\s*v(\d+\.\d+\.\d+)/);
                    if (match) {
                        const version = match[1];
                        const nvmPath = path.resolve(process.env.HOME || '', '.nvm', 'versions', 'node', `v${version}`, 'bin', 'node');
                        
                        // Verify if file exists
                        try {
                            await fs.promises.access(nvmPath);
                            this.environments.push({
                                type: 'nodejs',
                                path: nvmPath,
                                version: `v${version}`,
                                displayName: `Node.js v${version} - NVM`
                            });
                        } catch (accessError) {
                            // File does not exist, skip this version
                        }
                    }
                }
            } catch (unixError) {
                // nvm not available
            }
        }
    }

    public getEnvironments(): Environment[] {
        return this.environments;
    }

    public getEnvironmentsByType(type: 'python' | 'nodejs'): Environment[] {
        return this.environments.filter(env => env.type === type);
    }
}