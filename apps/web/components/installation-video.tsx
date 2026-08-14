"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function InstallationVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasEnteredView = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasEnteredView.current) {
          if (!hasEnteredView.current) video.pause();
          return;
        }

        hasEnteredView.current = true;
        video.currentTime = 0;
        video.play().catch(() => setIsPlaying(false));
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  async function replay() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    await video.play();
    setIsPlaying(true);
  }

  return (
    <figure className="installation-film" aria-label="TailHome installation walkthrough">
      <div className="installation-film-frame">
        <video
          ref={videoRef}
          className="installation-film-video"
          loop
          muted
          playsInline
          preload="metadata"
          poster="/videos/tailhome-install-poster.jpg"
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        >
          <source src="/videos/tailhome-install.webm" type="video/webm" />
          <source src="/videos/tailhome-install.mp4" type="video/mp4" />
        </video>
        <div className="installation-film-controls">
          <button type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause installation video" : "Play installation video"}>
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button type="button" onClick={replay} aria-label="Replay installation video">
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </div>
      <figcaption><span>24 second walkthrough</span><strong>Command → setup → running services</strong></figcaption>
    </figure>
  );
}
