const RTCPeerConnection = (
  window.RTCPeerConnection ||
  (window as any).webkitRTCPeerConnection ||
  (window as any).mozRTCPeerConnection
).bind(window);

export function getPeerConnection(options: { onStream: (stream: MediaStream) => void }) {
  const { onStream } = options;
  let peerConnection: RTCPeerConnection | undefined;
  let streamId: string | undefined;
  let sessionId: string | undefined;
  let sessionClientAnswer: RTCSessionDescriptionInit | undefined;

  async function connect() {
    if (peerConnection && peerConnection.connectionState === 'connected') {
      return;
    }

    const sessionResponse = await fetch(`https://api.d-id.com/talks/streams`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${process.env.DID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: 400,
        source_url: 'https://i.ibb.co/L0KMV1Y/Leonardo-Diffusion-an-cyberpunk-hacker-cartoon-style-looking-i-0.jpg',
      }),
    });

    const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json();
    streamId = newStreamId;
    sessionId = newSessionId;

    try {
      sessionClientAnswer = await createPeerConnection(offer, iceServers);
    } catch (e) {
      console.log('error during streaming setup', e);
      closePC();
      throw e;
    }

    const sdpResponse = await fetch(`https://api.d-id.com/talks/streams/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${process.env.DID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer: sessionClientAnswer,
        session_id: sessionId,
      }),
    });
  }

  async function talk(content: string) {
    // connectionState not supported in firefox
    if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
      const talkResponse = await fetch(`https://api.d-id.com/talks/streams/${streamId}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${process.env.DID_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: {
            type: 'text',
            input: content,
            provider: {
              type: 'microsoft',
              voice_id: 'en-US-TonyNeural',
            },
          },
          driver_url: 'bank://lively/',
          config: {
            stitch: true,
          },
          session_id: sessionId,
        }),
      });

      return talkResponse;
    }
  }

  async function destory() {
    await fetch(`https://api.d-id.com/talks/streams/${streamId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${process.env.DID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    closePC();
  }

  function onIceGatheringStateChange() {}

  function onIceCandidate(event: any) {
    console.log('onIceCandidate', event);
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

      fetch(`https://api.d-id.com/talks/streams/${streamId}/ice`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${process.env.DID_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId,
        }),
      });
    }
  }

  function onIceConnectionStateChange() {
    if (
      peerConnection &&
      (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed')
    ) {
      closePC();
    }
  }

  function onConnectionStateChange() {}
  function onSignalingStateChange() {}

  function onTrack(event: any) {
    const remoteStream = event.streams[0];
    console.log('onTrack', event);
    onStream(remoteStream);
  }

  async function createPeerConnection(offer: RTCSessionDescriptionInit, iceServers: RTCIceServer[]) {
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({ iceServers });
      peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
      peerConnection.addEventListener('icecandidate', onIceCandidate, true);
      peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
      peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
      peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
      peerConnection.addEventListener('track', onTrack, true);
    }

    await peerConnection.setRemoteDescription(offer);
    console.log('set remote sdp OK');

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log('create local sdp OK');

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log('set local sdp OK');

    return new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
      function connectionStateListener() {
        console.log('peerConnection.connectionState', peerConnection?.connectionState, peerConnection?.signalingState);
        if (
          peerConnection &&
          (peerConnection.connectionState === 'connected' || peerConnection.signalingState === 'stable')
        ) {
          peerConnection.removeEventListener('iceconnectionstatechange', connectionStateListener, true);
          resolve(sessionClientAnswer);
        }
      }

      if (peerConnection) {
        peerConnection.addEventListener('iceconnectionstatechange', connectionStateListener, true);
      }
    });
  }

  function closePC(pc = peerConnection) {
    if (!pc) return;
    console.log('stopping peer connection');
    pc.close();
    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    pc.removeEventListener('icecandidate', onIceCandidate, true);
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
    pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
    pc.removeEventListener('track', onTrack, true);

    console.log('stopped peer connection');
  }

  return {
    peerConnection,
    streamId,
    sessionId,
    sessionClientAnswer,
    destory,
    connect,
    talk,
  };
}
