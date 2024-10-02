// Import Firebase libraries
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBBnkH_V-yU-XGjxvpflPFWNTXSSGCCnPk",
    authDomain: "video-calling-d6518.firebaseapp.com",
    projectId: "video-calling-d6518",
    storageBucket: "video-calling-d6518.appspot.com",
    messagingSenderId: "238450505104",
    appId: "1:238450505104:web:4650064e7c157bda892f15",
    measurementId: "G-DTJVCXTQWB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// DOM Elements
const loginOverlay = document.getElementById("login-overlay");
const appContainer = document.getElementById("app-container");
const userNameSpan = document.getElementById("logged-user");
const profilePic = document.getElementById("profile-pic");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");
const contactList = document.getElementById("contacts");
const chatWindow = document.getElementById("chat-window");
const chatHeader = document.getElementById("chat-header");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const audioCallButton = document.getElementById("audio-call-btn");
const videoCallButton = document.getElementById("video-call-btn");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const profileContainer = document.getElementById("profile-container");

let selectedUser = null;
let localStream;
let peerConnection;
let unreadMessages = {}; // To track unread messages for each user
let lastMessageTimestamp = null; // To track the last message timestamp

// Google Login
loginButton.onclick = function () {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            storeUserData(user);
        })
        .catch((error) => {
            console.error("Login Error: ", error);
        });
};

// Logout Function
logoutButton.onclick = function () {
    signOut(auth).then(() => {
        loginOverlay.style.display = "flex";
        appContainer.style.display = "none";
        console.log("User logged out.");
    }).catch((error) => {
        console.error("Logout Error: ", error);
    });
};

// Store user data if first time, or fetch existing data
function storeUserData(user) {
    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then((docSnapshot) => {
        if (!docSnapshot.exists()) {
            // Store user data if it's their first login
            setDoc(userRef, {
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL
            }).then(() => {
                console.log("User data stored in Firestore.");
                updateUI(user);
            });
        } else {
            console.log("User data already exists.");
            updateUI(user);
        }
    }).catch((error) => {
        console.error("Error fetching user data: ", error);
    });
}

// Update UI after login
function updateUI(user) {
    loginOverlay.style.display = "none";
    appContainer.style.display = "flex";
    userNameSpan.innerText = user.displayName;
    profilePic.src = user.photoURL;
    fetchUserList(user);
}

// Fetch and display users list except logged-in user
function fetchUserList(loggedInUser) {
    contactList.innerHTML = ''; // Clear the existing list
    getDocs(collection(db, 'users'))
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const user = doc.data();
                if (user.uid !== loggedInUser.uid) {
                    const li = document.createElement("li");
                    li.id = "userListAJ";
                    li.innerText = user.name;
                    li.setAttribute("data-user-id", user.uid);

                    // Unread messages indicator
                    const unreadIndicator = document.createElement("span");
                    unreadIndicator.classList.add("unread-indicator");
                    unreadIndicator.id = `unread-${user.uid}`;
                    li.appendChild(unreadIndicator);

                    li.onclick = () => {
                        selectUser(user);
                        // Clear unread messages count when the user is selected
                        unreadMessages[user.uid] = 0;
                        updateUnreadIndicator(user.uid);
                    };
                    contactList.appendChild(li);
                }
            });
        })
        .catch((error) => {
            console.error("Error fetching user list: ", error);
        });
}

// Update unread messages indicator
function updateUnreadIndicator(userId) {
    const unreadIndicator = document.getElementById(`unread-${userId}`);
    const count = unreadMessages[userId] || 0;
    unreadIndicator.innerText = count > 0 ? ` (${count})` : '';
}

// Select a user to chat
function selectUser(user) {
    selectedUser = user;   
    const profileContainer = document.createElement("div");
    profileContainer.style.display = "flex"; 
    profileContainer.style.alignItems = "center"; 
    profileContainer.style.gap = "10px"; 
    const imgShowPro = document.createElement("img");
    imgShowPro.src = user.photoURL;
    imgShowPro.width = 40;
    imgShowPro.height = 40;
    imgShowPro.style.borderRadius = "100%"; 
    profileContainer.appendChild(imgShowPro);
    const userNameElement = document.createElement("h2");
    userNameElement.innerText = user.name; 
    userNameElement.style.margin = "0"; 
    profileContainer.appendChild(userNameElement);
    chatHeader.innerHTML = ''; 
    chatHeader.appendChild(profileContainer); 
    messageInput.disabled = false;
    sendButton.disabled = false;
    audioCallButton.style.display = 'inline-block';
    videoCallButton.style.display = 'inline-block';
    chatWindow.innerHTML = `<p>Start chatting with ${user.name}</p>`;
    listenForMessages(user);
}

// Send message functionality
sendButton.onclick = function () {
    const message = messageInput.value;
    if (message && selectedUser) {
        const chatId = createChatId(auth.currentUser.uid, selectedUser.uid);
        addDoc(collection(db, "chats", chatId, "messages"), {
            senderId: auth.currentUser.uid,
            recipientId: selectedUser.uid,
            text: message,
            timestamp: serverTimestamp()
        }).then(() => {
            messageInput.value = ''; // Clear input after sending
        }).catch((error) => {
            console.error("Error sending message: ", error);
        });
    }
};

// Create a unique chat ID for the two users
function createChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + "_" + userId2 : userId2 + "_" + userId1;
}

// // Listen for incoming messages and track unread messages
// function listenForMessages(selectedUser) {
//     const chatId = createChatId(auth.currentUser.uid, selectedUser.uid);
//     const messagesRef = collection(db, "chats", chatId, "messages");

//     onSnapshot(query(messagesRef, orderBy("timestamp")), (snapshot) => {
//         chatWindow.innerHTML = ''; // Clear chat window
//         let hasNewMessage = false;

//         snapshot.forEach((doc) => {
//             const msg = doc.data();
//             const msgElem = document.createElement("p");
//             msgElem.innerText = `${msg.senderId === auth.currentUser.uid ? 'Me' : selectedUser.name}: ${msg.text}`;
//             chatWindow.appendChild(msgElem);

//             // Check if the message is new and update unread messages
//             if (msg.timestamp && (lastMessageTimestamp === null || msg.timestamp.toMillis() > lastMessageTimestamp)) {
//                 if (msg.senderId !== auth.currentUser.uid && selectedUser.uid !== msg.senderId) {
//                     unreadMessages[msg.senderId] = (unreadMessages[msg.senderId] || 0) + 1;
//                     updateUnreadIndicator(msg.senderId);
//                 }
//                 lastMessageTimestamp = msg.timestamp.toMillis(); // Update last message timestamp
//                 hasNewMessage = true;
//             }
//         });

//         chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom
        
//         // Play notification sound when a new message arrives
//         if (hasNewMessage) {
//             const notificationSound = document.getElementById("notification-sound");
//             notificationSound.play();
//         }
//     });
// }



// Listen for incoming messages and track unread messages
function listenForMessages(selectedUser) {
    const chatId = createChatId(auth.currentUser.uid, selectedUser.uid);
    const messagesRef = collection(db, "chats", chatId, "messages");

    onSnapshot(query(messagesRef, orderBy("timestamp")), (snapshot) => {
        chatWindow.innerHTML = ''; // Clear chat window
        let hasNewMessage = false;

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const msgElem = document.createElement("p");
            msgElem.className = "chat-message"; // Common class for styling
            
            // Set class based on whether the message was sent or received
            if (msg.senderId === auth.currentUser.uid) {
                msgElem.classList.add("sent");
                msgElem.innerText = `Me: ${msg.text}`;
            } else {
                msgElem.classList.add("received");
                msgElem.innerText = `${selectedUser.name}: ${msg.text}`;
            }

            chatWindow.appendChild(msgElem);

            // Check if the message is new and update unread messages
            if (msg.timestamp && (lastMessageTimestamp === null || msg.timestamp.toMillis() > lastMessageTimestamp)) {
                if (msg.senderId !== auth.currentUser.uid && selectedUser.uid !== msg.senderId) {
                    unreadMessages[msg.senderId] = (unreadMessages[msg.senderId] || 0) + 1;
                    updateUnreadIndicator(msg.senderId);
                }
                lastMessageTimestamp = msg.timestamp.toMillis(); // Update last message timestamp
                hasNewMessage = true;
            }
        });

        chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom
        
        // Play notification sound when a new message arrives
        if (hasNewMessage) {
            const notificationSound = document.getElementById("notification-sound");
            notificationSound.play();
        }
    });
}


// Event listeners for call buttons
audioCallButton.onclick = () => initiateAudioCall(selectedUser.uid);
videoCallButton.onclick = () => initiateVideoCall(selectedUser.uid);

// WebRTC - Audio Call Functionality
function initiateAudioCall(recipientId) {
    startCall(recipientId, false); // Pass `false` for an audio-only call
}

// WebRTC - Video Call Functionality
function initiateVideoCall(recipientId) {
    startCall(recipientId, true); // Pass `true` for video call
}

// WebRTC - Start Call (both audio and video)
async function startCall(recipientId, isVideo) {
    const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    peerConnection = new RTCPeerConnection(configuration);

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        localVideo.srcObject = localStream; // Display local video (if applicable)

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'candidate',
                    candidate: event.candidate,
                    recipientId: recipientId
                });
            }
        };

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0]; // Display remote video
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignal({
            type: 'offer',
            offer: offer,
            recipientId: recipientId
        });
    } catch (error) {
        console.error("Error accessing media devices: ", error);
    }
}

// Send signaling messages via Firestore
function sendSignal(signal) {
    const signalRef = doc(db, "signals", signal.recipientId);
    setDoc(signalRef, {
        type: signal.type,
        candidate: signal.candidate || null,
        offer: signal.offer || null,
        timestamp: serverTimestamp()
    }).catch((error) => {
        console.error("Error sending signal: ", error);
    });
}

// Listen for incoming signaling messages
function listenForSignals() {
    const signalsRef = collection(db, "signals");
    onSnapshot(signalsRef, (snapshot) => {
        snapshot.forEach((doc) => {
            const signal = doc.data();
            if (signal.type === "offer") {
                handleIncomingOffer(signal.offer, doc.id); // Pass the sender's ID to the handler
            } else if (signal.type === "candidate") {
                handleIncomingCandidate(signal.candidate);
            }
        });
    });
}

// Handle incoming offer
async function handleIncomingOffer(offer, senderId) {
    peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendSignal({
        type: 'answer',
        answer: answer,
        recipientId: senderId
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal({
                type: 'candidate',
                candidate: event.candidate,
                recipientId: senderId
            });
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0]; // Display remote video
    };
}

// Handle incoming ICE candidate
function handleIncomingCandidate(candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        console.error("Error adding received ICE candidate: ", error);
    });
}

// Start listening for signals when the application loads
listenForSignals();

// Firebase Auth State Change Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        storeUserData(user);
    } else {
        // User is signed out
        loginOverlay.style.display = "flex";
        appContainer.style.display = "none";
    }
});
