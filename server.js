const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the same directory
app.use(express.static(__dirname));

// Serve the index.html file when the root URL is accessed
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket connection for real-time communication
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Broadcast message to all clients except the sender
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });

        // switch case for calls functions
// let users = [];
// let currentUser = null;

//         const data = JSON.parse(message);

//         switch (data.type) {
//             case 'login':
//                 currentUser = { name: data.name, ws };
//                 users.push(currentUser);
//                 console.log(`User ${data.name} logged in.`);
//                 break;

//             case 'call':
//                 const targetUser = users.find(u => u.name === data.targetUser);
//                 if (targetUser) {
//                     targetUser.ws.send(JSON.stringify({
//                         type: 'call',
//                         from: currentUser.name,
//                         offer: data.offer
//                     }));
//                     targetUser.ws.send(JSON.stringify({
//                         type: 'notification',
//                         message: `${currentUser.name} is calling you.`
//                     }));
//                 }
//                 break;

//             case 'answer':
//                 const caller = users.find(u => u.name === data.targetUser);
//                 if (caller) {
//                     caller.ws.send(JSON.stringify({
//                         type: 'answer',
//                         from: currentUser.name,
//                         answer: data.answer
//                     }));
//                 }
//                 break;

//             case 'ice':
//                 const iceTarget = users.find(u => u.name === data.targetUser);
//                 if (iceTarget) {
//                     iceTarget.ws.send(JSON.stringify({
//                         type: 'ice',
//                         from: currentUser.name,
//                         ice: data.ice
//                     }));
//                 }
//                 break;
//         }
//     });


        // end sritch and calls functions

    });
});

// Start the server
server.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});




// mnre 

// const WebSocket = require('ws');

// const wss = new WebSocket.Server({ port: 8080 });

// let users = [];

// wss.on('connection', (ws) => {
//     let currentUser = null;
    
//     ws.on('message', (message) => {
//         const data = JSON.parse(message);

//         switch (data.type) {
//             case 'login':
//                 currentUser = { name: data.name, ws };
//                 users.push(currentUser);
//                 console.log(`User ${data.name} logged in.`);
//                 broadcastUserList();
//                 broadcastMessage({ type: 'notification', message: `${data.name} is online.` });
//                 break;

//             case 'call':
//                 const targetUser = users.find(u => u.name === data.targetUser);
//                 if (targetUser) {
//                     targetUser.ws.send(JSON.stringify({
//                         type: 'call',
//                         from: currentUser.name,
//                         offer: data.offer
//                     }));
//                     targetUser.ws.send(JSON.stringify({
//                         type: 'notification',
//                         message: `${currentUser.name} is calling you.`
//                     }));
//                 }
//                 break;

//             case 'answer':
//                 const caller = users.find(u => u.name === data.targetUser);
//                 if (caller) {
//                     caller.ws.send(JSON.stringify({
//                         type: 'answer',
//                         from: currentUser.name,
//                         answer: data.answer
//                     }));
//                 }
//                 break;

//             case 'ice':
//                 const iceTarget = users.find(u => u.name === data.targetUser);
//                 if (iceTarget) {
//                     iceTarget.ws.send(JSON.stringify({
//                         type: 'ice',
//                         from: currentUser.name,
//                         ice: data.ice
//                     }));
//                 }
//                 break;
//         }
//     });

//     ws.on('close', () => {
//         if (currentUser) {
//             users = users.filter(u => u.name !== currentUser.name);
//             console.log(`User ${currentUser.name} disconnected.`);
//             broadcastUserList();
//             broadcastMessage({ type: 'notification', message: `${currentUser.name} went offline.` });
//         }
//     });

//     // Broadcast user list to all users
//     function broadcastUserList() {
//         const userNames = users.map(u => u.name);
//         users.forEach(user => {
//             user.ws.send(JSON.stringify({ type: 'user_list', users: userNames }));
//         });
//     }

//     // Send a message to all connected users
//     function broadcastMessage(message) {
//         users.forEach(user => {
//             user.ws.send(JSON.stringify(message));
//         });
//     }
// });
