<div align="center">

# 🚀 Brainsoft-OJ

[![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-Frontend-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-lightgrey?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
[![C++](https://img.shields.io/badge/Language-C++_STL-00599C?style=for-the-badge&logo=c%2B%2B)](https://cplusplus.com/)
[![Java](https://img.shields.io/badge/Language-Java_21-E34F26?style=for-the-badge&logo=java)](https://java.com/)
[![Python](https://img.shields.io/badge/Language-Python_3-FFD43B?style=for-the-badge&logo=python)](https://python.org/)

*A remarkable, local-first Online Judge platform for competitive programming and algorithm practice.*

</div>

## ✨ Why use Brainsoft-OJ?
Most Online Judges (like Codeforces, LeetCode, or SYZOJ) require setting up complex Docker environments, heavy SQL databases, or Linux specific dependencies. 
**Brainsoft-OJ** is designed to be the ultimate local learning tool:
- **Zero-Config Database:** Uses SQLite. Just run the server, and the database handles itself.
- **Local Judging:** The custom execution engine safely runs your code on your local machine.
- **Beautiful UI:** A sleek, modern interface built with React and Tailwind CSS, featuring the Monaco Editor for a VS Code-like coding experience.
- **Multi-Language:** First-class support for the core competitive programming languages (with full access to their standard libraries).

## 🛠️ Supported Languages & Libraries
- **C++ (g++)**: Full support for the C++ Standard Template Library (`#include <bits/stdc++.h>`, Vectors, Maps, Sets).
- **Java (JDK 21)**: Full support for Java Collections, `java.math.BigInteger`, and modern JDK 21 features. *(Note: Class name must be `Solution`)*
- **Python 3**: Full access to Python's robust standard library (`math`, `collections`, `itertools`).

## ⚙️ Architecture
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite
- **Judge Engine:** A custom sandboxed `child_process` engine that routes compilations (g++, javac) and executes binaries against hidden test cases in real-time.

## 🚀 How to Run Locally

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/almuzahidseyam/Brainsoft-OJ.git
   cd Brainsoft-OJ
   \`\`\`

2. **Install dependencies**
   - For backend: `cd backend && npm install`
   - For frontend: `cd frontend && npm install`

3. **Start the servers**
   On Windows, simply double-click the `start.ps1` script (or right-click -> Run with PowerShell). Alternatively:
   - Backend: `cd backend && npm start`
   - Frontend: `cd frontend && npm run dev`

## 🤝 Contribution
Contributions are highly welcome! Whether you want to add support for Rust/Go, implement a real-time leaderboard, or add new algorithmic problems—feel free to open issues or submit Pull Requests. **Happy Contributing!**

## 📄 License
MIT License
