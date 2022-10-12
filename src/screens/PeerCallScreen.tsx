import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  mediaDevices,
  RTCView,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';

const ICE_SERVER_URLS = [
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
];

export default function CallScreen() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isWebcamStarted, setIsWebcamStarted] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);

  const peerConnectionConfig = {
    iceServers: [
      {
        urls: ICE_SERVER_URLS,
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const startWebcam = async () => {
    const local = await mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    pc.current = new RTCPeerConnection(peerConnectionConfig);
    pc.current.addStream(local);
    setLocalStream(local);

    const remote = new MediaStream(undefined);

    // Push tracks from local stream to peer connection
    local.getTracks().forEach((track) => {
      pc.current?.getLocalStreams()[0].addTrack(track);
    });

    // Pull tracks from peer connection, add to remote video stream
    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remote.addTrack(track);
      });
    };

    pc.current.onaddstream = (event) => {
      setRemoteStream(event.stream);
    };

    setIsWebcamStarted(true);
  };

  const stopWebcam = () => {
    if (localStream) {
      localStream.release();
      setLocalStream(null);
    }
  };

  const startCall = async () => {
    if (!pc.current) {
      return;
    }

    const channelDoc = firestore().collection('channels').doc();
    const offerCandidates = channelDoc.collection('offerCandidates');
    const answerCandidates = channelDoc.collection('answerCandidates');

    setChannelId(channelDoc.id);

    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        console.info('Start - OnIceCandidate', event.candidate.toJSON());
        await offerCandidates.add(event.candidate.toJSON());
      }
    };

    //create offer
    const offerDescription = (await pc.current.createOffer(
      undefined
    )) as RTCSessionDescription;
    console.info('Start - OfferDescreiption', offerDescription);
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp, // SDP = Session Description Protocol
      type: offerDescription.type,
    };

    await channelDoc.set({ offer });

    // Listen for remote answer
    channelDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();

      console.info('Start - OnSnapshot', {
        pc: pc.current?.currentRemoteDescription,
        answer: data?.answer,
      });

      if (!pc.current?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current?.setRemoteDescription(answerDescription);
      }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.current?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const joinCall = async () => {
    if (!channelId || !pc.current) {
      return;
    }

    const channelDoc = firestore().collection('channels').doc(channelId);
    const offerCandidates = channelDoc.collection('offerCandidates');
    const answerCandidates = channelDoc.collection('answerCandidates');

    pc.current.onicecandidate = async (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.info('Join - OnIceCandidate', event.candidate.toJSON());
        await answerCandidates.add(event.candidate.toJSON());
      }
    };

    const channelDocument = await channelDoc.get();
    const channelData = channelDocument.data();

    const offerDescription = channelData?.offer;
    console.info('Join - offerDescription', offerDescription);

    await pc.current.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await pc.current.createAnswer();
    console.info('Join - answerDescription', answerDescription);

    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    console.info('Join - answer', answer);

    await channelDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          console.info('Join - IceCandidate', data);
          pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  return (
    <View style={styles.rootContainer}>
      <View style={styles.content}>
        {!isWebcamStarted && (
          <View style={styles.startWebcamContainer}>
            <TouchableOpacity style={styles.startWebcam} onPress={startWebcam}>
              <Text style={styles.startWebcamText}>Start</Text>
            </TouchableOpacity>
          </View>
        )}

        {localStream && (
          <RTCView
            streamURL={localStream?.toURL()}
            style={styles.rtc}
            objectFit="cover"
            mirror
          />
        )}

        {remoteStream && (
          <RTCView
            streamURL={remoteStream?.toURL()}
            style={styles.rtc}
            objectFit="cover"
            mirror
          />
        )}
      </View>

      <View style={styles.footer}>
        {isWebcamStarted && (
          <>
            <Button title="Start call" onPress={startCall} />

            <Text
              style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}
            >
              Or
            </Text>

            <View style={{ flexDirection: 'row' }}>
              <TextInput
                value={channelId || ''}
                placeholder="Enter Call ID to join"
                style={{ borderWidth: 1, padding: 5, flex: 1 }}
                onChangeText={(newText) => setChannelId(newText)}
              />
              <Button title="Join call" onPress={joinCall} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  startWebcamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startWebcam: {
    borderWidth: 3,
    borderColor: '#2f79e0',
    borderRadius: 100,
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startWebcamText: {
    color: '#2f79e0',
    fontSize: 22,
  },
  content: {
    flex: 15,
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  rtc: {
    flex: 1,
  },
  footer: {
    flex: 1,
    flexDirection: 'column',
    padding: 12,
    marginBottom: 48,
  },
});
