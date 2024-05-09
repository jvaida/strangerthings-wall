const express = require('express');
const http = require('http');
const Dictionary = require('./dictionary');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load the chatbot dictionary
let dictionaryData = fs.readFileSync('default.json', 'utf8');
let dictionary = new Dictionary(JSON.parse(dictionaryData));

// Arduino IP address and port
const arduinoIP = '192.168.79.195';
const arduinoPort = 80;

// Function to send data to Arduino using POST request
function sendToArduino(data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: arduinoIP,
            port: arduinoPort,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, res => {
            res.setEncoding('utf8');
            res.on('data', chunk => {
                console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                console.log('No more data in response.');
                resolve();
            });
        });

        req.on('error', e => {
            console.error(`Problem with request: ${e.message}`);
            reject(e);
        });

        // Write data to request body
        req.write(data);
        req.end();
    });
}

// Routes
app.post('/send-command', async (req, res) => {
    const { command, repeat } = req.body;
    const flickerCommand = JSON.stringify({ command: "FLICKER_SIGNAL" });

    if (command) {
        let wordToArduino1, wordToArduino2;

        if (repeat) {
            // If repeat flag is true, use the command directly as it contains the last response and question
            wordToArduino1 = command.wordToArduino1;
            wordToArduino2 = command.wordToArduino2;
        } else {
            // Generate new responses from the dictionary
            let keywords = dictionary.getKeywords(command.wordToArduino1);
            wordToArduino1 = dictionary.getAnswer(keywords).toUpperCase();
            wordToArduino2 = dictionary.getQuestion(keywords).toUpperCase();
        }

        res.send({ wordToArduino1, wordToArduino2 });

        console.log(`Sending to Arduino: ${wordToArduino1}`);
        console.log(`Sending to Arduino: ${wordToArduino2}`);

        try {
            await sendToArduino(JSON.stringify({ command: wordToArduino1.toUpperCase() }));
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await sendToArduino(flickerCommand);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await sendToArduino(JSON.stringify({ command: wordToArduino2.toUpperCase() }));
        } catch (error) {
            console.error('Error sending data to Arduino:', error);
        }
    } else {
        res.status(400).send('No command provided');
    }
});

// Endpoint to receive logs from Arduino
app.post('/log', (req, res) => {
    const message = req.body.message;
    console.log('Log from Arduino:', message);
    res.sendStatus(200);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
