import { useRef, useState } from "react";
import type Peer from "simple-peer";

type PeerWithConnection = Peer.Instance & {
  _pc?: RTCPeerConnection | null;
};

type PeerRefEntry = {
  peer: PeerWithConnection;
};

export const useScreenShare = (
  myStreamRef: React.MutableRefObject<MediaStream | null>,
  peersRef: React.MutableRefObject<Map<string, PeerRefEntry>>
) => {
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace camera track with screen track in all peer connections
      peersRef.current.forEach(({ peer }) => {
        const sender = peer._pc?.getSenders?.().find((s: RTCRtpSender) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      setIsSharing(true);

      // When user stops sharing via browser's native button
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Restore camera track
    if (myStreamRef.current) {
      const camTrack = myStreamRef.current.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        const sender = peer._pc?.getSenders?.().find((s: RTCRtpSender) => s.track?.kind === "video");
        if (sender && camTrack) sender.replaceTrack(camTrack);
      });
    }

    setIsSharing(false);
  };

  const toggleScreenShare = () => isSharing ? stopScreenShare() : startScreenShare();

  return { isSharing, toggleScreenShare };
};