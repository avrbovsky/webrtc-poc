import {
  View,
  Text,
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
  MediaStreamTrack,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import Button from '../components/Button';

const ICE_SERVER_URLS = [
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
];

const peerConnectionConfig = {
  iceServers: [
    {
      urls: ICE_SERVER_URLS,
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(peerConnectionConfig);

type Offer = Pick<RTCSessionDescription, 'sdp' | 'type'>;
type Answer = Pick<RTCSessionDescription, 'sdp' | 'type'>;
type Channel = {
  offer: Offer;
  answer?: Answer;
};

type CallMode = 'create' | 'join';

export default function CallScreen() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  const [isWebcamStarted, setIsWebcamStarted] = useState(false);

  const initCall = async (mode: CallMode) => {
    const _localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    const _remoteStream = new MediaStream(undefined);

    localStream?.getTracks().forEach((track) => {
      pc.addTrack(track);
    });

    pc.ontrack = (e: RTCTrackEvent) => {
      e.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
        _remoteStream.addTrack(track);
      });
    };

    setLocalStream(_localStream);
    setRemoteStream(_remoteStream);

    setIsWebcamStarted(true);

    if (mode === 'create') {
      createCall();
    } else if (mode === 'join' && channelId !== null) {
      joinToCall(channelId);
    }
  };

  const createCall = async () => {
    const channelDoc = firestore().collection<Channel>('channels').doc();
    const offerCandidates = channelDoc.collection('offerCandidates');
    const answerCandidates = channelDoc.collection('answerCandidates');

    setChannelId(channelDoc.id);

    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        offerCandidates.add(e.candidate.toJSON());
      }
    };

    const offerDescription = (await pc.createOffer(
      undefined
    )) as RTCSessionDescription;

    await pc.setLocalDescription(offerDescription);

    const offer: Offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await channelDoc.set({ offer });

    channelDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const joinToCall = async (channelId: string) => {
    const callDoc = firestore().collection<Channel>('channels').doc(channelId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        answerCandidates.add(e.candidate.toJSON());
      }
    };

    const callData = (await callDoc.get()).data();
    const offerDescription = callData?.offer;

    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription =
      (await pc.createAnswer()) as RTCSessionDescription;
    await pc.setLocalDescription(answerDescription);

    const answer: Answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        hangUp();
      }
    };
  };

  const hangUp = async () => {
    pc.close();

    if (channelId) {
      const channelDoc = firestore().collection('channels').doc(channelId);

      await channelDoc
        .collection('answerCandidates')
        .get()
        .then((answerCandidates) =>
          answerCandidates.forEach((doc) => doc.ref.delete())
        );

      await channelDoc
        .collection('offerCandidates')
        .get()
        .then((offerCandidates) =>
          offerCandidates.forEach((doc) => doc.ref.delete())
        );

      await channelDoc.delete();
    }
  };

  return (
    <View style={styles.rootContainer}>
      <View style={styles.content}>
        {!isWebcamStarted && (
          <View style={styles.buttons}>
            <Button
              text="Create Call"
              size="xl"
              onPress={() => initCall('create')}
            />

            <Button
              text="Join Call"
              size="xl"
              style={styles.joinButton}
              isDisabled={!channelId || channelId === ''}
              onPress={() => initCall('join')}
            />

            <TextInput
              value={channelId || ''}
              placeholder="Enter channel ID to Join Call."
              style={styles.input}
              onChangeText={(newText) => setChannelId(newText)}
            />
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

      {localStream && (
        <View style={styles.footer}>
          <TextInput
            value={channelId || ''}
            onChangeText={(newText) => setChannelId(newText)}
          />

          <Button
            text={`Hang\nup`}
            variant="danger"
            size="sm"
            onPress={hangUp}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  buttons: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButton: {
    marginTop: 50,
    marginBottom: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: '#2f79e0',
    width: '75%',
    maxWidth: 300,
    padding: 7,
    borderRadius: 12,
  },
  rtc: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    // height: 150,
    width: '100%',
    backgroundColor: 'white',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
