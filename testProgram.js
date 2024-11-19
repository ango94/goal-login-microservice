const fs = require('fs');
const path = require('path');
const readline = require('readline');

// File path for pipeline
const loginFile = path.join(__dirname, 'PipelineFiles', 'login.txt');

// Function to read a file
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
        console.error(`Error reading file at ${filePath}:`, error);
        return null;
    }
}

// Function to write to a file
function writeFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, data, 'utf8');
    } catch (error) {
        console.error(`Error writing to file at ${filePath}:`, error);
    }
}

// Menu for user interaction
const menu = `
Choose an option by entering the corresponding number:
1. Login
2. Logout
3. Request Deadlines
4. Request Reminders
5. Exit
`;

// Function to handle login
function login(rl, showMenu) {
    rl.question('Enter username: ', (username) => {
        rl.question('Enter password: ', (password) => {
            writeFile(loginFile, `${username}\n${password}`);
            console.log('Login request sent.');

            // Wait a short moment to let the microservice process the login request
            setTimeout(() => {
                const loginResponse = readFile(loginFile);
                console.log(`Path: ${loginResponse}`);
                if (loginResponse !== 'login error') {
                    writeFile(loginFile, 'LOGIN_SUCCESSFUL');
                    console.log('Login confirmed.');
                } else {
                    console.log('Login failed.');
                }
                showMenu();
            }, 1000);
        });
    });
}

// Function to handle logout
function logout(showMenu) {
    writeFile(loginFile, 'LOGOUT');
    console.log('Logout request sent.');
    showMenu();
}

// Function to request deadlines
function requestDeadlines(showMenu) {
    writeFile(loginFile, 'SEND_DEADLINES');
    console.log('Requesting deadlines...');

    const fetchDeadlines = () => {
        const response = readFile(loginFile);

        if (response === 'SEND_DEADLINES') {
            setTimeout(fetchDeadlines, 500);
            return;
        }

        if (response === 'NO_USER') {
            console.error('Error: No user is logged in. Please log in first.');
            showMenu();
            return;
        }

        if (response) {
            console.log('\n--- Deadlines ---');
            console.log(response);
            showMenu();
        } else {
            setTimeout(fetchDeadlines, 500);
        }
    };
    setTimeout(fetchDeadlines, 500);
}
// Function to request reminders
function requestReminders(showMenu) {
    writeFile(loginFile, 'SEND_REMINDERS');
    console.log('Requesting reminders...');
    const processReminders = () => {
        const response = readFile(loginFile);
        if (response === 'NO_REMINDERS') {
            console.log('All reminders processed.');
            showMenu();
        } else if (response.startsWith('REMINDER_MSG')) {
            const [, message] = response.split('\n');
            console.log('\n--- Reminder ---');
            console.log(message);
            writeFile(loginFile, 'REMINDER_RECEIVED');
            setTimeout(processReminders, 500);
        } else {
            setTimeout(processReminders, 500);
        }
    };

    processReminders();
}


// Main menu
function handleMenuChoice(choice, rl, showMenu) {
    switch (choice.trim()) {
        case '1':
            login(rl, showMenu);
            break;
        case '2':
            logout(showMenu);
            break;
        case '3':
            requestDeadlines(showMenu);
            break;
        case '4':
            requestReminders(showMenu);
            break;
        case '5':
            console.log('Exiting...');
            rl.close();
            process.exit(0);
        default:
            console.log('Invalid choice. Try again.');
            showMenu();
    }
}

// Main program
function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const showMenu = () => {
        console.log(menu);
        rl.question('Enter your choice: ', (choice) => handleMenuChoice(choice, rl, showMenu));
    };

    showMenu();
}

main();
