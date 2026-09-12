const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function runCode(code, language, input) {
    return new Promise((resolve) => {
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const basename = uuidv4();
        let filename;
        let executable;
        let command;
        let args = [];

        if (language === 'python') {
            filename = path.join(tempDir, `${basename}.py`);
            fs.writeFileSync(filename, code);
            command = 'python';
            args = [filename];
        } else if (language === 'cpp') {
            filename = path.join(tempDir, `${basename}.cpp`);
            executable = path.join(tempDir, `${basename}.exe`);
            fs.writeFileSync(filename, code);
            
            // Compile C++
            const compileProcess = spawnSync('g++', [filename, '-o', executable]);
            if (compileProcess.status !== 0) {
                resolve({ error: true, errorType: 'Compilation Error', details: compileProcess.stderr.toString() });
                try { fs.unlinkSync(filename); } catch(e){}
                return;
            }
            command = executable;
            args = [];
        } else if (language === 'java') {
            // Java requires the public class name to match the filename. We will enforce class Solution.
            filename = path.join(tempDir, 'Solution.java');
            executable = path.join(tempDir, 'Solution.class'); // For deletion tracking
            
            // If there's concurrent Java submissions, 'Solution.java' might collide. 
            // Better to create a sub-directory for each Java submission.
            const javaDir = path.join(tempDir, basename);
            fs.mkdirSync(javaDir);
            filename = path.join(javaDir, 'Solution.java');
            fs.writeFileSync(filename, code);
            
            const compileProcess = spawnSync('javac', [filename]);
            if (compileProcess.status !== 0) {
                resolve({ error: true, errorType: 'Compilation Error', details: compileProcess.stderr.toString() });
                try { fs.rmSync(javaDir, { recursive: true, force: true }); } catch(e){}
                return;
            }
            command = 'java';
            args = ['-cp', javaDir, 'Solution'];
            
            // Override cleanup specifically for java to remove the directory
            executable = javaDir; 
        } else {
            resolve({ error: true, errorType: 'Unsupported Language' });
            return;
        }

        const startTime = Date.now();
        const childProcess = spawn(command, args);

        let output = '';
        let errorOutput = '';

        // Timeout 2 seconds
        const timeout = setTimeout(() => {
            childProcess.kill();
            resolve({ error: true, errorType: 'Time Limit Exceeded', executionTime: Date.now() - startTime });
            try { 
                if(language === 'java') { fs.rmSync(executable, { recursive: true, force: true }); } 
                else { fs.unlinkSync(filename); if(executable) fs.unlinkSync(executable); } 
            } catch (e) {}
        }, 2000);

        childProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        childProcess.on('close', (exitCode) => {
            clearTimeout(timeout);
            try { 
                if(language === 'java') { fs.rmSync(executable, { recursive: true, force: true }); } 
                else { fs.unlinkSync(filename); if(executable) fs.unlinkSync(executable); } 
            } catch (e) {}
            
            const executionTime = Date.now() - startTime;
            if (exitCode !== 0) {
                resolve({ error: true, errorType: 'Runtime Error', executionTime, details: errorOutput });
            } else {
                resolve({ error: false, output, executionTime });
            }
        });

        if (input) {
            childProcess.stdin.write(input);
            childProcess.stdin.end();
        }
    });
}

module.exports = { runCode };
