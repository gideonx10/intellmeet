import { useRef, useState } from "react";
import type Peer from "simple-peer";

type PeerRefEntry = {
  peer: Peer.Instance;
};

export const useScreenShare = (peersRef: React.MutableRefObject<Map<string, PeerRefEntry>>) => {
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      setScreenStream(screenStream);
      const screenTrack = screenStream.getVideoTracks()[0];

      // Add the screen as its own additional stream on each connection — this is completely
      // independent of the camera track (whatever its enabled state) rather than hijacking the
      // camera's video sender, so toggling the camera on/off has zero effect on screen share and
      // vice versa. simple-peer renegotiates automatically through the existing signal relay.
      peersRef.current.forEach(({ peer }) => {
        if (!peer.destroyed) peer.addStream(screenStream);
      });

      setIsSharing(true);

      // When user stops sharing via the browser's native "Stop sharing" button
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = async () => {
    const stream = screenStreamRef.current;
    if (stream) {
      peersRef.current.forEach(({ peer }) => {
        if (!peer.destroyed) {
          try {
            peer.removeStream(stream);
          } catch {
            // Peer connection may already be tearing down (e.g. remote left mid-share) — fine to ignore.
          }
        }
      });
      stream.getTracks().forEach((t) => t.stop());
    }

    screenStreamRef.current = null;
    setScreenStream(null);
    setIsSharing(false);
  };

  const toggleScreenShare = () => (isSharing ? stopScreenShare() : startScreenShare());

  return { isSharing, screenStream, toggleScreenShare };
};
