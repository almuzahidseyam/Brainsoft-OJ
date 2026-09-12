const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function runCode(code, language, input) {
    return new Promise((resolve) => {
        if (language !== 'python') {
            resolve({ error: true, errorType: 'Unsupported Language' });
            return;
        }

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const filename = path.join(tempDir, \`\${uuidv4()}.py\`);
        fs.writeFileSync(filename, code);

        const startTime = Date.now();
        const process = spawn('python', [filename]);

        let output = '';
        let errorOutput = '';

        // Timeout 2 seconds
        const timeout = setTimeout(() => {
            process.kill();
            resolve({ error: true, errorType: 'Time Limit Exceeded', executionTime: Date.now() - startTime });
            try { fs.unlinkSync(filename); } catch (e) {}
        }, 2000);

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            clearTimeout(timeout);
            try { fs.unlinkSync(filename); } catch (e) {}
            
            const executionTime = Date.now() - startTime;
            if (code !== 0) {
                resolve({ error: true, errorType: 'Runtime Error', executionTime, details: errorOutput });
            } else {
                resolve({ error: false, output, executionTime });
            }
        });

        if (input) {
            process.stdin.write(input);
            process.stdin.end();
        }
    });
}

module.exports = { runCode };
