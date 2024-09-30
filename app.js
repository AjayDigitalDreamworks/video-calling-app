// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
const db = getFirestore(app); // Correct Firestore initialization

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

let selectedUser = null;

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
                    li.innerText = user.name;
                    li.setAttribute("data-user-id", user.uid);
                    li.onclick = () => selectUser(user);
                    contactList.appendChild(li);
                }
            });
        })
        .catch((error) => {
            console.error("Error fetching user list: ", error);
        });
}

// Select a user to chat
function selectUser(user) {
    selectedUser = user;
    chatHeader.querySelector("h2").innerText = `Chat with ${user.name}`;
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

// Listen for incoming messages
function listenForMessages(selectedUser) {
    const chatId = createChatId(auth.currentUser.uid, selectedUser.uid);
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = ""; // Clear the chat window
        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageElement = document.createElement("p");
            messageElement.innerText = `${message.senderId === auth.currentUser.uid ? "You" : selectedUser.name}: ${message.text}`;
            chatWindow.appendChild(messageElement);
        });
    });
}

// Handle user authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        storeUserData(user); // Update UI or store data if user is logged in
    } else {
        loginOverlay.style.display = "flex";
        appContainer.style.display = "none";
    }
});

// Function to send signaling data
function sendSignalingData(data) {
    // Replace with your implementation to send signaling data (e.g., using Firestore or WebSocket)
}

// Initialize the Media Stream (audio/video)
async function getMediaStream() {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
}

// Create Peer Connection
let peerConnection;

function createPeerConnection() {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(config);
    
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignalingData({ candidate: event.candidate });
        }
    };
    
    peerConnection.ontrack = event => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
}

// Add Media Stream to Peer Connection
function addMediaStreamToPeerConnection(localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

// Make a Call
async function initiateCall(receiverId) {
    createPeerConnection();
    const localStream = await getMediaStream();
    document.getElementById('localVideo').srcObject = localStream;
    addMediaStreamToPeerConnection(localStream);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to Firestore
    await setDoc(doc(db, 'calls', receiverId), {
        offer: peerConnection.localDescription,
        caller: auth.currentUser.uid,
        receiver: receiverId
    });
}

// Answer a Call
async function answerCall(offer) {
    createPeerConnection();
    const localStream = await getMediaStream();
    document.getElementById('localVideo').srcObject = localStream;
    addMediaStreamToPeerConnection(localStream);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer to the caller via Firestore
    await setDoc(doc(db, 'calls', auth.currentUser.uid), {
        answer: peerConnection.localDescription
    });
}

// Handle incoming call or answer
function handleSignalingData(data) {
    if (data.offer) {
        answerCall(data.offer);
    } else if (data.answer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

// Call buttons
audioCallButton.onclick = () => {
    if (selectedUser) initiateCall(selectedUser.uid); // Initiate audio call
};

videoCallButton.onclick = () => {
    if (selectedUser) initiateCall(selectedUser.uid); // Initiate video call
};
