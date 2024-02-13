const express = require('express');
const {SerialPort} = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const Dictionary = require('./dictionary');
const fs = require('fs');

const app = express();
const port = 8080;

const cors = require('cors');
app.use(cors());

// Replace '/dev/ttyACM0' with your Arduino's serial port
const arduinoPort = new SerialPort({path: '/dev/tty.usbmodem101', baudRate: 9600 });
const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// Load the chatbot dictionary
let dictionaryData = fs.readFileSync('default.json', 'utf8');
let dictionary = new Dictionary(JSON.parse(dictionaryData));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.post('/send-command', (req, res) => {
    
    const { command,repeat } = req.body;
    if (command) {
        console.log(`Command received: ${command}`);
            let wordToArduino = command;
            if(!repeat){
                // Generate chatbot response
                let keywords = dictionary.getKeywords(command);
                wordToArduino = dictionary.getAnswer(keywords).toUpperCase();
            }
            res.send({ message: 'Command sent to Arduino successfully', wordToArduino });

            console.log(`Sending chat response to Arduino: ${wordToArduino}`);
            arduinoPort.write(`${wordToArduino}\n`, (err) => {
                if (err) {
                    console.error('Error sending chat response to Arduino:', err);
                }
            });


    } else {
        res.status(400).send('No command provided');
    }
});

// Listening for data from Arduino
parser.on('data', data =>{
  console.log('Data from Arduino:', data);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
