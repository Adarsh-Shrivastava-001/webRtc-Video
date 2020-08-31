// getting dom elements
var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");
var localVideo = document.getElementById("localVideo");
var remoteVideo = {
    1:document.getElementById("remoteVideo1"),
    2:document.getElementById("remoteVideo2"),
    3:document.getElementById("remoteVideo3"),
    4:document.getElementById("remoteVideo4"),
    5:document.getElementById("remoteVideo5"),

}

// variables
var roomNumber;
var localStream;
var remoteStream = {};
var rtcPeerConnectionList = {};
var iceServers = {
    'iceServers': [
        { 'urls': 'stun:stun.services.mozilla.com' },
        { 'urls': 'stun:stun.l.google.com:19302' }
    ]
}
var streamConstraints = { audio: true, video: true };
var nodeId;
let peerList = {};

// Let's do this
var socket = io();


btnGoRoom.onclick = (event)=>{
    console.log("Go room clicked");
    if(inputRoomNumber.value === ''){
        alert("please input a valid room number");
    }
    else{
        roomNumber = inputRoomNumber.value;
        console.log('create or join emitted');
        socket.emit("create or join", roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
    }
}

socket.on('created', (room)=>{
    console.log('created event recieved');
    
    navigator.mediaDevices.getUserMedia(streamConstraints).then((stream)=>{
        nodeId = 1;
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch((err)=>{
        console.log("error while geting stream ", err);
    })
})

socket.on('joined', (obj)=>{
    let room = obj['room'];
    let srcid = obj['srcid'];
   
    console.log('joined event recieved');
    navigator.mediaDevices.getUserMedia(streamConstraints).then((stream)=>{
        localStream = stream;
        nodeId = srcid;
        localVideo.srcObject = stream;
        console.log('emitting ready for room ', room, 'from node', srcid);
        socket.emit('ready', {'room':room, 'srcid':nodeId});
    })
    .catch((err)=>{
        console.log("error while geting stream", err);
    })
})

socket.on('ready', (obj)=>{
    let srcid = obj.srcid;
    if(nodeId!=srcid){
        let rtcPeerConnection;
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnectionList[srcid] = rtcPeerConnection;

        rtcPeerConnectionList[srcid].onicecandidate = (event)=>{
            if (event.candidate) {
                console.log('sending ice candidate');
                socket.emit('candidate', {
                    'srcid':nodeId,
                    'destid':srcid,
                    'event':{
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate,
                        room: roomNumber,
                    }   
                    
                })
            }
        };
    

        rtcPeerConnectionList[srcid].ontrack = (event)=>{
            remoteVideo[srcid].srcObject = event.streams[0];
            remoteStream[srcid] = event.stream;
        };
        rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnectionList[srcid].createOffer()
        .then((sdp)=>{
            rtcPeerConnectionList[srcid].setLocalDescription(sdp);
            console.log("Offer emitted from ", nodeId, ' to ', srcid);
            socket.emit("offer", {
                'sdp' : sdp,
                'type' : 'offer',
                'room' : roomNumber,
                'srcid' : nodeId,
                'destid' : srcid,
            })            
        })
        .catch((err)=>{
            console.log("error on ready event", err);
        })
    }
})

socket.on('offer', (obj)=>{
    let remote_sdp = obj['remote_sdp'];
    let srcid = obj.srcid;
    let destid = obj.destid;
    if(nodeId === destid){
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnectionList[srcid] = rtcPeerConnection;
        rtcPeerConnectionList[srcid].onicecandidate = (event)=>{
            if (event.candidate) {
                console.log('sending ice candidate');
                socket.emit('candidate', {
                    'srcid':destid,
                    'destid':srcid,
                    'event':{
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate,
                        room: roomNumber,
                    }
                }); 
                
                    
                }
            };


        rtcPeerConnectionList[srcid].ontrack = (event)=>{
            remoteVideo[srcid].srcObject = event.streams[0];
            remoteStream[srcid] = event.stream;
        };

        rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnectionList[srcid].setRemoteDescription(new RTCSessionDescription(remote_sdp));
        rtcPeerConnectionList[srcid].createAnswer()
        .then((sdp)=>{
            rtcPeerConnectionList[srcid].setLocalDescription(sdp);
            console.log("Answer given from ", destid, ' to ', srcid);
            socket.emit("answer", {
                'sdp' : sdp,
                'type' : 'answer',
                'room' : roomNumber,
                'srcid' : destid,
                'destid' : srcid,
            })
        })
        .catch((err)=>{
            console.log("error occured while answering", err);
        })
    }
})

socket.on("answer", (obj)=>{
    let sdp = obj.sdp;
    let srcid = obj.srcid;
    let destid = obj.destid;
    if(destid===nodeId){
        let peerConnection = rtcPeerConnectionList[srcid];
        peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
    
})


socket.on('candidate', function (obj) {
    console.log("cand handled from client");
    console.log("nodeId is ", nodeId);
    console.log(obj)
    if(nodeId===obj.destid){
        let event = obj.event;
        let srcid = obj.srcid;
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: event.label,
            candidate: event.candidate
        });
        rtcPeerConnectionList[srcid].addIceCandidate(candidate);
        console.log("iceCandidate added");

    }
    else{
        console.log("node id and dest id didnot match");
    }
    
});

