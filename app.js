// Import Firebase libraries
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  limit,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBnkH_V-yU-XGjxvpflPFWNTXSSGCCnPk",
  authDomain: "video-calling-d6518.firebaseapp.com",
  projectId: "video-calling-d6518",
  storageBucket: "video-calling-d6518.appspot.com",
  messagingSenderId: "238450505104",
  appId: "1:238450505104:web:4650064e7c157bda892f15",
  measurementId: "G-DTJVCXTQWB",
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

let selectedUser = null;
let localStream;
let peerConnection;
let unreadMessages = {}; // To track unread messages for each user
let lastMessageTimestamp = {}; // To track the last message timestamp per user

// Google Login
loginButton.onclick = async function () {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await storeUserData(user);
  } catch (error) {
    console.error("Login Error: ", error);
  }
};

// Logout Function
logoutButton.onclick = function () {
  signOut(auth)
    .then(() => {
      loginOverlay.style.display = "flex";
      appContainer.style.display = "none";
      console.log("User logged out.");
    })
    .catch((error) => {
      console.error("Logout Error: ", error);
    });
};

// Store user data if first time, or fetch existing data
async function storeUserData(user) {
  const userRef = doc(db, "users", user.uid);
  const docSnapshot = await getDoc(userRef);
  if (!docSnapshot.exists()) {
    // Store user data if it's their first login
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    });
    console.log("User data stored in Firestore.");
  } else {
    console.log("User data already exists.");
  }
  updateUI(user);
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
  contactList.innerHTML = ""; // Clear the existing list
  getDocs(collection(db, "users"))
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const user = doc.data();
        if (user.uid !== loggedInUser.uid) {
          const li = document.createElement("li");
          li.id = `user-${user.uid}`;
          li.classList.add("user-item");
          li.setAttribute("data-user-id", user.uid);

          const nameSpan = document.createElement("span");
          nameSpan.innerText = user.name;
          li.appendChild(nameSpan);

          // Unread messages indicator
          const unreadIndicator = document.createElement("span");
          unreadIndicator.classList.add("unread-indicator");
          unreadIndicator.id = `unread-${user.uid}`;
          li.appendChild(unreadIndicator);

          // Latest message display
          const latestMsg = document.createElement("p");
          latestMsg.id = `latest-msg-${user.uid}`;
          latestMsg.classList.add("latest-msg");
          li.appendChild(latestMsg);

          li.onclick = () => {
            selectUser(user);
            unreadMessages[user.uid] = 0;
            updateUnreadIndicator(user.uid);
            removeHighlight(user.uid);
          };
          contactList.appendChild(li);

          // Fetch the latest message between the logged-in user and this user
          fetchLatestMessage(loggedInUser.uid, user.uid);
          // Listen for new messages to update latest message and highlight
          listenForLatestMessage(loggedInUser.uid, user.uid);
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching user list: ", error);
    });
}

// Fetch the latest message between two users and update the UI
function fetchLatestMessage(loggedInUserId, otherUserId) {
  const chatId = createChatId(loggedInUserId, otherUserId);
  const messagesRef = collection(db, "chats", chatId, "messages");

  getDocs(query(messagesRef, orderBy("timestamp", "desc"), limit(1)))
    .then((snapshot) => {
      if (!snapshot.empty) {
        const latestMessage = snapshot.docs[0].data();
        const latestMsgElem = document.getElementById(`latest-msg-${otherUserId}`);
        latestMsgElem.innerText = latestMessage.text; // Show the latest message
      }
    })
    .catch((error) => {
      console.error("Error fetching latest message: ", error);
    });
}

// Listen for the latest message to update the contact list
function listenForLatestMessage(loggedInUserId, otherUserId) {
  const chatId = createChatId(loggedInUserId, otherUserId);
  const messagesRef = collection(db, "chats", chatId, "messages");

  onSnapshot(query(messagesRef, orderBy("timestamp", "desc"), limit(1)), (snapshot) => {
    snapshot.forEach((doc) => {
      const latestMessage = doc.data();
      const latestMsgElem = document.getElementById(`latest-msg-${otherUserId}`);
      latestMsgElem.innerText = latestMessage.text;

      // If the message is from the other user, highlight them
      if (latestMessage.senderId === otherUserId && selectedUser?.uid !== otherUserId) {
        unreadMessages[otherUserId] = (unreadMessages[otherUserId] || 0) + 1;
        updateUnreadIndicator(otherUserId);
        highlightUser(otherUserId);
        // function playNotificationSound() {
          const notificationSound = document.getElementById("notification-sound");
          if (notificationSound) {
            notificationSound.play();
          }
        // }
      }
    });
  });
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
  chatHeader.innerHTML = "";
  chatHeader.appendChild(profileContainer);
  messageInput.disabled = false;
  sendButton.disabled = false;
  audioCallButton.style.display = "inline-block";
  videoCallButton.style.display = "inline-block";
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
      timestamp: serverTimestamp(),
      seen: false, // Initialize the message as not seen
    })
      .then(() => {
        messageInput.value = ""; // Clear input after sending
      })
      .catch((error) => {
        console.error("Error sending message: ", error);
      });
  }
};

// Mark messages as seen when the user opens the chat
function markMessagesAsSeen(chatId) {
  const messagesRef = collection(db, "chats", chatId, "messages");
  getDocs(messagesRef).then((snapshot) => {
    snapshot.forEach((docSnapshot) => {
      const message = docSnapshot.data();
      if (message.recipientId === auth.currentUser.uid && !message.seen) {
        // Update the 'seen' field to true for the recipient's messages
        updateDoc(docSnapshot.ref, { seen: true });
      }
    });
  });
}

// Listen for incoming messages and track unread messages
function listenForMessages(selectedUser) {
  const chatId = createChatId(auth.currentUser.uid, selectedUser.uid);
  const messagesRef = collection(db, "chats", chatId, "messages");

  onSnapshot(query(messagesRef, orderBy("timestamp")), (snapshot) => {
    chatWindow.innerHTML = ""; // Clear chat window

    snapshot.forEach((doc) => {
      const msg = doc.data();
      const msgElem = document.createElement("p");
      msgElem.className = "chat-message"; // Common class for styling

      // Set class based on whether the message was sent or received
      if (msg.senderId === auth.currentUser.uid) {
        msgElem.classList.add("sent");
        msgElem.innerText = `${msg.text}`;

        // Show 'Seen' under the message if it's been read
        if (msg.seen) {
          const seenLabel = document.createElement("span");
          seenLabel.innerText = "Seen";
          seenLabel.className = "seen-label";
          msgElem.appendChild(seenLabel);
        }
      } else {
        msgElem.classList.add("received");
        msgElem.innerText = `${msg.text}`;
      }

      chatWindow.appendChild(msgElem);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom

    // Mark all incoming messages as seen when opened
    markMessagesAsSeen(chatId);

    // Clear unread messages and remove highlight
    unreadMessages[selectedUser.uid] = 0;
    updateUnreadIndicator(selectedUser.uid);
    removeHighlight(selectedUser.uid);
  });
}

// Create a unique chat ID for the two users
function createChatId(userId1, userId2) {
  return userId1 < userId2 ? userId1 + "_" + userId2 : userId2 + "_" + userId1;
}

// Update unread messages indicator
function updateUnreadIndicator(userId) {
  const unreadIndicator = document.getElementById(`unread-${userId}`);
  const count = unreadMessages[userId] || 0;
  unreadIndicator.innerText = count > 0 ? ` (${count})` : "";
}

// Highlight the user in the contact list when a new message arrives
function highlightUser(userId) {
  const userElem = document.getElementById(`user-${userId}`);
  if (userElem) {
    userElem.classList.add("highlighted"); // Add a CSS class to highlight the user
  }
}

// Remove highlight from the user
function removeHighlight(userId) {
  const userElem = document.getElementById(`user-${userId}`);
  if (userElem) {
    userElem.classList.remove("highlighted");
  }
}

// Play notification sound


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
    if (localVideo) localVideo.srcObject = localStream; // Display local video (if applicable)

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: "candidate",
          candidate: event.candidate,
          recipientId: recipientId,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideo) remoteVideo.srcObject = event.streams[0]; // Display remote video
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendSignal({
      type: "offer",
      offer: offer,
      recipientId: recipientId,
    });
  } catch (error) {
    console.error("Error accessing media devices: ", error);
  }
}

// Send signaling messages via Firestore
function sendSignal(signal) {
  const signalsRef = collection(db, "signals");
  addDoc(signalsRef, {
    ...signal,
    senderId: auth.currentUser.uid,
    timestamp: serverTimestamp(),
  }).catch((error) => {
    console.error("Error sending signal: ", error);
  });
}

// Listen for incoming signaling messages
function listenForSignals() {
  const signalsRef = collection(db, "signals");
  onSnapshot(signalsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const signal = change.doc.data();
      if (signal.recipientId === auth.currentUser.uid) {
        if (signal.type === "offer") {
          handleIncomingOffer(signal.offer, signal.senderId);
        } else if (signal.type === "candidate") {
          handleIncomingCandidate(signal.candidate);
        } else if (signal.type === "answer") {
          handleIncomingAnswer(signal.answer);
        }
      }
    });
  });
}

// Handle incoming offer
async function handleIncomingOffer(offer, senderId) {
  peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: "candidate",
        candidate: event.candidate,
        recipientId: senderId,
      });
    }
  };

  peerConnection.ontrack = (event) => {
    if (remoteVideo) remoteVideo.srcObject = event.streams[0];
  };

  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideo) localVideo.srcObject = localStream;
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    } catch (error) {
      console.error("Error accessing media devices: ", error);
    }
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  sendSignal({
    type: "answer",
    answer: answer,
    recipientId: senderId,
  });
}

// Handle incoming answer
async function handleIncomingAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle incoming ICE candidate
function handleIncomingCandidate(candidate) {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch((error) => {
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
