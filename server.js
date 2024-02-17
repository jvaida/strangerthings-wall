const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
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

// Assuming '/dev/tty.usbmodem101' is the correct serial port
const arduinoPort = new SerialPort({ path: '/dev/tty.usbmodem101', baudRate: 9600 });
const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// Routes
app.post('/send-command', async (req, res) => {
    const { command, repeat } = req.body;
    const flickerCommand = "FLICKER_SIGNAL"
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

        arduinoPort.write(`${wordToArduino1.toUpperCase()}\n`, (err) => {
            if (err) console.error('Error sending word 1 to Arduino:', err);
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second

        arduinoPort.write(`${flickerCommand}\n`, (err) => {
            if (err) console.error('Error sending flicker signal to Arduino:', err);
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second

        arduinoPort.write(`${wordToArduino2.toUpperCase()}\n`, (err) => {
            if (err) console.error('Error sending word 2 to Arduino:', err);
        });

    } else {
        res.status(400).send('No command provided');
    }
});

// Listening for data from Arduino
// parser.on('data', data => {
//     console.log('Data from Arduino:', data);
// });

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
