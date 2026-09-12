<div align="center">

# 🚀 Brainsoft-OJ

[![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-Frontend-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-lightgrey?style=for-the-badge&logo=sqlite)](https://sqlite.org/)

*A lightweight, local-first Online Judge platform for competitive programming and learning.*

</div>

## Features
- 🧩 **Problem Archive:** View and read problems.
- 💻 **In-Browser Editor:** Write code using the Monaco Editor (same as VS Code).
- ⚙️ **Real-time Judging Engine:** Securely execute Python code locally against hidden test cases.
- ⚡ **Instant Verdicts:** Get Accepted (AC), Wrong Answer (WA), or Time Limit Exceeded (TLE) verdicts in real-time.

## Architecture
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite (Zero configuration needed)
- **Judge:** Custom sandboxed Node.js `child_process` engine.

## How to Run Locally

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/almuzahidseyam/Brainsoft-OJ.git
   cd Brainsoft-OJ
   \`\`\`

2. **Install dependencies**
   - For backend: `cd backend && npm install`
   - For frontend: `cd frontend && npm install`

3. **Start the servers**
   You can run the provided `start.ps1` script on Windows, or start them manually:
   - Backend: `cd backend && npm start`
   - Frontend: `cd frontend && npm run dev`

## Contribution
Contributions are welcome! Feel free to open issues or submit Pull Requests for adding features like C++ support, Leaderboards, or User Authentication.

## License
MIT License
