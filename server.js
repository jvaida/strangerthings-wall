const express = require('express');
const {SerialPort} = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const Dictionary = require('./dictionary');
const fs = require('fs');

const app = express();
const port = 8080;

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
    
    const { command } = req.body;
    if (command) {
        console.log(`Sending command to Arduino: ${command}`);
        arduinoPort.write(`${command}\n`, (err) => {
            if (err) {
                return res.status(500).send('Failed to send command to Arduino');
            }

            // Generate chatbot response
            let keywords = dictionary.getKeywords(command);
            let chatResponse = dictionary.getAnswer(keywords);
            res.send({ message: 'Command sent to Arduino successfully', chatResponse });

            setTimeout(() => {
                console.log(`Sending chat response to Arduino: ${chatResponse}`);
                arduinoPort.write(`${chatResponse}\n`, (err) => {
                    if (err) {
                        console.error('Error sending chat response to Arduino:', err);
                    }
                });
            }, 5000); 

            
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
