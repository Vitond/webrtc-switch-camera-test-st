
const configuration = { 'iceServers': [{ 'urls': 'stun:stun2.l.google.com:19302' }] };
const constraints = { 'video': true, 'audio': true };
let peerConnection = new RTCPeerConnection(configuration);
let remotePeerConnection = new RTCPeerConnection(configuration);
let madeCall = false;
let currentStream = null;
let currentVideoDeviceId = null;
let offer = null;

const gtag = (command, eventName, ...args) => {
    if ('dataLayer' in window) {
        window.dataLayer.push(arguments)
    }
    if ('ga' in window) {
        // Compatibility with old GA
        const trackers = window.ga.getAll();
        const firstTracker = trackers[0];
        const trackerName = firstTracker.get('name');
        window.ga(trackerName + '.' + 'send', arguments);
    }
}

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

document.getElementById('remoteVideo').addEventListener('click', () => {
    gtag('event', 'remote_video_clicked')
    console.log('CLICKED')
})

// SHOW LOCAL STREAM
async function playVideoFromCamera(deviceId = null) {
    console.log('PLAYING DEVICE ID', deviceId)
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const videoConstraints = deviceId ? { deviceId: { exact: deviceId } } : true;
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
        currentStream = stream;

        const videoElement = document.querySelector('video#localVideo');
        videoElement.srcObject = stream;

        // Clear previous tracks from peer connection
        peerConnection.getSenders().forEach(sender => peerConnection.removeTrack(sender));

        currentStream.getTracks().forEach(track => peerConnection.addTrack(track, currentStream));
    } catch (error) {
        console.error('Error opening video camera.', error);
    }
}
playVideoFromCamera();

async function switchCamera() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    let currentIndex = videoDevices.findIndex(device => device.deviceId === currentVideoDeviceId);
    if (currentIndex == -1) {
        currentIndex = 0;
    }
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    currentVideoDeviceId = videoDevices[nextIndex].deviceId;

    playVideoFromCamera(currentVideoDeviceId);
}


// HANDLERS
const makeCall = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    handleOffer(offer)
    // await socket.emit('message', { offer })
    madeCall = true;
}
const handleOffer = async (offer) => {
    console.log('HANDLING OFFER', offer)
    await remotePeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await remotePeerConnection.createAnswer();
    await remotePeerConnection.setLocalDescription(answer);
    handleAnswer(answer)
    // await socket.emit('message', { answer })
};
const handleAnswer = async (answer) => {
    console.log('HANDLING ANSWER', answer)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}
const handleIceCandidateFromPeer = async (iceCandidate) => {
    console.log('HANDLING ICE CANDIDATE FROM PEER', iceCandidate)
    try {
        await peerConnection.addIceCandidate(iceCandidate);
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
};
const handleTracks = async (event) => {
    const [remoteStream] = event.streams;
    console.log('REMOTE STREAM', remoteStream)
    if (event.track.kind === "audio") {
        console.log("GOT AUDIO TRACK")
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play()
    } else if (event.track.kind === "video") {
        console.log("GOT VIDEO TRACK", remoteStream)
        document.getElementById('remoteVideo').srcObject = remoteStream;
    }

};


const addTracks = async ({ video, audio }) => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: !!audio, video: !!video });
    localStream.getTracks().forEach(async track => {
        console.log('ASDING TRack')
       
        await remotePeerConnection.addTrack(track, localStream)
        await peerConnection.addTrack(track, localStream)
    });
}

////////////////////////////////
// LISTENERS
/////////////////////////////////

// BUTTONS
const callButton = document.getElementById('call');
callButton.addEventListener('click', () => {
    makeCall();
    callButton.style.background = 'green';
})

const addAudioTrackButton = document.getElementById('add-audio-track');
const addVideoTrackButton = document.getElementById('add-video-track')
const switchCameraButton = document.getElementById('switch-camera');
addAudioTrackButton.addEventListener('click', () => { addTracks({ audio: true }) })
addVideoTrackButton.addEventListener('click', () => { addTracks({ video: true }) })
switchCameraButton.addEventListener('click', () => { switchCamera() })

// PEERCONECTION
peerConnection.addEventListener('connectionstatechange', async event => {
    if (peerConnection.connectionState === 'connected') {
        console.log('CONNECTED')
    }
});
peerConnection.addEventListener('datachannel', event => {
    console.log('DATACHANNEL', event)
});
peerConnection.addEventListener('icecandidate', event => {
    console.log('ICECANDIDATE', event)
    if (event.candidate) {
        handleIceCandidateFromPeer(event.candidate)
    }
});
remotePeerConnection.addEventListener('icecandidate', event => {
    console.log('ICECANDIDATE', event)
    if (event.candidate) {
        handleIceCandidateFromPeer(event.candidate)
    }
});
peerConnection.addEventListener('icecandidateerror', event => {
    console.log('ICECANDIDATEERROR', event)
});
peerConnection.addEventListener("iceconnectionstatechange", event => {
    console.log('ICECONNECTIONSTATECHANGE', peerConnection.iceConnectionState, event)
    if (peerConnection.iceConnectionState === "disconnected" || peerConnection.iceConnectionState === "failed") {
        peerConnection.restartIce();
    }
})
remotePeerConnection.addEventListener("iceconnectionstatechange", event => {
    console.log('ICECONNECTIONSTATECHANGE', peerConnection.iceConnectionState, event)
    if (peerConnection.iceConnectionState === "disconnected" || peerConnection.iceConnectionState === "failed") {
        peerConnection.restartIce();
    }
})
peerConnection.addEventListener("icegatheringstatechange", event => {
    console.log('ICEGATHERINGSSTATECHANGE', event)
})
peerConnection.addEventListener('negotiationneeded', async event => {
    console.log('NEGOTIATIONNEEDED', event)
    makeCall();
});
remotePeerConnection.addEventListener('negotiationneeded', async event => {
    console.log('NEGOTIATIONNEEDED', event)
    makeCall();
});
peerConnection.addEventListener('signalingstatechange', event => {
    console.log('SIGNALINGSTATECHANGE', peerConnection.signalingState, event)
});
peerConnection.addEventListener('track', event => {
    console.log('TRACK', event)
    handleTracks(event);
})
