let dataChannels = {}; // { peerId: RTCDataChannel } only used by host
let peerConnections = {}; // { peerId: RTCPeerConnection } only used by host
let hostConnection; // used by peer to connect to host
let hostDataChannel; // used by peer to connect to host's data channel
let onMessage = null;
window.peerConnections = peerConnections;
window.dataChannels = dataChannels;
window.hostConnection = hostConnection;
window.hostDataChannel = hostDataChannel;

// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, addDoc, collection, onSnapshot, getDoc, deleteDoc } from "firebase/firestore";
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: "AIzaSyBx9KEPISLf8WtOnpYDkA9mEiMcVM529Y0",
  authDomain: "cardtable-47c43.firebaseapp.com",
  projectId: "cardtable-47c43",
  storageBucket: "cardtable-47c43.firebasestorage.app",
  messagingSenderId: "138981883947",
  appId: "1:138981883947:web:58a93536f241f661872a6e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// HTML elements
const idInput = document.getElementById('idInput')
const callInput = document.getElementById('callInput');
const callButton = document.getElementById('callButton');
const startOfferButton = document.getElementById('startOfferBtn');
const rtcStatus = document.getElementById('rtcStatus');

// Utility for random peer IDs
function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

// Define ICE servers once for reuse
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.l.google.com:5349" },
    { urls: "stun:stun1.l.google.com:3478" }
  ]
};

// --- HOST LOGIC ---
startOfferButton.onclick = async () => {
  // Create a room with a random ID if not provided
  const roomId = idInput.value.trim() || randomId();
  const roomRef = doc(collection(firestore, 'rooms'), roomId);
  const peersRef = collection(roomRef, 'peers');

  // Listen for new peers requesting to join
  onSnapshot(peersRef, snapshot => {
    snapshot.docChanges().forEach(async change => {
      const peerId = change.doc.id;
      if (change.type === "added" && !peerConnections[peerId]) {
        onPeerJoin(peersRef, peerId);
      }
    });
  });

  log("Room created. Share this code: " + roomId);
  updateRtcStatus();
};

async function onPeerJoin(peersRef, peerId) {
  log(`New peer connection requested: ${peerId}`);
  // 1. Create a new connection for this peer
  peerConnections[peerId] = new RTCPeerConnection(rtcConfig);
  let pc = peerConnections[peerId];

  // 2. Create a data channel for this peer
  dataChannels[peerId] = pc.createDataChannel(peerId);
  setupChannel(dataChannels[peerId], peerId);

  // 3. ICE candidate handling
  const peerRef = doc(peersRef, peerId);
  addIceListeners(peerConnections[peerId], peerRef, peerId, "offer");

  // 4. Create offer and set as local description
  const offer = await peerConnections[peerId].createOffer();
  await peerConnections[peerId].setLocalDescription(offer);

  // 5. Store offer in Firestore
  await setDoc(doc(peersRef, peerId), { offer: offer }, { merge: true });

  // 6. Listen for answer from this peer
  onSnapshot(doc(peersRef, peerId), docSnap => {
    const data = docSnap.data();
    if (data && data.answer && !peerConnections[peerId].currentRemoteDescription) {
      console.log(`Set remote description for peer ${peerId}: ` + JSON.stringify(data.answer));
      peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // 7. Listen for answer ICE candidates from this peer
  const answerCandidates = collection(peersRef, peerId, `answerCandidates`);
  onSnapshot(answerCandidates, candSnap => {
    candSnap.docChanges().forEach(candChange => {
      if (candChange.type === "added") {
        peerConnections[peerId].addIceCandidate(new RTCIceCandidate(candChange.doc.data()));
      }
    });
  });
  // 8. Data channel setup(if peer sends it)
  peerConnections[peerId].ondatachannel = (e) => {
    log(`Data channel established with peer ${peerId}`);
    dataChannels[peerId] = e.channel;
    setupChannel(e.channel, peerId);
  };
  updateRtcStatus();
}

// --- PEER LOGIC ---
callButton.onclick = async () => {
  const peerId = idInput.value.trim() || randomId();
  const roomId = callInput.value.trim();
  if (!roomId) {
    log("Please enter a room code.");
    return;
  }
  const roomRef = doc(collection(firestore, 'rooms'), roomId);
  const peersRef = collection(roomRef, 'peers');
  const peerRef = doc(peersRef, peerId);

  // Register self as a peer (triggers host to create offer)
  await setDoc(peerRef, { requested: true }, { merge: true });

  // Listen for offer from host
  onSnapshot(peerRef, async (docSnap) => {
    const data = docSnap.data();
    if (data && data.offer && !hostConnection) {
      onJoin(peerRef, peerId, data)
    }
  });

  // Remove peer from Firestore when disconnecting or closing the page
  window.addEventListener('beforeunload', async () => {
    try {
      await deleteDoc(peerRef);
    } catch (e) {
      // Ignore errors (e.g., if already deleted)
    }
  });
};

async function onJoin(peerRef, peerId, data){
  // Create peer connection
  hostConnection = new RTCPeerConnection(rtcConfig);
  let pc = hostConnection

  // Create data channel BEFORE setting remote description and creating answer
  // const dc = pc.createDataChannel("data");
  // dataChannels[peerId] = dc;
  // setupChannel(dc, peerId);

  // Set remote offer
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  console.log(`Set remote description from host answer`);

  // Listen for offer ICE candidates from host
  const offerCandidates = collection(peerRef, 'offerCandidates');
  onSnapshot(offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  // Create answer and upload to Firestore
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(peerRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

  // ICE candidate handling
  addIceListeners(pc, peerRef, peerId, "answer"); 

  // Also listen for host-created data channel (if host creates it)
  pc.ondatachannel = (e) => {
    dataChannels[peerId] = e.channel;
    setupChannel(e.channel, peerId);
  };

  log("Joined room.");
  updateRtcStatus();
}

// ice helper
function addIceListeners(peerConnection, peersRef, peerId, type) {
  const iceCandidates = collection(peersRef, `${type}Candidates`);
  peerConnection.onicecandidate = event => {
    console.log(`New ICE candidate for peer ${peerId}:`, event.candidate);
    if (event.candidate) {
      console.log(`New ICE candidate for peer ${peerId}:`, event.candidate);
      addDoc(iceCandidates, event.candidate.toJSON());
    }
  };
  peerConnection.oniceconnectionstatechange = () => {
  console.log("ICE state:", peerConnection.iceConnectionState);
  };
}

// --- Messaging API ---
export function setOnMessage(fn) {
  onMessage = fn;
}

export function sendMessage(msg, excludePeerId = null) {
  Object.entries(dataChannels).forEach(([peerId, dc]) => {
    if (dc && dc.readyState === "open" && peerId !== excludePeerId) {
      dc.send(JSON.stringify(msg));
    }
  });
}

// --- Data Channel Setup ---
function setupChannel(channel, peerId) {
  channel.onopen = () => {
    log(`Data channel open with ${peerId}!`);
    updateRtcStatus();
  };
  channel.onmessage = e => {
    let parsed;
    try {
      parsed = JSON.parse(e.data);
    } catch {
      parsed = e.data;
    }
    // Relay chat messages from peers if host
    if (isHost() && parsed && parsed.type === "chat") {
      // Relay to all except sender
      sendMessage(parsed, peerId);
    }
    if (onMessage) onMessage(parsed, peerId);
  };
}

// --- Host/Peer detection helper ---
function isHost() {
  return !!peerConnections && Object.keys(peerConnections).length > 0 && startOfferButton && !callButton.disabled;
}

// --- Logging ---
function log(msg) {
  window.log && window.log(msg);
  console.log(msg);
  updateRtcStatus();
}

// --- RTC Status Display ---
function updateRtcStatus() {
  const rtcStatus = document.getElementById('rtcStatus');
  if (!rtcStatus) return;

  // Determine if this client is host or peer
  let isHost = !!peerConnections && Object.keys(peerConnections).length > 0 && startOfferButton && !callButton.disabled;
  let hostLabel = isHost ? "&lt;Host&gt;" : "&lt;Peer&gt;";
  let peersList = [];

  // For host, show all connected peer IDs
  if (isHost) {
    peersList = Object.keys(peerConnections);
  } else {
    // For peer, show only self (idInput) and host
    const idInput = document.getElementById('idInput');
    if (idInput && idInput.value.trim()) {
      peersList = [idInput.value.trim()];
    }
  }

  // Format the tree
  let html = `${hostLabel}<br>`;
  peersList.forEach((peerId, idx) => {
    const isLast = idx === peersList.length - 1;
    html += `${isLast ? '└' : '├'} ${peerId}<br>`;
  });

  rtcStatus.innerHTML = html;
}

window.checkRTC = function() {
  console.log("RTC Connections:", JSON.stringify(peerConnections));
  console.log("Data Channels:", JSON.stringify(dataChannels));
}

window.checkRTCPeer = function(id) {
  console.log("RTC Connections:", JSON.stringify(peerConnections[id]));
  console.log("Data Channels:", JSON.stringify(dataChannels[id]));
}