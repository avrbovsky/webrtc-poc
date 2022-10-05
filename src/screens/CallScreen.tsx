import { View, Text, Button, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';

export default function CallScreen() {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const start = async () => {
    if (!stream) {
      let s;
      try {
        s = await mediaDevices.getUserMedia({ video: true });
        setStream(s);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const stop = () => {
    if (stream) {
      stream.release();
      setStream(null);
    }
  };

  return (
    <View style={styles.rootContainer}>
      <View style={styles.content}>
        {stream ? (
          <RTCView streamURL={stream.toURL()} style={styles.rtc} />
        ) : (
          <Text style={styles.text}>Press START for video streaming</Text>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.button}>
          <Button title="Start" onPress={start} />
        </View>
        <View style={styles.button}>
          <Button title="Stop" onPress={stop} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  content: {
    flex: 15,
    justifyContent: 'center',
  },
  rtc: {
    flex: 1,
  },
  text: {
    color: '#333',
    textAlign: 'center',
  },
  button: {
    width: '45%',
  },
  footer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 12,
  },
});
