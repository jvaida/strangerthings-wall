const express = require('express');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arduino IP address and port
const arduinoIP = '192.168.2.100'; // Replace with your Arduino IP address
const arduinoPort = 80;

// OpenAI API setup
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
            let responseData = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                console.log(`Response from Arduino: ${chunk}`);
                responseData += chunk;
            });

            res.on('end', () => {
                console.log('No more data in response.');
                resolve(responseData);
            });
        });

        req.on('error', e => {
            console.error(`Problem with request: ${e.message}`);
            reject(e);
        });

        // Write data to request body
        console.log(`Sending data to Arduino: ${data}`);
        req.write(data);
        req.end();
    });
}

// Function to process input using OpenAI API
async function processInput(input) {
    const response = await openai.completions.create({
        model: 'gpt-3.5-turbo', // or 'gpt-3.5-turbo' or 'gpt-4' if you have access
        prompt: input,
        max_tokens: 50,
    });

    const data = response.data;
    console.log(data);  // Log the response to inspect its structure
    return data.choices[0].text.trim();  // Extract and return the generated text
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
            // Generate new responses using AI processing
            try {
                const aiResponse = await processInput(command.wordToArduino1);
                console.log(aiResponse); // Log the response to inspect the structure

                wordToArduino1 = aiResponse || 'DEFAULT_RESPONSE_1';
                wordToArduino2 = 'DEFAULT_RESPONSE_2'; // You can modify this as needed
            } catch (error) {
                console.error('Error processing input with AI:', error);
                res.status(500).send('Error processing input with AI');
                return;
            }
        }

        res.send({ wordToArduino1, wordToArduino2 });

        console.log(`Sending to Arduino: ${wordToArduino1}`);
        try {
            await sendToArduino(JSON.stringify({ command: wordToArduino1.toUpperCase() }));
            console.log('First command sent successfully.');
        } catch (error) {
            console.error('Error sending first command to Arduino:', error);
        }

        console.log('Sending flicker command to Arduino.');
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Ensure 2-second delay
            await sendToArduino(flickerCommand);
            console.log('Flicker command sent successfully.');
        } catch (error) {
            console.error('Error sending flicker command to Arduino:', error);
        }

        console.log(`Sending to Arduino: ${wordToArduino2}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Ensure 2-second delay
            await sendToArduino(JSON.stringify({ command: wordToArduino2.toUpperCase() }));
            console.log('Second command sent successfully.');
        } catch (error) {
            console.error('Error sending second command to Arduino:', error);
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
