import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, onSnapshot } from "firebase/firestore";

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyBx9KEPISLf8WtOnpYDkA9mEiMcVM529Y0",
  authDomain: "cardtable-47c43.firebaseapp.com",
  projectId: "cardtable-47c43",
  storageBucket: "cardtable-47c43.firebasestorage.app",
  messagingSenderId: "138981883947",
  appId: "1:138981883947:web:58a93536f241f661872a6e"
};
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// --- Utility ---
function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

// --- Chatroom Logic ---
const roomId = prompt("Enter chatroom name:");
const userId = randomId();
const peers = {}; // peerId -> { pc, dc }

const roomRef = doc(collection(firestore, "rooms"), roomId);
const usersRef = collection(roomRef, "users");

// Register self in Firestore
await setDoc(doc(usersRef, userId), { joined: Date.now() });

// Listen for new users
onSnapshot(usersRef, async (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    const peerId = change.doc.id;
    if (peerId === userId) return; // Ignore self

    if (change.type === "added" && !peers[peerId]) {
      // Initiate connection if you have lower userId (to avoid double offers)
      if (userId < peerId) {
        await connectToPeer(peerId);
      }
    }
  });
});

// Listen for signaling messages
const signalsRef = collection(roomRef, "signals");
onSnapshot(signalsRef, async (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    const data = change.doc.data();
    if (data.to !== userId) return;

    let pc = peers[data.from]?.pc;
    if (!pc) {
      await connectToPeer(data.from, false);
      pc = peers[data.from].pc;
    }

    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await addDoc(signalsRef, {
        from: userId, to: data.from, type: "answer", sdp: pc.localDescription.toJSON()
      });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === "candidate" && data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
});

// --- Peer Connection ---
async function connectToPeer(peerId, isOfferer = true) {
  if (peers[peerId]) return;
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  let dc = null;

  // Assign peers[peerId] immediately so it's available in setupDataChannel
  peers[peerId] = { pc, dc: null };

  if (isOfferer) {
    dc = pc.createDataChannel("chat");
    peers[peerId].dc = dc;
    setupDataChannel(dc, peerId);
  } else {
    pc.ondatachannel = (e) => {
      peers[peerId].dc = e.channel;
      setupDataChannel(e.channel, peerId);
    };
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(signalsRef, {
        from: userId,
        to: peerId,
        type: "candidate",
        candidate: event.candidate.toJSON()
      });
    }
  };

  if (isOfferer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await addDoc(signalsRef, {
      from: userId,
      to: peerId,
      type: "offer",
      sdp: pc.localDescription.toJSON()
    });
  }
}

function setupDataChannel(dc, peerId) {
  dc.onopen = () => log(`Connected to ${peerId}`);
  dc.onmessage = (e) => log(`[${peerId}]: ${e.data}`);
  peers[peerId].dc = dc;
}

// --- UI ---
function log(msg) {
  let el = document.getElementById("chatLog");
  if (!el) {
    el = document.createElement("div");
    el.id = "chatLog";
    el.style = "position:fixed;right:10px;top:10px;width:300px;height:300px;overflow:auto;background:#222;color:#fff;padding:10px;z-index:1000;";
    document.body.appendChild(el);
  }
  el.innerHTML += `<div>${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

function sendMessage(msg) {
  Object.values(peers).forEach(({ dc }) => {
    if (dc && dc.readyState === "open") dc.send(msg);
  });
  log(`[me]: ${msg}`);
}

// Simple input UI
if (!document.getElementById("chatInput")) {
  const input = document.createElement("input");
  input.id = "chatInput";
  input.style = "position:fixed;right:10px;bottom:10px;width:300px;z-index:1001;";
  input.placeholder = "Type message and press Enter";
  input.onkeydown = (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      sendMessage(input.value.trim());
      input.value = "";
    }
  };
  document.body.appendChild(input);
}