let dataChannels = {}; // { peerId: RTCDataChannel } only used by host
let peerConnections = {}; // { peerId: RTCPeerConnection } only used by host
let hostConnection; // used by peer to connect to host
let hostDataChannel; // used by peer to connect to host's data channel
let onMessage = null;
let roomname = null;
let firebaseListeners = new Map(); // Track listeners for cleanup
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
    { urls: "stun:stun1.l.google.com:3478" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD
    },
        {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD
    },
        {
      urls: 'turn:standard.relay.metered.ca:443',
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_PASSWORD
    }
  ]
};

console.log(rtcConfig)

// --- HOST LOGIC ---
startOfferButton.onclick = async () => {
  // Create a room with a random ID if not provided
  roomname = idInput.value.trim();
  const roomId = roomname || randomId();
  const roomRef = doc(collection(firestore, 'rooms'), roomId);
  const peersRef = collection(roomRef, 'peers');

  // Listen for new peers requesting to join
  const peersUnsubscribe = onSnapshot(peersRef, snapshot => {
    snapshot.docChanges().forEach(async change => {
      const peerId = change.doc.id;
      if (change.type === "added" && !peerConnections[peerId]) {
        onPeerJoin(peersRef, peerId);
      }
    });
  });
  trackListener(`peers-${roomId}`, peersUnsubscribe);

  log("Room created. Share this code: " + roomId);
  updateRtcStatus();
};

async function onPeerJoin(peersRef, peerId) {
  log(`New peer connection requested: ${peerId}`);
  
  try {
    // 1. Create a new connection for this peer
    log('Creating connection...')
    peerConnections[peerId] = new RTCPeerConnection(rtcConfig);
    let pc = peerConnections[peerId];

    // 2. Create a data channel for this peer
    log('Creating datachannel...')
    dataChannels[peerId] = pc.createDataChannel(peerId);
    setupChannel(dataChannels[peerId], peerId);

    // 3. ICE candidate handling
    const peerRef = doc(peersRef, peerId);
    addIceListeners(peerConnections[peerId], peerRef, peerId, "offer");

    // 4. Create offer and set as local description with timeout
    const offer = await withTimeout(
      peerConnections[peerId].createOffer(),
      10000,
      'Timeout creating offer'
    );
    log('Offer created...')
    await peerConnections[peerId].setLocalDescription(offer);

    // 5. Store offer in Firestore immediately (trickle ICE will handle additional candidates)
    await setDoc(doc(peersRef, peerId), { offer: peerConnections[peerId].localDescription.toJSON() }, { merge: true });
    log('Offer stored...')

    // 7. Listen for answer from this peer
    const answerUnsubscribe = onSnapshot(doc(peersRef, peerId), docSnap => {
      const data = docSnap.data();
      if (data && data.answer && !peerConnections[peerId].currentRemoteDescription) {
        console.log(`Set remote description for peer ${peerId}: ` + JSON.stringify(data.answer));
        peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });
    trackListener(`answer-${peerId}`, answerUnsubscribe);

    // 8. Listen for answer ICE candidates from this peer
    const answerCandidates = collection(peersRef, peerId, `answerCandidates`);
    const candidatesUnsubscribe = onSnapshot(answerCandidates, candSnap => {
      candSnap.docChanges().forEach(candChange => {
        if (candChange.type === "added") {
          peerConnections[peerId].addIceCandidate(new RTCIceCandidate(candChange.doc.data()));
        }
      });
    });
    trackListener(`candidates-${peerId}`, candidatesUnsubscribe);
    
    // 9. Data channel setup(if peer sends it)
    peerConnections[peerId].ondatachannel = (e) => {
      log(`Data channel established with peer ${peerId}`);
      dataChannels[peerId] = e.channel;
      setupChannel(e.channel, peerId);
    };
    
    addConnectionStateListeners(pc, peerId);
    updateRtcStatus();
  } catch (error) {
    log(`Failed to create connection with ${peerId}: ${error.message}`);
    cleanupPeerConnection(peerId);
  }
}

// --- PEER LOGIC ---
callButton.onclick = async () => {
  log("Starting connection...")
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
  const offerUnsubscribe = onSnapshot(peerRef, async (docSnap) => {
    log("Waiting for firestore snapshot...")
    const data = docSnap.data();
    log(`data: ${Boolean(data)}`)
    log(`data.offer: ${Boolean(data.offer)}`)
    log(`not hostConnection: ${Boolean(!hostConnection)}`)
    if (data && data.offer && !hostConnection) {
      log("Joining host...")
      onJoin(peerRef, peerId, data)
    }
  });
  trackListener(`offer-${peerId}`, offerUnsubscribe);

  // Remove peer from Firestore when disconnecting or closing the page
  window.addEventListener('beforeunload', async () => {
    try {
      cleanupFirebaseListeners();
      await deleteDoc(peerRef);
    } catch (e) {
      // Ignore errors (e.g., if already deleted)
    }
  });
};

async function onJoin(peerRef, peerId, data){
  // Create peer connection
  log('on join')
  hostConnection = new RTCPeerConnection(rtcConfig);
  let pc = hostConnection

  // Peer doesn't need to create data channel - host creates it
  // Just wait for host's data channel via ondatachannel event

  // Set remote offer
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  log(`Remote description set...`);

  // Listen for offer ICE candidates from host
  const offerCandidates = collection(peerRef, 'offerCandidates');
  const offerCandidatesUnsubscribe = onSnapshot(offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
  trackListener(`offerCandidates-${peerId}`, offerCandidatesUnsubscribe);

  // Create answer and upload to Firestore
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  log(`Local description set...`);
  // PEER stores structured answer
  await setDoc(peerRef, { answer: answer }, { merge: true });

  // ICE candidate handling
  addIceListeners(pc, peerRef, peerId, "answer");
  

  // Also listen for host-created data channel (if host creates it)
  pc.ondatachannel = (e) => {
    log('DataChannel recieved...')
    dataChannels[peerId] = e.channel;
    setupChannel(e.channel, peerId);
  };
  addConnectionStateListeners(pc, peerId);
  updateRtcStatus();
}

// Firebase listener management
function trackListener(key, unsubscribe) {
  firebaseListeners.set(key, unsubscribe);
}

function cleanupFirebaseListeners() {
  firebaseListeners.forEach((unsubscribe, key) => {
    console.log(`Cleaning up Firebase listener: ${key}`);
    unsubscribe();
  });
  firebaseListeners.clear();
}

// Cleanup function for peer connections
function cleanupPeerConnection(peerId) {
  console.log(`Cleaning up peer connection: ${peerId}`);
  
  // Close data channel
  if (dataChannels[peerId]) {
    dataChannels[peerId].close();
    delete dataChannels[peerId];
  }
  
  // Close peer connection
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  }
  
  // Update status
  updateRtcStatus();
}

// Connection timeout helper
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

// Add connection state monitoring
function addConnectionStateListeners(pc, peerId) {
  pc.onconnectionstatechange = () => {
    log(`Connection state: ${pc.connectionState}`);
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      if (pc.connectionState === 'failed') {
        log('Connection failed - may need TURN server');
        log(JSON.stringify(pc))
      }
      cleanupPeerConnection(peerId);
    }
  };
}

// ice helper
function addIceListeners(peerConnection, peersRef, peerId, type) {
  log('Ice listeners added...')
  const iceCandidates = collection(peersRef, `${type}Candidates`);
  log(`Collection created... ${type}Candidates`)
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      log(`New ICE candidate for peer ${peerId}:`, event.candidate.candidate);
      addDoc(iceCandidates, event.candidate.toJSON());
    }
  };
  peerConnection.oniceconnectionstatechange = () => {
  log("ICE state:", peerConnection.iceConnectionState);
  };
}

// --- Messaging API ---
export function setOnMessage(fn) {
  onMessage = fn;
}

export function sendMessage(msg, excludePeerId = null) {
  Object.entries(dataChannels).forEach(([peerId, dc]) => {
    if (dc && dc.readyState === "open" && peerId !== excludePeerId) {
      if (!msg.senderId) {
        dc.send(JSON.stringify({...msg, senderId: peerId}));
      }else{
        dc.send(JSON.stringify({...msg}));
      }
    }
  });
}

// --- Data Channel Setup ---
function setupChannel(channel, peerId) {
  channel.onopen = () => {
    log(`Data channel open with ${peerId}!`);
    updateRtcStatus();
    
    // Send SYNC message to newly connected peer if we're the host
    if (isHost()) {
      import('./main.js').then(({ syncAllObjects }) => {
        const syncMessage = syncAllObjects();
        if (syncMessage.objects.length > 0) {
          log(`Sending SYNC with ${syncMessage.objects.length} objects to ${peerId}`);
          channel.send(JSON.stringify(syncMessage));
        }
      }).catch(err => {
        console.error('Failed to import syncAllObjects:', err);
      });
    }
  };
  channel.onerror = (error) => {
    log(`Data channel error with ${peerId}: ${error}`);
  };
  channel.onclose = () => {
    log(`Data channel closed with ${peerId}`);
  };
  channel.onmessage = e => {
    let parsed;
    try {
      parsed = JSON.parse(e.data);
    } catch {
      parsed = e.data;
    }
    // Relay chat messages from peers if host
    if (isHost() && parsed) {
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
  let hostLabel = roomname;
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