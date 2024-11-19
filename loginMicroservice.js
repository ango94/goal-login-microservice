const fs = require('fs');
const path = require('path');

// File paths
const loginFile = path.join(__dirname, 'PipelineFiles', 'login.txt');
const usersFile = path.join(__dirname, 'users.json');
const dataDirectory = path.join(__dirname, 'Data'); 

let userLogged = false; // Set no user logged in
let userPath = ''; // Store the path to the user's JSON file
let reminderQueue = []; // Queue to handle reminders

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

// Function to write to login.txt
function writeLoginFile(content) {
    try {
        fs.writeFileSync(loginFile, content, 'utf8');
    } catch (error) {
        console.error(`Error writing to login.txt:`, error);
    }
}

// Function to generate deadlines HTML
function generateDeadlinesHTML(goals) {
    const sortedGoals = goals
        .filter(goal => goal.Deadline) // Filter out invalid deadlines
        .sort((a, b) => new Date(a.Deadline) - new Date(b.Deadline));

    let output = '<h1>Deadlines</h1>\n';
    sortedGoals.forEach((goal, index) => {
        if (index % 10 === 0) {
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

        output += `<li>${formattedDate} ${formattedTime}: ${goal.goalName}</li>\n`;  // modify this if you want a different format

        if ((index + 1) % 10 === 0 || index === sortedGoals.length - 1) {
            output += '</ul>\n';
        }
    });

    return output || '<p>No valid goals available.</p>';
}

// Function to handle reminders
function processReminders() {
    if (!userLogged) {
        writeLoginFile('NO_USER');
        console.log('Attempted to process reminders without a logged-in user.');
        return;
    }

    if (reminderQueue.length === 0) {
        writeLoginFile('NO_REMINDERS');
        console.log('All reminders sent.');
        return;
    }

    const nextReminder = reminderQueue.shift(); // Get the next reminder in the queue
    const reminderContent = `REMINDER_MSG\n${nextReminder.reminderText}`;
    writeLoginFile(reminderContent);

    console.log('Reminder sent:', nextReminder.reminderText);

    // Update the reminderSent field and save updated goals
    const goals = readJSON(userPath);

    // Ensure the specific goal is updated correctly
    const goalToUpdate = goals.find(goal => goal.goalName === nextReminder.goal.goalName);
    if (goalToUpdate) {
        goalToUpdate.reminderSent = true; // Mark the reminder as sent
    } else {
        console.warn(`Could not find the goal to update: ${nextReminder.goal.goalName}`);
    }

    // Write the updated goals back to the userPath JSON file
    writeJSON(userPath, goals);

    // Wait for confirmation before sending the next reminder
    const reminderCheck = () => {
        const content = fs.readFileSync(loginFile, 'utf8').trim();
        if (content === 'REMINDER_RECEIVED') {
            clearTimeout(timeout);
            console.log('Reminder received.');
            processReminders(); // Process the next reminder
        } else {
            setTimeout(reminderCheck, 500);
        }
    };

    const timeout = setTimeout(reminderCheck, 500);
}

// Function to handle logout
function handleLogout() {
    userLogged = false;
    userPath = '';
    reminderQueue = [];
    writeLoginFile('LOGOUT_SUCCESSFUL');
    console.log('User logged out successfully.');
}

// Function to monitor login.txt
function monitorLogin() {
    fs.watch(loginFile, (eventType) => {
        if (eventType === 'change') {
            const content = fs.readFileSync(loginFile, 'utf8').trim();

            // Handle login requests only if user is not logged in
            if (!userLogged && content.includes('\n')) {
                const [username, password] = content.split('\n').map(line => line.trim());
                const users = readJSON(usersFile);
                const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

                if (user) {
                    userPath = path.join(dataDirectory, user.pathway);
                    writeLoginFile(userPath);
                    console.log('Path written to login.txt. Waiting for confirmation...');
                } else {
                    writeLoginFile('login error');
                }
            } else if (content === 'LOGIN_SUCCESSFUL' && !userLogged) {
                if (userPath) {
                    userLogged = true;
                    console.log('User logged in successfully.');
                } else {
                    console.error('No valid user path found during login confirmation.');
                }
            } else if (content === 'SEND_DEADLINES' && userLogged) {
                const goals = readJSON(userPath);
                const deadlinesHTML = generateDeadlinesHTML(goals);
                writeLoginFile(deadlinesHTML);
                console.log('Deadlines sent.');
            } else if (content === 'SEND_REMINDERS' && userLogged) {
                const goals = readJSON(userPath);

                // Add all pending reminders to the queue
                const now = Date.now();
                reminderQueue = goals
                    .filter(goal => new Date(goal.Deadline).getTime() <= now && !goal.reminderSent)
                    .map(goal => ({ goal, reminderText: goal.Reminders || 'No reminder set.' }));

                if (reminderQueue.length === 0) {
                    writeLoginFile('NO_REMINDERS');
                    console.log('No reminders available.');
                } else {
                    processReminders();
                }
            } else if (content === 'LOGOUT') {
                handleLogout();
            }
        }
    });
}

writeLoginFile('');
console.log('Login service started. Monitoring login.txt...');
monitorLogin();