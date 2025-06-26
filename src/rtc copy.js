let dataChannels = {}; // { peerId: RTCDataChannel }
let peerConnections = {}; // { peerId: RTCPeerConnection }
let onMessage = null;

// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, addDoc, collection, onSnapshot, getDoc } from "firebase/firestore";
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
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const startOfferButton = document.getElementById('startOfferBtn')

// Utility for random peer IDs
function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

// --- HOST LOGIC ---
startOfferButton.onclick = async () => {
  // Create a room with a random code
  const roomId = randomId();
  const roomRef = doc(collection(firestore, 'rooms'), roomId);
  const offerCandidates = collection(roomRef, 'offerCandidates');
  const answersRef = collection(roomRef, 'answers');

  callInput.value = roomId;

  // Create the offer for all peers
  const offerPc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" }
    ]
  });

  offerPc.onicecandidate = event => {
    if (event.candidate) {
      log('ICE candidate found')
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  // Optional: create a data channel for the host (not used for peer connections)
  offerPc.createDataChannel("data");

  const offerDesc = await offerPc.createOffer();
  await offerPc.setLocalDescription(offerDesc);
  await setDoc(roomRef, { offer: { type: offerDesc.type, sdp: offerDesc.sdp } });

  // Listen for new answers from peers
  onSnapshot(answersRef, snapshot => {
    snapshot.docChanges().forEach(async change => {
      const peerId = change.doc.id;
      if (change.type === "added" && !peerConnections[peerId]) {
        const answerData = change.doc.data();
        if (answerData.answer) {
          // For each peer, create a new RTCPeerConnection
          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun.l.google.com:5349" },
              { urls: "stun:stun1.l.google.com:3478" }
            ]
          });
          peerConnections[peerId] = pc;

          // Set up ICE candidate forwarding
          const answerCandidates = collection(answersRef, peerId, 'answerCandidates');
          pc.onicecandidate = event => {
            if (event.candidate) {
              addDoc(offerCandidates, event.candidate.toJSON());
            }
          };

          // Set up data channel
          pc.ondatachannel = (e) => {
            dataChannels[peerId] = e.channel;
            setupChannel(e.channel, peerId);
          };

          // Set the same offer as local description
          await pc.setLocalDescription(offerDesc);
          // Set the peer's answer as remote description
          await pc.setRemoteDescription(new RTCSessionDescription(answerData.answer));

          // Listen for answer ICE candidates from this peer
          onSnapshot(answerCandidates, candSnap => {
            candSnap.docChanges().forEach(candChange => {
              if (candChange.type === "added") {
                pc.addIceCandidate(new RTCIceCandidate(candChange.doc.data()));
              }
            });
          });
        }
      }
    });
  });

  log("Room created. Share this code: " + roomId);
};

// --- PEER LOGIC ---
callButton.onclick = async () => {
  const peerId = randomId();
  const roomId = callInput.value.trim();
  if (!roomId) {
    log("Please enter a room code.");
    return;
  }
  const roomRef = doc(collection(firestore, 'rooms'), roomId);
  const roomSnap = await getDoc(roomRef);
  const roomData = roomSnap.data();
  if (!roomData?.offer) {
    log("Room not found or offer missing.");
    return;
  }

  // Create peer connection
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" }
    ]
  });

  // Listen for ICE candidates from host
  const offerCandidates = collection(roomRef, 'offerCandidates');
  onSnapshot(offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  // Send own ICE candidates to answerCandidates subcollection
  const answersRef = collection(roomRef, 'answers');
  const answerRef = doc(answersRef, peerId);
  const answerCandidates = collection(answerRef, 'answerCandidates');
  pc.onicecandidate = event => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  // Set remote offer
  await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));

  // Set up data channel
  pc.ondatachannel = (e) => {
    dataChannels[peerId] = e.channel;
    setupChannel(e.channel, peerId);
  };

  // Create answer and upload to Firestore
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(answerRef, { answer: { type: answer.type, sdp: answer.sdp } });

  log("Joined room. You can now chat.");
};

// --- Messaging API ---
export function setOnMessage(fn) {
  onMessage = fn;
}

export function sendMessage(msg) {
  Object.values(dataChannels).forEach(dc => {
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(msg));
    }
  });
}

// --- Data Channel Setup ---
function setupChannel(channel, peerId) {
  channel.onopen = () => log(`Data channel open with ${peerId}!`);
  channel.onmessage = e => {
    if (onMessage) onMessage(JSON.parse(e.data), peerId);
  };
}

// --- Logging ---
function log(msg) {
  window.log(msg);
  console.log(msg);
}