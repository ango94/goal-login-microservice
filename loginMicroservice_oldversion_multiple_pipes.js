const fs = require('fs');
const path = require('path');

// File paths based on your structure
const loginFile = path.join(__dirname, 'PipelineFiles', 'login.txt');
const usersFile = path.join(__dirname, 'users.json');
const remindersFile = path.join(__dirname, 'PipelineFiles', 'reminders.txt');
const deadlinesFile = path.join(__dirname, 'PipelineFiles', 'deadlines.txt');
const dataDirectory = path.join(__dirname, 'Data'); 

let userLogged = false;

// Function to read JSON files
function readJSON(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading JSON from ${filePath}:`, error);
        return null;
    }
}

// Function to write JSON files
function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        console.error(`Error writing JSON to ${filePath}:`, error);
    }
}

// Function to clear txt files
function clearFile(filePath) {
    fs.writeFileSync(filePath, '');
}

// Format and write deadlines in proper HTML
function writeDeadlines(goals) {
    const sortedGoals = goals
        .filter(goal => goal.Deadline) // Filter out invalid deadlines then sort
        .sort((a, b) => new Date(a.Deadline) - new Date(b.Deadline));

    let output = '<h1>Deadlines</h1>\n';

    sortedGoals.forEach((goal, index) => {
        if (index % 10 === 0) { // Add line after every 10 items
            if (index > 0) output += '<br>\n'; 
            output += '<ul>\n';
        }

        const deadlineDate = new Date(goal.Deadline);
        const formattedDate = deadlineDate.toLocaleDateString('en-US');
        const formattedTime = deadlineDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        output += `<li>${formattedDate} ${formattedTime}: ${goal.goalName}</li>\n`;

        if ((index + 1) % 10 === 0 || index === sortedGoals.length - 1) {
            output += '</ul>\n';
        }
    });

    fs.writeFileSync(deadlinesFile, output);
    console.log('Deadline html written to deadlines.txt');
}

// Function to handle login/logout based on login.txt content
function monitorLogin() {
    const loginData = fs.readFileSync(loginFile, 'utf8').split('\n').map(line => line.trim());

    // Logout if login.txt is empty
    if (loginData.length === 1 && loginData[0] === '' && userLogged === true) {
        console.log('Logging out user');
        clearFile(deadlinesFile);
        clearFile(remindersFile);
        userLogged = false;
        console.log('Temporary data cleared');
        return;
    }

    // Login attempt
    if (loginData.length >= 2) {
        const [username, password] = loginData;

        const users = readJSON(usersFile);
        const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

        if (user) {
            console.log('User authenticated:', username);
            userLogged = true;

            const userPathway = path.join(dataDirectory, user.pathway);

            // Wait for path to be written before continuing
            let writeSuccess = false;
            for (let attempts = 0; attempts < 3; attempts++) {
                fs.writeFileSync(loginFile, userPathway);
                const writtenContent = fs.readFileSync(loginFile, 'utf8').trim();
                if (writtenContent === userPathway) {
                    writeSuccess = true;
                    console.log(`User path provided: ${userPathway}`);
                    break;
                } else {
                    console.warn(`Attempt ${attempts + 1}: Login.txt not written. Retrying...`);
                }
            }

            if (!writeSuccess) {
                console.error('login.txt could not be updated. Please restart service.');
                return;
            }

            // Handle goals and reminders
            const goalsFilePath = userPathway;
            writeDeadlines(readJSON(goalsFilePath));
            checkReminders(goalsFilePath);
        } else {
            console.error('Login failed.');
            fs.writeFileSync(loginFile, 'login error'); // Write "login error" to login.txt
        }
    }
}

// Check reminders
function checkReminders(goalsFilePath) {
    const interval = setInterval(() => {
        if (!userLogged) {
            clearInterval(interval);
            return;
        }

        const existingReminders = fs.existsSync(remindersFile) ? fs.readFileSync(remindersFile, 'utf8').trim() : '';
        if (existingReminders && existingReminders !== 'none') {
            return; // Skip if reminders.txt is not empty and doesn't already contain "none"
        }

        const goals = readJSON(goalsFilePath);

        const now = Date.now();
        const nextGoal = goals.find(goal => {
            const deadline = new Date(goal.Deadline);
            if (isNaN(deadline)) {
                console.warn(`Deadline error: ${goal.goalName}`);
                return false;
            }
            return deadline.getTime() <= now && !goal.reminderSent;
        });

        if (nextGoal) {
            // Write the reminder to reminders.txt
            fs.writeFileSync(remindersFile, nextGoal.Reminders);
            nextGoal.reminderSent = true;
            writeJSON(goalsFilePath, goals);
        } else {
            // If no reminders, write "none" to reminders.txt
            fs.writeFileSync(remindersFile, 'NO_REMINDERS');
            console.log('No reminders needed.');
        }
    }, 1000);
}

// Clear files at startup
clearFile(loginFile);
clearFile(deadlinesFile);
clearFile(remindersFile);

// Monitor login.txt for changes
console.log("Login service started. Waiting for request on login.txt...");
fs.watch(loginFile, (eventType) => {
    if (eventType === 'change') {
        try {
            monitorLogin();
        } catch (err) {
            console.error('Error processing login/logout:', err);
        }
    }
});
