import React, { useCallback, useEffect, useRef, useState } from 'react';
import { render } from 'react-dom';
import { css, cx } from '@linaria/core';
import './style';
import bg from './public/bg.png';
import idleVideo from './public/idle.mp4';
import { Button, Input, Space } from 'antd';
import { useAction } from './hooks/useAction';
import { getPeerConnection } from './peerConnection';

const defaultMessages = [
  {
    role: 'user',
    content:
      'You are not an AI. You are a 32-year-old male called Johnny, have been engaged in front-end development for 9 years, and living in Guangdong China. You are working on a company called Automata, which is a startup company focused on blockchain technology. You have a wife but no children for now. Now play this role and chat with me.',
  },
];

const Main: React.FC = () => {
  const ref = useRef<HTMLVideoElement>(null);
  const idleVideoRef = useRef<HTMLVideoElement>(null);

  const [content, setContent] = useState('');
  const [inited, setInited] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<
    { duration: number; message: { timestamp: string; role: string; content: string } } | undefined
  >();
  const [messageList, setMessageList] = useState<{ timestamp: string; role: string; content: string }[]>([]);

  const { triggerer: connect, loading: connecting, result: connectionResult } = useAction(connectToDID);

  const { triggerer: sendMessage, loading: sendingMessage } = useAction(sendMessageToChatGPT);

  useEffect(() => {
    let timer: any;

    if (!isMute) {
      if (inited) {
        setIsPlaying(true);
      }
    } else {
      timer = setTimeout(() => {
        setIsPlaying(false);
        if (idleVideoRef.current && idleVideoRef.current.paused) {
          idleVideoRef.current.play();
        }
      }, 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isMute, inited, setIsPlaying]);

  useEffect(() => {
    if (isPlaying && pendingMessage) {
      setMessageList(messageList.concat([pendingMessage.message]));
      setPendingMessage(undefined);

      // setTimeout(() => {
      //   setIsPlaying(false);
      //   if (idleVideoRef.current && idleVideoRef.current.paused) {
      //     idleVideoRef.current.play();
      //   }
      // }, pendingMessage.duration * 1000);
    }
  }, [isPlaying, pendingMessage, setPendingMessage, messageList, setMessageList, setIsPlaying]);

  const handleUnmute = useCallback(() => {
    console.log('handleUnmute');
    setIsMute(false);
  }, [setIsMute]);

  const handleMute = useCallback(() => {
    console.log('handleMute');
    setIsMute(true);
  }, [setIsMute]);

  function send() {
    if (connectionResult) {
      setContent('');
      setInited(true);
      sendMessage({ content, messageList, setMessageList, setPendingMessage, connectionResult });
    }
  }

  return (
    <div className={styleContainer}>
      <div className={styleAvatarContainer}>
        <div className={styleAvatar}>
          <video ref={ref} className={styleVideo} playsInline autoPlay></video>
          <video
            ref={idleVideoRef}
            className={cx(styleVideo, isPlaying ? styleTransparent : undefined)}
            src={idleVideo}
            loop
            autoPlay
            playsInline></video>
        </div>
      </div>
      <div className={styleChatList}>
        {messageList.map((item) => {
          return (
            <div key={item.timestamp} className={cx(styleMessage, item.role === 'user' ? styleUserMessage : undefined)}>
              {item.content}
            </div>
          );
        })}
        {pendingMessage ? (
          <div className={styleMessage}>
            <div className={styleLoadingIconWrapper}>
              <div className={styleLoadingIcon}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {!connectionResult ? (
        <Button
          className={styleButton}
          size="large"
          type="primary"
          loading={connecting}
          onClick={() => {
            if (idleVideoRef.current && idleVideoRef.current.paused) {
              idleVideoRef.current.play();
            }

            connect({
              onStream: (stream) => {
                if (ref.current) {
                  ref.current.srcObject = stream;

                  const videoTrack = stream.getTracks().find((item) => item.kind === 'video');

                  if (videoTrack) {
                    videoTrack.addEventListener('mute', handleMute);
                    videoTrack.addEventListener('unmute', handleUnmute);
                  }

                  // if (ref.current.paused) {
                  //   ref.current.play();
                  // }
                }
              },
            });
          }}>
          Get started to chat
        </Button>
      ) : (
        <div className={styleInputContainer}>
          <Space.Compact block>
            <Input
              disabled={isPlaying && inited}
              size="large"
              value={content}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  send();
                }
              }}
              onChange={(e) => {
                setContent(e.target.value);
              }}
            />
            <Button
              disabled={isPlaying && inited}
              type="primary"
              size="large"
              loading={sendingMessage}
              onClick={() => {
                send();
              }}>
              Send
            </Button>
          </Space.Compact>
        </div>
      )}
    </div>
  );
};

async function connectToDID(data: { onStream: (stream: MediaStream) => void }) {
  const { onStream } = data;

  const peerConnection = getPeerConnection({
    onStream,
  });

  await peerConnection.connect();

  return peerConnection;
}

async function sendMessageToChatGPT(data: {
  content: string;
  messageList: {
    timestamp: string;
    role: string;
    content: string;
  }[];
  connectionResult: ReturnType<typeof getPeerConnection>;
  setMessageList: React.Dispatch<
    React.SetStateAction<
      {
        timestamp: string;
        role: string;
        content: string;
      }[]
    >
  >;
  setPendingMessage: React.Dispatch<
    React.SetStateAction<
      | {
          duration: number;
          message: {
            timestamp: string;
            role: string;
            content: string;
          };
        }
      | undefined
    >
  >;
}) {
  const { content, messageList, connectionResult, setMessageList, setPendingMessage } = data;

  const newMessageList = messageList.concat([{ timestamp: `${Date.now()}`, role: 'user', content }]);

  setMessageList(newMessageList);

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHATGPT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      temperature: 1.2,
      messages: defaultMessages.concat(newMessageList.map((item) => ({ role: item.role, content: item.content }))),
    }),
  });

  const respJSON = await resp.json();

  const respMessage = respJSON?.choices && respJSON?.choices[0] && respJSON?.choices[0].message;

  if (resp.status === 200 && respMessage) {
    const talkResp = await connectionResult.talk(respMessage.content);

    if (talkResp?.status === 200) {
      const talkRespJSON = await talkResp.json();

      if (talkRespJSON.duration) {
        setPendingMessage({ duration: talkRespJSON.duration, message: { timestamp: `${Date.now()}`, ...respMessage } });
      }
    }
  }
}

const styleContainer = css`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const styleAvatarContainer = css`
  background-image: url(${bg});
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
`;

const styleAvatar = css`
  position: relative;
  margin: 0 auto;
  height: 200px;
  width: 200px;
  background-color: #fff;
  border-radius: 50%;
`;

const styleVideo = css`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
`;

const styleChatList = css`
  flex-grow: 1;
  width: 60%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
`;

const styleButton = css`
  width: 500px;
  margin: 0 auto;
`;

const styleMessage = css`
  max-width: 85%;
  padding: 8px;
  box-sizing: border-box;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.2em;
  background-color: rgb(241, 242, 246);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 10px;
  align-self: flex-start;
`;

const styleUserMessage = css`
  color: #fff;
  background-color: #1677ff;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 4px;
  align-self: flex-end;
`;

const styleInputContainer = css`
  width: 60%;
  margin: 0 auto;
`;

const styleTransparent = css`
  opacity: 0;
`;

const styleLoadingIconWrapper = css`
  width: 20px;
  height: 20px;
`;

const styleLoadingIcon = css`
  display: inline-block;
  position: relative;
  width: 80px;
  height: 80px;
  transform: scale(0.25);
  transform-origin: left top;

  & div {
    position: absolute;
    top: 33px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #888;
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }

  & div:nth-child(1) {
    left: 8px;
    animation: lds-ellipsis1 0.6s infinite;
  }

  & div:nth-child(2) {
    left: 8px;
    animation: lds-ellipsis2 0.6s infinite;
  }

  & div:nth-child(3) {
    left: 32px;
    animation: lds-ellipsis2 0.6s infinite;
  }

  & div:nth-child(4) {
    left: 56px;
    animation: lds-ellipsis3 0.6s infinite;
  }

  @keyframes lds-ellipsis1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes lds-ellipsis3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }

  @keyframes lds-ellipsis2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(24px, 0);
    }
  }
`;

function init() {
  const rootElement = document.getElementById('container');

  render(<Main />, rootElement);
}

init();
